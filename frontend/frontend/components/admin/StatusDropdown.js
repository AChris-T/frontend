'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { statusMeta } from '@/lib/constants';

const OPTIONS = ['in_progress', 'fixed', 'rejected'];

export default function StatusDropdown({ report, onUpdate, updating }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = statusMeta(report.status);
  const busy = updating === report.id;

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <current.icon className="h-3.5 w-3.5" />}
        {current.label}
        <ChevronDown className={`h-3.5 w-3.5 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {OPTIONS.map((status) => {
            const meta = statusMeta(status);
            const active = report.status === status;
            return (
              <button
                key={status}
                type="button"
                disabled={active}
                onClick={() => { onUpdate(report.id, status); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
                  active ? 'bg-surface-2 text-ink-muted' : 'text-ink hover:bg-surface-2'
                }`}
              >
                <meta.icon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
