import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { faultMeta } from '@/lib/constants';

export default function SuccessScreen({ reportId, faultType, severity, aiResult, onReset }) {
  const fm = faultMeta(faultType);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-good" />
        <h2 className="mb-1 text-2xl font-bold text-ink">Report Submitted!</h2>
        <p className="mb-4 text-sm text-ink-muted">Report ID: <strong className="text-ink">#{reportId}</strong></p>

        <div className="mb-4 rounded-xl bg-surface-2 p-4 text-left text-sm">
          <p className="mb-1 flex items-center gap-1.5">
            <fm.icon className="h-4 w-4 text-ink-secondary" /><strong>Fault Type:</strong> {fm.label}
          </p>
          <p className="mb-1"><strong>Severity:</strong> {severity?.toUpperCase()}</p>
          {aiResult && (
            <p><strong>AI Confidence:</strong> {aiResult.confidence ? `${Math.round(aiResult.confidence * 100)}%` : 'N/A'}</p>
          )}
        </div>

        <div className="mb-6 rounded-xl bg-warning/10 p-3 text-xs text-ink-secondary">
          Create an account to track this report and get email updates.
        </div>

        <div className="flex justify-center gap-3">
          <Link href="/register"><Button>Create Account</Button></Link>
          <Button variant="secondary" onClick={onReset}>Report Another</Button>
        </div>
      </Card>
    </div>
  );
}
