'use client';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, CornerDownLeft, MapPin, FileText, Zap } from 'lucide-react';
import { faultMeta } from '@/lib/constants';
import { locationLabel } from '@/lib/format';
import { SEVERITY_HEX } from '@/lib/analytics';

/** ⌘K / Ctrl+K palette: jump to any report, section or action. */
export default function CommandPalette({ onClose, reports, commands, onOpenReport }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    const cmds = commands
      .filter((c) => !q || c.label.toLowerCase().includes(q))
      .map((c) => ({ ...c, kind: 'command' }));
    const reps = (q ? reports.filter((r) =>
      String(r.id).startsWith(q) || locationLabel(r).toLowerCase().includes(q) || (r.fault_type || '').replace(/_/g, ' ').includes(q) || (r.reporter_email || '').toLowerCase().includes(q)
    ) : reports.slice(0, 5)).slice(0, 8).map((r) => ({ kind: 'report', id: `r${r.id}`, report: r }));
    return [...cmds, ...reps];
  }, [query, reports, commands]);

  const run = (item) => {
    onClose();
    if (item.kind === 'report') onOpenReport(item.report.id);
    else item.run();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && items[active]) run(items[active]);
    if (e.key === 'Escape') onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-start justify-center p-3 pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-pop-in relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 text-ink-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder="Search reports, places, or type a command…"
            className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">ESC</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="py-10 text-center text-sm text-ink-muted">No matches</li>}
          {items.map((item, i) => {
            const isActive = i === active;
            const cls = `flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm ${isActive ? 'bg-brand/10' : ''}`;
            if (item.kind === 'command') {
              const Icon = item.icon || Zap;
              return (
                <li key={item.id}>
                  <button type="button" onMouseEnter={() => setActive(i)} onClick={() => run(item)} className={cls}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-ink-secondary"><Icon className="h-4 w-4" /></span>
                    <span className="flex-1 font-medium text-ink">{item.label}</span>
                    {isActive && <CornerDownLeft className="h-4 w-4 text-ink-muted" />}
                  </button>
                </li>
              );
            }
            const r = item.report;
            const fm = faultMeta(r.fault_type);
            return (
              <li key={item.id}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => run(item)} className={cls}>
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-ink-secondary">
                    <FileText className="h-4 w-4" />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface" style={{ background: SEVERITY_HEX[r.severity] }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink"><strong className="font-mono">#{r.id}</strong> · {fm.label}</span>
                    <span className="flex items-center gap-1 truncate text-xs text-ink-muted"><MapPin className="h-3 w-3" />{locationLabel(r)}</span>
                  </span>
                  {isActive && <CornerDownLeft className="h-4 w-4 text-ink-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body
  );
}
