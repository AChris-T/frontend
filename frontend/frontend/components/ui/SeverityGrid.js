import { SEVERITY } from '@/lib/constants';

const LEVELS = ['low', 'medium', 'high'];

export default function SeverityGrid({ value, onChange }) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {LEVELS.map((key) => {
        const meta = SEVERITY[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors ${
              value === key ? 'border-brand bg-brand/10' : 'border-border hover:bg-surface-2'
            }`}
          >
            <meta.icon className="h-5 w-5 text-ink-secondary" />
            <span className="text-xs font-semibold text-ink">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
