// frontend/src/features/customer/components/ReservationModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { reservationService, type ReservationRecord } from '../services/reservationService';
import { useAuth } from '../../../app/useAuth';
import { Lock, CheckCircle2, Clock, MapPin, X, AlertTriangle, Loader, ShieldCheck } from 'lucide-react';
import type { NearbyPharmacyResult } from '../types';

interface ReservationModalProps {
  pharmacy: NearbyPharmacyResult;
  medicineName: string;
  genericName?: string;
  strength?: string;
  initialQuantity?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (reservation: ReservationRecord) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  pharmacy,
  medicineName,
  genericName,
  strength,
  initialQuantity = 1,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(initialQuantity);
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRecord, setCreatedRecord] = useState<ReservationRecord | null>(null);

  const isCustomerLoggedIn = user && user.role === 'CUSTOMER';
  const isOutOfStock = pharmacy.stockStatus === 'out';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCustomerLoggedIn) {
      setErrorMessage('Please sign in with a Customer account to place a hold request.');
      return;
    }

    if (quantity < 1) {
      setErrorMessage('Quantity must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const record = await reservationService.createReservation({
        pharmacyId: pharmacy.pharmacyId,
        pharmacyName: pharmacy.pharmacyName,
        pharmacyPhone: pharmacy.phone,
        pharmacyAddress: pharmacy.address,
        medicineId: pharmacy.id || 'med-custom',
        medicineName,
        genericName,
        strength,
        quantity,
        customerName: customerName.trim() || user?.name || 'Valued Customer',
        customerPhone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setCreatedRecord(record);
      if (onSuccess) onSuccess(record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create reservation.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAndReset = useCallback(() => {
    setCreatedRecord(null);
    setErrorMessage(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseAndReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCloseAndReset]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseAndReset();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.1))',
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={handleCloseAndReset}
          aria-label="Close reservation dialog"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        {createdRecord ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              textAlign: 'center',
              padding: '16px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(10, 126, 81, 0.12)',
                color: 'var(--color-status-available)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={28} aria-hidden="true" />
            </div>

            <h3
              id="reservation-modal-title"
              style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}
            >
              Hold Request Submitted!
            </h3>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Your request for <strong>{createdRecord.quantity} unit(s)</strong> of <strong>{createdRecord.medicineName}</strong> has been transmitted to <strong>{createdRecord.pharmacyName}</strong>.
            </p>

            <div
              style={{
                backgroundColor: 'var(--color-surface-canvas)',
                border: '2px dashed var(--color-action-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 20px',
                margin: '8px 0',
              }}
            >
              <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block' }}>
                Pickup Verification Code
              </span>
              <span style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '4px', color: 'var(--color-action-primary)' }}>
                {createdRecord.pickupCode}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              <Clock size={13} aria-hidden="true" />
              <span>Hold valid for 2 hours. Present code at the counter.</span>
            </div>

            <button
              type="button"
              onClick={handleCloseAndReset}
              className="btn-primary"
              style={{
                marginTop: '10px',
                padding: '8px 24px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(23, 107, 135, 0.1)',
                  color: 'var(--color-action-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Clock size={16} aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="reservation-modal-title"
                  style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}
                >
                  Reserve Medicine for Pickup
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Request a temporary hold (up to 2 hours)
                </span>
              </div>
            </div>

            {/* Pharmacy & Medicine summary badge */}
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-canvas)',
                border: '1px solid var(--color-border-default)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {medicineName} {strength ? `(${strength})` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                <MapPin size={12} aria-hidden="true" />
                <span>{pharmacy.pharmacyName} • {pharmacy.address}</span>
              </div>
            </div>

            {/* Authentication Alert if user is not logged in as Customer */}
            {!isCustomerLoggedIn && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(180, 83, 9, 0.08)',
                  border: '1px solid var(--color-status-caution)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--color-status-caution, #b45309)',
                }}
              >
                <Lock size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>Customer sign in is required to hold medicines at participating pharmacies.</span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(217, 56, 58, 0.08)',
                  border: '1px solid var(--color-status-problem)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--color-status-problem)',
                }}
              >
                <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Quantity Selector */}
            <div>
              <label
                htmlFor="reservation-qty-input"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Hold Quantity:
              </label>
              <input
                id="reservation-qty-input"
                type="number"
                min={1}
                max={pharmacy.quantity && pharmacy.quantity > 0 ? pharmacy.quantity : 10}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={isOutOfStock}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Customer Name input */}
            <div>
              <label
                htmlFor="reservation-name-input"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Full Name for Pickup:
              </label>
              <input
                id="reservation-name-input"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Optional Customer Phone */}
            <div>
              <label
                htmlFor="reservation-phone-input"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Contact Number (optional, for SMS hold updates):
              </label>
              <input
                id="reservation-phone-input"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label
                htmlFor="reservation-notes-input"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Notes for Pharmacist (optional):
              </label>
              <input
                id="reservation-notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. Will pick up in 45 minutes on my way home"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  fontSize: '12px',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Dialog Footer Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={handleCloseAndReset}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isOutOfStock}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmitting || isOutOfStock ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader size={14} className="spin" aria-hidden="true" />
                    <span>Placing hold...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} aria-hidden="true" />
                    <span>Confirm Hold Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
