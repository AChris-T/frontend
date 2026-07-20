'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/ui/Sidebar';
import Badge from '@/components/ui/Badge';
import StatusDropdown from './StatusDropdown';
import DeleteReportButton from './DeleteReportButton';
import FaultDetectionList from './FaultDetectionList';
import LocationInfo from './LocationInfo';
import SolutionPanel from './SolutionPanel';
import { faultMeta, severityMeta, statusMeta, mediaUrl } from '@/lib/constants';

export default function ReportDetailSidebar({ report, onClose, onUpdate, updating, onDelete, deleting }) {
  const [displayed, setDisplayed] = useState(report);

  useEffect(() => {
    if (report) setDisplayed(report);
  }, [report]);

  if (!displayed) return null;

  const detections = displayed.ai_result?.all_detections || [];
  const fm = faultMeta(displayed.fault_type);
  const sev = severityMeta(displayed.severity);
  const st = statusMeta(displayed.status);

  return (
    <Sidebar open={!!report} onClose={onClose} title={`Report #${displayed.id}`}>
      <div className="mb-4 flex items-center justify-between">
        <Badge icon={st.icon} label={st.label} color={st.color} />
        <span className="text-xs text-ink-muted">
          {new Date(displayed.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>

      {displayed.photo_url && (
        <img src={mediaUrl(displayed.photo_url)} alt="Road fault" className="mb-4 h-48 w-full rounded-xl object-cover" />
      )}
      {displayed.video_url && (
        <video src={mediaUrl(displayed.video_url)} controls className="mb-4 w-full rounded-xl" />
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2 p-3 text-center">
          <fm.icon className="mx-auto mb-1 h-5 w-5 text-ink-secondary" />
          <div className="text-xs text-ink-muted">Primary Fault</div>
          <div className="text-sm font-semibold text-ink">{fm.label}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3 text-center">
          <sev.icon className="mx-auto mb-1 h-5 w-5 text-ink-secondary" />
          <div className="text-xs text-ink-muted">Severity</div>
          <div className="text-sm font-semibold text-ink">{sev.label}</div>
        </div>
      </div>

      {detections.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            AI Detections ({detections.length})
          </h3>
          <FaultDetectionList detections={detections} />
        </div>
      )}

      <div className="mb-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Location</h3>
        <LocationInfo latitude={displayed.latitude} longitude={displayed.longitude} roadName={displayed.road_name} />
      </div>

      {displayed.description && (
        <div className="mb-4 rounded-xl border border-border bg-surface-2 p-3 text-sm italic text-ink-secondary">
          &ldquo;{displayed.description}&rdquo;
        </div>
      )}

      <div className="mb-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Solution</h3>
        <SolutionPanel faultType={displayed.fault_type} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Update Status</h3>
        <div className="flex items-center gap-2">
          <StatusDropdown report={displayed} onUpdate={onUpdate} updating={updating} />
          <DeleteReportButton reportId={displayed.id} onDelete={onDelete} deleting={deleting} />
        </div>
      </div>
    </Sidebar>
  );
}
