// frontend/src/features/customer/components/LocationRequestBanner.tsx
import React from 'react';
import { MapPin, Loader, AlertTriangle, XCircle } from 'lucide-react';

interface LocationRequestBannerProps {
  isLoading: boolean;
  permissionDenied: boolean;
  error: string | null;
  onRequestLocation: () => void;
  onDismiss: () => void;
}

export const LocationRequestBanner: React.FC<LocationRequestBannerProps> = ({
  isLoading,
  permissionDenied,
  error,
  onRequestLocation,
  onDismiss,
}) => {
  // If permission was explicitly denied — show manual fallback prompt only
  if (permissionDenied) {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface-warning, #fff8e1)',
          border: '1px solid var(--color-status-caution, #f59e0b)',
          fontSize: '13px',
          lineHeight: '1.5',
        }}
      >
        <AlertTriangle
          size={16}
          color="var(--color-status-caution, #d97706)"
          style={{ flexShrink: 0, marginTop: '2px' }}
          aria-hidden="true"
        />
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>Location access denied</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>
            Please type your area name below (e.g. Dhanmondi, Dhaka) to find nearby pharmacies.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss location banner"
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            color: 'var(--color-text-muted)',
          }}
        >
          <XCircle size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  // If there's a generic error (timeout, unavailable, etc.)
  if (error) {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface-error, #fef2f2)',
          border: '1px solid var(--color-status-problem, #ef4444)',
          fontSize: '13px',
          lineHeight: '1.5',
        }}
      >
        <AlertTriangle
          size={16}
          color="var(--color-status-problem, #dc2626)"
          style={{ flexShrink: 0, marginTop: '2px' }}
          aria-hidden="true"
        />
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>Location unavailable</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>{error}</p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss location error"
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            color: 'var(--color-text-muted)',
          }}
        >
          <XCircle size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  // Default: invite user to share location
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border-default)',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MapPin
          size={16}
          color="var(--color-action-primary)"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        />
        <span style={{ color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
          Share your location for the most accurate nearby pharmacy results.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={onRequestLocation}
          disabled={isLoading}
          aria-busy={isLoading}
          aria-label={isLoading ? 'Acquiring GPS location…' : 'Use my GPS location'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-action-primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            border: 'none',
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.75 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {isLoading ? (
            <>
              <Loader size={14} className="spin" aria-hidden="true" />
              <span>Locating…</span>
            </>
          ) : (
            <>
              <MapPin size={14} aria-hidden="true" />
              <span>📍 Use my location</span>
            </>
          )}
        </button>

        <button
          onClick={onDismiss}
          aria-label="Skip location, use area search only"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            textDecoration: 'underline',
            padding: '0',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
};
