// frontend/src/features/customer/components/SearchResultsList.tsx
import React from 'react';
import { AvailabilityStatus } from '../../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../../components/FreshnessBadge';
import { ChevronRight, Phone, PhoneOff, Navigation, CheckCircle2, AlertTriangle, RefreshCw, SearchX, Bell } from 'lucide-react';
import { getDirectionsRoute, sanitizePhoneNumber } from '../utils/routingUtils';
import type { NearbyPharmacyResult } from '../types';

interface SearchResultsListProps {
  results: NearbyPharmacyResult[];
  isLoading: boolean;
  errorMessage: string | null;
  searchQuery: string;
  onRetry: () => void;
  onSelectPharmacy?: (pharmacyId: string) => void;
  onCallPharmacy?: (phone: string) => void;
  onSelectAlternative?: (altQuery: string) => void;
  onReportDiscrepancy?: (pharmacy: NearbyPharmacyResult) => void;
  onSubscribeAlert?: (medicineQuery: string) => void;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  isLoading,
  errorMessage,
  searchQuery,
  onRetry,
  onSelectPharmacy,
  onCallPharmacy,
  onSelectAlternative,
  onReportDiscrepancy,
  onSubscribeAlert,
}) => {
  // 1. Loading State
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          gap: '14px',
        }}
      >
        <div className="spinner" aria-hidden="true" style={{ width: '36px', height: '36px' }} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Checking verified pharmacy availability...
        </span>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Matching "{searchQuery}" against nearby pharmacy stock reports
        </span>
      </div>
    );
  }

  // 2. Network / API Error State
  if (errorMessage) {
    return (
      <div
        role="alert"
        style={{
          padding: '32px 20px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(180, 35, 47, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-status-problem-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-status-problem)',
          }}
        >
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>
            Unable to Load Pharmacy Availability
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '440px' }}>
            {errorMessage}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label="Retry loading nearby pharmacy availability"
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Retry Search</span>
        </button>
      </div>
    );
  }

  // 3. Empty State (No Results Guidance)
  if (results.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '40px 24px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface-canvas)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
          }}
        >
          <SearchX size={26} aria-hidden="true" />
        </div>

        <div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
            No nearby pharmacies reporting "{searchQuery}"
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '460px', lineHeight: 1.5 }}>
            No participating pharmacies in this area currently report stock for this query. Stock changes throughout the day as pharmacies restock.
          </p>
        </div>

        {/* Helpful No-Results Guidance Checklist */}
        <div
          style={{
            textAlign: 'left',
            backgroundColor: 'var(--color-surface-canvas)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            border: '1px solid var(--color-border-default)',
            maxWidth: '440px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <strong style={{ fontSize: '12px', color: 'var(--color-text-primary)', display: 'block', marginBottom: '8px' }}>
            Recommended next steps:
          </strong>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            <li>Search by generic active ingredient (e.g. <em>Paracetamol</em> instead of a specific brand).</li>
            <li>Try searching a standard dosage strength (e.g. <em>500 mg</em>).</li>
            <li>Expand your search area or check neighboring wards.</li>
          </ul>
        </div>

        {/* Restock alert trigger button */}
        {onSubscribeAlert && (
          <div style={{ marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onSubscribeAlert(searchQuery)}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label={`Subscribe to restock notification for ${searchQuery}`}
            >
              <Bell size={14} aria-hidden="true" />
              <span>Notify me when restocked</span>
            </button>
          </div>
        )}

        {/* Common Searches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            Try common medicines:
          </span>
          {['Paracetamol 500 mg', 'Amoxicillin 500 mg', 'Cetirizine 10 mg'].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSelectAlternative?.(suggestion)}
              style={{
                backgroundColor: 'var(--color-surface-canvas)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 12px',
                fontSize: '12px',
                color: 'var(--color-action-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 4. Success State (Render List of Pharmacy Results)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          {results.length} {results.length === 1 ? 'pharmacy' : 'pharmacies'} reporting this medicine
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Sorted by distance
        </span>
      </div>

      {results.map((pharmacy) => (
        <article
          key={pharmacy.id}
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
          }}
        >
          {pharmacy.isDemoData && (
            <span
              style={{
                position: 'absolute',
                top: '12px',
                right: '14px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                backgroundColor: 'var(--color-surface-canvas)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              Demo Data
            </span>
          )}

          {/* Pharmacy Name, Verification Status, Distance & Hours */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: '16px',
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-status-neutral, #475467)',
                      backgroundColor: 'var(--color-status-neutral-bg, #F2F4F7)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                    }}
                    title="Community submitted or unverified listing"
                  >
                    <span>Unverified</span>
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                {pharmacy.address}
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <strong>{pharmacy.distanceKm} km away</strong>
                <span>&bull;</span>
                <span style={{ color: pharmacy.isOpen ? 'var(--color-status-available)' : 'var(--color-status-problem)' }}>
                  {pharmacy.isOpen ? 'Open Now' : 'Closed'} ({pharmacy.openingHoursText})
                </span>
              </div>
            </div>
          </div>

          {/* Availability Status & Freshness Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'var(--color-surface-canvas)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <AvailabilityStatus status={pharmacy.stockStatus} quantity={pharmacy.quantity} size="md" />
            <FreshnessBadge updatedAt={pharmacy.updatedAt} isStale={pharmacy.isStale} />
          </div>

          {/* Action Row: Direct Call, Get Directions, & Pharmacy Details */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid var(--color-border-default)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {sanitizePhoneNumber(pharmacy.phone) ? (
                <button
                  type="button"
                  onClick={() => onCallPharmacy?.(sanitizePhoneNumber(pharmacy.phone)!)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-action-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    padding: '6px 10px',
                  }}
                  aria-label={`Call ${pharmacy.pharmacyName} at ${pharmacy.phone}`}
                >
                  <Phone size={13} aria-hidden="true" />
                  <span>Call</span>
                </button>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface-canvas)',
                    border: '1px dashed var(--color-border-default)',
                  }}
                  title="No direct phone number reported"
                >
                  <PhoneOff size={12} aria-hidden="true" />
                  <span>No phone</span>
                </span>
              )}

              {/* Get Directions link */}
              <a
                href={
                  getDirectionsRoute({
                    latitude: pharmacy.latitude,
                    longitude: pharmacy.longitude,
                    address: pharmacy.address,
                    pharmacyName: pharmacy.pharmacyName,
                  }).url
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  textDecoration: 'none',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                }}
                aria-label={`Get directions to ${pharmacy.pharmacyName}`}
              >
                <Navigation size={13} aria-hidden="true" />
                <span>Directions</span>
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onSelectPharmacy?.(pharmacy.pharmacyId)}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
                aria-label={`View pharmacy and medicine details for ${pharmacy.pharmacyName}`}
              >
                <span>View details</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>

              {onReportDiscrepancy && (
                <button
                  type="button"
                  onClick={() => onReportDiscrepancy(pharmacy)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    background: 'none',
                    border: 'none',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  title="Report incorrect availability or stock info"
                  aria-label={`Report availability discrepancy for ${pharmacy.pharmacyName}`}
                >
                  <AlertTriangle size={12} aria-hidden="true" />
                  <span>Report</span>
                </button>
              )}
            </div>
          </div>
        </article>
      ))}

      <div
        role="note"
        aria-label="Stock disclaimer"
        style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
          marginTop: '8px',
          lineHeight: 1.4,
        }}
      >
        Availability is pharmacy-reported and can change. Always check the last-updated timestamp and call ahead before travelling.
      </div>
    </div>
  );
};

