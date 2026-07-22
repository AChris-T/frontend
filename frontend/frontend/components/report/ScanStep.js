import { Bot, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Input';
import { faultMeta, severityMeta } from '@/lib/constants';

export default function ScanStep({
  preview, mediaType, scanning, aiResult, description, onDescription, onBack, onContinue,
}) {
  const detections = aiResult?.all_detections || [];

  return (
    <Card>
      <h2 className="mb-4 flex items-center justify-center gap-2 text-lg font-bold text-ink">
        <Bot className="h-5 w-5 text-brand" /> AI Analysis
      </h2>

      {preview && (
        mediaType === 'photo'
          ? <img src={preview} alt="Uploaded" className="mb-4 h-52 w-full rounded-xl object-cover" />
          : <video src={preview} controls className="mb-4 w-full rounded-xl" />
      )}

      {scanning && (
        <div className="mb-4 rounded-xl bg-info/10 p-6 text-center">
          <Search className="mx-auto mb-2 h-8 w-8 animate-pulse text-info" />
          <p className="text-sm font-semibold text-info">AI is scanning your media…</p>
          <p className="text-xs text-ink-muted">Detecting fault type and severity</p>
        </div>
      )}

      {!scanning && aiResult && (
        <div className={`mb-4 rounded-xl border-2 p-4 ${aiResult.fault_detected ? 'border-good bg-good/10' : 'border-warning bg-warning/10'}`}>
          <p className={`mb-1 flex items-center gap-1.5 text-sm font-bold ${aiResult.fault_detected ? 'text-good' : 'text-warning'}`}>
            {aiResult.fault_detected ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {aiResult.fault_detected ? `AI Detected ${aiResult.total_faults} Fault(s)` : 'AI could not detect a fault automatically'}
          </p>
          <p className="text-xs text-ink-secondary">
            {aiResult.fault_detected
              ? 'This report will be filed with the result below.'
              : 'This report will be flagged for manual review by the Works team.'}
          </p>
        </div>
      )}

      {!scanning && detections.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Detected Faults</p>
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
        </div>
      )}

      <Textarea
        placeholder="Add description (optional)…"
        rows={3}
        value={description}
        onChange={(e) => onDescription(e.target.value)}
        className="mb-4"
      />

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={onContinue} disabled={scanning} className="flex-2">
          {scanning ? 'Scanning…' : 'Continue'}
        </Button>
      </div>
    </Card>
  );
}
