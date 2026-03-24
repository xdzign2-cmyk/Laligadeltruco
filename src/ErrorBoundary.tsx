import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 bg-slate-900 text-white min-h-screen font-mono">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">⚠️ ERROR CRÍTICO DEL SISTEMA</h1>
                    <p className="mb-4 text-slate-300">La aplicación ha encontrado un error irrecuperable.</p>

                    <div className="bg-black p-4 rounded-xl border border-red-900/50 mb-6 overflow-auto max-h-[400px]">
                        <p className="text-red-400 font-bold mb-2">{this.state.error?.toString()}</p>
                        <pre className="text-xs text-slate-500 whitespace-pre-wrap">
                            {this.state.error?.stack}
                        </pre>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg"
                        >
                            Recargar Página
                        </button>
                        <button
                            onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
                            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
                        >
                            ♻️ Borrar Datos y Restaurar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
