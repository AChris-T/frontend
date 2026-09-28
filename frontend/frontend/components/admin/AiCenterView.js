'use client';
import { useMemo } from 'react';
import {
  Bot, Sparkles, RefreshCcw, CheckCircle2, XCircle, ArrowRight, MinusCircle, MapPinned, Loader2, Cpu, Gauge, History, Zap,
} from 'lucide-react';
import { computeAnalytics } from '@/lib/analytics';
import { faultMeta } from '@/lib/constants';
import { BarList } from './charts/Charts';

function Stat({ label, value, tone = 'text-ink' }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 text-center">
      <div className={`font-mono text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-[11px] font-medium text-ink-muted">{label}</div>
    </div>
  );
}

function ProgressBar({ value, total, running }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-linear-to-r from-brand to-info transition-all duration-700" style={{ width: `${pct}%` }} />
      {running && <div className="animate-progress-indeterminate absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/40 to-transparent" />}
    </div>
  );
}

function eta(job) {
  if (!job.running || !job.done || !job.started_at) return null;
  const elapsed = (Date.now() - new Date(job.started_at).getTime()) / 1000;
  const remaining = (elapsed / job.done) * (job.total - job.done);
  const m = Math.round(remaining / 60);
  return m < 1 ? 'under a minute left' : `~${m} min left`;
}

function ResultRow({ r, onOpen }) {
  const Icon = r.skipped || r.kept ? MinusCircle : r.ok ? CheckCircle2 : XCircle;
  const tone = r.skipped ? 'text-ink-muted' : r.kept ? 'text-warning' : r.ok ? (r.changed ? 'text-brand' : 'text-good') : 'text-critical';
  return (
    <button type="button" onClick={() => onOpen(r.report_id)} className="animate-fade-in flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-xs hover:bg-surface-2">
      <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
      <span className="font-mono font-semibold text-ink">#{r.report_id}</span>
      {r.kept ? (
        <span className="flex-1 truncate text-ink-muted">Kept previous result — Gemini unavailable</span>
      ) : r.ok && r.previous ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink-secondary">
          <span className="truncate">{faultMeta(r.previous.fault_type).label}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className={`truncate ${r.changed ? 'font-semibold text-brand' : ''}`}>{faultMeta(r.fault_type).label}</span>
        </span>
      ) : (
        <span className="flex-1 truncate text-ink-muted">{r.message}</span>
      )}
      {r.ok && r.confidence ? <span className="font-mono text-ink-muted">{Math.round(r.confidence * 100)}%</span> : null}
    </button>
  );
}

export default function AiCenterView({ d }) {
  const a = useMemo(() => computeAnalytics(d.reports), [d.reports]);
  const job = d.rescanJob;
  const geo = d.geocodeJob;
  const neverRescanned = d.reports.filter((r) => (r.photo_url || r.video_url) && !r.ai_result?.rescanned_at).length;

  const confidenceBins = useMemo(() => {
    const bins = [
      { key: 'vhigh', label: 'Very high (85–100%)', min: 0.85, max: 1.01 },
      { key: 'high', label: 'High (70–85%)', min: 0.7, max: 0.85 },
      { key: 'mid', label: 'Moderate (50–70%)', min: 0.5, max: 0.7 },
      { key: 'low', label: 'Low (< 50%)', min: 0.0001, max: 0.5 },
      { key: 'none', label: 'No AI result', min: -1, max: 0.0001 },
    ];
    return bins.map((b) => ({ ...b, value: d.reports.filter((r) => (r.confidence || 0) >= b.min && (r.confidence || 0) < b.max).length }));
  }, [d.reports]);

  const results = [...(job.results || [])].reverse();

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-[#0b1220] p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#2a78d6]/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[#1baf7a]/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Powered by Gemini Vision · automatic model failover
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Command Center</h1>
            <p className="mt-2 text-sm text-white/70">
              Re-run fault detection on every stored photo and video with Gemini. If one Gemini model is busy or out of quota,
              the next one answers; if none can, the report is left unchanged. New classifications, severities and confidence
              scores are saved automatically, and each report keeps its previous result for comparison.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <button
              type="button"
              disabled={job.running}
              onClick={() => { if (window.confirm(`Rescan all ${a.withMedia} reports with media? This runs in the background and may take a while.`)) d.handleStartRescan('all'); }}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0b1220] shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {job.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Rescan all ({a.withMedia})
            </button>
            <button
              type="button"
              disabled={job.running || !neverRescanned}
              onClick={() => d.handleStartRescan('unscanned')}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" /> Only never-rescanned ({neverRescanned})
            </button>
          </div>
        </div>

        {(job.running || job.total > 0) && (
          <div className="relative mt-6 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                {job.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-[#34d399]" />}
                {job.running ? `Scanning report #${job.current_id ?? '…'}` : 'Last rescan complete'}
              </span>
              <span className="font-mono text-white/80">{job.done}/{job.total}{eta(job) ? ` · ${eta(job)}` : ''}</span>
            </div>
            <div className="[&_.bg-surface-2]:bg-white/10"><ProgressBar value={job.done} total={job.total} running={job.running} /></div>
            {job.stopped_reason && (
              <p className="mt-3 rounded-xl border border-[#fcd34d]/40 bg-[#fcd34d]/10 px-3 py-2 text-xs text-[#fde68a]">⚠️ {job.stopped_reason}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/70">
              <span><strong className="text-white">{job.succeeded}</strong> rescanned</span>
              <span><strong className="text-[#7cb8ff]">{job.changed}</strong> reclassified</span>
              <span><strong className="text-white">{job.skipped}</strong> skipped</span>
              {job.kept > 0 && <span><strong className="text-[#fcd34d]">{job.kept}</strong> kept (Gemini unavailable)</span>}
              <span><strong className={job.failed ? 'text-[#ff8a8a]' : 'text-white'}>{job.failed}</strong> failed</span>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Live results */}
        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><History className="h-4 w-4 text-brand" /> Rescan results</h2>
              <p className="text-xs text-ink-muted">Before → after for each report in the latest run. Click to inspect.</p>
            </div>
          </div>
          {results.length ? (
            <div className="max-h-[420px] overflow-y-auto pr-1">
              {results.map((r, i) => <ResultRow key={`${r.report_id}-${i}`} r={r} onOpen={d.setSelectedReportId} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Bot className="h-10 w-10 text-ink-muted" />
              <p className="text-sm font-semibold text-ink">No rescan has run since the server started</p>
              <p className="max-w-sm text-xs text-ink-muted">Start a rescan above, select reports in the Reports tab, or rescan a single report from its detail view.</p>
            </div>
          )}
        </section>

        {/* Model health */}
        <section className="flex flex-col gap-5">
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><Gauge className="h-4 w-4 text-brand" /> Model health</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Avg confidence" value={a.avgConfidence ? `${Math.round(a.avgConfidence * 100)}%` : '—'} tone="text-brand" />
              <Stat label="Reports with media" value={a.withMedia} />
              <Stat label="Rescanned" value={a.rescanned} />
              <Stat label="Never rescanned" value={neverRescanned} />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border p-3 text-xs">
              <Cpu className="h-4 w-4 text-ink-muted" />
              <span className="flex-1 text-ink-secondary">Detection engine</span>
              <span className="font-semibold text-ink">{a.engines.gemini} Gemini · {a.engines.opencv} OpenCV</span>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-bold text-ink">Confidence distribution</h2>
            <BarList items={confidenceBins} />
          </div>
        </section>
      </div>

      {/* Location intelligence */}
      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3 lg:flex-1">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-good/10 text-good"><MapPinned className="h-5 w-5" /></span>
            <div>
              <h2 className="text-sm font-bold text-ink">Location intelligence</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Turns GPS coordinates into real street names and addresses (Google Geocoding when a key is configured, OpenStreetMap otherwise).
                {' '}<strong className="text-ink">{a.unlocated}</strong> report{a.unlocated === 1 ? '' : 's'} still show only coordinates.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={geo.running || !a.unlocated} onClick={() => d.handleStartGeocode(true)} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink disabled:opacity-50">
              {geo.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />} Resolve missing ({a.unlocated})
            </button>
            <button type="button" disabled={geo.running} onClick={() => { if (window.confirm('Re-resolve the address for every report?')) d.handleStartGeocode(false); }} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-50">
              Refresh all
            </button>
          </div>
        </div>
        {(geo.running || geo.total > 0) && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
              <span>{geo.running ? `Resolving report #${geo.current_id ?? '…'}` : 'Last run complete'}</span>
              <span className="font-mono">{geo.done}/{geo.total}</span>
            </div>
            <ProgressBar value={geo.done} total={geo.total} running={geo.running} />
          </div>
        )}
      </section>
    </div>
  );
}
