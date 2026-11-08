// src/features/pharmacy/PharmacyDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PharmacyApplicationResponse, Pharmacy, VerificationStatus } from '../../types/pharmacy';
import {
  getPharmacyApplication,
  getPharmacyProfile,
  setMockVerificationStatus,
  seedSamplePharmacy,
  isMockApiEnabled,
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
  CheckCircle2,
  AlertOctagon,
  Phone,
  Mail,
  Edit3,
  Sparkles,
  Sliders,
} from 'lucide-react';

export const PharmacyDashboard: React.FC = () => {
  const [application, setApplication] = useState<PharmacyApplicationResponse | null>(null);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (showRefreshingIndicator = false) => {
    if (showRefreshingIndicator) setIsRefreshing(true);
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
      setIsRefreshing(false);
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
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Could not retrieve pharmacy verification status from server.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSimulateStatus = (status: VerificationStatus) => {
    let reason: string | undefined;
    let nextStep: string | undefined;

    if (status === 'rejected') {
      reason = 'Uploaded Drug Trade License certificate expired or name does not match national registry.';
      nextStep = 'Please upload a renewed DGDA trade certificate and correct the legal trade name in your application.';
    } else if (status === 'suspended') {
      reason = 'Repeated customer complaints regarding inaccurate reported stock availability under investigation.';
      nextStep = 'Contact MediFind Compliance at compliance@medifind.dev with your audit reference number to arrange re-audit.';
    }

    setMockVerificationStatus(status, reason, nextStep);
    fetchStatus();
  };

  const handleSeedDemo = () => {
    seedSamplePharmacy('pending');
    fetchStatus();
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
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

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
                textDecoration: 'none',
              }}
            >
              <span>Start Pharmacy Application</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>

            {isMockApiEnabled() && (
              <button
                type="button"
                onClick={handleSeedDemo}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <span>Load Sample Pharmacy (Dev Mode)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentStatus: VerificationStatus = application?.status || pharmacy?.status || 'pending';
  const pharmacyName = pharmacy?.name || application?.data?.name || 'Your Pharmacy';
  const ownerName = pharmacy?.ownerName || application?.data?.ownerName || 'Pharmacy Representative';
  const licenseNumber = pharmacy?.licenseNo || application?.data?.licenseNo || 'Documentation on file';
  const addressString = pharmacy?.formattedAddress || pharmacy?.address || application?.data?.formattedAddress || application?.data?.streetAddress || 'Address on file';
  const openingHoursString = pharmacy?.openingHours || application?.data?.openingHours || 'Schedule on file';
  const phoneString = pharmacy?.phone || application?.data?.phone || '';
  const emailString = pharmacy?.email || application?.data?.email || '';

  // Extract decision reason and next step when provided by the API
  const decisionReason =
    application?.decisionReason ||
    application?.verificationReason ||
    pharmacy?.decisionReason ||
    pharmacy?.verificationReason;

  const nextStep = application?.nextStep || pharmacy?.nextStep;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Dev Verification State Simulator Bar */}
      {isMockApiEnabled() && (
        <aside
          aria-label="Development review state simulator"
          style={{
            marginBottom: '20px',
            padding: '10px 16px',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px dashed var(--color-action-primary)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} color="var(--color-action-primary)" aria-hidden="true" />
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Reviewer Simulator:
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Switch verification state to test all 4 flows:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {(['pending', 'verified', 'rejected', 'suspended'] as VerificationStatus[]).map((st) => {
              const isActive = currentStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleSimulateStatus(st)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    borderRadius: 'var(--radius-full)',
                    border: isActive
                      ? '1px solid var(--color-action-primary)'
                      : '1px solid var(--color-border-default)',
                    backgroundColor: isActive ? 'var(--color-action-primary)' : 'var(--color-surface-canvas)',
                    color: isActive ? '#ffffff' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                  aria-pressed={isActive}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* Error alert if status retrieval failed */}
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

      {/* Workspace Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {pharmacyName}
            </h1>
          </div>

          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span>License: <code>{licenseNumber}</code></span>
            <span>•</span>
            <span>{addressString}</span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={isRefreshing}
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
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
            }}
            aria-label="Refresh verification status"
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              style={{
                animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
              }}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>

          <Link
            to="/pharmacy/profile"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Edit3 size={14} aria-hidden="true" />
            <span>Pharmacy Profile</span>
          </Link>
        </div>
      </div>

      {/* ================================================================= */}
      {/* AUTHORITATIVE VERIFICATION STATUS BANNER                          */}
      {/* Explicitly supports: Pending, Verified, Rejected, Suspended       */}
      {/* Uses text labels, icons, and supporting guidance (never color alone)*/}
      {/* ================================================================= */}

      {/* STATE 1: PENDING REVIEW */}
      {currentStatus === 'pending' && (
        <section
          role="region"
          aria-label="Verification status: Pending Review"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(152, 88, 0, 0.35)',
            borderLeft: '6px solid var(--color-status-caution)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-caution-bg)',
                    color: 'var(--color-status-caution)',
                    border: '1px solid rgba(152, 88, 0, 0.3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  VERIFICATION STATUS: PENDING ADMINISTRATOR REVIEW
                </span>

                {application?.applicationId && (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Ref: <code>{application.applicationId}</code>
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 8px' }}>
                Application Awaiting Regulatory Verification
              </h2>

              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
                Your pharmacy application has been submitted and is currently awaiting administrative and regulatory
                cross-checking against official drug authority registries. Per MediFind healthcare safety integrity rules,{' '}
                <strong>your pharmacy is not yet publicly visible</strong> and medicine stock reporting remains locked
                until verification is approved by an administrator.
              </p>

              {/* Review turnaround & Next Step Guidance */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-status-caution-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(152, 88, 0, 0.2)',
                  fontSize: '13px',
                  color: 'var(--color-status-caution)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <Clock size={15} aria-hidden="true" />
                  <span>Expected Review Turnaround: 1–2 business days</span>
                </div>
                <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  <strong>Next step:</strong> No further action is required at this time. You can review and complete your
                  profile details (contact info, address, location pin, and operating hours) below so everything is ready
                  once your listing is verified.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STATE 2: VERIFIED & ACTIVE */}
      {currentStatus === 'verified' && (
        <section
          role="region"
          aria-label="Verification status: Verified and Active"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(24, 115, 75, 0.35)',
            borderLeft: '6px solid var(--color-status-available)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-available-bg)',
                color: 'var(--color-status-available)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <CheckCircle2 size={26} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-available-bg)',
                    color: 'var(--color-status-available)',
                    border: '1px solid rgba(24, 115, 75, 0.3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  VERIFICATION STATUS: VERIFIED & OFFICIALLY ACTIVE
                </span>

                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Accredited by DGDA
                </span>
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 8px' }}>
                Pharmacy Verified & Publicly Listed
              </h2>

              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
                Your pharmacy credentials have been confirmed by MediFind regulatory administrators. Your pharmacy is{' '}
                <strong>officially published</strong> and visible to patients discovering medicines in your locality.
                Inventory management and one-tap stock level reporting are active.
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-status-available-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(24, 115, 75, 0.2)',
                  fontSize: '13px',
                  color: 'var(--color-status-available)',
                }}
              >
                <Sparkles size={15} aria-hidden="true" />
                <span>
                  <strong>Next step:</strong> Keep your medicine availability reports fresh and maintain updated operating
                  hours so nearby patients receive reliable guidance.
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STATE 3: APPLICATION REJECTED */}
      {currentStatus === 'rejected' && (
        <section
          role="alert"
          aria-label="Verification status: Application Rejected"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(180, 35, 47, 0.35)',
            borderLeft: '6px solid var(--color-status-problem)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-problem-bg)',
                color: 'var(--color-status-problem)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <ShieldAlert size={26} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-problem-bg)',
                    color: 'var(--color-status-problem)',
                    border: '1px solid rgba(180, 35, 47, 0.3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  VERIFICATION STATUS: APPLICATION NOT APPROVED
                </span>
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-status-problem)', margin: '4px 0 8px' }}>
                Application Rejected by Verification Authority
              </h2>

              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
                The verification review could not approve your pharmacy application. Per MediFind safety integrity rules,
                this pharmacy is <strong>not publicly listed</strong> and stock updating operations are disabled.
              </p>

              {/* Decision Reason (When supplied by API vs Gap handling) */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-status-problem-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(180, 35, 47, 0.25)',
                  marginBottom: '14px',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: 'var(--color-status-problem)', display: 'block', marginBottom: '4px' }}>
                  Decision Reason:
                </strong>
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {decisionReason ||
                    'No specific rejection reason was provided by the review authority. Please verify that your drug trade license number, business name, and issuing authority match official records.'}
                </span>
              </div>

              {/* Next Step Guidance (When supplied by API vs Gap handling) */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-surface-canvas)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  marginBottom: '18px',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: '4px' }}>
                  Required Next Step:
                </strong>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {nextStep ||
                    'Review your drug license documents and trade name details, then resubmit your corrected application for expedited administrator review.'}
                </span>
              </div>

              {/* Correction Action Link */}
              <Link
                to="/pharmacy/register"
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                }}
              >
                <span>Correct and Resubmit Application</span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* STATE 4: ACCOUNT SUSPENDED */}
      {currentStatus === 'suspended' && (
        <section
          role="alert"
          aria-label="Verification status: Account Suspended"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(180, 35, 47, 0.35)',
            borderLeft: '6px solid var(--color-status-problem)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-problem-bg)',
                color: 'var(--color-status-problem)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <AlertOctagon size={26} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-problem-bg)',
                    color: 'var(--color-status-problem)',
                    border: '1px solid rgba(180, 35, 47, 0.3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  VERIFICATION STATUS: PHARMACY ACCOUNT SUSPENDED
                </span>
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-status-problem)', margin: '4px 0 8px' }}>
                Pharmacy Operations Suspended
              </h2>

              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
                This pharmacy’s operations and public listings have been paused by MediFind administration. To protect
                patient safety and preserve catalog trust, your listings are hidden from customer discovery and stock
                updates are temporarily locked.
              </p>

              {/* Decision Reason */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-status-problem-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(180, 35, 47, 0.25)',
                  marginBottom: '14px',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: 'var(--color-status-problem)', display: 'block', marginBottom: '4px' }}>
                  Suspension Reason:
                </strong>
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {decisionReason ||
                    'No specific suspension reason was specified by the administrator.'}
                </span>
              </div>

              {/* Next Step Guidance */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-surface-canvas)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  marginBottom: '18px',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: '4px' }}>
                  Next Step:
                </strong>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {nextStep ||
                    'Please contact MediFind Compliance at compliance@medifind.dev with your Drug License number to initiate a compliance review and request account reactivation.'}
                </span>
              </div>

              <a
                href="mailto:compliance@medifind.dev?subject=Pharmacy%20Suspension%20Review%20Request"
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-primary)',
                  textDecoration: 'none',
                }}
              >
                <Mail size={16} aria-hidden="true" />
                <span>Contact Compliance Desk</span>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* WORKSPACE SECTIONS: INVENTORY & PROFILE OVERVIEWS                 */}
      {/* ================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* SECTION 1: MEDICINE INVENTORY WORKBENCH */}
        <section
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
          aria-labelledby="inventory-section-heading"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h2
                id="inventory-section-heading"
                style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}
              >
                Medicine Inventory & Availability Reports
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Report stock levels (Available, Low stock, Out of stock) to patients
              </span>
            </div>

            {currentStatus !== 'verified' && (
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

          {currentStatus !== 'verified' ? (
            <div
              style={{
                padding: '36px 20px',
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
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.5 }}>
                To maintain patient safety and prevent unverified medicine availability claims, stock updating unlocks
                immediately upon regulatory approval of your drug license evidence.
              </p>
            </div>
          ) : (
            <div
              style={{
                padding: '24px',
                backgroundColor: 'var(--color-status-available-bg)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(24, 115, 75, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <strong style={{ fontSize: '15px', color: 'var(--color-status-available)', display: 'block', marginBottom: '4px' }}>
                  ✓ Inventory Operations Unlocked
                </strong>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  You are authorized to report availability and manage medicine listings.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-status-available)',
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(24, 115, 75, 0.3)',
                  }}
                >
                  Live Reporting Ready
                </span>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2: PHARMACY PROFILE & SCHEDULE OVERVIEW */}
        <section
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
          aria-labelledby="profile-overview-heading"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h2
                id="profile-overview-heading"
                style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}
              >
                Pharmacy Profile & Operating Schedule
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Public contact details, physical address, and patient operating hours
              </span>
            </div>

            <Link
              to="/pharmacy/profile"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
              }}
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>View & Edit Full Profile</span>
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '18px',
            }}
          >
            {/* Contact Person */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Building2 size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Representative / Owner
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{ownerName}</strong>
              </div>
            </div>

            {/* Drug License */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <FileText size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Drug Trade License
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{licenseNumber}</strong>
              </div>
            </div>

            {/* Phone & Email */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Phone size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Contact Information
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {phoneString || 'No phone'} {emailString ? `• ${emailString}` : ''}
                </span>
              </div>
            </div>

            {/* Address */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <MapPin size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Physical Address
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{addressString}</span>
              </div>
            </div>

            {/* Operating Hours */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', gridColumn: '1 / -1' }}>
              <Clock size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Operating Hours Summary
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{openingHoursString}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
