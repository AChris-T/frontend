import { faultMeta, severityMeta, statusMeta, mediaUrl } from '@/lib/constants';
import Badge from '@/components/ui/Badge';

export default function ReportCard({ report, expanded, onToggle }) {
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
            <img src={mediaUrl(report.photo_url)} alt="Fault" className="mb-3 h-48 w-full rounded-lg object-cover" />
          )}
          {report.video_url && (
            <video src={mediaUrl(report.video_url)} controls className="mb-3 w-full rounded-lg" />
          )}
        </div>
      )}
    </div>
  );
}
