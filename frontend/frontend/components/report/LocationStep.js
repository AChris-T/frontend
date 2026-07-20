import { MapPin, Satellite } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function LocationStep({ onGetLocation, loading, error }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <MapPin className="h-8 w-8" />
      </div>
      <h2 className="mb-2 text-lg font-bold text-ink">Get Your Location</h2>
      <p className="mb-6 text-sm text-ink-muted">
        We need your GPS location to tag this fault to the correct road
      </p>
      {error && <p className="mb-4 rounded-lg bg-critical/10 p-3 text-sm text-critical">{error}</p>}
      <Button onClick={onGetLocation} loading={loading} className="w-full">
        <Satellite className="h-4 w-4" /> Allow Location Access
      </Button>
    </Card>
  );
}
