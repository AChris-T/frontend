import { CheckCircle2, Mail } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { faultMeta } from '@/lib/constants';

export default function ReviewStep({
  preview, mediaType, location, faultType, severity, aiResult, media, email, onEmail, onSubmit, onBack, loading,
}) {
  const fm = faultMeta(faultType);
  const rows = [
    { label: 'Location', value: location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : 'Not set' },
    { label: 'Fault Type', value: fm.label },
    { label: 'Severity', value: severity?.toUpperCase() || '—' },
    { label: 'AI Confidence', value: aiResult?.confidence ? `${Math.round(aiResult.confidence * 100)}%` : 'Manual entry' },
    { label: 'Media', value: media ? `${mediaType} attached` : 'No media' },
  ];

  return (
    <Card>
      <h2 className="mb-5 flex items-center justify-center gap-2 text-lg font-bold text-ink">
        <CheckCircle2 className="h-5 w-5 text-good" /> Review &amp; Submit
      </h2>

      {preview && (
        mediaType === 'photo'
          ? <img src={preview} alt="Fault" className="mb-4 h-44 w-full rounded-xl object-cover" />
          : <video src={preview} controls className="mb-4 w-full rounded-xl" />
      )}

      <div className="mb-6">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between border-b border-border py-2.5 text-sm last:border-0">
            <span className="text-ink-muted">{row.label}</span>
            <span className="font-medium text-ink">{row.value}</span>
          </div>
        ))}
      </div>

      <Field label="Email (optional — get status updates)">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            className="pl-9"
          />
        </div>
      </Field>

      <Button onClick={onSubmit} loading={loading} className="mb-3 w-full">Submit Report</Button>
      <Button variant="secondary" onClick={onBack} className="w-full">Go Back</Button>
    </Card>
  );
}
