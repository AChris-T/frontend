'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { reverseGeocode } from '@/lib/api';
import ReportRow from './ReportRow';
import ReportCardRow from './ReportCardRow';

const STATUS_OPTIONS = ['all', 'reported', 'in_progress', 'fixed', 'rejected'];
const PAGE_SIZE = 10;

export default function ReportsTable({ reports, onSelect, onUpdate, updating, onDelete, deleting }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roadNames, setRoadNames] = useState({});

  useEffect(() => {
    let active = true;
    const unresolved = reports.filter((report) => (
      !report.road_name && report.latitude != null && report.longitude != null
    ));

    Promise.all(unresolved.map(async (report) => {
      try {
        const res = await reverseGeocode(report.latitude, report.longitude);
        return [report.id, res.data.roadName || null];
      } catch {
        return [report.id, null];
      }
    })).then((entries) => {
      if (active) setRoadNames(Object.fromEntries(entries.filter(([, name]) => name)));
    });

    return () => { active = false; };
  }, [reports]);

  const filtered = reports.filter((r) => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchSearch = !search ||
      String(r.id).includes(search) ||
      (r.fault_type || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.road_name || roadNames[r.id] || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleReports = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-ink">All Reports ({filtered.length})</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by ID or fault type…"
              className="w-full rounded-xl border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand sm:w-56"
            />
          </div>
          <select
            value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand sm:w-auto"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Status' : s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">No reports found.</p>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {visibleReports.map((r) => (
              <ReportCardRow
                key={r.id}
                report={r}
                roadName={roadNames[r.id]}
                onSelect={onSelect}
                onUpdate={onUpdate}
                updating={updating}
                onDelete={onDelete}
                deleting={deleting}
              />
            ))}
          </div>

          {/* sm and up: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Media</th>
                  <th className="px-3 py-2">Fault</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Road</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((r) => (
                  <ReportRow
                    key={r.id}
                    report={r}
                    roadName={roadNames[r.id]}
                    onSelect={onSelect}
                    onUpdate={onUpdate}
                    updating={updating}
                    onDelete={onDelete}
                    deleting={deleting}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-ink-muted">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >Previous</button>
                <span className="text-xs font-semibold text-ink">{currentPage} / {pageCount}</span>
                <button
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
