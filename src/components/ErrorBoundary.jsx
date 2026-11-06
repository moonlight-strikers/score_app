import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xl mb-4 font-bold border border-red-500/40">
            !
          </div>
          <h2 className="text-lg font-bold text-red-400 mb-2">Something went wrong</h2>
          <p className="text-xs text-slate-400 mb-4 max-w-sm">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('ms_cricket_matches_cache');
              } catch {}
              window.location.href = '/';
            }}
            className="ms-btn ms-btn-primary ms-btn-sm text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            Reset Cache & Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
