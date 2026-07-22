import { Video, ImageOff } from 'lucide-react';
import { faultMeta, severityMeta, statusMeta, mediaUrl } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import StatusDropdown from './StatusDropdown';
import DeleteReportButton from './DeleteReportButton';

export default function ReportCardRow({ report, onSelect, onUpdate, updating, onDelete, deleting }) {
  const fm = faultMeta(report.fault_type);
  const sev = severityMeta(report.severity);
  const st = statusMeta(report.status);

  return (
    <div
      onClick={() => onSelect(report)}
      className="cursor-pointer rounded-xl border border-border p-3 transition-colors hover:bg-surface-2"
    >
      <div className="mb-2 flex items-center gap-3">
        {report.photo_url ? (
          <img src={mediaUrl(report.photo_url)} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
        ) : report.video_url ? (
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
            <Video className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
            <ImageOff className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-ink">#{report.id}</span>
            <Badge icon={st.icon} label={st.label} color={st.color} />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-secondary">
            <fm.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{fm.label}</span>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <Badge icon={sev.icon} label={sev.label} color={sev.color} />
        <span>{report.road_name || (report.road_id ? `Road #${report.road_id}` : 'Unmatched')}</span>
        <span>·</span>
        <span>{new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <StatusDropdown report={report} onUpdate={onUpdate} updating={updating} />
        <DeleteReportButton reportId={report.id} onDelete={onDelete} deleting={deleting} />
      </div>
    </div>
  );
}
