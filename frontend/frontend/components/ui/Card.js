export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-sm ${padded ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
