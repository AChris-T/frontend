export function Field({ label, children }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

const baseStyles =
  'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand';

export function Input({ className = '', ...props }) {
  return <input className={`${baseStyles} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${baseStyles} resize-none ${className}`} {...props} />;
}
