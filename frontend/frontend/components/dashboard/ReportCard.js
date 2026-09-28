import { MapPin, Navigation } from 'lucide-react';
import { faultMeta, severityMeta, statusMeta, mediaUrl } from '@/lib/constants';
import { locationLabel } from '@/lib/format';
import Badge from '@/components/ui/Badge';
import Thumbnail from '@/components/ui/Thumbnail';

export default function ReportCard({ report, expanded, onToggle, onLocate }) {
  const fm = faultMeta(report.fault_type);
  const sev = severityMeta(report.severity);
  const st = statusMeta(report.status);

  return (
    <div
      onClick={onToggle}
      className={`cursor-pointer rounded-xl border p-4 transition-colors ${
        expanded ? 'border-brand bg-surface-2' : 'border-border hover:bg-surface-2'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-ink">#{report.id}</span>
          <span className="text-xs text-ink-muted">
            {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <Badge icon={st.icon} label={st.label} color={st.color} />
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onLocate(report); }}
        className="mt-2 flex max-w-full items-center gap-1.5 text-left text-xs font-medium text-brand hover:underline"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{locationLabel(report)}</span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-ink-muted">Fault Type</div>
              <div className="mt-1 flex items-center gap-1.5 font-medium text-ink">
                <fm.icon className="h-4 w-4" />{fm.label}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">Severity</div>
              <div className="mt-1"><Badge icon={sev.icon} label={sev.label} color={sev.color} /></div>
            </div>
          </div>

          {report.photo_url && (
            <Thumbnail report={report} alt="Fault" className="mb-3 h-48 w-full rounded-lg" />
          )}
          {report.video_url && (
            <video src={mediaUrl(report.video_url)} controls className="mb-3 w-full rounded-lg" />
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onLocate(report); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink"
          >
            <Navigation className="h-4 w-4" /> View location &amp; directions
          </button>
        </div>
      )}
    </div>
  );
}
