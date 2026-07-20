import { BADGE_CLASSES } from '@/lib/constants';

export default function Badge({ icon: Icon, label, color = 'muted', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${BADGE_CLASSES[color] || BADGE_CLASSES.muted} ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </span>
  );
}
