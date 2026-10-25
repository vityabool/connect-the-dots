import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { clearSession } from './play/session';

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Start page', () => {
  it('is the landing page, with the 6-digit game code form on it', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn a room full of colleagues into a human network');
    expect(screen.getByLabelText('Game code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
  });

  it('prefills the code from a join link', () => {
    renderAt('/join/123456');
    expect(screen.getByLabelText('Game code')).toHaveValue('123456');
    expect(screen.getByRole('button', { name: 'Join' })).toBeEnabled();
  });

  it('links to the facilitator area', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Facilitator sign-in' })).toHaveAttribute('href', '/admin');
  });

  it('shows the public pages and a not-found page', () => {
    const { unmount } = renderAt('/privacy');
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument();
    unmount();
    const second = renderAt('/terms');
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of service' })).toBeInTheDocument();
    second.unmount();
    const third = renderAt('/how-to-play');
    expect(screen.getByRole('heading', { level: 1, name: 'How to play Connect the Dots' })).toBeInTheDocument();
    third.unmount();
    renderAt('/this-page-does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'This page does not exist' })).toBeInTheDocument();
  });

  it('sends visitors without a session from /play back to the start', () => {
    renderAt('/play');
    expect(screen.getByLabelText('Game code')).toBeInTheDocument();
  });
});

describe('Admin sign-in', () => {
  it('offers Microsoft sign-in when not signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    renderAt('/admin');
    expect(await screen.findByRole('link', { name: 'Sign in with Microsoft' })).toBeInTheDocument();
  });
});
