// frontend/src/features/customer/components/SelectedPharmacyPanel.tsx
import React, { useState } from 'react';
import { AvailabilityStatus } from '../../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../../components/FreshnessBadge';
import { useAuth } from '../../../app/useAuth';
import {
  Clock,
  Phone,
  Navigation,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  AlertCircle,
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

  const isCustomerLoggedIn = user && user.role === 'CUSTOMER';

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrement = () => {
    const max = pharmacy.quantity && pharmacy.quantity > 0 ? pharmacy.quantity : 10;
    if (quantity < max) setQuantity(quantity + 1);
  };

  const isOutOfStock = pharmacy.stockStatus === 'out';

  return (
    <aside
      aria-label={`Selected pharmacy details for ${pharmacy.pharmacyName}`}
      className="card"
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '20px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'sticky',
        top: '80px',
      }}
    >
      {/* Header: Pharmacy Name & Verified Status */}
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
                gap: '3px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-trust-primary, #0B6BCB)',
                backgroundColor: 'var(--color-trust-subtle, #EBF5FF)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
              title="Verified licensed pharmacy"
            >
              <CheckCircle2 size={12} aria-hidden="true" />
              <span>Verified</span>
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
            {pharmacy.isOpen ? 'Open Now' : 'Closed'} ({pharmacy.openingHoursText})
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

      {/* Reserve for Pickup Button (Sign-in gated per Product Rules & UI Design Page 5) */}
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

      {/* Action Buttons: Get Directions & Call */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
        <button
          type="button"
          onClick={() => onGetDirections(pharmacy)}
          className="btn-secondary"
          style={{
            flex: 1,
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

        {pharmacy.phone && (
          <button
            type="button"
            onClick={() => onCall(pharmacy.phone!)}
            className="btn-secondary"
            style={{
              flex: 1,
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
            aria-label={`Call ${pharmacy.pharmacyName}`}
          >
            <Phone size={14} aria-hidden="true" />
            <span>Call pharmacy</span>
          </button>
        )}
      </div>

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
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Clock size={12} />
          <span>{showHoursModal ? 'Hide operating hours' : 'View daily opening hours'}</span>
        </button>
      </div>

      {showHoursModal && (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'var(--color-surface-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <strong style={{ display: 'block', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            Daily Schedule:
          </strong>
          <div>Monday – Sunday: 08:00 AM – 10:00 PM</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            * Emergency stock verification available via phone call.
          </div>
        </div>
      )}

      {/* Responsible Shopping Reminder */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.4,
          paddingTop: '8px',
          borderTop: '1px solid var(--color-border-default)',
        }}
      >
        <AlertCircle size={14} color="var(--color-action-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          Availability is pharmacy-reported and subject to change. Please call ahead before travelling.
        </span>
      </div>
    </aside>
  );
};
