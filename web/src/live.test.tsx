import type { Unchanged } from '@ctd/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLive, type LiveOptions } from './live';

interface Data {
  version: number;
  text: string;
}

type Fetcher = (since: number | undefined) => Promise<Data | Unchanged>;

let refreshNow: () => void = () => undefined;
const expose = (fn: () => void) => {
  refreshNow = fn;
};

function Probe(props: { fetch: Fetcher; options?: Partial<LiveOptions<Data>>; keyName?: string }) {
  const live = useLive<Data>({
    key: props.keyName ?? 'a',
    fetch: props.fetch,
    versionOf: (d) => d.version,
    intervalMs: 20,
    hiddenIntervalMs: 20,
    maxBackoffMs: 40,
    ...props.options,
  });
  const { refresh } = live;
  useEffect(() => {
    expose(refresh);
  }, [refresh]);
  return (
    <div>
      <p data-testid="text">{live.data?.text ?? 'none'}</p>
      <p data-testid="offline">{String(live.offline)}</p>
    </div>
  );
}

const text = () => screen.getByTestId('text').textContent;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLive', () => {
  it('loads once without a version, then polls with the version it has', async () => {
    const fetcher = vi.fn<Fetcher>(async (since) =>
      since === 1 ? { unchanged: true, version: 1 } : { version: 1, text: 'first' },
    );
    render(<Probe fetch={fetcher} />);
    await waitFor(() => expect(text()).toBe('first'));
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(3));
    expect(fetcher.mock.calls[0]?.[0]).toBeUndefined();
    expect(fetcher.mock.calls.slice(1).every(([since]) => since === 1)).toBe(true);
  });

  it('shows new data as soon as the server reports a new version', async () => {
    let current: Data = { version: 1, text: 'one' };
    const fetcher: Fetcher = async (since) => (since === current.version ? { unchanged: true, version: since } : current);
    render(<Probe fetch={fetcher} />);
    await waitFor(() => expect(text()).toBe('one'));

    current = { version: 2, text: 'two' };
    await waitFor(() => expect(text()).toBe('two'));
  });

  it('refresh() reloads immediately, ignoring the version', async () => {
    const fetcher = vi.fn<Fetcher>(async (since) =>
      since === undefined ? { version: 1, text: 'full' } : { unchanged: true, version: since },
    );
    render(<Probe fetch={fetcher} options={{ intervalMs: 5000, hiddenIntervalMs: 5000 }} />);
    await waitFor(() => expect(text()).toBe('full'));
    const callsBefore = fetcher.mock.calls.length;

    act(() => refreshNow());
    await waitFor(() => expect(fetcher.mock.calls.length).toBe(callsBefore + 1));
    expect(fetcher.mock.calls.at(-1)?.[0]).toBeUndefined();
  });

  it('keeps the data and reports offline during an outage, then recovers', async () => {
    let failing = false;
    const fetcher: Fetcher = async (since) => {
      if (failing) throw new Error('network down');
      return since === 1 ? { unchanged: true, version: 1 } : { version: 1, text: 'data' };
    };
    render(<Probe fetch={fetcher} />);
    await waitFor(() => expect(text()).toBe('data'));

    failing = true;
    await waitFor(() => expect(screen.getByTestId('offline').textContent).toBe('true'));
    expect(text()).toBe('data');

    failing = false;
    await waitFor(() => expect(screen.getByTestId('offline').textContent).toBe('false'));
  });

  it('stops polling after a fatal error and reports it once', async () => {
    const fatal = new Error('game ended');
    const onFatal = vi.fn();
    const fetcher = vi.fn<Fetcher>(async () => {
      throw fatal;
    });
    render(<Probe fetch={fetcher} options={{ isFatal: (e) => e === fatal, onFatal }} />);
    await waitFor(() => expect(onFatal).toHaveBeenCalledWith(fatal));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onFatal).toHaveBeenCalledTimes(1);
  });

  it('does a full reload now and then even when the server keeps saying "unchanged"', async () => {
    const fetcher = vi.fn<Fetcher>(async (since) =>
      since === undefined ? { version: 1, text: 'full' } : { unchanged: true, version: since },
    );
    render(<Probe fetch={fetcher} options={{ fullRefreshMs: 80 }} />);
    await waitFor(() => expect(fetcher.mock.calls.filter(([since]) => since === undefined).length).toBeGreaterThanOrEqual(2));
  });

  it('stops polling when the component goes away', async () => {
    const fetcher = vi.fn<Fetcher>(async () => ({ version: 1, text: 'x' }));
    const { unmount } = render(<Probe fetch={fetcher} />);
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    unmount();
    const calls = fetcher.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetcher.mock.calls.length).toBe(calls);
  });

  it('starts over when the key changes', async () => {
    const fetcher: Fetcher = async () => ({ version: 1, text: 'data' });
    const { rerender } = render(<Probe fetch={fetcher} keyName="a" />);
    await waitFor(() => expect(text()).toBe('data'));

    const slow: Fetcher = () => new Promise(() => undefined);
    rerender(<Probe fetch={slow} keyName="b" />);
    expect(text()).toBe('none');
  });
});
