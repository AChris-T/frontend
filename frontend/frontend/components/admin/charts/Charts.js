'use client';
import { useMemo, useRef, useState } from 'react';

const SERIES = 'var(--brand)';

/** Single-series area + line trend with a crosshair tooltip. */
export function TrendChart({ data, height = 220, valueLabel = 'reports' }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 720;
  const H = height;
  const pad = { top: 16, right: 12, bottom: 26, left: 32 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const x = (i) => pad.left + (i * (W - pad.left - pad.right)) / Math.max(1, data.length - 1);
  const y = (v) => pad.top + (1 - v / niceMax) * (H - pad.top - pad.bottom);

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, niceMax / 4, niceMax / 2, (3 * niceMax) / 4, niceMax];
  const labelEvery = Math.ceil(data.length / 6);

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.left) / (W - pad.left - pad.right)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        onMouseMove={onMove}
        onTouchMove={(e) => onMove(e.touches[0])}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Daily ${valueLabel} over the last ${data.length} days`}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity="0.28" />
            <stop offset="100%" stopColor={SERIES} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--divider)" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-muted)">{Math.round(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1) && (
          <text key={d.label} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">{d.label}</text>
        ))}
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={y(0)} stroke="var(--ink-muted)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(h.value)} r="5" fill={SERIES} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <div className="font-semibold text-ink">{h.value} {valueLabel}</div>
          <div className="text-ink-muted">{h.full || h.label}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Horizontal bar list. Bars use one series color unless an item carries its
 * own (only for status/severity, which always ship with an icon + label).
 */
export function BarList({ items, onSelect, emptyText = 'No data yet' }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0) || 1;

  if (!items.length) return <p className="py-6 text-center text-sm text-ink-muted">{emptyText}</p>;

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, idx) => (
        <li key={item.key}>
          <button
            type="button"
            onClick={() => onSelect?.(item)}
            onMouseEnter={() => setHover(idx)}
            onMouseLeave={() => setHover(null)}
            className={`group w-full text-left ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink">
                {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0 text-ink-secondary" />}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 font-mono text-ink-secondary">
                {item.value}
                <span className={`ml-1.5 text-ink-muted transition-opacity ${hover === idx ? 'opacity-100' : 'opacity-0'}`}>
                  {Math.round((item.value / total) * 100)}%
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color || SERIES }}
              />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Part-to-whole bar for status (≤5 segments) with a labelled legend. */
export function SegmentBar({ segments }) {
  const [hover, setHover] = useState(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-ink-muted">No reports yet</p>;

  return (
    <div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover && hover !== s.key ? 0.4 : 1 }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {segments.map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${hover === s.key ? 'border-ink-muted/40 bg-surface-2' : 'border-border'}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            {s.icon && <s.icon className="h-3.5 w-3.5 shrink-0 text-ink-secondary" />}
            <span className="flex-1 truncate text-xs font-medium text-ink-secondary">{s.label}</span>
            <span className="font-mono text-sm font-bold text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 96, height = 28 }) {
  const path = useMemo(() => {
    if (!values.length) return '';
    const max = Math.max(1, ...values);
    return values.map((v, i) => {
      const px = (i / Math.max(1, values.length - 1)) * (width - 4) + 2;
      const py = height - 2 - (v / max) * (height - 4);
      return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  }, [values, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
