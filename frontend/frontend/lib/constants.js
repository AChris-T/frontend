import {
  CircleDot, Grid3x3, ArrowUpDown, ArrowLeftRight, Waves, CircleHelp,
  Loader2, Minus, Circle, CircleCheck, AlertTriangle, AlertOctagon, Siren,
  Inbox, Wrench, CircleCheckBig, CircleX,
} from 'lucide-react';

export const FAULT_TYPES = {
  pothole: { icon: CircleDot, label: 'Pothole' },
  alligator_crack: { icon: Grid3x3, label: 'Alligator Crack' },
  longitudinal_crack: { icon: ArrowUpDown, label: 'Longitudinal Crack' },
  transverse_crack: { icon: ArrowLeftRight, label: 'Transverse Crack' },
  rutting: { icon: Waves, label: 'Rutting' },
  other: { icon: CircleHelp, label: 'Other' },
  analyzing: { icon: Loader2, label: 'Analyzing…', spin: true },
  none: { icon: Minus, label: 'None' },
};

export function faultMeta(type) {
  return FAULT_TYPES[type] || { icon: CircleHelp, label: type?.replace(/_/g, ' ') || '—' };
}

export const SEVERITY = {
  none: { icon: Circle, label: 'None', color: 'muted' },
  low: { icon: CircleCheck, label: 'Low', color: 'good' },
  medium: { icon: AlertTriangle, label: 'Medium', color: 'warning' },
  high: { icon: AlertOctagon, label: 'High', color: 'serious' },
  critical: { icon: Siren, label: 'Critical', color: 'critical' },
};

export function severityMeta(level) {
  return SEVERITY[level] || SEVERITY.none;
}

export const STATUS = {
  reported: { icon: Inbox, label: 'Reported', color: 'warning' },
  in_progress: { icon: Wrench, label: 'In Progress', color: 'info' },
  fixed: { icon: CircleCheckBig, label: 'Fixed', color: 'good' },
  rejected: { icon: CircleX, label: 'Rejected', color: 'muted' },
};

export function statusMeta(status) {
  return STATUS[status] || STATUS.reported;
}

export const API_ASSET_URL = process.env.NEXT_PUBLIC_ASSET_URL || 'http://localhost:8000';

// photo_url/video_url are absolute URLs for R2-hosted media and relative
// /uploads/... paths for local-disk-hosted media (older rows, or local dev
// without R2 configured) — this resolves either into a usable <img>/<video> src.
export function mediaUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_ASSET_URL}${path}`;
}

// Static class strings so Tailwind's content scanner can find them
// (dynamic template interpolation like `bg-${color}` is not detectable).
export const BADGE_CLASSES = {
  good: 'bg-good/10 text-good',
  warning: 'bg-warning/15 text-warning',
  serious: 'bg-serious/10 text-serious',
  critical: 'bg-critical/10 text-critical',
  info: 'bg-info/10 text-info',
  muted: 'bg-muted/10 text-ink-secondary',
};

export const SOLID_CLASSES = {
  good: 'bg-good text-brand-ink',
  warning: 'bg-warning text-ink',
  serious: 'bg-serious text-brand-ink',
  critical: 'bg-critical text-brand-ink',
  info: 'bg-info text-brand-ink',
  muted: 'bg-muted text-brand-ink',
};
