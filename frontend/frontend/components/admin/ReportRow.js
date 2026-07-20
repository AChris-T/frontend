import { Video, ImageOff } from 'lucide-react';
import { faultMeta, severityMeta, statusMeta, mediaUrl } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import StatusDropdown from './StatusDropdown';
import DeleteReportButton from './DeleteReportButton';

export default function ReportRow({ report, onSelect, onUpdate, updating, onDelete, deleting }) {
  const fm = faultMeta(report.fault_type);
  const sev = severityMeta(report.severity);
  const st = statusMeta(report.status);

  return (
    <tr
      onClick={() => onSelect(report)}
      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
    >
      <td className="px-3 py-3 font-mono font-semibold text-ink">#{report.id}</td>
      <td className="px-3 py-3">
        {report.photo_url ? (
          <img src={mediaUrl(report.photo_url)} alt="" className="h-10 w-14 rounded-lg object-cover" />
        ) : report.video_url ? (
          <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-info/10 text-info">
            <Video className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
            <ImageOff className="h-4 w-4" />
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-1.5 text-ink">
          <fm.icon className="h-4 w-4 text-ink-secondary" />
          {fm.label}
        </span>
      </td>
      <td className="px-3 py-3"><Badge icon={sev.icon} label={sev.label} color={sev.color} /></td>
      <td className="px-3 py-3"><Badge icon={st.icon} label={st.label} color={st.color} /></td>
      <td className="px-3 py-3 text-ink-muted">{report.road_name || (report.road_id ? `#${report.road_id}` : '—')}</td>
      <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
        {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <StatusDropdown report={report} onUpdate={onUpdate} updating={updating} />
          <DeleteReportButton reportId={report.id} onDelete={onDelete} deleting={deleting} />
        </div>
      </td>
    </tr>
  );
}
