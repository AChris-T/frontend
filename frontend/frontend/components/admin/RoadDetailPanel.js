import { X } from 'lucide-react';
import { severityMeta, statusMeta, mediaUrl } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import StatusDropdown from './StatusDropdown';
import DeleteReportButton from './DeleteReportButton';

export default function RoadDetailPanel({ road, reports, onClose, onSelectReport, onUpdate, updating, onDelete, deleting }) {
  if (!road) return null;
  const sev = severityMeta(road.severity);

  return (
    <Card padded={false} className="flex h-[70vh] max-h-160 min-h-100 flex-col overflow-hidden">
      <div className="border-b border-border p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">{road.name || 'Unnamed Road'}</h3>
          <button onClick={onClose} className="shrink-0 rounded-full p-1.5 text-ink-muted hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={road.road_type || 'road'} color="info" />
          <Badge icon={sev.icon} label={sev.label} color={sev.color} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-2 p-2">
            <div className="font-mono text-sm font-bold text-ink">{road.fault_count || 0}</div>
            <div className="text-[10px] text-ink-muted">Faults</div>
          </div>
          <div className="rounded-lg bg-surface-2 p-2">
            <div className="font-mono text-sm font-bold text-ink">{reports.length}</div>
            <div className="text-[10px] text-ink-muted">Reports</div>
          </div>
          <div className="rounded-lg bg-surface-2 p-2">
            <div className="text-sm font-bold capitalize text-ink">{road.status || 'good'}</div>
            <div className="text-[10px] text-ink-muted">Status</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {reports.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No faults on this road.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => {
              const rSev = severityMeta(r.severity);
              const rSt = statusMeta(r.status);
              return (
                <div
                  key={r.id}
                  onClick={() => onSelectReport(r)}
                  className="cursor-pointer rounded-xl border border-border p-3 transition-colors hover:bg-surface-2"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">#{r.id}</span>
                    <Badge icon={rSt.icon} label={rSt.label} color={rSt.color} />
                  </div>
                  {r.photo_url && (
                    <img src={mediaUrl(r.photo_url)} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />
                  )}
                  <div className="mb-2 flex items-center gap-2">
                    <Badge icon={rSev.icon} label={rSev.label} color={rSev.color} />
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <StatusDropdown report={r} onUpdate={onUpdate} updating={updating} />
                    <DeleteReportButton reportId={r.id} onDelete={onDelete} deleting={deleting} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
