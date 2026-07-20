import { MapPinned, RefreshCw } from 'lucide-react';

export default function AdminHeader({ userName, lastRefresh, onRefresh, refreshing }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <MapPinned className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Admin Dashboard</h1>
          <p className="text-sm text-ink-muted">Works &amp; Maintenance Department</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        {userName && <span className="font-medium text-ink-secondary">{userName}</span>}
        <span>Updated {lastRefresh}</span>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-medium text-ink transition-colors hover:bg-surface-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
    </div>
  );
}
