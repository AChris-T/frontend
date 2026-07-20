import Link from 'next/link';
import { Camera, UserPlus } from 'lucide-react';

export default function Hero() {
  return (
    <div className="border-b border-border bg-surface px-6 py-20 text-center">
      <h1 className="mb-3 text-4xl font-bold text-ink sm:text-5xl">UI Road Monitor</h1>
      <p className="mb-1 text-lg text-ink-secondary">
        GIS-Based Road Infrastructure Condition Monitoring System
      </p>
      <p className="mb-10 text-sm text-ink-muted">University of Ibadan — Faculty of Technology</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/report"
          className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90"
        >
          <Camera className="h-4 w-4" /> Report a Fault
        </Link>
        <Link
          href="/register"
          className="flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          <UserPlus className="h-4 w-4" /> Create Account
        </Link>
      </div>
    </div>
  );
}
