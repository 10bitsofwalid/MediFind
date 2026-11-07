// src/components/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            maxWidth: '640px',
            margin: '40px auto',
            padding: '32px 24px',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-problem-bg)',
              color: 'var(--color-status-problem)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
            aria-hidden="true"
          >
            <AlertCircle size={26} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            {this.props.fallbackTitle || 'Something went wrong rendering this component'}
          </h2>

          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. Your entered data has been preserved.'}
          </p>

          <button
            type="button"
            onClick={this.handleReset}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              fontSize: '14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Reload Application</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

