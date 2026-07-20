import { faultMeta, severityMeta } from '@/lib/constants';
import Badge from '@/components/ui/Badge';

export default function FaultDetectionList({ detections = [] }) {
  if (!detections.length) {
    return <p className="text-sm text-ink-muted">No AI detections recorded.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {detections.map((det, i) => {
        const fm = faultMeta(det.fault_type);
        const sev = severityMeta(det.severity);
        const pct = det.confidence ? Math.round(det.confidence * 100) : 0;
        return (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2">
            <fm.icon className="h-4 w-4 shrink-0 text-ink-secondary" />
            <span className="flex-1 text-sm font-medium text-ink">{fm.label}</span>
            <Badge icon={sev.icon} label={sev.label} color={sev.color} />
            {pct > 0 && <span className="w-9 text-right font-mono text-xs text-ink-muted">{pct}%</span>}
          </div>
        );
      })}
    </div>
  );
}
