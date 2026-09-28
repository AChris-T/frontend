import { Loader2, MapPinOff } from 'lucide-react';

/** next/dynamic loading state for maps — also surfaces chunk load errors instead of spinning forever. */
export default function MapLoading({ error }) {
  if (error) {
    return (
      <div className="flex h-full min-h-96 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-ink-muted">
        <MapPinOff className="h-6 w-6 text-critical" />
        <span className="font-semibold text-ink">The map could not be loaded</span>
        <span className="text-xs">{error.message}</span>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-96 items-center justify-center gap-2 text-sm font-semibold text-brand">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
    </div>
  );
}
