import { Wrench, ShieldCheck } from 'lucide-react';
import { solutionFor } from '@/lib/solutions';

export default function SolutionPanel({ faultType }) {
  const solution = solutionFor(faultType);

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
        <Wrench className="h-3.5 w-3.5" /> Recommended Fix
      </div>
      <ol className="mb-3 list-decimal space-y-1 pl-4 text-xs text-ink-secondary">
        {solution.fix.map((step, i) => <li key={i}>{step}</li>)}
      </ol>

      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
        <ShieldCheck className="h-3.5 w-3.5" /> Prevent Recurrence
      </div>
      <ul className="list-disc space-y-1 pl-4 text-xs text-ink-secondary">
        {solution.prevention.map((tip, i) => <li key={i}>{tip}</li>)}
      </ul>
    </div>
  );
}
