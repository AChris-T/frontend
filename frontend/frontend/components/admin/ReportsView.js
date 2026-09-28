'use client';
import { useMemo, useState } from 'react';
import {
  Search, Download, X, MapPin, Sparkles, Trash2, MoreHorizontal, Eye, Video, ImageOff, Loader2,
  ArrowUpDown, SlidersHorizontal, CheckSquare, Filter, LocateFixed, Bot,
} from 'lucide-react';
import { FAULT_TYPES, SEVERITY, STATUS, faultMeta, severityMeta } from '@/lib/constants';
import { locationLabel, locationDetail, timeAgo, formatDate, downloadCsv } from '@/lib/format';
import { priorityScore } from '@/lib/analytics';
import Badge from '@/components/ui/Badge';
import Thumbnail from '@/components/ui/Thumbnail';
import Select from '@/components/ui/Select';
import Popover, { MenuItem } from '@/components/ui/Popover';
import StatusDropdown from './StatusDropdown';

const SEV_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

const STATUS_OPTIONS = [{ value: 'all', label: 'All statuses' }, ...Object.entries(STATUS).map(([value, m]) => ({ value, label: m.label, icon: m.icon }))];
const SEVERITY_OPTIONS = [{ value: 'all', label: 'All severities' }, ...['critical', 'high', 'medium', 'low'].map((value) => ({ value, label: SEVERITY[value].label, icon: SEVERITY[value].icon }))];
const FAULT_OPTIONS = [{ value: 'all', label: 'All fault types' }, ...Object.entries(FAULT_TYPES).filter(([k]) => !['analyzing', 'none'].includes(k)).map(([value, m]) => ({ value, label: m.label, icon: m.icon }))];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'severity', label: 'Most severe' },
  { value: 'confidence', label: 'AI confidence' },
];
const PAGE_SIZES = [10, 25, 50, 100];

function Thumb({ report, size = 'md' }) {
  const cls = size === 'lg' ? 'h-16 w-20' : 'h-11 w-14';
  if (report.photo_url) return <Thumbnail report={report} className={`${cls} shrink-0 rounded-xl`} />;
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-xl ${report.video_url ? 'bg-info/10 text-info' : 'bg-surface-2 text-ink-muted'}`}>
      {report.video_url ? <Video className="h-4 w-4" /> : <ImageOff className="h-4 w-4" />}
    </div>
  );
}

function Confidence({ value }) {
  if (!value) return <span className="text-[11px] text-ink-muted">Manual</span>;
  const p = Math.round(value * 100);
  return (
    <span className="flex items-center gap-1.5" title={`AI confidence ${p}%`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${p}%` }} />
      </span>
      <span className="font-mono text-[11px] text-ink-muted">{p}%</span>
    </span>
  );
}

function RowMenu({ report, d, onLocate }) {
  return (
    <Popover
      title={`Report #${report.id}`}
      width={220}
      trigger={({ toggle, ref, open }) => (
        <button ref={ref} type="button" onClick={toggle} aria-label="More actions" className={`rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink ${open ? 'bg-surface-2 text-ink' : ''}`}>
          {d.rescanning === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <MenuItem icon={Eye} onClick={() => { d.setSelectedReportId(report.id); close(); }}>Open full details</MenuItem>
          <MenuItem icon={MapPin} onClick={() => { onLocate(report); close(); }}>View location & directions</MenuItem>
          <MenuItem icon={Sparkles} disabled={!report.photo_url && !report.video_url || d.rescanning === report.id} onClick={() => { d.handleRescanOne(report.id); close(); }}>
            Rescan with AI
          </MenuItem>
          <MenuItem icon={LocateFixed} onClick={() => { d.handleGeocodeOne(report.id); close(); }}>Refresh address</MenuItem>
          <div className="my-1 h-px bg-divider" />
          <MenuItem icon={Trash2} danger onClick={() => { if (window.confirm(`Delete report #${report.id}? This cannot be undone.`)) d.handleDelete(report.id); close(); }}>
            Delete report
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

export default function ReportsView({ d, filters, setFilters, onLocate }) {
  const [rawSelected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const { status, severity, fault, search, sort } = filters;
  const set = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = d.reports.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (severity !== 'all' && r.severity !== severity) return false;
      if (fault !== 'all' && r.fault_type !== fault) return false;
      if (!q) return true;
      return [
        `#${r.id}`, String(r.id), r.fault_type?.replace(/_/g, ' '), locationLabel(r), r.address, r.road_name,
        r.reporter_email, r.reporter_name, r.description,
      ].some((v) => v && String(v).toLowerCase().includes(q));
    });
    const sorters = {
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      priority: (a, b) => priorityScore(b) - priorityScore(a),
      severity: (a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0),
      confidence: (a, b) => (b.confidence || 0) - (a.confidence || 0),
    };
    return rows.sort(sorters[sort] || sorters.newest);
  }, [d.reports, status, severity, fault, search, sort]);

  // Ignore selections that no longer exist (deleted / refreshed away).
  const selected = useMemo(() => {
    const ids = new Set(d.reports.map((r) => r.id));
    return new Set([...rawSelected].filter((id) => ids.has(id)));
  }, [rawSelected, d.reports]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const activeFilters = [status, severity, fault].filter((v) => v !== 'all').length + (search ? 1 : 0);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    visible.forEach((r) => (allVisibleSelected ? next.delete(r.id) : next.add(r.id)));
    return next;
  });

  const exportCsv = () => {
    const rows = (selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered);
    downloadCsv(`road-faults-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['ID', 'Fault type', 'Severity', 'Status', 'AI confidence', 'Location', 'Address', 'Road segment', 'Latitude', 'Longitude', 'Reporter', 'Reported at', 'Description'],
      ...rows.map((r) => [
        r.id, faultMeta(r.fault_type).label, r.severity, r.status, r.confidence ? Math.round(r.confidence * 100) + '%' : '',
        locationLabel(r), r.address || '', r.road_name || '', r.latitude, r.longitude, r.reporter_email || '',
        new Date(r.created_at).toISOString(), r.description || '',
      ]),
    ]);
  };

  const ids = [...selected];

  return (
    <section className="rounded-3xl border border-border bg-surface shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Search ID, location, fault, reporter…"
              className="h-10 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-9 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/15"
            />
            {search && (
              <button type="button" onClick={() => set({ search: '' })} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors lg:hidden ${showFilters ? 'border-brand bg-brand/10 text-brand' : 'border-border text-ink'}`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </button>
          <div className={`${showFilters ? 'grid' : 'hidden'} w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap`}>
            <Select label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} icon={Filter} className="w-full lg:w-44" />
            <Select label="Severity" value={severity} onChange={(v) => set({ severity: v })} options={SEVERITY_OPTIONS} className="w-full lg:w-40" />
            <Select label="Fault type" value={fault} onChange={(v) => set({ fault: v })} options={FAULT_OPTIONS} className="w-full lg:w-48" />
            <Select label="Sort by" value={sort} onChange={(v) => set({ sort: v })} options={SORT_OPTIONS} icon={ArrowUpDown} className="w-full lg:w-48" />
          </div>
          <button type="button" onClick={exportCsv} className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span><strong className="text-ink">{filtered.length}</strong> of {d.reports.length} reports</span>
          {activeFilters > 0 && (
            <button type="button" onClick={() => set({ status: 'all', severity: 'all', fault: 'all', search: '' })} className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-secondary hover:text-ink">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="animate-fade-in sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-brand/10 px-4 py-2.5 backdrop-blur sm:px-5">
          <CheckSquare className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold text-ink">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Popover
              title={`Set status for ${selected.size} report(s)`}
              width={220}
              trigger={({ toggle, ref }) => (
                <button ref={ref} type="button" onClick={toggle} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2">Set status</button>
              )}
            >
              {({ close }) => Object.entries(STATUS).map(([key, m]) => (
                <MenuItem key={key} icon={m.icon} onClick={async () => { close(); if (await d.handleBulkUpdate(ids, key)) setSelected(new Set()); }}>{m.label}</MenuItem>
              ))}
            </Popover>
            <button
              type="button"
              disabled={d.rescanJob.running}
              onClick={() => { d.handleStartRescan('ids', ids); setSelected(new Set()); }}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink disabled:opacity-50"
            >
              <Bot className="h-3.5 w-3.5" /> AI rescan
            </button>
            <button
              type="button"
              onClick={async () => { if (window.confirm(`Delete ${selected.size} report(s)? This cannot be undone.`) && await d.handleBulkDelete(ids)) setSelected(new Set()); }}
              className="flex items-center gap-1.5 rounded-lg border border-critical/30 bg-surface px-3 py-1.5 text-xs font-semibold text-critical hover:bg-critical/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="rounded-lg p-1.5 text-ink-muted hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-ink-muted" />
          <p className="text-sm font-semibold text-ink">No reports match these filters</p>
          <p className="text-xs text-ink-muted">Try clearing a filter or searching for something else.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col divide-y divide-border md:hidden">
            {visible.map((r) => {
              const fm = faultMeta(r.fault_type);
              const sev = severityMeta(r.severity);
              return (
                <div key={r.id} className={`flex gap-3 p-4 ${selected.has(r.id) ? 'bg-brand/5' : ''}`} onClick={() => d.setSelectedReportId(r.id)}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]" aria-label={`Select report ${r.id}`} />
                  <Thumb report={r} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
                        <fm.icon className="h-4 w-4 shrink-0 text-ink-secondary" /><span className="truncate">{fm.label}</span>
                      </div>
                      <span className="font-mono text-xs text-ink-muted">#{r.id}</span>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onLocate(r); }} className="mt-0.5 flex max-w-full items-center gap-1 text-left text-xs text-brand">
                      <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{locationLabel(r)}</span>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Badge icon={sev.icon} label={sev.label} color={sev.color} />
                      <StatusDropdown report={r} onUpdate={d.handleUpdate} updating={d.updating} />
                      <span className="ml-auto"><RowMenu report={r} d={d} onLocate={onLocate} /></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <th className="w-10 py-3 pl-5 pr-2">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 accent-[var(--brand)]" aria-label="Select all on this page" />
                  </th>
                  <th className="px-3 py-3">Report</th>
                  <th className="px-3 py-3">Fault · AI</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Reported</th>
                  <th className="w-12 px-3 py-3 pr-5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const fm = faultMeta(r.fault_type);
                  const sev = severityMeta(r.severity);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => d.setSelectedReportId(r.id)}
                      className={`group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-2 ${selected.has(r.id) ? 'bg-brand/5' : ''}`}
                    >
                      <td className="py-3 pl-5 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[var(--brand)]" aria-label={`Select report ${r.id}`} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb report={r} />
                          <span className="font-mono font-semibold text-ink">#{r.id}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-ink"><fm.icon className="h-4 w-4 text-ink-secondary" />{fm.label}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <Confidence value={r.confidence} />
                          {r.ai_result?.rescanned_at && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">RESCANNED</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3"><Badge icon={sev.icon} label={sev.label} color={sev.color} /></td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <StatusDropdown report={r} onUpdate={d.handleUpdate} updating={d.updating} />
                      </td>
                      <td className="max-w-72 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => onLocate(r)} className="group/loc flex max-w-full items-start gap-2 text-left">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink group-hover/loc:text-brand group-hover/loc:underline">{locationLabel(r)}</span>
                            <span className="block truncate text-xs text-ink-muted">{locationDetail(r)}</span>
                          </span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="text-ink">{formatDate(r.created_at)}</div>
                        <div className="text-xs text-ink-muted">{timeAgo(r.created_at)}</div>
                      </td>
                      <td className="px-3 py-3 pr-5" onClick={(e) => e.stopPropagation()}>
                        <RowMenu report={r} d={d} onLocate={onLocate} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row sm:px-5">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              Rows
              <Select
                label="Rows per page"
                value={pageSize}
                onChange={(v) => { setPageSize(v); setPage(1); }}
                options={PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))}
                width={120}
                className="h-8 w-20 text-xs"
              />
              <span>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40">Previous</button>
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pageCount || Math.abs(p - currentPage) <= 1)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center">
                    {i > 0 && p - arr[i - 1] > 1 && <span className="px-1 text-ink-muted">…</span>}
                    <button type="button" onClick={() => setPage(p)} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold ${p === currentPage ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface-2'}`}>{p}</button>
                  </span>
                ))}
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
