'use client';
import { useEffect, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteReportButton({ reportId, onDelete, deleting }) {
  const [confirming, setConfirming] = useState(false);
  const busy = deleting === reportId;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onDelete(reportId);
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        confirming
          ? 'border-critical bg-critical text-brand-ink hover:opacity-90'
          : 'border-border bg-surface text-critical hover:bg-critical/10'
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {confirming ? 'Confirm delete?' : 'Delete'}
    </button>
  );
}
