'use client';
import MapLoading from '@/components/location/MapLoading';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, X, Loader2, MapPin, Route as RoadIcon } from 'lucide-react';
import { STATUS, SEVERITY, faultMeta, severityMeta, statusMeta } from '@/lib/constants';
import { SEVERITY_HEX } from '@/lib/analytics';
import { locationLabel, timeAgo } from '@/lib/format';
import Badge from '@/components/ui/Badge';
import StatusDropdown from './StatusDropdown';

const AdminMap = dynamic(() => import('@/components/AdminMap'), {
  ssr: false,
  loading: MapLoading,
});

function Chip({ active, onClick, color, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
        active ? 'border-transparent bg-ink text-surface shadow' : 'border-border bg-surface text-ink-secondary hover:bg-surface-2'
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

function RoadDrawer({ road, reports, onClose, d }) {
  const sev = severityMeta(road.severity);
  return (
    <aside className="animate-pop-in absolute inset-x-2 bottom-2 z-[600] flex max-h-[60%] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:bottom-3 sm:right-16 sm:top-3 sm:max-h-none sm:w-96">
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"><RoadIcon className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-ink">{road.name}</h3>
              <p className="text-xs capitalize text-ink-muted">{road.road_type || 'road'} segment</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close road" className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2"><div className="font-mono text-base font-bold text-ink">{road.fault_count || 0}</div><div className="text-[10px] text-ink-muted">Faults logged</div></div>
          <div className="rounded-xl bg-surface-2 p-2"><div className="font-mono text-base font-bold text-ink">{reports.length}</div><div className="text-[10px] text-ink-muted">Reports</div></div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-surface-2 p-2"><Badge icon={sev.icon} label={sev.label} color={sev.color} /></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {reports.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No reports on this road segment.</p>
        ) : reports.map((r) => {
          const fm = faultMeta(r.fault_type);
          const rs = severityMeta(r.severity);
          return (
            <div key={r.id} onClick={() => d.setSelectedReportId(r.id)} className="mb-2 cursor-pointer rounded-2xl border border-border p-3 transition-colors hover:bg-surface-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><fm.icon className="h-4 w-4 text-ink-secondary" />#{r.id} · {fm.label}</span>
                <Badge icon={rs.icon} label={rs.label} color={rs.color} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                <StatusDropdown report={r} onUpdate={d.handleUpdate} updating={d.updating} />
                <span className="text-[11px] text-ink-muted">{timeAgo(r.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function MapView({ d }) {
  const [statuses, setStatuses] = useState(() => new Set(['reported', 'in_progress']));
  const [severities, setSeverities] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(null);

  const toggleIn = (setter) => (key) => setter((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const visible = useMemo(() => d.reports.filter((r) =>
    (!statuses.size || statuses.has(r.status)) && (!severities.size || severities.has(r.severity))
  ), [d.reports, statuses, severities]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    if (!q) return [];
    return d.reports.filter((r) => String(r.id) === q || locationLabel(r).toLowerCase().includes(q) || r.fault_type?.replace(/_/g, ' ').includes(q)).slice(0, 6);
  }, [d.reports, query]);

  const roadReports = useMemo(() => d.reports.filter((r) => d.roadReportIds.has(r.id)), [d.reports, d.roadReportIds]);

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm lg:h-[calc(100dvh-6.5rem)]">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to #ID, place or fault…"
            className="h-9 w-full rounded-xl border border-border bg-surface-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
          />
          {matches.length > 0 && (
            <div className="animate-pop-in absolute left-0 right-0 top-11 z-[700] overflow-hidden rounded-2xl border border-border bg-surface p-1 shadow-2xl">
              {matches.map((r) => (
                <button key={r.id} type="button" onClick={() => { setFocus(r); setQuery(''); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs hover:bg-surface-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_HEX[r.severity] }} />
                  <span className="font-mono font-semibold text-ink">#{r.id}</span>
                  <span className="flex-1 truncate text-ink-secondary">{locationLabel(r)}</span>
                  <MapPin className="h-3.5 w-3.5 text-ink-muted" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="scrollbar-thin -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 lg:mx-0 lg:flex-1 lg:px-0">
          {Object.entries(STATUS).map(([key, m]) => (
            <Chip key={key} active={statuses.has(key)} onClick={() => toggleIn(setStatuses)(key)}><m.icon className="h-3.5 w-3.5" />{m.label}</Chip>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-divider" />
          {['critical', 'high', 'medium', 'low'].map((key) => (
            <Chip key={key} active={severities.has(key)} color={SEVERITY_HEX[key]} onClick={() => toggleIn(setSeverities)(key)}>{SEVERITY[key].label}</Chip>
          ))}
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-muted lg:flex">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-good" /></span>
          Showing <strong className="text-ink">{visible.length}</strong> of {d.reports.length}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <AdminMap
          reports={visible}
          onSelectReport={d.setSelectedReportId}
          onRoadClick={d.handleRoadClick}
          focus={focus}
          highlightIds={d.roadReportIds}
        />
        {d.selectedRoad && <RoadDrawer road={d.selectedRoad} reports={roadReports} onClose={d.closeRoad} d={d} />}
      </div>
    </div>
  );
}
