import { ClipboardList, Route, Inbox, Wrench, CircleCheckBig } from 'lucide-react';
import StatTile from '@/components/ui/StatTile';

export default function StatsRow({ stats }) {
  const tiles = [
    { icon: ClipboardList, label: 'Total Reports', value: stats.total_reports, color: 'info' },
    { icon: Route, label: 'Total Roads', value: stats.total_roads, color: 'info' },
    { icon: Inbox, label: 'Pending', value: stats.pending, color: 'warning' },
    { icon: Wrench, label: 'In Progress', value: stats.in_progress, color: 'info' },
    { icon: CircleCheckBig, label: 'Fixed', value: stats.fixed, color: 'good' },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  );
}
