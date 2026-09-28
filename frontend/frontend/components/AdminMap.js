'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Loader2, Layers, Maximize2, Minimize2, LocateFixed, ScanSearch, Flame, Route as RoadIcon, MapPin, ChevronDown, Eye,
} from 'lucide-react';
import { getRoadsGeoJSON } from '@/lib/api';
import { BASE_LAYERS } from '@/lib/map-layers';
import { SEVERITY_HEX, STATUS_HEX, isOpen } from '@/lib/analytics';
import { faultMeta } from '@/lib/constants';
import Thumbnail from '@/components/ui/Thumbnail';
import { locationLabel, timeAgo, distanceMeters } from '@/lib/format';
import 'leaflet/dist/leaflet.css';

const CAMPUS_CENTER = [7.4405, 3.8960];

function pinIcon(report, highlighted) {
  const color = SEVERITY_HEX[report.severity] || SEVERITY_HEX.none;
  const open = isOpen(report);
  const urgent = open && (report.severity === 'high' || report.severity === 'critical');
  const size = highlighted ? 22 : 16;
  const ring = STATUS_HEX[report.status] || '#fff';
  return L.divIcon({
    className: 'fault-pin',
    iconSize: [size + 16, size + 16],
    iconAnchor: [(size + 16) / 2, (size + 16) / 2],
    html: `
      <div style="position:relative;width:${size + 16}px;height:${size + 16}px;display:flex;align-items:center;justify-content:center">
        ${urgent ? `<span class="animate-pulse-ring" style="position:absolute;width:${size}px;height:${size}px;border-radius:9999px;background:${color}"></span>` : ''}
        <span style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;background:${color};
          border:3px solid ${open ? '#fff' : ring};opacity:${open ? 1 : 0.55};
          box-shadow:0 2px 8px rgba(0,0,0,.35)${highlighted ? ',0 0 0 4px rgba(42,120,214,.45)' : ''}"></span>
      </div>`,
  });
}

function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    let layer;
    let cancelled = false;
    window.L = window.L || L;
    import('leaflet.heat').then(() => {
      if (cancelled || !L.heatLayer) return;
      layer = L.heatLayer(points, {
        radius: 32, blur: 24, maxZoom: 17, minOpacity: 0.35,
        gradient: { 0.2: '#2a78d6', 0.45: '#fab219', 0.7: '#ec835a', 1: '#d03b3b' },
      }).addTo(map);
    });
    return () => { cancelled = true; if (layer) map.removeLayer(layer); };
  }, [map, points]);
  return null;
}

/** Reports near the median location — keeps one mis-geotagged report from zooming out to a whole region. */
function coreReports(reports) {
  if (reports.length < 3) return reports;
  const median = (vals) => { const v = [...vals].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const center = { lat: median(reports.map((r) => r.latitude)), lon: median(reports.map((r) => r.longitude)) };
  const core = reports.filter((r) => distanceMeters(center, { lat: r.latitude, lon: r.longitude }) < 15000);
  return core.length ? core : reports;
}

function MapController({ fitKey, reports, focus, locateKey }) {
  const map = useMap();
  useEffect(() => {
    const pts = coreReports(reports);
    if (!pts.length) return;
    map.flyToBounds(L.latLngBounds(pts.map((r) => [r.latitude, r.longitude])), { padding: [60, 60], maxZoom: 17, duration: 0.8 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focus) map.flyTo([focus.latitude, focus.longitude], 19, { duration: 0.8 });
  }, [focus, map]);
  useEffect(() => {
    if (!locateKey) return;
    map.locate({ setView: true, maxZoom: 17 });
  }, [locateKey, map]);
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Legend() {
  const [open, setOpen] = useState(true);
  return (
    <div className="absolute bottom-4 left-3 z-[500] w-48 overflow-hidden rounded-2xl border border-border bg-surface/95 text-xs shadow-xl backdrop-blur">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3.5 py-2.5 font-bold text-ink">
        Legend <ChevronDown className={`h-4 w-4 text-ink-muted transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="border-t border-border px-3.5 pb-3 pt-2">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Severity</div>
          {['critical', 'high', 'medium', 'low', 'none'].map((k) => (
            <div key={k} className="mb-1 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: SEVERITY_HEX[k] }} />
              <span className="capitalize text-ink-secondary">{k === 'none' ? 'No faults (road)' : k}</span>
            </div>
          ))}
          <div className="mb-1.5 mt-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Markers</div>
          <div className="mb-1 flex items-center gap-2 text-ink-secondary">
            <span className="relative flex h-3 w-3"><span className="animate-pulse-ring absolute inset-0 rounded-full bg-critical" /><span className="relative h-3 w-3 rounded-full bg-critical" /></span>
            Urgent &amp; open
          </div>
          <div className="flex items-center gap-2 text-ink-secondary">
            <span className="h-3 w-3 rounded-full border-2 opacity-60" style={{ background: SEVERITY_HEX.medium, borderColor: STATUS_HEX.fixed }} />
            Fixed / rejected
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMap({ reports, onSelectReport, onRoadClick, focus, highlightIds }) {
  const containerRef = useRef(null);
  const [roadsGeoJSON, setRoadsGeoJSON] = useState(null);
  const [layer, setLayer] = useState('streets');
  const [show, setShow] = useState({ roads: true, pins: true, heat: false });
  const [fitKey, setFitKey] = useState(0);
  const [locateKey, setLocateKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  useEffect(() => {
    getRoadsGeoJSON()
      .then((res) => setRoadsGeoJSON(res.data))
      .catch((err) => console.error('Failed to load roads:', err));
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  };

  const heatPoints = useMemo(() => reports.filter(isOpen).map((r) => [
    r.latitude, r.longitude, { low: 0.35, medium: 0.6, high: 0.85, critical: 1 }[r.severity] || 0.4,
  ]), [reports]);

  const dark = layer !== 'streets';
  const roadStyle = (feature) => {
    const sev = feature.properties.severity;
    return {
      color: sev && sev !== 'none' ? SEVERITY_HEX[sev] : dark ? '#9ca3af' : '#64748b',
      weight: sev && sev !== 'none' ? 5 : 3,
      opacity: sev && sev !== 'none' ? 0.95 : 0.55,
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  const onEachRoad = (feature, lyr) => {
    const props = feature.properties;
    const roadName = props.name && !props.name.startsWith('Campus') && props.name !== 'Unnamed Road' ? props.name : `Road segment #${props.id}`;
    lyr.on({
      click: () => onRoadClick({ ...props, name: roadName }),
      mouseover: (e) => { e.target.setStyle({ weight: 9, opacity: 1 }); e.target.bringToFront(); },
      mouseout: (e) => { e.target.setStyle(roadStyle(feature)); },
    });
    lyr.bindTooltip(
      `<div style="font-family:system-ui,sans-serif;padding:2px 4px"><strong style="font-size:13px">${roadName}</strong><br/>
       <span style="font-size:11px;color:#52514e">${props.road_type || 'road'} · ${props.fault_count || 0} fault(s) · ${props.severity || 'none'}</span></div>`,
      { sticky: true }
    );
  };

  const btn = 'rounded-xl border border-border bg-surface/95 p-2.5 text-ink shadow-lg backdrop-blur transition-colors hover:bg-surface-2';

  return (
    <div ref={containerRef} className="relative h-full w-full bg-surface-2">
      <MapContainer center={CAMPUS_CENTER} zoom={15} maxZoom={20} className="h-full w-full" zoomControl={false} preferCanvas>
        <TileLayer key={layer} url={BASE_LAYERS[layer].url} attribution={BASE_LAYERS[layer].attribution} maxZoom={20} maxNativeZoom={BASE_LAYERS[layer].maxNativeZoom} />
        {BASE_LAYERS[layer].labels && <TileLayer key={`${layer}-labels`} url={BASE_LAYERS[layer].labels} maxZoom={20} maxNativeZoom={BASE_LAYERS[layer].maxNativeZoom} />}
        <MapController fitKey={fitKey} reports={reports} focus={focus} locateKey={locateKey} />

        {show.roads && roadsGeoJSON && (
          <GeoJSON key={`roads-${layer}`} data={roadsGeoJSON} style={roadStyle} onEachFeature={onEachRoad} />
        )}
        {show.heat && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

        {show.pins && reports.map((report) => {
          const fm = faultMeta(report.fault_type);
          return (
            <Marker
              key={report.id}
              position={[report.latitude, report.longitude]}
              icon={pinIcon(report, highlightIds?.has(report.id) || focus?.id === report.id)}
              zIndexOffset={isOpen(report) ? 500 : 0}
            >
              <Popup minWidth={260} maxWidth={280}>
                <div className="w-[260px] font-sans">
                  {report.photo_url && <Thumbnail report={report} className="h-32 w-full" />}
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm text-[#0b0b0b]">#{report.id} · {fm.label}</strong>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: SEVERITY_HEX[report.severity] || '#898781' }}>{report.severity}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-[#52514e]"><MapPin className="h-3 w-3" />{locationLabel(report)}</div>
                    <div className="mt-1 text-[11px] text-[#898781]">
                      <span className="capitalize">{report.status.replace('_', ' ')}</span> · {timeAgo(report.created_at)}
                      {report.confidence ? ` · AI ${Math.round(report.confidence * 100)}%` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectReport(report.id)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2a78d6] py-2 text-xs font-semibold text-white"
                    >
                      <Eye className="h-3.5 w-3.5" /> Open full details
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Base layer switcher */}
      <div className="absolute left-3 top-3 z-[500] flex overflow-hidden rounded-xl border border-border bg-surface/95 p-1 shadow-lg backdrop-blur">
        {Object.entries(BASE_LAYERS).map(([key, l]) => (
          <button key={key} type="button" onClick={() => setLayer(key)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${layer === key ? 'bg-brand text-brand-ink' : 'text-ink-secondary hover:bg-surface-2'}`}>
            {l.label}
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <button type="button" title="Fit all reports" onClick={() => setFitKey((k) => k + 1)} className={btn}><ScanSearch className="h-4 w-4" /></button>
        <button type="button" title="My location" onClick={() => setLocateKey((k) => k + 1)} className={btn}><LocateFixed className="h-4 w-4" /></button>
        <button type="button" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen} className={`${btn} hidden sm:block`}>
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <div className="relative">
          <button type="button" title="Overlays" onClick={() => setLayersOpen((o) => !o)} className={`${btn} ${layersOpen ? 'bg-brand! text-brand-ink!' : ''}`}><Layers className="h-4 w-4" /></button>
          {layersOpen && (
            <div className="animate-pop-in absolute right-0 top-12 w-52 rounded-2xl border border-border bg-surface p-2 shadow-2xl">
              {[['pins', MapPin, 'Fault markers'], ['roads', RoadIcon, 'Road network'], ['heat', Flame, 'Density heatmap']].map(([key, Icon, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-ink hover:bg-surface-2">
                  <Icon className="h-4 w-4 text-ink-muted" />
                  <span className="flex-1">{label}</span>
                  <input type="checkbox" checked={show[key]} onChange={() => setShow((s) => ({ ...s, [key]: !s[key] }))} className="h-4 w-4 accent-[var(--brand)]" />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <Legend />

      {!roadsGeoJSON && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-semibold text-brand shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading road network…
        </div>
      )}
    </div>
  );
}
