// frontend/src/features/customer/components/StockAlertModal.tsx
import React, { useState } from 'react';
import { alertService, type StockAlertSubscription } from '../services/alertService';
import { Bell, CheckCircle2, X, AlertTriangle, Loader, Mail } from 'lucide-react';

interface StockAlertModalProps {
  medicineName: string;
  genericName?: string;
  strength?: string;
  area: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (alert: StockAlertSubscription) => void;
}

export const StockAlertModal: React.FC<StockAlertModalProps> = ({
  medicineName,
  genericName,
  strength,
  area,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [targetArea, setTargetArea] = useState(area || 'Dhanmondi, Dhaka');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdAlert, setCreatedAlert] = useState<StockAlertSubscription | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const alert = await alertService.subscribeAlert({
        medicineName,
        genericName,
        strength,
        area: targetArea,
        emailOrPhone,
      });

      setCreatedAlert(alert);
      if (onSuccess) onSuccess(alert);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to subscribe to alerts.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setCreatedAlert(null);
    setErrorMessage(null);
    setEmailOrPhone('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
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
          maxWidth: '440px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={handleResetAndClose}
          aria-label="Close alert subscription modal"
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

        {createdAlert ? (
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
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(10, 126, 81, 0.12)',
                color: 'var(--color-status-available)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={26} aria-hidden="true" />
            </div>

            <h3
              id="alert-modal-title"
              style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}
            >
              Restock Alert Activated!
            </h3>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              We will notify <strong>{createdAlert.emailOrPhone}</strong> the moment a verified pharmacy in <strong>{createdAlert.area}</strong> reports fresh stock of <strong>{createdAlert.medicineName}</strong>.
            </p>

            <button
              type="button"
              onClick={handleResetAndClose}
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
              Done
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
                <Bell size={16} aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="alert-modal-title"
                  style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}
                >
                  Get Restock Notifications
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  We'll alert you as soon as stock updates
                </span>
              </div>
            </div>

            {/* Medicine details badge */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-canvas)',
                border: '1px solid var(--color-border-default)',
                fontSize: '12px',
              }}
            >
              <strong style={{ color: 'var(--color-text-primary)' }}>{medicineName}</strong>
              {strength && <span style={{ color: 'var(--color-text-secondary)' }}> • {strength}</span>}
              {genericName && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                  Active ingredient: {genericName}
                </div>
              )}
            </div>

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

            {/* Area */}
            <div>
              <label
                htmlFor="alert-area-input"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Target Dhaka Area:
              </label>
              <input
                id="alert-area-input"
                type="text"
                value={targetArea}
                onChange={(e) => setTargetArea(e.target.value)}
                placeholder="E.g. Dhanmondi, Gulshan, Mirpur"
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

            {/* Email or Phone */}
            <div>
              <label
                htmlFor="alert-contact-input"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Send notification to:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="alert-contact-input"
                  type="text"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="Email or mobile number (01XXXXXXXXX)"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 34px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-canvas)',
                    fontSize: '13px',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                <Mail
                  size={15}
                  color="var(--color-text-muted)"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                No marketing or spam. Only automated stock notices.
              </span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={handleResetAndClose}
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
                disabled={isSubmitting}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader size={14} className="spin" aria-hidden="true" />
                    <span>Subscribing...</span>
                  </>
                ) : (
                  <>
                    <Bell size={14} aria-hidden="true" />
                    <span>Notify Me</span>
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
