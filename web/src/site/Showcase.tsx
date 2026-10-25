import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

export interface Slide {
  id: string;
  title: string;
  text: string;
  /** The picture in the carousel: an <img> (inside a link to the full-size picture) or an illustration. */
  visual: ReactNode;
  /** The same picture, bigger, shown in the overlay when the visitor clicks the picture. */
  zoom: ReactNode;
}

/** How long each slide stays before the next one slides in. */
export const AUTOPLAY_MS = 3000;

const noopSubscribe = () => () => {};

/** True once the page runs in a browser (false while the page is rendered to static HTML and during hydration). */
function useEnhanced(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** People who asked their system for less motion get the same slide show, but the slides change without sliding. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia?.(REDUCED_MOTION);
      query?.addEventListener('change', notify);
      return () => query?.removeEventListener('change', notify);
    },
    () => window.matchMedia?.(REDUCED_MOTION).matches ?? false,
    () => false,
  );
}

type IconName = 'close' | 'previous' | 'next' | 'pause' | 'play' | 'enlarge';

const ICON_PATHS: Record<IconName, string> = {
  close: 'M6 6l12 12M18 6L6 18',
  previous: 'M15.5 5l-7 7 7 7',
  next: 'M8.5 5l7 7-7 7',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  play: 'M8 5.5l10.5 6.5L8 18.5z',
  enlarge: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
};

/** A button symbol drawn as a shape (not as a text character), so it is exactly in the middle of its round button. */
function Icon(props: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[props.name]} fill={props.name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A picture in a full-screen overlay (a native modal dialog: Esc closes it and the keyboard focus stays inside). */
function Lightbox(props: { slides: Slide[]; index: number; onStep: (delta: number) => void; onClose: () => void }) {
  const { slides, index, onStep, onClose } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const slide = slides[index];

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'ArrowRight') onStep(1);
    else if (event.key === 'ArrowLeft') onStep(-1);
  };

  // A click on the dark area around the picture closes the overlay; a click on the picture or the buttons does not.
  const onBackdropClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || target.classList.contains('lightbox-stage') || target.classList.contains('lightbox-inner')) onClose();
  };

  if (!slide) return null;
  return (
    <dialog ref={dialog} className="lightbox" aria-label={slide.title} onClose={onClose} onKeyDown={onKeyDown} onClick={onBackdropClick}>
      <div className="lightbox-inner" onClick={onBackdropClick}>
        <button type="button" className="lightbox-close" aria-label="Close the large picture" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div className="lightbox-stage" onClick={onBackdropClick}>
          <button type="button" className="lightbox-step lightbox-prev" aria-label="Previous picture" onClick={() => onStep(-1)}>
            <Icon name="previous" />
          </button>
          {slide.zoom}
          <button type="button" className="lightbox-step lightbox-next" aria-label="Next picture" onClick={() => onStep(1)}>
            <Icon name="next" />
          </button>
        </div>
        <p className="lightbox-caption">
          <strong>{slide.title}</strong> <span>{slide.text}</span>
        </p>
      </div>
    </dialog>
  );
}

/**
 * A slide show of pictures with captions. It is plain HTML and CSS first (a row of slides that scrolls and snaps, so it works
 * without JavaScript, with a swipe, and every caption is in the page for search engines; each picture is a link to the big
 * version). After the page has loaded it adds previous / next buttons, dots, an automatic slide show (with a pause button) and
 * a full-screen overlay for the pictures.
 */
export function Showcase(props: { slides: Slide[]; label: string }) {
  const { slides, label } = props;
  const enhanced = useEnhanced();
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const current = useRef(0);
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [holding, setHolding] = useState(false);
  const [visible, setVisible] = useState(false);
  const [zoomed, setZoomed] = useState<number | null>(null);
  const count = slides.length;

  const goTo = useCallback(
    (target: number) => {
      const element = track.current;
      if (!element) return;
      const next = (target + count) % count;
      element.scrollTo({ left: next * element.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
    },
    [count, reducedMotion],
  );

  // Which slide is showing: follows swipes, scrolling and the buttons.
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.round(element.scrollLeft / Math.max(1, element.clientWidth));
        current.current = next;
        setIndex(next);
      });
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Only run the automatic slide show while some of the picture is on screen.
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const running = enhanced && autoplay && visible && !holding && zoomed === null;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => goTo(current.current + 1), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [running, goTo]);

  const stopAndGo = (target: number) => {
    setAutoplay(false);
    goTo(target);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stopAndGo(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stopAndGo(index - 1);
    }
  };

  // A click on a picture (or on its link) opens the overlay instead of the plain image file.
  const onPictureClick = (event: MouseEvent<HTMLElement>, slideIndex: number) => {
    event.preventDefault();
    setZoomed(slideIndex);
  };

  const step = (delta: number) => {
    setZoomed((value) => (value === null ? null : (value + delta + count) % count));
  };

  return (
    <section ref={root} className="showcase" aria-roledescription="carousel" aria-label={label}>
      <div className="showcase-viewport">
        <div
          ref={track}
          className="showcase-track"
          tabIndex={0}
          aria-label={`${label}: use the left and right arrow keys to change the slide`}
          onKeyDown={onKeyDown}
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
        >
          {slides.map((slide, i) => (
            <div key={slide.id} className="showcase-slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              <figure>
                <div className="showcase-visual" onClick={(event) => onPictureClick(event, i)}>
                  {slide.visual}
                </div>
                <figcaption>
                  <strong>{slide.title}</strong>
                  <span>{slide.text}</span>
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      </div>
      {enhanced && (
        <div className="showcase-controls">
          <button type="button" className="showcase-button" aria-label="Previous slide" onClick={() => stopAndGo(index - 1)}>
            <Icon name="previous" />
          </button>
          <div className="showcase-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className="showcase-dot"
                aria-label={`Show slide ${i + 1}: ${slide.title}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => stopAndGo(i)}
              />
            ))}
          </div>
          <button type="button" className="showcase-button" aria-label="Next slide" onClick={() => stopAndGo(index + 1)}>
            <Icon name="next" />
          </button>
          <button
            type="button"
            className="showcase-button showcase-play"
            aria-label={autoplay ? 'Pause the automatic slide show' : 'Start the automatic slide show'}
            onClick={() => setAutoplay((value) => !value)}
          >
            <Icon name={autoplay ? 'pause' : 'play'} />
          </button>
          <button type="button" className="showcase-button showcase-enlarge" aria-label="Enlarge this picture" onClick={() => setZoomed(index)}>
            <Icon name="enlarge" />
          </button>
        </div>
      )}
      {zoomed !== null && <Lightbox slides={slides} index={zoomed} onStep={step} onClose={() => setZoomed(null)} />}
    </section>
  );
}
