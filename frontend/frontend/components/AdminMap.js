'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import { Loader2 } from 'lucide-react';
import { getRoadsGeoJSON } from '@/lib/api';
import 'leaflet/dist/leaflet.css';

const SEVERITY_COLORS = {
  none: '#898781',
  low: '#0ca30c',
  medium: '#fab219',
  high: '#ec835a',
  critical: '#d03b3b',
};

const STATUS_COLORS = {
  reported: '#fab219',
  in_progress: '#2a78d6',
  fixed: '#0ca30c',
  rejected: '#898781',
};

function MapLegend() {
  return (
    <div className="absolute bottom-6 right-2.5 z-1000 min-w-35 rounded-xl border border-border bg-surface p-3.5 text-xs shadow-lg">
      <div className="mb-2 font-bold text-ink">Road Severity</div>
      {Object.entries(SEVERITY_COLORS).map(([key, color]) => (
        <div key={key} className="mb-1 flex items-center gap-1.5">
          <div className="h-1 w-6 shrink-0 rounded" style={{ background: color }} />
          <span className="capitalize text-ink-secondary">{key}</span>
        </div>
      ))}
      <div className="mb-1.5 mt-2 border-t border-border pt-2 font-bold text-ink">Report Status</div>
      {Object.entries(STATUS_COLORS).map(([key, color]) => (
        <div key={key} className="mb-1 flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="capitalize text-ink-secondary">{key.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminMap({ onRoadClick, reports }) {
  const [roadsGeoJSON, setRoadsGeoJSON] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    getRoadsGeoJSON()
      .then((res) => {
        setRoadsGeoJSON(res.data);
        setMapReady(true);
      })
      .catch((err) => console.error('Failed to load roads:', err));
  }, []);

  const roadStyle = (feature) => ({
    color: SEVERITY_COLORS[feature.properties.severity] || SEVERITY_COLORS.none,
    weight: 4,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round',
  });

  const onEachRoad = (feature, layer) => {
    const props = feature.properties;
    const roadName = props.name && !props.name.startsWith('Campus') ? props.name : `Road Segment #${props.id}`;

    layer.on({
      click: () => onRoadClick({ ...props, name: roadName }),
      mouseover: (e) => { e.target.setStyle({ weight: 7, opacity: 1 }); e.target.openTooltip(); },
      mouseout: (e) => { e.target.setStyle({ weight: 4, opacity: 0.85 }); e.target.closeTooltip(); },
    });

    layer.bindTooltip(`
      <div style="font-family:system-ui,sans-serif;padding:4px">
        <strong style="color:#0b0b0b;font-size:13px">${roadName}</strong><br/>
        <span style="color:#52514e;font-size:11px">Type: ${props.road_type || '—'}</span><br/>
        <span style="color:#52514e;font-size:11px">Faults: ${props.fault_count || 0}</span><br/>
        <span style="color:#52514e;font-size:11px">Severity: ${props.severity || 'none'}</span>
      </div>
    `, { sticky: true, className: 'road-tooltip' });
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer center={[7.4410, 3.9067]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {roadsGeoJSON && <GeoJSON data={roadsGeoJSON} style={roadStyle} onEachFeature={onEachRoad} />}

        {reports.map((report) => (
          <CircleMarker
            key={report.id}
            center={[report.latitude, report.longitude]}
            radius={8}
            fillColor={STATUS_COLORS[report.status] || STATUS_COLORS.reported}
            color="white"
            weight={2}
            fillOpacity={0.9}
          >
            <Popup>
              <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 160 }}>
                <strong style={{ color: '#0b0b0b' }}>Report #{report.id}</strong><br />
                <span style={{ fontSize: 12, color: '#52514e' }}>
                  Fault: {report.fault_type?.replace(/_/g, ' ') || 'Pending AI'}<br />
                  Severity: {report.severity || '—'}<br />
                  Status: {report.status}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <MapLegend />

      {!mapReady && (
        <div className="absolute inset-0 z-999 flex items-center justify-center gap-2 bg-surface/80 text-sm font-semibold text-brand">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading road network…
        </div>
      )}
    </div>
  );
}
