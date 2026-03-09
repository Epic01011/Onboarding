import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from './ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <Alert variant="destructive">
          <AlertDescription>
            Une erreur s'est produite. Rechargez la page.
            {this.state.error && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer">Détails techniques</summary>
                <pre className="mt-1 overflow-auto">{this.state.error.message}</pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}