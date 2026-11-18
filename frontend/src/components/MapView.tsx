// src/components/MapView.tsx
import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from '../config/constants';
import { ErrorBoundary } from './ErrorBoundary';

interface MapMarkerItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  statusLabel?: string;
}

interface MapViewProps {
  markers?: MapMarkerItem[];
  centerLatitude?: number;
  centerLongitude?: number;
  zoom?: number;
  height?: string;
  interactive?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  markers = [],
  centerLatitude = DEFAULT_LATITUDE,
  centerLongitude = DEFAULT_LONGITUDE,
  zoom = 13,
  height = '360px',
  interactive = true,
}) => {
  const pinIcon = useMemo(() => {
    try {
      const Leaflet = (L as unknown as { default?: typeof L }).default || L;
      if (!Leaflet || typeof Leaflet.divIcon !== 'function') return undefined;
      return Leaflet.divIcon({
        className: 'medifind-map-pin',
        html: `
          <div style="
            background-color: #176B87;
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(23, 43, 58, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #ffffff; transform: rotate(45deg);"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });
    } catch {
      return undefined;
    }
  }, []);

  return (
    <ErrorBoundary fallbackTitle="Map View Unavailable">
      <div
        role="region"
        aria-label="Interactive map view of pharmacies"
        style={{
          height,
          width: '100%',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--color-border-default)',
          position: 'relative',
        }}
      >
        <MapContainer
          center={[centerLatitude, centerLongitude]}
          zoom={zoom}
          dragging={interactive}
          scrollWheelZoom={interactive}
          doubleClickZoom={interactive}
          touchZoom={interactive}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {markers.map((m) => (
            <Marker key={m.id} position={[m.latitude, m.longitude]} icon={pinIcon}>
              <Popup>
                <div style={{ padding: '4px', fontSize: '13px' }}>
                  <strong style={{ display: 'block', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                    {m.name}
                  </strong>
                  {m.address && (
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      {m.address}
                    </div>
                  )}
                  {m.statusLabel && (
                    <div style={{ fontWeight: 600, color: 'var(--color-action-primary)' }}>
                      {m.statusLabel}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </ErrorBoundary>
  );
};
