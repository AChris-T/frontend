'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const DEFAULT_STAGES = [
  'Uploading media securely',
  'Enhancing image quality',
  'Detecting surface cracks',
  'Measuring pothole depth cues',
  'Classifying fault types',
  'Estimating severity',
];

/** Animated "AI is scanning" layer drawn on top of a photo or video. */
export default function ScanOverlay({ label, stages = DEFAULT_STAGES }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 2200);
    return () => clearInterval(t);
  }, [stages.length]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-live="polite">
      <div className="absolute inset-0 bg-[#07111f]/45" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(rgba(96,165,250,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,.35) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Corner brackets */}
      {['left-4 top-4 border-l-2 border-t-2', 'right-4 top-4 border-r-2 border-t-2', 'bottom-4 left-4 border-b-2 border-l-2', 'bottom-4 right-4 border-b-2 border-r-2'].map((c) => (
        <span key={c} className={`absolute h-8 w-8 rounded-sm border-[#60a5fa] ${c}`} />
      ))}
      {/* Laser */}
      <div className="animate-scan-sweep absolute inset-x-0 h-16 -translate-y-1/2">
        <div className="h-full w-full bg-linear-to-b from-transparent via-[#60a5fa]/35 to-transparent" />
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#93c5fd] shadow-[0_0_18px_4px_rgba(96,165,250,.8)]" />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent px-4 pb-4 pt-12 text-white">
        <div className="mb-2.5 flex gap-1">
          {stages.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= stage ? 'bg-[#93c5fd]' : 'bg-white/20'}`} />
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#93c5fd]" />
          <div className="min-w-0">
            <div className="text-sm font-bold">{label}</div>
            <div key={stage} className="animate-fade-in text-xs text-white/75">{stages[stage]}…</div>
          </div>
        </div>
      </div>
    </div>
  );
}
