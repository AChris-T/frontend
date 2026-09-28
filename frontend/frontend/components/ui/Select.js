'use client';
import { Check, ChevronDown } from 'lucide-react';
import Popover, { MenuItem } from './Popover';

/**
 * Responsive replacement for <select>: a portal dropdown on desktop and a
 * bottom sheet on phones. options: [{ value, label, icon? }]
 */
export default function Select({ value, onChange, options, label, icon: Icon, className = '', width = 220 }) {
  const current = options.find((o) => o.value === value) || options[0];

  return (
    <Popover
      title={label}
      align="start"
      width={width}
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex h-10 items-center gap-2 rounded-xl border bg-surface px-3 text-sm text-ink transition-colors hover:bg-surface-2 ${
            open ? 'border-brand ring-2 ring-brand/15' : 'border-border'
          } ${className}`}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-muted" />}
          {current?.icon && !Icon && <current.icon className="h-4 w-4 shrink-0 text-ink-muted" />}
          <span className="flex-1 truncate text-left font-medium">{current?.label}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    >
      {({ close }) => options.map((o) => (
        <MenuItem
          key={o.value}
          icon={o.icon}
          active={o.value === value}
          onClick={() => { onChange(o.value); close(); }}
          hint={o.hint}
        >
          <span className="flex items-center justify-between gap-2">
            {o.label}
            {o.value === value && <Check className="h-4 w-4" />}
          </span>
        </MenuItem>
      ))}
    </Popover>
  );
}
