import { Camera, MapPin, Bot, CircleCheckBig } from 'lucide-react';

const STEPS = [
  { icon: Camera, title: 'Take a Photo/Video', desc: 'Capture the road fault on your phone' },
  { icon: MapPin, title: 'GPS Auto-tags Location', desc: 'Your exact location is recorded automatically' },
  { icon: Bot, title: 'AI Detects Fault', desc: 'YOLOv8 classifies the fault type and severity' },
  { icon: CircleCheckBig, title: 'Works Department Acts', desc: 'Admin reviews and schedules repair' },
];

export default function HowItWorks() {
  return (
    <div className="border-t border-border bg-surface px-6 py-16 text-center">
      <h2 className="mb-10 text-2xl font-bold text-ink">How It Works</h2>
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="mb-1 font-mono text-xs font-bold text-ink-muted">STEP {i + 1}</div>
            <h3 className="mb-1 text-sm font-bold text-ink">{s.title}</h3>
            <p className="text-xs text-ink-secondary">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
