import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last-resort guard: if a render throws, show a friendly message with a reload
 * link instead of a blank iframe. Keeps a bad state from looking like the whole
 * embed is broken on the customer's site.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in the browser console for debugging; no external reporting.
    console.error('Facade Designer error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#1c1c1e' }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong.</h2>
          <p style={{ color: '#6f6d68', marginBottom: 12 }}>
            The designer hit an unexpected error. Reloading usually clears it.
          </p>
          <button
            className="btn primary"
            onClick={() => window.location.reload()}
            style={{ padding: '8px 14px' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
