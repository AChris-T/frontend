'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Inbox, Wrench, CircleCheckBig, Plus } from 'lucide-react';
import StatTile from '@/components/ui/StatTile';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ReportCard from './ReportCard';

export default function DashboardClient({ initialReports, userName }) {
  const [reports] = useState(initialReports);
  const [selectedId, setSelectedId] = useState(null);
  const router = useRouter();

  const count = (status) => reports.filter((r) => r.status === status).length;
  const stats = [
    { icon: ClipboardList, label: 'Total Reports', value: reports.length, color: 'info' },
    { icon: Inbox, label: 'Reported', value: count('reported'), color: 'warning' },
    { icon: Wrench, label: 'In Progress', value: count('in_progress'), color: 'info' },
    { icon: CircleCheckBig, label: 'Fixed', value: count('fixed'), color: 'good' },
  ];

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card className="mb-8">
        <h1 className="mb-1 text-2xl font-bold text-ink">Welcome, {userName}</h1>
        <p className="text-sm text-ink-muted">Track all your road fault reports here</p>
      </Card>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </div>

      <Card>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">My Reports</h2>
          <Button onClick={() => router.push('/report')}>
            <Plus className="h-4 w-4" /> New Report
          </Button>
        </div>

        {reports.length === 0 ? (
          <div className="py-12 text-center text-ink-muted">
            <p className="mb-4 text-sm">You have not submitted any reports yet.</p>
            <Button onClick={() => router.push('/report')}>Report Your First Fault</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                expanded={selectedId === r.id}
                onToggle={() => setSelectedId(selectedId === r.id ? null : r.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
