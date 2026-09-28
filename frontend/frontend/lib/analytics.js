import { FAULT_TYPES, SEVERITY, STATUS } from './constants';
import { locationLabel } from './format';

export const STATUS_HEX = { reported: '#fab219', in_progress: '#2a78d6', fixed: '#0ca30c', rejected: '#898781' };
export const SEVERITY_HEX = { none: '#898781', low: '#0ca30c', medium: '#fab219', high: '#ec835a', critical: '#d03b3b' };
const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};

export function dailySeries(reports, days = 30, predicate = () => true) {
  const counts = new Map();
  reports.forEach((r) => {
    if (!predicate(r)) return;
    const k = dayKey(r.created_at);
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      full: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' }),
      value: counts.get(dayKey(d)) || 0,
    });
  }
  return out;
}

/** Picks a window that actually contains data (reports can be weeks old). */
export function trendWindow(reports) {
  if (!reports.length) return 30;
  const oldest = Math.min(...reports.map((r) => new Date(r.created_at).getTime()));
  const span = Math.ceil((Date.now() - oldest) / 86400000) + 1;
  return Math.min(90, Math.max(14, span));
}

export function isOpen(r) {
  return r.status === 'reported' || r.status === 'in_progress';
}

export function computeAnalytics(reports) {
  const total = reports.length;
  const open = reports.filter(isOpen);
  const now = Date.now();
  const week = 7 * 86400000;
  const thisWeek = reports.filter((r) => now - new Date(r.created_at) < week).length;
  const lastWeek = reports.filter((r) => {
    const age = now - new Date(r.created_at);
    return age >= week && age < 2 * week;
  }).length;

  const byFault = Object.entries(FAULT_TYPES)
    .filter(([k]) => !['analyzing', 'none'].includes(k))
    .map(([key, meta]) => ({ key, label: meta.label, icon: meta.icon, value: reports.filter((r) => r.fault_type === key).length }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const bySeverity = ['critical', 'high', 'medium', 'low']
    .map((key) => ({ key, label: SEVERITY[key].label, icon: SEVERITY[key].icon, color: SEVERITY_HEX[key], value: open.filter((r) => r.severity === key).length }));

  const byStatus = Object.entries(STATUS).map(([key, meta]) => ({
    key, label: meta.label, icon: meta.icon, color: STATUS_HEX[key], value: reports.filter((r) => r.status === key).length,
  }));

  // Hotspots: group open reports by resolved place name.
  const groups = new Map();
  open.forEach((r) => {
    const label = locationLabel(r).split(' · ')[0];
    const g = groups.get(label) || { key: label, label, value: 0, worst: 'none', reports: [] };
    g.value += 1;
    g.reports.push(r);
    if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[g.worst]) g.worst = r.severity;
    groups.set(label, g);
  });
  const hotspots = [...groups.values()].sort((a, b) => b.value - a.value || SEVERITY_RANK[b.worst] - SEVERITY_RANK[a.worst]);

  const scanned = reports.filter((r) => r.ai_result);
  const confidences = scanned.map((r) => r.confidence || 0).filter((c) => c > 0);
  const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  const rescanned = reports.filter((r) => r.ai_result?.rescanned_at).length;
  const withMedia = reports.filter((r) => r.photo_url || r.video_url).length;
  const engines = {
    gemini: scanned.filter((r) => r.ai_result?.engine === 'gemini' || r.ai_result?.all_detections?.[0]?.method === 'gemini').length,
  };
  engines.opencv = scanned.length - engines.gemini;

  const fixed = reports.filter((r) => r.status === 'fixed');
  const fixHours = fixed
    .map((r) => (new Date(r.updated_at) - new Date(r.created_at)) / 3600000)
    .filter((h) => h > 0);
  const avgFixHours = fixHours.length ? fixHours.reduce((a, b) => a + b, 0) / fixHours.length : null;

  const oldestOpen = open.reduce((oldest, r) => (!oldest || new Date(r.created_at) < new Date(oldest.created_at) ? r : oldest), null);
  const oldestOpenDays = oldestOpen ? Math.floor((now - new Date(oldestOpen.created_at)) / 86400000) : 0;
  const critical = open.filter((r) => r.severity === 'high' || r.severity === 'critical');
  const unlocated = reports.filter((r) => !r.location_name).length;

  return {
    total, open: open.length, thisWeek, lastWeek, byFault, bySeverity, byStatus, hotspots,
    avgConfidence, rescanned, withMedia, scanned: scanned.length, engines,
    resolutionRate: total ? fixed.length / total : 0, avgFixHours, oldestOpen, oldestOpenDays, critical, unlocated,
  };
}

/** Priority score used to rank the triage queue: severity × age. */
export function priorityScore(r) {
  const days = (Date.now() - new Date(r.created_at)) / 86400000;
  return (SEVERITY_RANK[r.severity] || 1) * 10 + Math.min(30, days) + (r.status === 'reported' ? 5 : 0);
}
