'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Large in-app modal: full screen on phones, a centered panel from `sm` up.
 * Locks page scroll while open and closes on Escape / backdrop click.
 */
export default function Modal({ open, onClose, title, subtitle, actions, children, size = 'xl', bodyClassName = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const widths = {
    md: 'sm:max-w-2xl',
    lg: 'sm:max-w-4xl',
    xl: 'sm:max-w-6xl',
    full: 'sm:max-w-[min(1600px,96vw)]',
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-stretch justify-center sm:items-center sm:p-4 lg:p-8">
      <div className="animate-fade-in absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`animate-pop-in relative flex h-dvh w-full flex-col overflow-hidden bg-surface shadow-2xl sm:h-[min(92dvh,1000px)] sm:rounded-3xl sm:border sm:border-border ${widths[size]}`}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-ink sm:text-lg">{title}</div>
            {subtitle && <div className="truncate text-xs text-ink-muted">{subtitle}</div>}
          </div>
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
