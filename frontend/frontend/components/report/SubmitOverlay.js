'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, UploadCloud, Route, Database, Mail } from 'lucide-react';

const STEPS = [
  { icon: UploadCloud, label: 'Uploading your photo or video' },
  { icon: Route, label: 'Matching the fault to the nearest road' },
  { icon: Database, label: 'Saving your report' },
  { icon: Mail, label: 'Sending your confirmation email' },
];

/** Full-screen progress while a report is being submitted. */
export default function SubmitOverlay({ hasMedia, hasEmail }) {
  const steps = STEPS.filter((s, i) => (i !== 0 || hasMedia) && (i !== 3 || hasEmail));
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => Math.min(c + 1, steps.length - 1)), 1400);
    return () => clearInterval(t);
  }, [steps.length]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4" role="alertdialog" aria-live="assertive" aria-label="Submitting report">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="animate-pop-in relative w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl">
        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
          <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand/40" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-ink shadow-lg shadow-brand/40">
            <Loader2 className="h-7 w-7 animate-spin" />
          </span>
        </div>
        <h2 className="text-center text-lg font-bold text-ink">Submitting your report</h2>
        <p className="mb-5 text-center text-sm text-ink-muted">Please keep this page open — this only takes a moment.</p>
        <ol className="flex flex-col gap-2.5">
          {steps.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s.label} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${active ? 'bg-brand/10' : ''}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-good text-white' : active ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-ink-muted'}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <s.icon className="h-4 w-4" />}
                </span>
                <span className={`text-sm ${active ? 'font-semibold text-ink' : done ? 'text-ink-secondary' : 'text-ink-muted'}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body
  );
}
