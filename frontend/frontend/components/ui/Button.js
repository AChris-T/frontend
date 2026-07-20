'use client';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-brand text-brand-ink hover:opacity-90',
  secondary: 'bg-surface-2 text-ink hover:bg-divider border border-border',
  danger: 'bg-critical text-brand-ink hover:opacity-90',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface-2',
};

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
