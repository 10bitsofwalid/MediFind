// frontend/src/features/customer/MedicineDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { medicineService, type MedicineCatalogueDetails } from '../../services/medicineService';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import { SelectedPharmacyPanel } from './components/SelectedPharmacyPanel';
import { ReportDiscrepancyModal } from './components/ReportDiscrepancyModal';
import { ReservationModal } from './components/ReservationModal';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { getDirectionsRoute, sanitizePhoneNumber } from './utils/routingUtils';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import type { NearbyPharmacyResult } from './types';

export const MedicineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const pharmacyIdParam = searchParams.get('pharmacyId');
  const initialQuery = id || searchParams.get('q') || 'med-paracetamol-500';

  const [medicine, setMedicine] = useState<MedicineCatalogueDetails | null>(null);
  const [pharmacies, setPharmacies] = useState<NearbyPharmacyResult[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<NearbyPharmacyResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCallNumber, setActiveCallNumber] = useState<string | null>(null);
  const [reservationFeedback, setReservationFeedback] = useState<string | null>(null);
  const [reportingPharmacy, setReportingPharmacy] = useState<NearbyPharmacyResult | null>(null);
  const [reservingPharmacy, setReservingPharmacy] = useState<NearbyPharmacyResult | null>(null);
  const [reserveQuantity, setReserveQuantity] = useState<number>(1);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const med = await medicineService.getMedicineById(initialQuery);
        if (!active) return;
        setMedicine(med);

        const { results } = await medicineService.searchNearbyPharmacies({
          query: med?.name || initialQuery,
          radiusKm: 15,
        });

        if (!active) return;
        setPharmacies(results);

        if (results.length > 0) {
          const match = pharmacyIdParam
            ? results.find((p) => p.pharmacyId === pharmacyIdParam)
            : null;
          setSelectedPharmacy(match || results[0]);
        }
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Unable to load medicine and pharmacy details.';
        setErrorMessage(msg);
      } finally {
        if (active) setIsLoading(false);
      }
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, initialQuery, pharmacyIdParam]);

  const handleCall = (phone: string) => {
    const clean = sanitizePhoneNumber(phone) || phone;
    setActiveCallNumber(clean);
    window.location.href = `tel:${clean}`;
  };

  const handleGetDirections = (targetPharmacy: NearbyPharmacyResult) => {
    const route = getDirectionsRoute({
      latitude: targetPharmacy.latitude,
      longitude: targetPharmacy.longitude,
      address: targetPharmacy.address,
      pharmacyName: targetPharmacy.pharmacyName,
    });
    window.open(route.url, '_blank', 'noopener,noreferrer');
  };

  const handleReserveClick = (targetPharmacy: NearbyPharmacyResult, quantity: number) => {
    // If not signed in as customer, navigate to login with return path
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;

    if (!user || user.role !== 'CUSTOMER') {
      navigate('/login?reason=reservation_required');
      return;
    }

    setReserveQuantity(quantity);
    setReservingPharmacy(targetPharmacy);
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          maxWidth: '1100px',
          margin: '40px auto',
          padding: '24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div className="spinner" aria-hidden="true" style={{ width: '36px', height: '36px' }} />
        <span style={{ fontSize: '15px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          Loading medicine specifications and verified pharmacy availability...
        </span>
      </div>
    );
  }

  if (errorMessage || !medicine) {
    return (
      <div
        role="alert"
        style={{
          maxWidth: '680px',
          margin: '40px auto',
          padding: '24px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(180, 35, 47, 0.3)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '18px', color: 'var(--color-status-problem)', margin: '0 0 8px 0' }}>
          Medicine Details Unavailable
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
          {errorMessage || 'The requested medicine could not be found in the directory.'}
        </p>
        <Link to="/search" className="btn-primary" style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 'var(--radius-md)' }}>
          Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '16px',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Breadcrumb Navigation (per UI Design Page 5) */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <Link
          to="/search"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--color-action-primary)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Search</span>
        </Link>
        <span style={{ color: 'var(--color-text-muted)' }}>/</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>Medicine details</span>
        <span style={{ color: 'var(--color-text-muted)' }}>/</span>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{medicine.name}</span>
      </nav>

      {/* Reservation feedback notification */}
      {reservationFeedback && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid rgba(24, 115, 75, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-status-available)',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{reservationFeedback}</span>
          <button
            type="button"
            onClick={() => setReservationFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Medicine Details Card (per UI Design Page 5) */}
      <section
        aria-label="Catalogue medicine reference"
        className="card"
        style={{
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-action-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-action-primary)',
              fontWeight: 800,
              fontSize: '20px',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            Rx
          </div>

          <div style={{ flex: 1, minWidth: '260px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-action-primary)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {medicine.strength}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                {medicine.name}
              </h1>
              {medicine.isCatalogueVerified && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-trust-primary, #0B6BCB)',
                    backgroundColor: 'var(--color-trust-subtle, #EBF5FF)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  <CheckCircle2 size={12} aria-hidden="true" />
                  <span>Catalogue Verified</span>
                </span>
              )}
            </div>

            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
              <strong>Generic name:</strong> {medicine.genericName} &bull; <strong>Form:</strong> {medicine.form} &bull;{' '}
              <strong>Strength:</strong> {medicine.strength}
              {medicine.manufacturer && <span> &bull; <strong>Manufacturer:</strong> {medicine.manufacturer}</span>}
            </div>
          </div>
        </div>

        {/* Reference Information Notice */}
        <div
          role="note"
          style={{
            marginTop: '16px',
            padding: '10px 14px',
            backgroundColor: 'var(--color-status-caution-bg)',
            border: '1px solid rgba(152, 88, 0, 0.25)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--color-status-caution)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>
            <strong>Reference information only:</strong> MediFind does not provide medical or dosage advice. Follow a clinician’s prescription or official product label guidance.
          </span>
        </div>
      </section>

      {/* Two Column Layout: Pharmacy Availability List (Left) + Selected Pharmacy Action Panel (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Nearby Pharmacy List */}
        <section aria-label="Nearby pharmacy stock availability">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              Nearby pharmacy availability
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Sorted by distance &bull; within 15 km
            </span>
          </div>

          {pharmacies.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-panel)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              <Building2 size={32} color="var(--color-text-secondary)" style={{ margin: '0 auto 8px auto' }} />
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                No nearby pharmacies currently reporting stock for this medicine.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pharmacies.map((pharmacy) => {
                const isSelected = selectedPharmacy?.pharmacyId === pharmacy.pharmacyId;
                return (
                  <article
                    key={pharmacy.id}
                    className="card"
                    style={{
                      backgroundColor: 'var(--color-surface-panel)',
                      border: isSelected
                        ? '2px solid var(--color-action-primary)'
                        : '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                          {pharmacy.pharmacyName}
                        </strong>
                        {pharmacy.isVerified && (
                          <CheckCircle2 size={13} color="var(--color-trust-primary, #0B6BCB)" aria-label="Verified pharmacy" />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <AvailabilityStatus status={pharmacy.stockStatus} quantity={pharmacy.quantity} size="sm" />
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {pharmacy.distanceKm} km
                        </span>
                        <span>&bull;</span>
                        <FreshnessBadge updatedAt={pharmacy.updatedAt} isStale={pharmacy.isStale} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPharmacy(pharmacy)}
                        className={isSelected ? 'btn-primary' : 'btn-secondary'}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        aria-label={`View selected pharmacy details for ${pharmacy.pharmacyName}`}
                      >
                        {isSelected ? 'Selected' : 'View details'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setReportingPharmacy(pharmacy)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-muted)',
                          fontSize: '11px',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        aria-label={`Report incorrect stock for ${pharmacy.pharmacyName}`}
                      >
                        Report
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Selected Pharmacy Action Panel */}
        {selectedPharmacy && (
          <SelectedPharmacyPanel
            pharmacy={selectedPharmacy}
            onCall={handleCall}
            onGetDirections={handleGetDirections}
            onReserveClick={handleReserveClick}
          />
        )}
      </div>

      {/* Same-generic Alternatives Section (per UI Design Page 5) */}
      {medicine.sameGenericAlternatives && medicine.sameGenericAlternatives.length > 0 && (
        <section aria-label="Same-generic medicine alternatives" style={{ marginTop: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--color-text-primary)' }}>
            Same-generic alternatives
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {medicine.sameGenericAlternatives.map((alt) => (
              <div
                key={alt}
                className="card"
                style={{
                  backgroundColor: 'var(--color-surface-panel)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {alt}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Same generic active ingredient
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(alt)}`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-action-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  aria-label={`Compare availability for alternative medicine ${alt}`}
                >
                  <span>Compare &rarr;</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stock disclaimer notice */}
      <DisclaimerBanner variant="banner" pharmacyPhone={selectedPharmacy?.phone} />

      {/* Discrepancy Reporting Modal */}
      {reportingPharmacy && (
        <ReportDiscrepancyModal
          pharmacy={reportingPharmacy}
          medicineName={medicine.name}
          medicineId={medicine.id}
          isOpen={true}
          onClose={() => setReportingPharmacy(null)}
        />
      )}

      {/* Reservation Hold Modal */}
      {reservingPharmacy && medicine && (
        <ReservationModal
          pharmacy={reservingPharmacy}
          medicineName={medicine.name}
          genericName={medicine.genericName}
          strength={medicine.strength}
          initialQuantity={reserveQuantity}
          isOpen={true}
          onClose={() => setReservingPharmacy(null)}
          onSuccess={(record) => {
            setReservationFeedback(
              `Hold request confirmed! Pickup code is ${record.pickupCode} at ${record.pharmacyName}.`
            );
          }}
        />
      )}

      {/* Accessibility announcer */}
      {activeCallNumber && (
        <div role="status" className="sr-only">
          Dialing {activeCallNumber}
        </div>
      )}
    </div>
  );
};
