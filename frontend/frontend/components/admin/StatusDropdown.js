'use client';
import { ChevronDown, Loader2 } from 'lucide-react';
import { STATUS, statusMeta, BADGE_CLASSES } from '@/lib/constants';
import Popover, { MenuItem } from '@/components/ui/Popover';

const OPTIONS = ['reported', 'in_progress', 'fixed', 'rejected'];

export default function StatusDropdown({ report, onUpdate, updating, size = 'sm' }) {
  const current = statusMeta(report.status);
  const busy = updating === report.id;

  return (
    <Popover
      title={`Report #${report.id} status`}
      width={220}
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          disabled={busy}
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
            BADGE_CLASSES[current.color]
          } ${open ? 'ring-2 ring-current/30' : 'hover:brightness-95'} ${size === 'lg' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <current.icon className="h-3.5 w-3.5" />}
          {current.label}
          <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    >
      {({ close }) => OPTIONS.map((status) => {
        const meta = STATUS[status];
        const active = report.status === status;
        return (
          <MenuItem
            key={status}
            icon={meta.icon}
            active={active}
            disabled={active}
            hint={active ? 'Current' : undefined}
            onClick={() => { onUpdate(report.id, status); close(); }}
          >
            {meta.label}
          </MenuItem>
        );
      })}
    </Popover>
  );
}
