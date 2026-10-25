import { Component, type ErrorInfo, type ReactNode } from 'react';
import { strings } from './strings';

interface State {
  failed: boolean;
}

/** Last line of defence: shows a friendly screen instead of a blank page when something crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unexpected error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="home">
        <div role="alert">
          <h1>{strings.crashTitle}</h1>
          <p>{strings.crashText}</p>
        </div>
        <p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            {strings.crashReload}
          </button>
        </p>
      </main>
    );
  }
}
