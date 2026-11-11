// frontend/src/features/customer/components/MobileResultsPreview.tsx
import React from 'react';
import { AvailabilityStatus } from '../../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../../components/FreshnessBadge';
import { ChevronRight, Phone, CheckCircle2 } from 'lucide-react';
import type { NearbyPharmacyResult } from '../types';

interface MobileResultsPreviewProps {
  results: NearbyPharmacyResult[];
  onSelectPharmacy?: (pharmacyId: string) => void;
  onCallPharmacy?: (phone: string) => void;
}

export const MobileResultsPreview: React.FC<MobileResultsPreviewProps> = ({
  results,
  onSelectPharmacy,
  onCallPharmacy,
}) => {
  return (
    <section aria-label="Nearby pharmacy results preview" style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            fontSize: '13px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          Nearby Results
        </h3>
        <span
          style={{
            fontSize: '11px',
            backgroundColor: 'var(--color-surface-panel)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {results.length} reported
        </span>
      </div>

      {results.length === 0 ? (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px dashed var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
          }}
        >
          No nearby pharmacy availability reported yet.
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {results.map((item) => (
          <article
            key={item.id}
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              position: 'relative',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <h4
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      margin: 0,
                    }}
                  >
                    {item.pharmacyName}
                  </h4>
                  {item.isVerified && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-trust-primary, #0B6BCB)',
                        backgroundColor: 'var(--color-trust-subtle, #EBF5FF)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                      }}
                      title="Verified licensed pharmacy"
                    >
                      <CheckCircle2 size={11} aria-hidden="true" />
                      Verified
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {item.distanceKm} km away &bull; {item.openingHoursText}
                </div>
              </div>
            </div>

            {/* Availability status & freshness indicators */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <AvailabilityStatus status={item.stockStatus} quantity={item.quantity} size="sm" />
              <FreshnessBadge updatedAt={item.updatedAt} isStale={item.isStale} />
            </div>

            {/* Actions: Details & Call */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '8px',
                borderTop: '1px solid var(--color-border-default)',
                marginTop: '4px',
              }}
            >
              {item.phone ? (
                <button
                  type="button"
                  onClick={() => onCallPharmacy?.(item.phone!)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-action-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                  aria-label={`Call ${item.pharmacyName} to confirm stock at ${item.phone}`}
                >
                  <Phone size={13} aria-hidden="true" />
                  <span>Call to confirm</span>
                </button>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Phone not listed
                </span>
              )}

              <button
                type="button"
                onClick={() => onSelectPharmacy?.(item.pharmacyId)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-action-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
                aria-label={`View medicine availability details for ${item.pharmacyName}`}
              >
                <span>Details</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>
      )}

      <div
        role="note"
        aria-label="Stock disclaimer notice"
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        Reported stock may change. Check freshness. Always call the pharmacy before travelling.
      </div>
    </section>
  );
};

