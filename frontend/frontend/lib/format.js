const GENERIC_ROAD_NAMES = new Set(['Unnamed Road', '', null, undefined]);

/** Best human-readable place for a report — never null. */
export function locationLabel(report) {
  if (!report) return '—';
  if (report.location_name) return report.location_name;
  if (!GENERIC_ROAD_NAMES.has(report.road_name) && !report.road_name?.startsWith('Campus')) return report.road_name;
  if (report.address) return report.address.split(',').slice(0, 2).join(',');
  if (report.latitude != null) return `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
  return 'Unknown location';
}

/** Secondary line under the location: the area/road it belongs to. */
export function locationDetail(report) {
  if (!report) return '';
  if (report.address) {
    const parts = report.address.split(',').map((p) => p.trim());
    return parts.slice(-4, -2).join(', ') || parts.slice(0, 3).join(', ');
  }
  const coords = report.latitude != null ? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}` : '';
  // Don't repeat the coordinates when they are already the main label.
  return locationLabel(report) === coords ? 'GPS coordinates · address pending' : coords;
}

export function formatDate(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', opts);
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function timeAgo(value) {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [unit, size] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function pct(value) {
  return value ? `${Math.round(value * 100)}%` : '—';
}

export function formatDistance(meters) {
  if (meters == null) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

/** Haversine distance in meters. */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function downloadCsv(filename, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
