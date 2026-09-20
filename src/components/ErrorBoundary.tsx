import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('psycalcu_pending_redirect');
      // Keep user sessions/settings safe in user-specific keys if possible
      sessionStorage.clear();
      window.location.href = window.location.pathname;
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6" id="error-boundary-screen">
          <div className="max-w-md w-full bg-white rounded-3xl border border-[#e5e1d8] shadow-lg p-8 text-center space-y-6 relative overflow-hidden">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mx-auto border border-rose-100">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-slate-800">Bir Hata Oluştu</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Uygulama yüklenirken beklenmeyen bir durum meydana geldi. Verileriniz güvendedir.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-left overflow-auto max-h-36 font-mono text-[11px] text-slate-700">
                <p className="font-bold text-rose-600 mb-1">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-400 whitespace-pre-wrap leading-tight">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sayfayı Yeniden Yükle
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                Giriş Durumunu Sıfırla ve Aç
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Sorun devam ederse lütfen <strong className="text-[#6b705c]">muhammedakifkayacan@gmail.com</strong> ile iletişime geçin.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
