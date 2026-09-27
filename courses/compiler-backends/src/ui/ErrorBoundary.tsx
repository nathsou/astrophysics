import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(`[${this.props.label ?? 'widget'}]`, error); }
  render() {
    if (this.state.error) {
      return (
        <div className="error-box" role="alert">
          This {this.props.label ?? 'widget'} failed to render: {this.state.error.message}{' '}
          <button className="chip-btn" onClick={() => this.setState({ error: null })}>retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
