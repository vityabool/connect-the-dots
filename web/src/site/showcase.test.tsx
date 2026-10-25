import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOPLAY_MS, Showcase, type Slide } from './Showcase';

const picture = (id: string, alt: string): Pick<Slide, 'visual' | 'zoom'> => ({
  visual: (
    <a className="showcase-link" href={`/screens/${id}-full.webp`}>
      <img src={`/screens/${id}.webp`} alt={alt} width={1600} height={1000} />
    </a>
  ),
  zoom: <img src={`/screens/${id}-full.webp`} alt={alt} width={3200} height={2000} />,
});

const SLIDES: Slide[] = [
  { id: 'a', title: 'First', text: 'The first picture.', ...picture('a', 'A first picture') },
  { id: 'b', title: 'Second', text: 'The second picture.', ...picture('b', 'A second picture') },
  { id: 'c', title: 'Third', text: 'The third picture.', ...picture('c', 'A third picture') },
];

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe('Showcase', () => {
  let container: HTMLElement;
  let root: Root;
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 500 });
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  function mount() {
    root = createRoot(container);
    act(() => root.render(<Showcase slides={SLIDES} label="Pictures" />));
  }

  const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  it('is plain HTML first: every slide, caption and picture is in the page, each picture links to the big version, and no buttons need JavaScript', () => {
    const html = renderToString(<Showcase slides={SLIDES} label="Pictures" />);
    for (const slide of SLIDES) {
      expect(html).toContain(slide.title);
      expect(html).toContain(slide.text);
    }
    expect(html).toContain('alt="A third picture"');
    expect(html).toContain('href="/screens/c-full.webp"');
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<dialog');
  });

  it('adds buttons and dots in the browser, and the next button scrolls one slide', () => {
    mount();
    expect(container.querySelectorAll('.showcase-dot')).toHaveLength(3);
    expect(container.querySelector('.showcase-dot[aria-current="true"]')?.getAttribute('aria-label')).toContain('First');

    act(() => button('Next slide')?.click());
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 500 }));

    // From the first slide, "previous" wraps around to the last one.
    act(() => button('Previous slide')?.click());
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 1000 }));
  });

  it('changes the slide by itself every 3 seconds while it is on screen, and stops when someone uses a control', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
        observe() {
          this.callback([{ isIntersecting: true }]);
        }
        disconnect() {}
      },
    );
    expect(AUTOPLAY_MS).toBe(3000);
    mount();
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_MS);
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 500 }));
    expect(container.querySelector('.showcase-play')?.getAttribute('aria-label')).toContain('Pause');

    act(() => button('Next slide')?.click());
    const calls = scrollTo.mock.calls.length;
    expect(container.querySelector('.showcase-play')?.getAttribute('aria-label')).toContain('Start');
    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_MS * 3);
    });
    expect(scrollTo).toHaveBeenCalledTimes(calls);
  });

  it('does not start by itself while the carousel is off screen', () => {
    vi.useFakeTimers();
    mount(); // no IntersectionObserver in jsdom: nothing reports the picture as visible
    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_MS * 3);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('opens the picture in an overlay when it is clicked, steps through the pictures and closes', () => {
    mount();
    expect(container.querySelector('dialog')).toBeNull();

    // A click on the picture's link opens the overlay and does not follow the link.
    const link = container.querySelectorAll<HTMLAnchorElement>('.showcase-link')[1];
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => {
      link?.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(dialog?.getAttribute('aria-label')).toBe('Second');
    expect(dialog?.querySelector('img')?.getAttribute('src')).toBe('/screens/b-full.webp');

    act(() => dialog?.querySelector<HTMLButtonElement>('button[aria-label="Next picture"]')?.click());
    expect(container.querySelector('dialog img')?.getAttribute('src')).toBe('/screens/c-full.webp');
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Next picture"]')?.click());
    expect(container.querySelector('dialog img')?.getAttribute('src')).toBe('/screens/a-full.webp'); // wraps around

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Close the large picture"]')?.click());
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('opens the overlay from the enlarge button, and a click on the dark area closes it', () => {
    mount();
    act(() => button('Enlarge this picture')?.click());
    expect(container.querySelector('dialog img')?.getAttribute('src')).toBe('/screens/a-full.webp');

    // A click on the picture itself keeps it open ...
    act(() => container.querySelector<HTMLElement>('dialog img')?.click());
    expect(container.querySelector('dialog')).not.toBeNull();
    // ... a click next to it closes it.
    act(() => container.querySelector<HTMLElement>('.lightbox-stage')?.click());
    expect(container.querySelector('dialog')).toBeNull();
  });
});
