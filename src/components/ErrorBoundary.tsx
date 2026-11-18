import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Bacaro Tour UI error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 bg-app text-center">
          <h1 className="font-display text-xl text-ink">Qualcosa è andato storto</h1>
          <p className="text-sm text-muted max-w-sm">
            Ricarica la pagina. Se il problema continua, prova a chiudere e
            riaprire l&apos;app.
          </p>
          <button
            type="button"
            className="mt-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-medium"
            onClick={() => window.location.reload()}
          >
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
