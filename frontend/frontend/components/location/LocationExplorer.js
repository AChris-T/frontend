'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import {
  Navigation, Crosshair, Copy, Layers, MapPin, Route as RouteIcon, Car, Footprints, Loader2,
  LocateFixed, MousePointerClick, ArrowUp, CornerUpLeft, CornerUpRight, RotateCcw, Flag, Share2,
} from 'lucide-react';
import { reverseGeocode } from '@/lib/api';
import { formatDistance, formatDuration, locationLabel, distanceMeters } from '@/lib/format';
import { BASE_LAYERS } from '@/lib/map-layers';
import 'leaflet/dist/leaflet.css';

const SEVERITY_HEX = { none: '#898781', low: '#0ca30c', medium: '#fab219', high: '#ec835a', critical: '#d03b3b' };
const WALK_SPEED = 1.35; // m/s

function faultIcon(color) {
  return L.divIcon({
    className: 'fault-pin',
    iconSize: [44, 56],
    iconAnchor: [22, 52],
    html: `
      <div style="position:relative;width:44px;height:56px">
        <span class="animate-pulse-ring" style="position:absolute;left:10px;top:34px;width:24px;height:24px;border-radius:9999px;background:${color}"></span>
        <svg width="44" height="52" viewBox="0 0 44 52" style="position:absolute;inset:0;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))">
          <path d="M22 2C11.5 2 3 10.3 3 20.6 3 34.5 22 50 22 50s19-15.5 19-29.4C41 10.3 32.5 2 22 2z" fill="${color}" stroke="white" stroke-width="3"/>
          <circle cx="22" cy="20.5" r="7" fill="white"/>
        </svg>
      </div>`,
  });
}

const originIcon = L.divIcon({
  className: 'fault-pin',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#2a78d6;border:4px solid white;box-shadow:0 0 0 6px rgba(42,120,214,.25),0 4px 10px rgba(0,0,0,.3)"></div>',
});

function FitTo({ points, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.flyTo(points[0], 18, { duration: 0.8 });
    else map.flyToBounds(L.latLngBounds(points), { padding: [60, 60], duration: 0.8, maxZoom: 18 });
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickToSetOrigin({ enabled, onPick }) {
  useMapEvents({ click: (e) => enabled && onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, 19, { duration: 0.6 }); }, [target, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [map]);
  return null;
}

function stepIcon(step) {
  const mod = step.maneuver?.modifier || '';
  if (step.maneuver?.type === 'arrive') return Flag;
  if (step.maneuver?.type === 'depart') return Navigation;
  if (mod.includes('uturn')) return RotateCcw;
  if (mod.includes('left')) return CornerUpLeft;
  if (mod.includes('right')) return CornerUpRight;
  return ArrowUp;
}

function stepText(step) {
  const { type, modifier } = step.maneuver || {};
  const road = step.name ? ` onto ${step.name}` : '';
  switch (type) {
    case 'depart': return `Head ${modifier || 'out'}${step.name ? ` on ${step.name}` : ''}`;
    case 'arrive': return 'Arrive at the reported fault';
    case 'roundabout':
    case 'rotary': return `Take the roundabout${road}`;
    case 'end of road':
    case 'turn':
    case 'fork':
    case 'on ramp':
    case 'off ramp': return `${modifier === 'straight' ? 'Continue straight' : `Turn ${modifier || ''}`}${road}`.trim();
    case 'new name':
    case 'continue': return `Continue${road || ' straight'}`;
    default: return `${type ? type[0].toUpperCase() + type.slice(1) : 'Continue'}${road}`;
  }
}

/**
 * Everything about a fault's location in one place: interactive map with
 * satellite / street / dark layers, in-app turn-by-turn directions (OSRM),
 * resolved address, nearby reports and copy/share tools.
 */
export default function LocationExplorer({ report, nearby = [], onSelectNearby, compact = false }) {
  const target = useMemo(() => ({ lat: report.latitude, lon: report.longitude }), [report.latitude, report.longitude]);
  const [layer, setLayer] = useState('satellite');
  const coordKey = `${report.latitude},${report.longitude}`;
  const [fetched, setFetched] = useState(null);
  const address = report.address || (fetched?.key === coordKey ? fetched.address : null);
  const [origin, setOrigin] = useState(null);
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [mode, setMode] = useState('drive');
  const [fitKey, setFitKey] = useState(0);
  const [flyTarget, setFlyTarget] = useState(null);

  const color = SEVERITY_HEX[report.severity] || SEVERITY_HEX.medium;
  const icon = useMemo(() => faultIcon(color), [color]);
  const coords = `${target.lat.toFixed(6)}, ${target.lon.toFixed(6)}`;

  useEffect(() => {
    if (report.address) return;
    let active = true;
    reverseGeocode(target.lat, target.lon)
      .then((res) => active && setFetched({ key: coordKey, address: res.data.address }))
      .catch(() => {});
    return () => { active = false; };
  }, [report.address, target.lat, target.lon, coordKey]);

  const fetchRoute = useCallback(async (from) => {
    setRouting(true);
    setRoute(null);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${target.lon},${target.lat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json();
      const r = data.routes?.[0];
      if (!r) throw new Error('No route');
      setRoute({
        distance: r.distance,
        duration: r.duration,
        line: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
        steps: r.legs.flatMap((leg) => leg.steps).filter((s) => s.distance > 0 || s.maneuver?.type === 'arrive'),
      });
      setFitKey((k) => k + 1);
    } catch {
      // Straight-line fallback so the admin still gets a bearing and distance.
      const d = distanceMeters(from, target);
      setRoute({ distance: d, duration: d / 8, line: [[from.lat, from.lon], [target.lat, target.lon]], steps: [], straight: true });
      setFitKey((k) => k + 1);
      toast('Road routing unavailable — showing straight-line distance', { icon: '📍' });
    } finally {
      setRouting(false);
    }
  }, [target]);

  const setStart = useCallback((point) => {
    setOrigin(point);
    setPicking(false);
    fetchRoute(point);
  }, [fetchRoute]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation is not supported on this device'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setStart({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      () => { setLocating(false); toast.error('Location permission denied — tap the map to choose a start point'); setPicking(true); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearRoute = () => { setRoute(null); setOrigin(null); setFitKey((k) => k + 1); };

  const copy = async (value, label) => {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copied`); } catch { toast.error('Could not copy'); }
  };

  const share = async () => {
    const text = `Road fault #${report.id} — ${locationLabel(report)} (${coords})`;
    if (navigator.share) {
      try { await navigator.share({ title: `Road fault #${report.id}`, text }); } catch { /* dismissed */ }
    } else {
      copy(text, 'Location details');
    }
  };

  const fitPoints = route ? route.line : [[target.lat, target.lon]];
  const eta = route ? (mode === 'walk' ? route.distance / WALK_SPEED : route.duration) : null;

  return (
    <div className={`flex h-full min-h-0 flex-col lg:flex-row ${compact ? '' : 'bg-surface'}`}>
      {/* Map */}
      <div className="relative h-[46dvh] min-h-72 shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
        <MapContainer center={[target.lat, target.lon]} zoom={18} maxZoom={20} className="h-full w-full" zoomControl={false}>
          <TileLayer key={layer} url={BASE_LAYERS[layer].url} attribution={BASE_LAYERS[layer].attribution} maxZoom={20} maxNativeZoom={BASE_LAYERS[layer].maxNativeZoom} />
          {BASE_LAYERS[layer].labels && <TileLayer key={`${layer}-labels`} url={BASE_LAYERS[layer].labels} maxZoom={20} maxNativeZoom={BASE_LAYERS[layer].maxNativeZoom} />}
          <InvalidateOnResize />
          <FitTo points={fitPoints} trigger={fitKey} />
          <FlyTo target={flyTarget} />
          <ClickToSetOrigin enabled={picking} onPick={setStart} />

          {nearby.map((r) => (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={7}
              pathOptions={{ color: 'white', weight: 2, fillColor: SEVERITY_HEX[r.severity] || '#898781', fillOpacity: 0.95 }}
              eventHandlers={{ click: () => onSelectNearby?.(r) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>#{r.id} · {r.fault_type?.replace(/_/g, ' ')}</Tooltip>
            </CircleMarker>
          ))}

          {route && (
            <>
              <Polyline positions={route.line} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
              <Polyline positions={route.line} pathOptions={{ color: '#2a78d6', weight: 5, opacity: 1, dashArray: route.straight ? '8 10' : null }} />
            </>
          )}
          {origin && <Marker position={[origin.lat, origin.lon]} icon={originIcon} />}
          <Marker position={[target.lat, target.lon]} icon={icon} />
        </MapContainer>

        {/* Map controls */}
        <div className="absolute left-3 top-3 z-[500] flex overflow-hidden rounded-xl border border-border bg-surface/95 p-1 shadow-lg backdrop-blur">
          {Object.entries(BASE_LAYERS).map(([key, l]) => (
            <button
              key={key}
              type="button"
              onClick={() => setLayer(key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${layer === key ? 'bg-brand text-brand-ink' : 'text-ink-secondary hover:bg-surface-2'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
          <button type="button" title="Recenter on fault" onClick={() => setFitKey((k) => k + 1)} className="rounded-xl border border-border bg-surface/95 p-2.5 text-ink shadow-lg backdrop-blur hover:bg-surface-2">
            <Crosshair className="h-4 w-4" />
          </button>
          <button type="button" title="Layers" onClick={() => setLayer((l) => (l === 'satellite' ? 'streets' : l === 'streets' ? 'dark' : 'satellite'))} className="rounded-xl border border-border bg-surface/95 p-2.5 text-ink shadow-lg backdrop-blur hover:bg-surface-2">
            <Layers className="h-4 w-4" />
          </button>
        </div>
        {picking && (
          <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-surface shadow-xl">
            <MousePointerClick className="h-4 w-4 shrink-0" /> Tap anywhere on the map to set your starting point
            <button type="button" onClick={() => setPicking(false)} className="ml-auto text-xs font-bold underline">Cancel</button>
          </div>
        )}
        {route && !picking && (
          <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center gap-4 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-xl backdrop-blur lg:hidden">
            <div>
              <div className="font-mono text-lg font-bold text-ink">{formatDuration(eta)}</div>
              <div className="text-xs text-ink-muted">{formatDistance(route.distance)} · {mode === 'walk' ? 'walking' : 'driving'}</div>
            </div>
            <button type="button" onClick={clearRoute} className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">Clear</button>
          </div>
        )}
      </div>

      {/* Side panel */}
      <aside className="flex min-h-0 w-full flex-col border-t border-border lg:w-[400px] lg:shrink-0 lg:border-l lg:border-t-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: color }}>
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-ink">{locationLabel({ ...report, address: report.address || address })}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{address || 'Resolving address…'}</div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => copy(coords, 'Coordinates')} className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 text-[11px] font-semibold text-ink-secondary hover:bg-surface-2">
              <Copy className="h-4 w-4" /> Coords
            </button>
            <button type="button" disabled={!address} onClick={() => copy(address, 'Address')} className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 text-[11px] font-semibold text-ink-secondary hover:bg-surface-2 disabled:opacity-40">
              <MapPin className="h-4 w-4" /> Address
            </button>
            <button type="button" onClick={share} className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 text-[11px] font-semibold text-ink-secondary hover:bg-surface-2">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>

          <dl className="mb-5 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-ink-muted">Latitude</dt>
              <dd className="mt-0.5 font-mono font-semibold text-ink">{target.lat.toFixed(6)}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-ink-muted">Longitude</dt>
              <dd className="mt-0.5 font-mono font-semibold text-ink">{target.lon.toFixed(6)}</dd>
            </div>
            {report.road_name && (
              <div className="col-span-2 rounded-xl bg-surface-2 p-3">
                <dt className="text-ink-muted">Matched road segment</dt>
                <dd className="mt-0.5 font-semibold text-ink">{report.road_name}{report.road_type ? ` · ${report.road_type}` : ''}</dd>
              </div>
            )}
          </dl>

          {/* Directions */}
          <div className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
              <RouteIcon className="h-4 w-4 text-brand" /> Directions to fault
            </div>

            {!route && (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating || routing}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {locating || routing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  {locating ? 'Finding you…' : routing ? 'Plotting route…' : 'From my location'}
                </button>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2"
                >
                  <MousePointerClick className="h-4 w-4" /> Pick a start point on the map
                </button>
              </div>
            )}

            {route && (
              <>
                <div className="mb-3 flex rounded-xl bg-surface-2 p-1">
                  {[['drive', Car, 'Drive'], ['walk', Footprints, 'Walk']].map(([key, Icon, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMode(key)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${mode === key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <div className="font-mono text-2xl font-bold text-ink">{formatDuration(eta)}</div>
                    <div className="text-xs text-ink-muted">{formatDistance(route.distance)}{route.straight ? ' · straight line' : ''}</div>
                  </div>
                  <button type="button" onClick={clearRoute} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2">
                    Clear
                  </button>
                </div>
                {route.steps.length > 0 && (
                  <ol className="-mx-1 max-h-72 overflow-y-auto">
                    {route.steps.map((step, i) => {
                      const Icon = stepIcon(step);
                      const [lon, lat] = step.maneuver.location;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => setFlyTarget([lat, lon])}
                            className="flex w-full items-start gap-3 rounded-lg px-1 py-2 text-left hover:bg-surface-2"
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="flex-1 text-xs text-ink">{stepText(step)}</span>
                            {step.distance > 0 && <span className="text-[11px] text-ink-muted">{formatDistance(step.distance)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
          </div>

          {nearby.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Nearby reports ({nearby.length})</div>
              <div className="flex flex-col gap-1.5">
                {nearby.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectNearby?.(r)}
                    className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-left text-xs hover:bg-surface-2"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_HEX[r.severity] || '#898781' }} />
                    <span className="font-mono font-semibold text-ink">#{r.id}</span>
                    <span className="flex-1 truncate capitalize text-ink-secondary">{r.fault_type?.replace(/_/g, ' ')}</span>
                    <span className="text-ink-muted">{formatDistance(distanceMeters(target, { lat: r.latitude, lon: r.longitude }))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
