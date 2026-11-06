import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import Button from './Button';

/**
 * ConfirmModal
 * Clean in-app confirmation modal replacing native browser window.confirm()
 * Styled for MoonLight Strikers with theme-aware styling, capsule action buttons,
 * glowing accent borders, and backdrop blur.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onConfirm: () => void | Promise<void>
 * - title: string
 * - message: string | ReactNode
 * - confirmText: string
 * - cancelText: string
 * - isDestructive: boolean (default true)
 * - loading: boolean (default false)
 * - error: string | null
 * - icon: LucideIcon
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = null,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = true,
  loading = false,
  error = null,
  icon: CustomIcon
}) {
  // Close on Escape key press if not loading
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const IconComponent = CustomIcon || (isDestructive ? Trash2 : AlertTriangle);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose?.();
        }
      }}
    >
      <div
        className="ms-card relative max-w-sm w-full p-5 sm:p-6 bg-ms-bg-card border border-rose-500/40 shadow-2xl rounded-2xl text-center transform transition-all animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close (X) button */}
        {!loading && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-ms-text-muted hover:text-ms-text-primary hover:bg-ms-bg-elevated transition-colors cursor-pointer"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Top Icon Badge with subtle glow */}
        <div
          className={`w-13 h-13 rounded-full mx-auto mb-3.5 flex items-center justify-center shadow-lg ${
            isDestructive
              ? 'bg-rose-500/15 border border-rose-500/40 text-rose-500 dark:text-rose-400 shadow-rose-500/10'
              : 'bg-amber-500/15 border border-amber-500/40 text-amber-500 dark:text-amber-400 shadow-amber-500/10'
          }`}
        >
          <IconComponent className="w-6 h-6" />
        </div>

        {/* Modal Title */}
        <h3
          id="confirm-modal-title"
          className="text-base sm:text-lg font-black text-ms-text-primary tracking-tight"
        >
          {title}
        </h3>

        {/* Modal Message (only rendered if provided) */}
        {message ? (
          <div className="text-xs sm:text-sm text-ms-text-secondary leading-relaxed mt-2 mb-5 px-1">
            {message}
          </div>
        ) : (
          <div className="mb-6" />
        )}

        {/* Error notification if action failed */}
        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-semibold animate-fadeIn">
            {error}
          </div>
        )}

        {/* Action Buttons using capsule design */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            fullWidth
            disabled={loading}
            onClick={onClose}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={isDestructive ? 'danger' : 'primary'}
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
