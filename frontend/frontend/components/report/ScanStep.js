import { Bot, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import FaultTypeGrid from '@/components/ui/FaultTypeGrid';
import SeverityGrid from '@/components/ui/SeverityGrid';

export default function ScanStep({
  preview, mediaType, scanning, aiResult,
  faultType, severity, description,
  onFaultType, onSeverity, onDescription, onBack, onContinue,
}) {
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
            {aiResult.fault_detected ? 'Confirm or correct the result below.' : 'Please select the fault type manually below.'}
          </p>
        </div>
      )}

      {!scanning && (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Fault Type</p>
          <FaultTypeGrid value={faultType} onChange={onFaultType} />
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Severity</p>
          <SeverityGrid value={severity} onChange={onSeverity} />
        </>
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
        <Button onClick={onContinue} disabled={scanning || !faultType || !severity} className="flex-[2]">
          {scanning ? 'Scanning…' : 'Continue'}
        </Button>
      </div>
    </Card>
  );
}
