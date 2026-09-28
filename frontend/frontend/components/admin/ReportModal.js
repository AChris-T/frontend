'use client';
import MapLoading from '@/components/location/MapLoading';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronLeft, ChevronRight, Sparkles, Trash2, Loader2, LayoutGrid, Bot, MapPin, History, Wrench, Mail, User,
  CalendarClock, Maximize2, X, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Send, Video, ImageOff, Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { getAdminReport } from '@/lib/api';
import { faultMeta, severityMeta, statusMeta, mediaUrl, BADGE_CLASSES } from '@/lib/constants';
import { solutionFor } from '@/lib/solutions';
import { locationLabel, formatDateTime, timeAgo, distanceMeters } from '@/lib/format';
import { priorityScore } from '@/lib/analytics';
import StatusDropdown from './StatusDropdown';
import ScanOverlay from '@/components/ui/ScanOverlay';
import Thumbnail from '@/components/ui/Thumbnail';

const LocationExplorer = dynamic(() => import('@/components/location/LocationExplorer'), {
  ssr: false,
  loading: MapLoading,
});

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'ai', label: 'AI analysis', icon: Bot },
  { key: 'location', label: 'Location & directions', icon: MapPin },
  { key: 'timeline', label: 'Timeline', icon: History },
  { key: 'fix', label: 'Repair plan', icon: Wrench },
];

function Field({ icon: Icon, label, children }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function Media({ report, scanning, onExpand }) {
  if (report.photo_url) {
    return (
      <div className="group relative overflow-hidden rounded-3xl bg-black">
        {/* Thumbnail shows instantly (blurred); the full-resolution original fades in over it. */}
        {report.thumb_url && <Thumbnail report={report} className="absolute inset-0 h-full w-full scale-110 opacity-60 blur-xl" />}
        <img
          key={report.id}
          src={mediaUrl(report.photo_url)}
          alt={`Road fault #${report.id}`}
          onLoad={(e) => { e.currentTarget.style.opacity = 1; }}
          style={{ opacity: report.thumb_url ? 0 : 1 }}
          className="relative h-72 w-full object-contain transition-opacity duration-500 sm:h-[420px]"
        />
        {scanning && <ScanOverlay label="Re-analysing with AI…" />}
        <button type="button" onClick={onExpand} className="absolute right-3 top-3 rounded-xl bg-black/50 p-2 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="View full size">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    );
  }
  if (report.video_url) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <video src={mediaUrl(report.video_url)} controls className="h-72 w-full sm:h-[420px]" />
        {scanning && <ScanOverlay label="Re-analysing video frames…" />}
      </div>
    );
  }
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-3xl bg-surface-2 text-ink-muted">
      <ImageOff className="h-8 w-8" /> <span className="text-sm">No photo or video was attached</span>
    </div>
  );
}

function Detections({ result }) {
  const detections = result?.all_detections || [];
  if (!detections.length) {
    return <p className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-muted">{result?.message || 'No AI detections recorded for this report.'}</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {detections.map((det, i) => {
        const fm = faultMeta(det.fault_type);
        const sev = severityMeta(det.severity);
        const p = Math.round((det.confidence || 0) * 100);
        return (
          <div key={i} className="rounded-2xl border border-border p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2"><fm.icon className="h-4 w-4 text-ink-secondary" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">{fm.label} {i === 0 && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">PRIMARY</span>}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-brand" style={{ width: `${p}%` }} /></span>
                  <span className="w-9 text-right font-mono text-xs text-ink-secondary">{p}%</span>
                </div>
              </div>
              <Badge icon={sev.icon} label={sev.label} color={sev.color} />
            </div>
            {det.evidence && <p className="mt-2 pl-12 text-xs text-ink-muted">{det.method === 'gemini' ? '🔎 ' : ''}{det.evidence}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ report, detail }) {
  const events = useMemo(() => {
    const list = [{ at: report.created_at, icon: Send, tone: 'info', title: 'Report submitted', body: report.reporter_email ? `by ${report.reporter_name || report.reporter_email}` : 'Anonymous reporter' }];
    (detail?.status_history || []).forEach((h) => {
      const st = statusMeta(h.new_status);
      list.push({ at: h.changed_at, icon: st.icon, tone: st.color, title: `Status → ${st.label}`, body: [h.changed_by && `by ${h.changed_by}`, h.note].filter(Boolean).join(' · ') });
    });
    (detail?.notifications || []).forEach((n) => {
      list.push({ at: n.created_at, icon: Mail, tone: n.email_sent ? 'good' : 'critical', title: n.email_sent ? 'Email sent to reporter' : 'Email failed to send', body: n.message });
    });
    (report.ai_result?.scan_history || []).forEach((s) => {
      if (s.scanned_at) list.push({ at: s.scanned_at, icon: Bot, tone: 'muted', title: 'AI scan', body: `${faultMeta(s.fault_type).label} · ${s.severity || '—'}${s.confidence ? ` · ${Math.round(s.confidence * 100)}%` : ''}` });
    });
    if (report.ai_result?.rescanned_at) {
      list.push({ at: report.ai_result.rescanned_at, icon: Sparkles, tone: 'info', title: 'AI rescan (current result)', body: `${faultMeta(report.fault_type).label} · ${report.severity}${report.confidence ? ` · ${Math.round(report.confidence * 100)}%` : ''}` });
    }
    return list.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [report, detail]);

  return (
    <ol className="relative flex flex-col gap-5 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-divider">
      {events.map((e, i) => (
        <li key={i} className="relative flex gap-4">
          <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-surface ${BADGE_CLASSES[e.tone] || BADGE_CLASSES.muted}`}><e.icon className="h-4 w-4" /></span>
          <div className="pt-1">
            <div className="text-sm font-semibold text-ink">{e.title}</div>
            {e.body && <div className="text-xs text-ink-secondary">{e.body}</div>}
            <div className="mt-0.5 text-[11px] text-ink-muted">{formatDateTime(e.at)} · {timeAgo(e.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function ReportModal({ d, report, orderedIds }) {
  const [tab, setTab] = useState('overview');
  const [detailState, setDetailState] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const open = !!report;
  const id = report?.id;

  useEffect(() => {
    if (!id) return;
    let active = true;
    getAdminReport(id).then((res) => active && setDetailState({ id, data: res.data })).catch(() => {});
    return () => { active = false; };
  }, [id, report?.status, report?.updated_at]);

  const detail = detailState && detailState.id === id ? detailState.data : null;
  const confirmDelete = confirmDeleteId === id;
  const idx = orderedIds.indexOf(id);
  const go = useCallback((delta) => {
    const next = orderedIds[idx + delta];
    if (next != null) d.setSelectedReportId(next);
  }, [orderedIds, idx, d]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || tab === 'location') return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go, tab]);

  const nearby = useMemo(() => {
    if (!report) return [];
    const here = { lat: report.latitude, lon: report.longitude };
    return d.reports
      .filter((r) => r.id !== report.id && distanceMeters(here, { lat: r.latitude, lon: r.longitude }) < 400)
      .sort((a, b) => distanceMeters(here, { lat: a.latitude, lon: a.longitude }) - distanceMeters(here, { lat: b.latitude, lon: b.longitude }));
  }, [d.reports, report]);

  if (!report) return null;

  const fm = faultMeta(report.fault_type);
  const sev = severityMeta(report.severity);
  const scanning = d.rescanning === report.id;
  const canScan = !!(report.photo_url || report.video_url);
  const solution = solutionFor(report.fault_type);
  const result = report.ai_result;
  const previous = result?.scan_history?.[result.scan_history.length - 1];
  const priority = priorityScore(report);

  const close = () => { d.setSelectedReportId(null); setTab('overview'); };

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        size="full"
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono">#{report.id}</span>
            <span className="hidden items-center gap-1.5 font-semibold sm:flex"><fm.icon className="h-4 w-4 text-ink-secondary" />{fm.label}</span>
          </span>
        }
        subtitle={`${locationLabel(report)} · ${timeAgo(report.created_at)}`}
        actions={
          <div className="flex items-center gap-1">
            <span className="hidden text-xs text-ink-muted md:inline">{idx + 1} / {orderedIds.length}</span>
            <button type="button" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Previous report" className="rounded-lg p-2 text-ink-secondary hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" disabled={idx < 0 || idx >= orderedIds.length - 1} onClick={() => go(1)} aria-label="Next report" className="rounded-lg p-2 text-ink-secondary hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
          </div>
        }
        bodyClassName="flex flex-col overflow-hidden"
      >
        {/* Action bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5 sm:px-6">
          <StatusDropdown report={report} onUpdate={d.handleUpdate} updating={d.updating} size="lg" />
          <Badge icon={sev.icon} label={`${sev.label} severity`} color={sev.color} />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!canScan || scanning}
              onClick={() => { setTab('ai'); d.handleRescanOne(report.id); }}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-brand-ink shadow shadow-brand/25 disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {scanning ? 'Scanning…' : 'Rescan with AI'}
            </button>
            <button
              type="button"
              disabled={d.deleting === report.id}
              onClick={() => { if (confirmDelete) { d.handleDelete(report.id); } else { setConfirmDeleteId(report.id); setTimeout(() => setConfirmDeleteId(null), 4000); } }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${confirmDelete ? 'border-critical bg-critical text-white' : 'border-border text-critical hover:bg-critical/10'}`}
            >
              {d.deleting === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{confirmDelete ? 'Confirm delete' : 'Delete'}</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 sm:px-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors ${tab === t.key ? 'text-brand' : 'text-ink-muted hover:text-ink'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {tab === t.key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'overview' && (
            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                <Media report={report} scanning={scanning} onExpand={() => setLightbox(true)} />
                {report.description && (
                  <blockquote className="rounded-2xl border-l-4 border-brand bg-surface-2 p-4 text-sm italic text-ink-secondary">&ldquo;{report.description}&rdquo;</blockquote>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-2.5">
                  <Field icon={fm.icon} label="Primary fault">{fm.label}</Field>
                  <Field icon={sev.icon} label="Severity">{sev.label}</Field>
                  <Field icon={Bot} label="AI confidence">{report.confidence ? `${Math.round(report.confidence * 100)}%` : 'Manual entry'}</Field>
                  <Field icon={AlertTriangle} label="Priority score">{Math.round(priority)}</Field>
                  <Field icon={CalendarClock} label="Reported">{formatDateTime(report.created_at)}</Field>
                  <Field icon={History} label="Last updated">{timeAgo(report.updated_at)}</Field>
                </dl>
                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Reporter</div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand"><User className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{report.reporter_name || (report.reporter_email ? 'Guest reporter' : 'Anonymous')}</div>
                      <div className="truncate text-xs text-ink-muted">{report.reporter_email || 'No email — cannot be notified'}</div>
                    </div>
                    {report.reporter_email && (
                      <button type="button" onClick={() => { navigator.clipboard?.writeText(report.reporter_email); toast.success('Email copied'); }} className="rounded-lg p-2 text-ink-muted hover:bg-surface-2" aria-label="Copy email"><Copy className="h-4 w-4" /></button>
                    )}
                  </div>
                  {report.reporter_email && <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-good/10 px-3 py-2 text-xs text-good"><Mail className="h-3.5 w-3.5" /> Status changes are emailed automatically</p>}
                </div>
                <button type="button" onClick={() => setTab('location')} className="group flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:border-brand/40 hover:bg-brand/5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-ink"><MapPin className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{locationLabel(report)}</span>
                    <span className="block truncate text-xs text-ink-muted">{report.address || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-brand">Directions <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </button>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Media report={report} scanning={scanning} onExpand={() => setLightbox(true)} />
                <div className={`rounded-2xl border-2 p-4 ${result?.fault_detected ? 'border-good/40 bg-good/5' : 'border-warning/40 bg-warning/5'}`}>
                  <div className={`flex items-center gap-2 text-sm font-bold ${result?.fault_detected ? 'text-good' : 'text-warning'}`}>
                    {result?.fault_detected ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {result?.fault_detected ? `${result.total_faults || result.all_detections?.length || 1} fault(s) detected` : 'No confident AI detection'}
                  </div>
                  {(result?.summary || result?.message) && <p className="mt-1 text-xs text-ink-secondary">{result.summary || result.message}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-muted">
                    <span className="rounded-full bg-surface px-2 py-1">Engine: <strong className="text-ink">{result?.engine === 'gemini' || result?.all_detections?.[0]?.method === 'gemini' ? `Gemini Vision${result?.model ? ` (${result.model})` : ''}` : result ? 'OpenCV heuristics' : '—'}</strong></span>
                    {result?.rescanned_at && <span className="rounded-full bg-surface px-2 py-1">Rescanned {timeAgo(result.rescanned_at)}</span>}
                    {result?.rescan_count > 0 && <span className="rounded-full bg-surface px-2 py-1">{result.rescan_count} rescan(s)</span>}
                    {result?.last_rescan_attempt?.kept_previous && (
                      <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">Last rescan {timeAgo(result.last_rescan_attempt.at)}: Gemini unavailable, result kept</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Detections</h3>
                <Detections result={result} />
                {previous && (
                  <div className="rounded-2xl border border-border p-4">
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Before vs after rescan</h3>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                      <div className="rounded-xl bg-surface-2 p-3">
                        <div className="text-[11px] text-ink-muted">Previous</div>
                        <div className="font-semibold text-ink">{faultMeta(previous.fault_type).label}</div>
                        <div className="text-xs capitalize text-ink-secondary">{previous.severity} · {previous.confidence ? `${Math.round(previous.confidence * 100)}%` : '—'}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-ink-muted" />
                      <div className="rounded-xl bg-brand/10 p-3">
                        <div className="text-[11px] text-brand">Current</div>
                        <div className="font-semibold text-ink">{fm.label}</div>
                        <div className="text-xs capitalize text-ink-secondary">{report.severity} · {report.confidence ? `${Math.round(report.confidence * 100)}%` : '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
                {!canScan && <p className="rounded-2xl bg-surface-2 p-4 text-xs text-ink-muted">This report has no media, so it cannot be rescanned.</p>}
              </div>
            </div>
          )}

          {tab === 'location' && (
            <div className="h-full min-h-[560px]">
              <LocationExplorer report={report} nearby={nearby} onSelectNearby={(r) => d.setSelectedReportId(r.id)} />
            </div>
          )}

          {tab === 'timeline' && (
            <div className="mx-auto max-w-2xl p-4 sm:p-8">
              {!detail ? <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</div> : <Timeline report={report} detail={detail} />}
            </div>
          )}

          {tab === 'fix' && (
            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-border p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><Wrench className="h-4 w-4 text-brand" /> Recommended repair — {fm.label}</h3>
                <ol className="flex flex-col gap-3">
                  {solution.fix.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-ink">{i + 1}</span>
                      <span className="pt-1 text-sm text-ink-secondary">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="rounded-3xl border border-border p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><ShieldCheck className="h-4 w-4 text-good" /> Prevent recurrence</h3>
                <ul className="flex flex-col gap-3">
                  {solution.prevention.map((tip, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink-secondary"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" />{tip}</li>
                  ))}
                </ul>
                {nearby.length > 0 && (
                  <p className="mt-5 rounded-2xl bg-warning/10 p-3 text-xs text-ink-secondary">
                    <strong className="text-ink">{nearby.length} other report(s)</strong> within 400 m — consider repairing them in the same site visit.
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </Modal>

      {lightbox && report.photo_url && (
        <div className="animate-fade-in fixed inset-0 z-[1300] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(false)}>
          <img src={mediaUrl(report.photo_url)} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" onClick={() => setLightbox(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X className="h-5 w-5" /></button>
        </div>
      )}
    </>
  );
}
