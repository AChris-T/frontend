'use client';
import { useMemo } from 'react';
import {
  ClipboardList, Inbox, Wrench, CircleCheckBig, Route as RoadIcon, Bot, TrendingUp, TrendingDown,
  Flame, AlertOctagon, Clock, Sparkles, ArrowRight, MapPin, ImageOff, Video,
} from 'lucide-react';
import { computeAnalytics, dailySeries, trendWindow, priorityScore, isOpen, SEVERITY_HEX } from '@/lib/analytics';
import { faultMeta, severityMeta, statusMeta, BADGE_CLASSES } from '@/lib/constants';
import { locationLabel, timeAgo, greeting } from '@/lib/format';
import Badge from '@/components/ui/Badge';
import Thumbnail from '@/components/ui/Thumbnail';
import { TrendChart, BarList, SegmentBar, Sparkline } from './charts/Charts';

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, color, spark, foot, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${BADGE_CLASSES[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {spark && <span className={BADGE_CLASSES[color].split(' ').find((c) => c.startsWith('text-'))}><Sparkline values={spark} /></span>}
      </div>
      <div className="mt-4 font-mono text-3xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      {foot && <div className="mt-3 border-t border-border pt-3 text-xs text-ink-secondary">{foot}</div>}
    </button>
  );
}

function Delta({ now, before }) {
  if (!before && !now) return <span className="text-ink-muted">No reports in the last 2 weeks</span>;
  const diff = now - before;
  const up = diff >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="flex items-center gap-1">
      <Icon className={`h-3.5 w-3.5 ${up ? 'text-serious' : 'text-good'}`} />
      <strong className="text-ink">{now}</strong> this week vs {before} last week
    </span>
  );
}

export default function OverviewView({ d, userName, goTo, onFilter }) {
  const a = useMemo(() => computeAnalytics(d.reports), [d.reports]);
  const days = useMemo(() => trendWindow(d.reports), [d.reports]);
  const trend = useMemo(() => dailySeries(d.reports, days), [d.reports, days]);
  const spark = (pred) => dailySeries(d.reports, 14, pred).map((x) => x.value);

  const queue = useMemo(
    () => d.reports.filter(isOpen).sort((x, y) => priorityScore(y) - priorityScore(x)).slice(0, 6),
    [d.reports]
  );
  const recent = d.reports.slice(0, 8);
  const oldestDays = a.oldestOpenDays;

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-linear-to-br from-brand/15 via-surface to-surface p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p suppressHydrationWarning className="text-sm font-medium text-ink-secondary">{greeting()}{userName ? `, ${userName.split(' ')[0]}` : ''} 👋</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {a.open} open fault{a.open === 1 ? '' : 's'} across {d.stats.affected_roads ?? '—'} road{d.stats.affected_roads === 1 ? '' : 's'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
              {a.critical.length} high-severity fault{a.critical.length === 1 ? ' needs' : 's need'} attention
              {a.oldestOpen && <> · oldest open report is <strong className="text-ink">{oldestDays} days</strong> old</>}
              {a.unlocated > 0 && <> · {a.unlocated} report{a.unlocated === 1 ? '' : 's'} missing a resolved address</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => goTo('map')} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-lg shadow-brand/25 transition-transform hover:-translate-y-0.5">
              <MapPin className="h-4 w-4" /> Open live map
            </button>
            <button type="button" onClick={() => goTo('ai')} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5">
              <Sparkles className="h-4 w-4 text-brand" /> AI command center
            </button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi icon={ClipboardList} label="Total reports" value={a.total} color="info" spark={spark(() => true)}
          foot={<Delta now={a.thisWeek} before={a.lastWeek} />} onClick={() => onFilter({ status: 'all' })} />
        <Kpi icon={Inbox} label="Awaiting triage" value={d.stats.pending} color="warning" spark={spark((r) => r.status === 'reported')}
          foot="Newly reported, not yet actioned" onClick={() => onFilter({ status: 'reported' })} />
        <Kpi icon={Wrench} label="In progress" value={d.stats.in_progress} color="info"
          foot="Repair crews assigned" onClick={() => onFilter({ status: 'in_progress' })} />
        <Kpi icon={CircleCheckBig} label="Fixed" value={d.stats.fixed} color="good"
          foot={`${Math.round(a.resolutionRate * 100)}% resolution rate${a.avgFixHours ? ` · avg ${Math.round(a.avgFixHours / 24)}d to fix` : ''}`}
          onClick={() => onFilter({ status: 'fixed' })} />
        <Kpi icon={RoadIcon} label="Roads affected" value={d.stats.affected_roads ?? '—'} color="serious"
          foot={`of ${d.stats.total_roads} mapped segments`} onClick={() => goTo('map')} />
        <Kpi icon={Bot} label="AI confidence" value={a.avgConfidence ? `${Math.round(a.avgConfidence * 100)}%` : '—'} color="info"
          foot={`${a.scanned} scanned · ${a.rescanned} rescanned`} onClick={() => goTo('ai')} />
      </div>

      {/* Trend + status */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Reports over time" subtitle={`Daily submissions, last ${days} days`}>
          <TrendChart data={trend} />
        </Panel>
        <Panel title="Status pipeline" subtitle="Where every report is right now">
          <SegmentBar segments={a.byStatus} />
        </Panel>
      </div>

      {/* Breakdown */}
      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel title="Fault types" subtitle="All reports, by primary fault">
          <BarList items={a.byFault} onSelect={(item) => onFilter({ fault: item.key })} />
        </Panel>
        <Panel title="Open reports by severity" subtitle="Reported + in progress">
          <BarList items={a.bySeverity} onSelect={(item) => onFilter({ severity: item.key })} />
        </Panel>
        <Panel
          className="lg:col-span-2 2xl:col-span-1"
          title="Hotspots"
          subtitle="Places with the most open faults"
          action={<Flame className="h-4 w-4 text-serious" />}
        >
          <ol className="flex flex-col gap-1.5">
            {a.hotspots.slice(0, 6).map((h, i) => {
              const sev = severityMeta(h.worst);
              return (
                <li key={h.key}>
                  <button
                    type="button"
                    onClick={() => onFilter({ search: h.label })}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs font-bold text-ink-secondary">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{h.label}</span>
                      <span className="text-xs text-ink-muted">{h.value} open fault{h.value === 1 ? '' : 's'}</span>
                    </span>
                    <Badge icon={sev.icon} label={sev.label} color={sev.color} />
                  </button>
                </li>
              );
            })}
            {!a.hotspots.length && <p className="py-6 text-center text-sm text-ink-muted">No open faults 🎉</p>}
          </ol>
        </Panel>
      </div>

      {/* Triage + activity */}
      <div className="grid gap-5 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Priority triage queue"
          subtitle="Ranked by severity and how long they have waited"
          action={
            <button type="button" onClick={() => goTo('reports')} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              All reports <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {queue.map((r) => {
              const fm = faultMeta(r.fault_type);
              const sev = severityMeta(r.severity);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => d.setSelectedReportId(r.id)}
                  className="group flex gap-3 rounded-2xl border border-border p-3 text-left transition-all hover:border-brand/40 hover:shadow-md"
                >
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {r.photo_url ? (
                      <Thumbnail report={r} className="h-full w-full transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-ink-muted">{r.video_url ? <Video className="h-5 w-5" /> : <ImageOff className="h-5 w-5" />}</div>
                    )}
                    <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: SEVERITY_HEX[r.severity] }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <fm.icon className="h-4 w-4 shrink-0 text-ink-secondary" /> <span className="truncate">{fm.label}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-secondary">{locationLabel(r)}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge icon={sev.icon} label={sev.label} color={sev.color} />
                      <span className="flex items-center gap-1 text-[11px] text-ink-muted"><Clock className="h-3 w-3" />{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {!queue.length && <p className="col-span-full py-8 text-center text-sm text-ink-muted">Nothing waiting — every fault is resolved.</p>}
          </div>
        </Panel>

        <Panel className="xl:col-span-2" title="Live activity" subtitle="Latest submissions">
          <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-divider">
            {recent.map((r) => {
              const st = statusMeta(r.status);
              const fm = faultMeta(r.fault_type);
              return (
                <li key={r.id} className="relative">
                  <button type="button" onClick={() => d.setSelectedReportId(r.id)} className="flex w-full items-start gap-3 text-left">
                    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface ${BADGE_CLASSES[st.color]}`}>
                      <st.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="block text-sm text-ink">
                        <strong className="font-mono">#{r.id}</strong> {fm.label.toLowerCase()} reported
                      </span>
                      <span className="block truncate text-xs text-ink-muted">{locationLabel(r)} · {timeAgo(r.created_at)}</span>
                    </span>
                    {(r.severity === 'high' || r.severity === 'critical') && isOpen(r) && <AlertOctagon className="mt-1 h-4 w-4 shrink-0 text-serious" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
