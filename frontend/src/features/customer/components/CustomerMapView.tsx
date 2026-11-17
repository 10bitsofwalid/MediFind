// frontend/src/features/customer/components/CustomerMapView.tsx
import React, { useMemo } from 'react';
import { MapView, type MapMarkerItem } from '../../../components/MapView';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { MapPin } from 'lucide-react';
import type { NearbyPharmacyResult } from '../types';

interface CustomerMapViewProps {
  results: NearbyPharmacyResult[];
  selectedPharmacyId?: string;
  onSelectPharmacy?: (pharmacyId: string) => void;
  centerLatitude?: number;
  centerLongitude?: number;
  height?: string;
}

export const CustomerMapView: React.FC<CustomerMapViewProps> = (props) => {
  const {
    results,
    selectedPharmacyId,
    centerLatitude = 23.7461,
    centerLongitude = 90.3742,
    height = '420px',
  } = props;
  // onSelectPharmacy is reserved for future Marker click wiring
  // when the shared MapView component exposes an onMarkerClick prop.
  // Convert results into MapView markers
  const markers: MapMarkerItem[] = useMemo(() => {
    return results.map((r, index) => {
      const statusText =
        r.stockStatus === 'available'
          ? `Available (${r.quantity ?? 'In stock'})`
          : r.stockStatus === 'low'
          ? `Low stock (${r.quantity ?? 'Limited'})`
          : r.stockStatus === 'out'
          ? 'Out of stock'
          : 'Unverified report';

      return {
        id: r.pharmacyId,
        name: `${index + 1}. ${r.pharmacyName}${r.isVerified ? ' (Verified)' : ''}`,
        latitude: r.latitude,
        longitude: r.longitude,
        address: `${r.address} • ${r.distanceKm} km away`,
        phone: r.phone,
        statusLabel: statusText,
      };
    });
  }, [results]);

  // Center on selected pharmacy if available
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

  return (
    <div
      aria-label="Pharmacy map exploration"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          <MapPin size={15} color="var(--color-action-primary)" aria-hidden="true" />
          <span>Interactive Map View ({results.length} pins)</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Tiles include OpenStreetMap provider attribution
        </span>
      </div>

      <ErrorBoundary fallbackTitle="Map Display Unavailable — your pharmacy list below remains fully functional.">
        <div style={{ position: 'relative', width: '100%' }}>
          <MapView
            markers={markers}
            centerLatitude={centerCoords.lat}
            centerLongitude={centerCoords.lng}
            zoom={13}
            height={height}
          />
        </div>
      </ErrorBoundary>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-status-available)' }} />
            <span>Available</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-status-caution)' }} />
            <span>Low stock</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-status-problem)' }} />
            <span>Out of stock</span>
          </span>
        </div>
        <span>Click pin to view address & status. Map and list show the same stock.</span>
      </div>
    </div>
  );
};
