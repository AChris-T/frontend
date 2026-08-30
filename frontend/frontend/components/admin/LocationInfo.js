'use client';
import { useEffect, useState } from 'react';
import { MapPin, Navigation, Route as RoadIcon, X } from 'lucide-react';
import { reverseGeocode } from '@/lib/api';

export default function LocationInfo({ latitude, longitude, roadName }) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    let active = true;
    reverseGeocode(latitude, longitude)
      .then((res) => { if (active) setAddress(res.data.address); })
      .catch(() => { if (active) setAddress(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [latitude, longitude]);

  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`;

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
      <button
        type="button"
        onClick={() => setShowMap(true)}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-ink transition-opacity hover:opacity-90"
      >
        <Navigation className="h-3.5 w-3.5" /> Get Directions to Fault
      </button>
      {showMap && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-ink/40 p-4" onClick={() => setShowMap(false)}>
          <div role="dialog" aria-modal="true" aria-label="Directions to road fault" className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold text-ink">Directions to Fault</h2>
              <button type="button" aria-label="Close map" onClick={() => setShowMap(false)} className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe title="Google map showing the road fault" src={mapUrl} className="h-[60vh] min-h-80 w-full border-0" loading="lazy" />
          </div>
        </div>
      )}
    </div>
  );
}
