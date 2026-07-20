'use client';
import { useEffect, useState } from 'react';
import { MapPin, Navigation, Route as RoadIcon } from 'lucide-react';
import { reverseGeocode } from '@/lib/api';

export default function LocationInfo({ latitude, longitude, roadName }) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reverseGeocode(latitude, longitude)
      .then((res) => { if (active) setAddress(res.data.address); })
      .catch(() => { if (active) setAddress(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [latitude, longitude]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <RoadIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <span className="text-sm font-semibold text-ink">{roadName || 'Unmatched road'}</span>
      </div>
      <div className="mb-3 flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
        <span className="text-xs text-ink-secondary">
          {loading ? 'Resolving address…' : address || `${latitude?.toFixed(5)}, ${longitude?.toFixed(5)}`}
        </span>
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-ink transition-opacity hover:opacity-90"
      >
        <Navigation className="h-3.5 w-3.5" /> Get Directions to Fault
      </a>
    </div>
  );
}
