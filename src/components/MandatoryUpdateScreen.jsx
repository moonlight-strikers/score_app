import React, { useState } from 'react';
import { Download, RefreshCw, WifiOff, AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react';

export default function MandatoryUpdateScreen({
  installedVersion = '1.0.0',
  requiredVersion = '2.0.0',
  updateUrl = 'https://github.com/moonlight-strikers/cricket-scoring-app/releases/latest',
  isError = false,
  errorMessage = '',
  onRetry,
  onCheckAgain,
  isChecking = false
}) {
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleUpdateClick = () => {
    try {
      setDownloadStarted(true);
      if (updateUrl) {
        // Open download link in external system browser/downloader for APK download
        window.open(updateUrl, '_system');
      }
    } catch (err) {
      console.warn('Failed to launch APK download URL via window.open:', err);
      if (updateUrl) {
        window.location.href = updateUrl;
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ms-update-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0a0f1e]/95 backdrop-blur-md text-slate-100 select-none overflow-y-auto"
    >
      <div className="ms-card max-w-md w-full p-6 sm:p-8 bg-[#111827] border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-950/60 flex flex-col items-center text-center relative overflow-hidden animate-fadeIn">
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-40 ${
            isError ? 'bg-red-500' : 'bg-cyan-500'
          }`}
        />

        {/* Status Icon Badge */}
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 border shadow-inner transition-transform ${
            isError
              ? 'bg-red-500/15 border-red-500/40 text-red-400'
              : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
          }`}
        >
          {isError ? (
            <WifiOff className="w-10 h-10 animate-pulse stroke-[2.2]" />
          ) : (
            <Download className="w-10 h-10 animate-bounce stroke-[2.2]" />
          )}
        </div>

        {/* Title */}
        <h1
          id="ms-update-title"
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-white font-sans"
        >
          {isError ? 'Connection Error' : 'Update Required!'}
        </h1>

        {/* Message */}
        <p className="text-base sm:text-lg text-slate-200 font-medium leading-relaxed mb-6 max-w-sm text-center">
          {isError
            ? errorMessage ||
              'Unable to verify application version with the server. Please check your internet connection and try again.'
            : 'You want to update your app, Please contact Manoth.'}
        </p>

        {/* Version Badges Container (Shown when update is required) */}
        {!isError && (
          <div className="w-full bg-[#162032] border border-slate-700/60 rounded-2xl p-4 mb-6 flex items-center justify-around">
            <div className="flex flex-col items-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Installed Version
              </span>
              <span className="text-base font-score font-bold px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 tabular-nums">
                v{installedVersion}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            <div className="flex flex-col items-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Required Version
              </span>
              <span className="text-base font-score font-bold px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 tabular-nums">
                v{requiredVersion || '2.0.0'}
              </span>
            </div>
          </div>
        )}

        {/* Primary Action Buttons */}
        {isError ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isChecking}
            className="ms-btn ms-btn-primary ms-btn-lg w-full flex items-center justify-center gap-2 font-bold text-base cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking Connection...' : 'Retry'}</span>
          </button>
        ) : (
          <div className="w-full flex flex-col gap-2.5">
            {Boolean(updateUrl) && (
              <button
                type="button"
                onClick={handleUpdateClick}
                className="ms-btn ms-btn-primary ms-btn-lg w-full flex items-center justify-center gap-2 font-bold text-base shadow-xl cursor-pointer"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>Update Now</span>
                <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
              </button>
            )}

            {/* Check Again button after downloading */}
            <button
              type="button"
              onClick={onCheckAgain}
              disabled={isChecking}
              className="ms-btn ms-btn-outline w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Verifying Version...' : 'I Have Updated — Verify Again'}</span>
            </button>
          </div>
        )}

        {/* Help text */}
        <div className="mt-5 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span>Mandatory security & scoring update for MoonLight Strikers</span>
        </div>
      </div>
    </div>
  );
}

