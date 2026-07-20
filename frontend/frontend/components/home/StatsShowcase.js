import { Route, MapPin, Bot, Zap } from 'lucide-react';
import StatTile from '@/components/ui/StatTile';

const STATS = [
  { icon: Route, label: 'Road Segments', value: '335', color: 'info' },
  { icon: MapPin, label: 'Campus Coverage', value: '100%', color: 'good' },
  { icon: Bot, label: 'AI Detection', value: 'YOLOv8', color: 'info' },
  { icon: Zap, label: 'Real-time Updates', value: 'Live', color: 'warning' },
];

export default function StatsShowcase() {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-2 gap-5 px-6 py-14 sm:grid-cols-4">
      {STATS.map((s) => (
        <StatTile key={s.label} {...s} />
      ))}
    </div>
  );
}
