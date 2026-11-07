// src/features/pharmacy/PharmacyDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PharmacyApplicationResponse, Pharmacy } from '../../types/pharmacy';
import {
  getPharmacyApplication,
  getPharmacyProfile,
} from '../../services/pharmacyService';
import {
  Building2,
  Clock3,
  Lock,
  MapPin,
  ShieldAlert,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export const PharmacyDashboard: React.FC = () => {
  const [application, setApplication] = useState<PharmacyApplicationResponse | null>(null);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [appRes, profileRes] = await Promise.all([
        getPharmacyApplication().catch(() => null),
        getPharmacyProfile().catch(() => null),
      ]);
      setApplication(appRes);
      setPharmacy(profileRes);
    } catch {
      setError('Could not retrieve pharmacy verification status from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getPharmacyApplication().catch(() => null),
      getPharmacyProfile().catch(() => null),
    ])
      .then(([appRes, profileRes]) => {
        if (isMounted) {
          setApplication(appRes);
          setPharmacy(profileRes);
        }
      })
      .catch(() => {
        if (isMounted) setError('Could not retrieve pharmacy verification status from server.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div className="spinner" aria-hidden="true" />
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
          Loading pharmacy workspace...
        </span>
      </div>
    );
  }

  // Case 1: No registered pharmacy or application found
  if (!application && !pharmacy) {
    return (
      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px', textAlign: 'center' }}>
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '40px 24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-action-subtle)',
              color: 'var(--color-action-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
            aria-hidden="true"
          >
            <Building2 size={28} />
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            No Pharmacy Registered
          </h1>

          <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
            To report medicine availability, manage inventory, and receive patient inquiries, submit your official
            pharmacy onboarding application.
          </p>

          <Link
            to="/pharmacy/register"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-action-primary)',
              color: '#ffffff',
              textDecoration: 'none',
            }}
          >
            <span>Start Pharmacy Application</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = application?.status || pharmacy?.status || 'pending';
  const pharmacyName = application?.data.name || pharmacy?.name || 'Your Pharmacy';
  const licenseNumber = application?.data.licenseNo || pharmacy?.licenseNo || 'Pending Documentation';
  const addressString = application?.data.formattedAddress || pharmacy?.address || 'Address provided';
  const openingHoursString = application?.data.openingHours || pharmacy?.openingHours || 'Schedule on file';

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 16px 64px' }}>
      {/* Error alert */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
          }}
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {pharmacyName}
            </h1>
          </div>
          <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            License: <code>{licenseNumber}</code> • {addressString}
          </span>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-panel)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
          aria-label="Refresh verification status"
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* AUTHORITATIVE STATUS BANNER                               */}
      {/* ========================================================= */}
      {currentStatus === 'pending' && (
        <div
          role="region"
          aria-label="Verification status banner"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(152, 88, 0, 0.35)',
            borderLeft: '5px solid var(--color-status-caution)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-caution-bg)',
                color: 'var(--color-status-caution)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <Clock3 size={24} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-caution-bg)',
                    color: 'var(--color-status-caution)',
                    border: '1px solid rgba(152, 88, 0, 0.25)',
                    letterSpacing: '0.04em',
                  }}
                >
                  STATUS: PENDING REVIEW
                </span>
                {application?.applicationId && (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Ref: <code>{application.applicationId}</code>
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 8px' }}>
                Application Awaiting Administrator Approval
              </h2>

              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 12px' }}>
                Your pharmacy application is queued for regulatory cross-checking against official drug authority
                registries. Per MediFind safety integrity rules, <strong>your listing is not publicly visible</strong> and
                stock reporting operations remain locked until verification is confirmed.
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--color-status-caution)',
                  fontWeight: 500,
                }}
              >
                <Clock size={15} aria-hidden="true" />
                <span>Typical review response window: 1–2 business days</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStatus === 'rejected' && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            borderLeft: '5px solid var(--color-status-problem)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <ShieldAlert size={28} color="var(--color-status-problem)" style={{ flexShrink: 0 }} aria-hidden="true" />
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#ffffff',
                  color: 'var(--color-status-problem)',
                }}
              >
                STATUS: APPLICATION REJECTED
              </span>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-status-problem)', margin: '6px 0' }}>
                Review Reason: {application?.verificationReason || 'Documentation mismatch'}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
                Please review your drug license credentials and re-submit a corrected application.
              </p>
              <Link
                to="/pharmacy/register"
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  padding: '8px 16px',
                  fontSize: '13px',
                  textDecoration: 'none',
                }}
              >
                Correct and Resubmit Application
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* WORKSPACE SECTIONS (LOCKED DURING PENDING)                */}
      {/* ========================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Inventory Section (Locked during pending) */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                Medicine Inventory & Availability Reports
              </h3>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Report stock levels (Available, Low, Out of Stock) to nearby patients
              </span>
            </div>

            {currentStatus === 'pending' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <Lock size={13} aria-hidden="true" />
                <span>Locked until Verified</span>
              </span>
            )}
          </div>

          {currentStatus === 'pending' ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-canvas)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--color-border-default)',
              }}
            >
              <Lock size={32} color="var(--color-text-secondary)" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
              <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)', display: 'block', marginBottom: '6px' }}>
                Inventory Management is Locked
              </strong>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '440px', margin: '0 auto' }}>
                To maintain patient safety and prevent unverified medicine claims, stock updating unlocks immediately
                upon administrator approval of your license evidence.
              </p>
            </div>
          ) : (
            <div style={{ padding: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Active listings available for one-tap stock update.
            </div>
          )}
        </div>

        {/* Pharmacy Profile & Schedule Review */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Onboarding Profile Details
            </h3>
            <Link
              to="/pharmacy/register"
              style={{
                fontSize: '13px',
                color: 'var(--color-action-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View Full Application
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              fontSize: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <FileText size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Drug Trade Licence
                </span>
                <strong style={{ color: 'var(--color-text-primary)' }}>{licenseNumber}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <MapPin size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Registered Location
                </span>
                <span style={{ color: 'var(--color-text-primary)' }}>{addressString}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', gridColumn: '1 / -1' }}>
              <Clock size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Weekly Hours
                </span>
                <span style={{ color: 'var(--color-text-primary)' }}>{openingHoursString}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
