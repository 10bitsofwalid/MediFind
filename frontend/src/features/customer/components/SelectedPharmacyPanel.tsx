// frontend/src/features/customer/components/SelectedPharmacyPanel.tsx
import React, { useState } from 'react';
import { AvailabilityStatus } from '../../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../../components/FreshnessBadge';
import { useAuth } from '../../../app/useAuth';
import { getDirectionsRoute, sanitizePhoneNumber } from '../utils/routingUtils';
import {
  Clock,
  Phone,
  Navigation,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  AlertCircle,
  PhoneOff,
  ExternalLink,
} from 'lucide-react';
import type { NearbyPharmacyResult } from '../types';

interface SelectedPharmacyPanelProps {
  pharmacy: NearbyPharmacyResult;
  onCall: (phone: string) => void;
  onGetDirections: (pharmacy: NearbyPharmacyResult) => void;
  onReserveClick: (pharmacy: NearbyPharmacyResult, quantity: number) => void;
}

export const SelectedPharmacyPanel: React.FC<SelectedPharmacyPanelProps> = ({
  pharmacy,
  onCall,
  onGetDirections,
  onReserveClick,
}) => {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);

  const isCustomerLoggedIn = user && user.role === 'CUSTOMER';
  const cleanPhone = sanitizePhoneNumber(pharmacy.phone);

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrement = () => {
    const max = pharmacy.quantity && pharmacy.quantity > 0 ? pharmacy.quantity : 10;
    if (quantity < max) setQuantity(quantity + 1);
  };

  const isOutOfStock = pharmacy.stockStatus === 'out';

  const handleDirectionsClick = () => {
    try {
      setRoutingError(null);
      const route = getDirectionsRoute({
        latitude: pharmacy.latitude,
        longitude: pharmacy.longitude,
        address: pharmacy.address,
        pharmacyName: pharmacy.pharmacyName,
      });

      if (!route.hasExactCoordinates) {
        setRoutingError('Exact GPS coordinates not on file. Opening search on Google Maps instead.');
      }

      onGetDirections(pharmacy);
    } catch {
      setRoutingError('Unable to open map routing. Please check your network connection.');
    }
  };

  return (
    <aside
      aria-label={`Selected pharmacy details for ${pharmacy.pharmacyName}`}
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        borderRadius: 'var(--radius-xl)',
        border: '2px solid var(--color-action-primary)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: 'var(--shadow-md)',
        position: 'sticky',
        top: '20px',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {/* Panel Top Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-default)', paddingBottom: '10px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-action-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Selected Pharmacy
        </span>
        {pharmacy.isDemoData && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--color-status-neutral)',
              backgroundColor: 'var(--color-status-neutral-bg)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Demo Data
          </span>
        )}
      </div>

      {/* Pharmacy Header Info */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {pharmacy.pharmacyName}
          </h3>
          {pharmacy.isVerified ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-action-primary)',
                backgroundColor: 'rgba(23, 107, 135, 0.08)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
              title="Verified by MediFind inspection"
            >
              <CheckCircle2 size={12} aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-status-neutral)',
                backgroundColor: 'var(--color-status-neutral-bg)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              Unverified
            </span>
          )}
        </div>

        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          {pharmacy.address}
        </div>
      </div>

      {/* Availability Status & Distance */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <AvailabilityStatus status={pharmacy.stockStatus} quantity={pharmacy.quantity} size="md" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {pharmacy.distanceKm} km away
        </span>
      </div>

      {/* Freshness & Operating Hours */}
      <div
        style={{
          padding: '12px',
          backgroundColor: 'var(--color-surface-canvas)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-default)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Data freshness:</span>
          <FreshnessBadge updatedAt={pharmacy.updatedAt} isStale={pharmacy.isStale} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Operating schedule:</span>
          <span style={{ fontWeight: 600, color: pharmacy.isOpen ? 'var(--color-status-available)' : 'var(--color-status-problem)' }}>
            {pharmacy.isOpen ? 'Open Now' : 'Closed'}
            {pharmacy.openingHoursText ? ` (${pharmacy.openingHoursText})` : ''}
          </span>
        </div>
      </div>

      {/* Quantity Selector */}
      <div>
        <label
          htmlFor="reserve-qty-selector"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Quantity
        </label>
        <div
          id="reserve-qty-selector"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-canvas)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={handleDecrement}
            disabled={quantity <= 1 || isOutOfStock}
            style={{
              border: 'none',
              background: 'none',
              padding: '8px 12px',
              cursor: quantity <= 1 || isOutOfStock ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-primary)',
            }}
            aria-label="Decrease medicine hold quantity"
          >
            <Minus size={14} />
          </button>
          <span
            style={{
              padding: '0 14px',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={isOutOfStock}
            style={{
              border: 'none',
              background: 'none',
              padding: '8px 12px',
              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-primary)',
            }}
            aria-label="Increase medicine hold quantity"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Reserve for Pickup Button (Sign-in gated) */}
      <div>
        <button
          type="button"
          onClick={() => onReserveClick(pharmacy, quantity)}
          disabled={isOutOfStock}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
          }}
          aria-label={`Reserve ${quantity} units for pickup at ${pharmacy.pharmacyName}`}
        >
          {!isCustomerLoggedIn && <Lock size={15} aria-hidden="true" />}
          <span>{isOutOfStock ? 'Out of Stock' : 'Reserve for pickup'}</span>
        </button>

        {!isCustomerLoggedIn && (
          <span
            style={{
              display: 'block',
              marginTop: '6px',
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            Sign in is required to create a short hold.
          </span>
        )}
      </div>

      {/* Action Buttons: Get Directions & Call (with graceful fallback) */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleDirectionsClick}
          className="btn-secondary"
          style={{
            flex: 1,
            minWidth: '120px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label={`Get directions to ${pharmacy.pharmacyName}`}
        >
          <Navigation size={14} aria-hidden="true" />
          <span>Get directions</span>
        </button>

        {cleanPhone ? (
          <button
            type="button"
            onClick={() => onCall(cleanPhone)}
            className="btn-secondary"
            style={{
              flex: 1,
              minWidth: '120px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            aria-label={`Call ${pharmacy.pharmacyName} at ${cleanPhone}`}
          >
            <Phone size={14} aria-hidden="true" />
            <span>Call pharmacy</span>
          </button>
        ) : (
          <div
            style={{
              flex: 1,
              minWidth: '120px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-surface-canvas)',
              border: '1px dashed var(--color-border-default)',
            }}
            aria-label="Phone number not listed for this pharmacy"
          >
            <PhoneOff size={14} aria-hidden="true" />
            <span>No phone listed</span>
          </div>
        )}
      </div>

      {/* Routing notification / fallback banner if coordinates missing */}
      {routingError && (
        <div
          role="status"
          style={{
            fontSize: '11px',
            color: 'var(--color-status-caution, #b45309)',
            backgroundColor: 'var(--color-surface-warning, #fffbeb)',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-status-caution, #f59e0b)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ExternalLink size={12} aria-hidden="true" />
          <span>{routingError}</span>
        </div>
      )}

      {/* Quick link to view hours breakdown */}
      <div style={{ textAlign: 'center', fontSize: '12px' }}>
        <button
          type="button"
          onClick={() => setShowHoursModal(!showHoursModal)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-action-primary)',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '4px',
          }}
          aria-expanded={showHoursModal}
        >
          {showHoursModal ? 'Hide operating hours' : 'View weekly schedule'}
        </button>
      </div>

      {/* Inline schedule breakdown toggle */}
      {showHoursModal && (
        <div
          style={{
            padding: '12px',
            backgroundColor: 'var(--color-surface-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
          role="region"
          aria-label="Weekly operating schedule"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Clock size={14} aria-hidden="true" />
            <span>Operating Schedule</span>
          </div>
          <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {pharmacy.openingHoursText || 'Standard daily hours: 09:00 AM - 10:00 PM'}
          </div>
        </div>
      )}

      {/* Clinical Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          backgroundColor: 'var(--color-surface-canvas)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          lineHeight: '1.4',
        }}
      >
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
        <span>
          MediFind facilitates availability verification. Prices, prescriptions, and exact dispense decisions are governed strictly by the dispensing pharmacy.
        </span>
      </div>
    </aside>
  );
};
