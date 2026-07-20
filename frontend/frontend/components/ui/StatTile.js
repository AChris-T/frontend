import { BADGE_CLASSES } from '@/lib/constants';
import Card from './Card';

export default function StatTile({ icon: Icon, label, value, color = 'info' }) {
  return (
    <Card className="text-center" padded={false}>
      <div className="p-5">
        <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${BADGE_CLASSES[color] || BADGE_CLASSES.info}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-mono text-3xl font-bold text-ink">{value}</div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      </div>
    </Card>
  );
}
