// frontend/src/features/customer/components/CustomerMapView.tsx
import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { MapPin, Phone, ExternalLink, Clock, ShieldCheck } from 'lucide-react';
import type { NearbyPharmacyResult } from '../types';

interface CustomerMapViewProps {
  results: NearbyPharmacyResult[];
  selectedPharmacyId?: string;
  onSelectPharmacy?: (pharmacyId: string) => void;
  onCallPharmacy?: (phone: string) => void;
  centerLatitude?: number;
  centerLongitude?: number;
  height?: string;
}

const getPinColor = (status: string): string => {
  switch (status) {
    case 'available':
      return '#0A7E51'; // var(--color-status-available)
    case 'low':
      return '#C28400'; // var(--color-status-caution)
    case 'out':
      return '#D9383A'; // var(--color-status-problem)
    default:
      return '#6C757D';
  }
};

const createColoredPinIcon = (status: string, index: number, isSelected: boolean) => {
  try {
    const Leaflet = (L as unknown as { default?: typeof L }).default || L;
    if (!Leaflet || typeof Leaflet.divIcon !== 'function') return undefined;

    const bgColor = getPinColor(status);
    const border = isSelected ? '3px solid #000000' : '2px solid #ffffff';
    const scale = isSelected ? 'transform: scale(1.15) rotate(-45deg);' : 'transform: rotate(-45deg);';
    const shadow = isSelected
      ? '0 6px 14px rgba(0, 0, 0, 0.45);'
      : '0 4px 10px rgba(23, 43, 58, 0.35);';

    return Leaflet.divIcon({
      className: `medifind-custom-pin-${status}`,
      html: `
        <div style="
          background-color: ${bgColor};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          ${scale}
          border: ${border};
          box-shadow: ${shadow}
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        ">
          <span style="
            transform: rotate(45deg);
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            user-select: none;
          ">${index + 1}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  } catch {
    return undefined;
  }
};

export const CustomerMapView: React.FC<CustomerMapViewProps> = ({
  results,
  selectedPharmacyId,
  onSelectPharmacy,
  onCallPharmacy,
  centerLatitude = 23.7461,
  centerLongitude = 90.3742,
  height = '460px',
}) => {
  // Center coordinates: fallback order -> selectedPharmacy, first result, or provided center coords
  const centerCoords = useMemo(() => {
    if (selectedPharmacyId) {
      const match = results.find((r) => r.pharmacyId === selectedPharmacyId);
      if (match) return { lat: match.latitude, lng: match.longitude };
    }
    if (results.length > 0) {
      return { lat: results[0].latitude, lng: results[0].longitude };
    }
    return { lat: centerLatitude, lng: centerLongitude };
  }, [results, selectedPharmacyId, centerLatitude, centerLongitude]);

  const selectedPharmacy = useMemo(
    () => results.find((r) => r.pharmacyId === selectedPharmacyId),
    [results, selectedPharmacyId]
  );

  return (
    <div
      aria-label="Pharmacy map exploration"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
      }}
    >
      {/* Top Header bar with pin count and active indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          <MapPin size={15} color="var(--color-action-primary)" aria-hidden="true" />
          <span>Interactive Map ({results.length} pharmacies found)</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Numbered pins match search rankings • OpenStreetMap tiles
        </span>
      </div>

      {/* Main Map with error boundary */}
      <ErrorBoundary fallbackTitle="Map Display Unavailable — your pharmacy list below remains fully functional.">
        <div
          role="region"
          aria-label="Interactive leaflet map displaying pharmacy pins"
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
            center={[centerCoords.lat, centerCoords.lng]}
            zoom={13}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            {results.map((pharmacy, index) => {
              const isSelected = pharmacy.pharmacyId === selectedPharmacyId;
              const pinIcon = createColoredPinIcon(pharmacy.stockStatus, index, isSelected);

              return (
                <Marker
                  key={pharmacy.pharmacyId}
                  position={[pharmacy.latitude, pharmacy.longitude]}
                  icon={pinIcon}
                  eventHandlers={{
                    click: () => {
                      if (onSelectPharmacy) {
                        onSelectPharmacy(pharmacy.pharmacyId);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '200px', maxWidth: '260px', padding: '4px', fontSize: '12px', lineHeight: '1.4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                          {index + 1}. {pharmacy.pharmacyName}
                        </span>
                        {pharmacy.isVerified && (
                          <span
                            title="Verified Pharmacy"
                            style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-action-primary)' }}
                          >
                            <ShieldCheck size={14} aria-label="Verified" />
                          </span>
                        )}
                      </div>

                      <div style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        {pharmacy.address} • <strong>{pharmacy.distanceKm} km</strong>
                      </div>

                      {/* Stock availability banner in popup */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: `${getPinColor(pharmacy.stockStatus)}18`,
                          color: getPinColor(pharmacy.stockStatus),
                          fontWeight: 700,
                          fontSize: '11px',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getPinColor(pharmacy.stockStatus) }} />
                        <span>
                          {pharmacy.stockStatus === 'available'
                            ? `Available (${pharmacy.quantity ?? 'In stock'})`
                            : pharmacy.stockStatus === 'low'
                            ? `Low stock (${pharmacy.quantity ?? 'Limited'})`
                            : pharmacy.stockStatus === 'out'
                            ? 'Out of stock'
                            : 'Unverified'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '8px' }}>
                        <Clock size={12} aria-hidden="true" />
                        <span>{pharmacy.isOpen ? 'Open Now' : 'Closed today'}</span>
                      </div>

                      {/* Action buttons inside popup */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        {onSelectPharmacy && (
                          <button
                            type="button"
                            onClick={() => onSelectPharmacy(pharmacy.pharmacyId)}
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-action-primary)',
                              color: '#fff',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <ExternalLink size={12} aria-hidden="true" />
                            <span>Details</span>
                          </button>
                        )}
                        {pharmacy.phone && onCallPharmacy && (
                          <button
                            type="button"
                            onClick={() => {
                              if (pharmacy.phone) onCallPharmacy(pharmacy.phone);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-surface-panel)',
                              color: 'var(--color-text-primary)',
                              border: '1px solid var(--color-border-default)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            aria-label={`Call ${pharmacy.pharmacyName}`}
                          >
                            <Phone size={12} aria-hidden="true" />
                            <span>Call</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </ErrorBoundary>

      {/* Selected pharmacy synchronization card (under map when one is selected) */}
      {selectedPharmacy && (
        <div
          role="region"
          aria-label="Selected pharmacy details"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-panel)',
            border: '2px solid var(--color-action-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-action-primary)' }}>
                Selected Pin:
              </span>
              <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                {selectedPharmacy.pharmacyName}
              </strong>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {selectedPharmacy.address} • {selectedPharmacy.distanceKm} km away
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedPharmacy.phone && onCallPharmacy && (
              <button
                type="button"
                onClick={() => {
                  if (selectedPharmacy.phone) onCallPharmacy(selectedPharmacy.phone);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface-panel)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Phone size={13} aria-hidden="true" />
                <span>Call ({selectedPharmacy.phone})</span>
              </button>
            )}

            {onSelectPharmacy && (
              <button
                type="button"
                onClick={() => onSelectPharmacy(selectedPharmacy.pharmacyId)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-action-primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>View Full Details &rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map Legend & Parity Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-default)',
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0A7E51' }} />
            <span>Available</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#C28400' }} />
            <span>Low stock</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#D9383A' }} />
            <span>Out of stock</span>
          </span>
        </div>
        <span>Click any pin to inspect stock & directions. Both map and list show identical real-time data.</span>
      </div>
    </div>
  );
};
