// src/components/LocationPicker.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Compass, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  error?: string;
  disabled?: boolean;
}

// Custom crisp SVG pin that does not rely on external png assets
const pinIcon = L.divIcon({
  className: 'medifind-map-pin',
  html: `
    <div style="
      background-color: #176B87;
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #ffffff;
      box-shadow: 0 4px 12px rgba(23, 43, 58, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    ">
      <div style="width: 10px; height: 10px; border-radius: 50%; background-color: #ffffff; transform: rotate(45deg);"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Component to recenter map smoothly when coordinates change externally
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

// Component to handle map clicks for pin placement
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6))
      );
    },
  });
  return null;
}

const PRESET_LOCATIONS = [
  { name: 'Dhaka Central', lat: 23.8103, lng: 90.4125 },
  { name: 'Dhanmondi', lat: 23.7465, lng: 90.376 },
  { name: 'Gulshan 2', lat: 23.7925, lng: 90.4178 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { name: 'Chattogram', lat: 22.3569, lng: 91.7832 },
  { name: 'Sylhet', lat: 24.8949, lng: 91.8687 },
];

export const LocationPicker: React.FC<LocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  error,
  disabled = false,
}) => {
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccess, setGeoSuccess] = useState<boolean>(false);
  const [mapRenderError, setMapRenderError] = useState<boolean>(false);
  const markerRef = useRef<L.Marker>(null);

  // Validate coordinates
  const isValidLat = !isNaN(latitude) && latitude >= -90 && latitude <= 90;
  const isValidLng = !isNaN(longitude) && longitude >= -180 && longitude <= 180;
  const mapCenter: [number, number] = useMemo(() => {
    return [
      isValidLat ? latitude : 23.8103,
      isValidLng ? longitude : 90.4125,
    ];
  }, [isValidLat, isValidLng, latitude, longitude]);

  const handleDragEnd = () => {
    const marker = markerRef.current;
    if (marker) {
      const latLng = marker.getLatLng();
      onChange(
        parseFloat(latLng.lat.toFixed(6)),
        parseFloat(latLng.lng.toFixed(6))
      );
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetecting(true);
    setGeoError(null);
    setGeoSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetecting(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        onChange(lat, lng);
        setGeoSuccess(true);
        setTimeout(() => setGeoSuccess(false), 3500);
      },
      (err) => {
        setIsDetecting(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError('Location permission denied. You can manually enter coordinates or click on the map.');
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError('GPS position unavailable. Please manually select on the map or enter coordinates.');
            break;
          case err.TIMEOUT:
            setGeoError('Location detection timed out. Please try again or enter manually.');
            break;
          default:
            setGeoError('Could not detect location. Please enter coordinates manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="location-picker-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Helper & Geolocation Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={16} color="var(--color-action-primary)" aria-hidden="true" />
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Drag pin or tap map to position your pharmacy entrance
          </span>
        </div>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={disabled || isDetecting}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            padding: '8px 14px',
            minHeight: '44px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-panel)',
            color: 'var(--color-action-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
          aria-label="Detect current location using GPS"
        >
          {isDetecting ? (
            <>
              <div className="spinner-small" aria-hidden="true" />
              <span>Detecting GPS...</span>
            </>
          ) : (
            <>
              <Navigation size={15} aria-hidden="true" />
              <span>Detect My Location</span>
            </>
          )}
        </button>
      </div>

      {/* Geolocation Feedback alerts */}
      {geoError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
          <span>{geoError}</span>
        </div>
      )}

      {geoSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid rgba(24, 115, 75, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-available)',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>Location successfully updated from device GPS.</span>
        </div>
      )}

      {/* Quick Area Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          Quick Jump:
        </span>
        {PRESET_LOCATIONS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => onChange(preset.lat, preset.lng)}
            disabled={disabled}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-canvas)',
              color: 'var(--color-text-secondary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              minHeight: '32px',
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Interactive Leaflet Map */}
      {!mapRenderError ? (
        <div
          style={{
            width: '100%',
            height: '280px',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: error
              ? '1px solid var(--color-status-problem)'
              : '1px solid var(--color-border-default)',
            position: 'relative',
            zIndex: 1,
          }}
          aria-label="Interactive map for selecting pharmacy location"
        >
          <MapContainer
            center={mapCenter}
            zoom={15}
            scrollWheelZoom={false}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <Marker
              position={mapCenter}
              draggable={!disabled}
              eventHandlers={{ dragend: handleDragEnd }}
              ref={markerRef}
              icon={pinIcon}
            />
            <MapRecenter lat={mapCenter[0]} lng={mapCenter[1]} />
            <MapClickHandler
              onLocationSelect={(lat, lng) => {
                if (!disabled) onChange(lat, lng);
              }}
            />
          </MapContainer>
        </div>
      ) : (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-canvas)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-default)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Compass size={32} style={{ margin: '0 auto 8px', color: 'var(--color-text-secondary)' }} aria-hidden="true" />
          <p style={{ fontSize: '14px', marginBottom: '8px' }}>
            Map view unavailable. You can enter precise latitude and longitude directly below.
          </p>
          <button
            type="button"
            onClick={() => setMapRenderError(false)}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <RotateCcw size={13} style={{ marginRight: '4px' }} aria-hidden="true" /> Retry Map
          </button>
        </div>
      )}

      {/* Manual Coordinate Inputs for Precision & Accessibility */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div>
          <label
            htmlFor="pharmacy-latitude"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              marginBottom: '6px',
            }}
          >
            Latitude <span style={{ color: 'var(--color-status-problem)' }}>*</span>
          </label>
          <input
            id="pharmacy-latitude"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            disabled={disabled}
            value={isNaN(latitude) ? '' : latitude}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange(isNaN(val) ? 0 : val, longitude);
            }}
            placeholder="e.g. 23.810332"
            aria-describedby="lat-help"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              borderRadius: 'var(--radius-md)',
              border: error
                ? '1px solid var(--color-status-problem)'
                : '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              boxSizing: 'border-box',
              minHeight: '44px',
            }}
          />
          <span id="lat-help" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Range: -90.0 to 90.0
          </span>
        </div>

        <div>
          <label
            htmlFor="pharmacy-longitude"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              marginBottom: '6px',
            }}
          >
            Longitude <span style={{ color: 'var(--color-status-problem)' }}>*</span>
          </label>
          <input
            id="pharmacy-longitude"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            disabled={disabled}
            value={isNaN(longitude) ? '' : longitude}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange(latitude, isNaN(val) ? 0 : val);
            }}
            placeholder="e.g. 90.412518"
            aria-describedby="lng-help"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              borderRadius: 'var(--radius-md)',
              border: error
                ? '1px solid var(--color-status-problem)'
                : '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              boxSizing: 'border-box',
              minHeight: '44px',
            }}
          />
          <span id="lng-help" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Range: -180.0 to 180.0
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-status-problem)',
            fontSize: '13px',
            marginTop: '2px',
          }}
        >
          <AlertCircle size={15} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

