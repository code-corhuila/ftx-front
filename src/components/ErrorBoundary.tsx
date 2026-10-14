import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * Un error de renderizado no deja la pantalla en blanco: se muestra un aviso con reintento.
 * No usa el router, para funcionar aunque el error venga de un layout.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Error de renderizado", error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="container page">
        <div className="alert alert-error" role="alert">
          <p className="alert-title">Algo salió mal al mostrar esta página</p>
          <div className="alert-body">
            <p>Tus datos no se perdieron. Intenta de nuevo o vuelve al inicio.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={this.retry}>
                Reintentar
              </button>
              <a href="/" className="btn btn-ghost">
                Volver al inicio
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }
}
