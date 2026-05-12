
import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0A0F1E] text-white p-8 text-center">
          <div className="bg-red-900/20 p-12 rounded-[50px] border border-red-500/30 max-w-2xl backdrop-blur-3xl shadow-2xl">
            <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
               <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter mb-4 uppercase">Ops! O sistema parou de respirar.</h1>
            <p className="text-slate-400 font-bold mb-10 leading-relaxed">
              Ocorreu um erro inesperado que impediu o carregamento da interface. 
              Geralmente isso acontece por problemas de conexão ou dados corrompidos no navegador.
            </p>
            
            <div className="bg-black/40 p-6 rounded-2xl mb-10 text-left overflow-auto max-h-40 border border-white/5 font-mono text-xs text-red-300">
               <p className="font-bold mb-2 uppercase text-white/40">Detalhes Técnicos:</p>
               {this.state.error?.toString()}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="bg-white text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl active:scale-95"
              >
                Recarregar App
              </button>
              <button 
                onClick={() => {
                   localStorage.clear();
                   window.location.reload();
                }}
                className="bg-transparent border-2 border-white/10 text-white/50 px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:border-red-500 hover:text-red-500 transition-all active:scale-95 text-xs"
              >
                Limpar Cache e Sair
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
