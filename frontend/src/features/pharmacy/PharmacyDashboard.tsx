// src/features/pharmacy/PharmacyDashboard.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { PharmacyApplicationResponse, Pharmacy, VerificationStatus } from '../../types/pharmacy';
import type { StockInventoryRecord } from '../../types/medicine';
import {
  getPharmacyApplication,
  getPharmacyProfile,
  deletePharmacyApplication,
  setMockVerificationStatus,
  isMockApiEnabled,
} from '../../services/pharmacyService';
import { stockService } from '../../services/stockService';
import {
  STOCK_STATUS_LABELS,
  formatExactTimestamp,
  isStockRecordStale,
  mergeServerStockRecord,
} from './inventoryUtils';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import {
  Building2,
  Clock3,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
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
  Copy,
  Check,
  Trash2,
  X,
} from 'lucide-react';
import { OneTapStockControl } from './OneTapStockControl';
import { StockReminderSettings } from './StockReminderSettings';
import { DeleteApplicationModal } from '../../components/DeleteApplicationModal';

const activeDashboardReconfirmOps = new Set<string>();

export const PharmacyDashboard: React.FC = () => {
  const [application, setApplication] = useState<PharmacyApplicationResponse | null>(null);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [showFirstApprovalNotice, setShowFirstApprovalNotice] = useState<boolean>(false);
  const [approvalCountdown, setApprovalCountdown] = useState<number>(10);

  // Attention items & reconfirmation state (synced from loaded inventory + optional /owner/summary)
  const [trackedInventory, setTrackedInventory] = useState<StockInventoryRecord[] | null>(null);
  const [inventoryRefreshNonce, setInventoryRefreshNonce] = useState<number>(0);
  const [reconfirmingStockId, setReconfirmingStockId] = useState<string | null>(null);
  const [attentionSuccess, setAttentionSuccess] = useState<string | null>(null);
  const [attentionError, setAttentionError] = useState<string | null>(null);

  const isFetchingStatusRef = useRef<boolean>(false);
  const isDeletingRef = useRef<boolean>(false);

  const syncFirstApprovalNotice = (
    appRes: PharmacyApplicationResponse | null,
    profileRes: Pharmacy | null
  ) => {
    const resolvedStatus = appRes?.status || profileRes?.status;
    const entityId = appRes?.applicationId || profileRes?._id;
    if (!entityId) {
      setShowFirstApprovalNotice(false);
      return;
    }

    const seenKey = `medifind_approval_notice_seen_${entityId}`;
    if (resolvedStatus === 'verified') {
      const alreadySeen = localStorage.getItem(seenKey) === 'true';
      if (!alreadySeen) {
        setApprovalCountdown(10);
        setShowFirstApprovalNotice(true);
      } else {
        setShowFirstApprovalNotice(false);
      }
    } else {
      localStorage.removeItem(seenKey);
      setShowFirstApprovalNotice(false);
    }
  };

  const dismissFirstApprovalNotice = () => {
    const entityId = application?.applicationId || pharmacy?._id;
    if (entityId) {
      localStorage.setItem(`medifind_approval_notice_seen_${entityId}`, 'true');
    }
    setShowFirstApprovalNotice(false);
  };

  const handleCopyEmail = () => {
    navigator.clipboard
      ?.writeText('compliance@medifind.dev')
      .then(() => {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      })
      .catch(() => {});
  };

  const fetchStatus = async (showRefreshingIndicator = false) => {
    if (isFetchingStatusRef.current) return;
    isFetchingStatusRef.current = true;
    if (showRefreshingIndicator) setIsRefreshing(true);
    setError(null);
    try {
      const [appResult, profileResult] = await Promise.allSettled([
        getPharmacyApplication(),
        getPharmacyProfile(),
      ]);
      const appRes = appResult.status === 'fulfilled' ? appResult.value : null;
      const profileRes = profileResult.status === 'fulfilled' ? profileResult.value : null;
      const rejectedReason =
        profileResult.status === 'rejected'
          ? profileResult.reason
          : appResult.status === 'rejected'
          ? appResult.reason
          : null;

      if (rejectedReason && !appRes && !profileRes) {
        setError(
          rejectedReason instanceof Error
            ? rejectedReason.message
            : 'Could not retrieve pharmacy verification status from server.'
        );
      } else {
        setApplication(appRes);
        setPharmacy(profileRes);
        syncFirstApprovalNotice(appRes, profileRes);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not retrieve pharmacy verification status from server.'
      );
    } finally {
      isFetchingStatusRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getPharmacyApplication(), getPharmacyProfile()])
      .then(([appResult, profileResult]) => {
        if (!isMounted) return;
        const appRes = appResult.status === 'fulfilled' ? appResult.value : null;
        const profileRes = profileResult.status === 'fulfilled' ? profileResult.value : null;
        const rejectedReason =
          profileResult.status === 'rejected'
            ? profileResult.reason
            : appResult.status === 'rejected'
            ? appResult.reason
            : null;

        if (rejectedReason && !appRes && !profileRes) {
          setError(
            rejectedReason instanceof Error
              ? rejectedReason.message
              : 'Could not retrieve pharmacy verification status from server.'
          );
        } else {
          setApplication(appRes);
          setPharmacy(profileRes);
          syncFirstApprovalNotice(appRes, profileRes);
        }
        setIsLoading(false);
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

  useEffect(() => {
    if (!showFirstApprovalNotice) return;
    const entityId = application?.applicationId || pharmacy?._id;

    const intervalId = window.setInterval(() => {
      setApprovalCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      if (entityId) {
        localStorage.setItem(`medifind_approval_notice_seen_${entityId}`, 'true');
      }
      setShowFirstApprovalNotice(false);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [showFirstApprovalNotice, application?.applicationId, pharmacy?._id]);

  const handleSimulateStatus = (status: VerificationStatus) => {
    setMockVerificationStatus(status);
    fetchStatus();
  };

  const handleDeleteApplication = async () => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deletePharmacyApplication(application?.applicationId);
      sessionStorage.removeItem('medifind_pharmacy_form_draft');
      setShowDeleteModal(false);
      setApplication(null);
      setPharmacy(null);
      setDeleteSuccessMessage('Your submitted pharmacy application has been deleted.');
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete pharmacy application.'
      );
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  const handleInventorySync = useCallback((items: StockInventoryRecord[]) => {
    setTrackedInventory(items);
  }, []);

  const attentionItems = useMemo(() => {
    if (!trackedInventory) return [];
    return trackedInventory
      .filter((item) => item.status === 'unverified' || isStockRecordStale(item))
      .sort((a, b) => {
        // Prioritize unverified items first, then oldest stale reports
        if (a.status === 'unverified' && b.status !== 'unverified') return -1;
        if (b.status === 'unverified' && a.status !== 'unverified') return 1;
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return (Number.isNaN(timeA) ? 0 : timeA) - (Number.isNaN(timeB) ? 0 : timeB);
      });
  }, [trackedInventory]);

  const handleAttentionReconfirm = useCallback(
    async (
      pharmacyId: string,
      item: StockInventoryRecord,
      confirmedStatus?: 'available' | 'low' | 'out'
    ) => {
      const opKey = `${pharmacyId}:${item.stockId}`;
      if (activeDashboardReconfirmOps.has(opKey)) return;

      const targetStatus: 'available' | 'low' | 'out' | undefined =
        confirmedStatus ??
        (item.status === 'available' || item.status === 'low' || item.status === 'out'
          ? item.status
          : undefined);

      activeDashboardReconfirmOps.add(opKey);
      setReconfirmingStockId(item.stockId);
      setAttentionSuccess(null);
      setAttentionError(null);

      try {
        const serverUpdate = await stockService.reconfirmStockItem(pharmacyId, item.stockId, {
          status: targetStatus,
          quantity: item.quantity,
        });
        const merged = mergeServerStockRecord(item, serverUpdate);
        setTrackedInventory((prev) =>
          prev ? prev.map((rec) => (rec.stockId === merged.stockId ? merged : rec)) : prev
        );
        setInventoryRefreshNonce((n) => n + 1);
        setAttentionSuccess(
          `Reconfirmed ${merged.medicineName} as ${STOCK_STATUS_LABELS[merged.status]} • Updated ${formatExactTimestamp(merged.updatedAt)}`
        );
      } catch (err: unknown) {
        setAttentionError(
          err instanceof Error
            ? err.message
            : `Could not reconfirm ${item.medicineName}. Please verify status and try again.`
        );
      } finally {
        activeDashboardReconfirmOps.delete(opKey);
        setReconfirmingStockId(null);
      }
    },
    []
  );

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

  // Case 0: Initial load failed with server/network error (do not falsely show empty state)
  if (error && !application && !pharmacy) {
    return (
      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px' }}>
        <div
          role="alert"
          className="pharmacy-section-card"
          style={{
            borderColor: 'var(--color-status-problem-border)',
            backgroundColor: 'var(--color-status-problem-bg)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            padding: '32px 24px',
          }}
        >
          <AlertTriangle size={30} color="var(--color-status-problem)" aria-hidden="true" />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-problem)', margin: '0 0 6px' }}>
              Could Not Load Pharmacy Workspace
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
              {error}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchStatus(true)}
            disabled={isRefreshing}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <span>{isRefreshing ? 'Retrying...' : 'Retry'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Case 1: No registered pharmacy or application found
  if (!application && !pharmacy) {
    return (
      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px', textAlign: 'center' }}>
        {deleteSuccessMessage && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-status-available-bg)',
              border: '1px solid rgba(24, 115, 75, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-available)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{deleteSuccessMessage}</span>
          </div>
        )}
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

  const resolvedPharmacyId = pharmacy?._id || pharmacy?.id || application?.pharmacyId || '';

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
                    padding: '6px 12px',
                    minHeight: '36px',
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
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-word' }}>
              {pharmacyName}
            </h1>
            {currentStatus === 'verified' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-status-available-bg)',
                  color: 'var(--color-status-available)',
                  border: '1px solid rgba(24, 115, 75, 0.3)',
                }}
              >
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>Verified &amp; Publicly Listed</span>
              </span>
            )}
          </div>

          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap', overflowWrap: 'anywhere' }}>
            <span>License: <code>{licenseNumber}</code></span>
            <span>•</span>
            <span>{addressString}</span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
              padding: '10px 14px',
              minHeight: '44px',
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
              padding: '10px 16px',
              minHeight: '44px',
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
          className="pharmacy-status-banner"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(152, 88, 0, 0.35)',
            borderLeft: '6px solid var(--color-status-caution)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div className="pharmacy-status-banner-inner">
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

            <div style={{ flex: 1, minWidth: 0 }}>
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

              <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link
                  to="/pharmacy/register"
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-canvas)',
                    color: 'var(--color-text-primary)',
                    textDecoration: 'none',
                  }}
                >
                  <span>View Submitted Application</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setShowDeleteModal(true);
                  }}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(180, 35, 47, 0.35)',
                    backgroundColor: 'var(--color-status-problem-bg)',
                    color: 'var(--color-status-problem)',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Delete Application</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STATE 2: VERIFIED & ACTIVE (First-Time Approval Notice: 10s limit + Close) */}
      {currentStatus === 'verified' && showFirstApprovalNotice && (
        <section
          role="region"
          aria-label="Verification status: Verified and Active"
          className="pharmacy-status-banner"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(24, 115, 75, 0.35)',
            borderLeft: '6px solid var(--color-status-available)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
            position: 'relative',
          }}
        >
          <div className="pharmacy-status-banner-inner">
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

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                    VERIFICATION STATUS: VERIFIED &amp; OFFICIALLY ACTIVE
                  </span>

                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Accredited by DGDA
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'var(--color-surface-canvas)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border-default)',
                    }}
                  >
                    Closes in {approvalCountdown}s
                  </span>

                  <button
                    type="button"
                    onClick={dismissFirstApprovalNotice}
                    aria-label="Close verified approval notice"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      minHeight: '36px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-canvas)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} aria-hidden="true" />
                    <span>Close</span>
                  </button>
                </div>
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
          className="pharmacy-status-banner"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(180, 35, 47, 0.35)',
            borderLeft: '6px solid var(--color-status-problem)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div className="pharmacy-status-banner-inner">
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

            <div style={{ flex: 1, minWidth: 0 }}>
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

              {/* Correction & Delete Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setShowDeleteModal(true);
                  }}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(180, 35, 47, 0.35)',
                    backgroundColor: 'var(--color-status-problem-bg)',
                    color: 'var(--color-status-problem)',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span>Delete Application</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STATE 4: ACCOUNT SUSPENDED */}
      {currentStatus === 'suspended' && (
        <section
          role="alert"
          aria-label="Verification status: Account Suspended"
          className="pharmacy-status-banner"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(180, 35, 47, 0.35)',
            borderLeft: '6px solid var(--color-status-problem)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <div className="pharmacy-status-banner-inner">
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

            <div style={{ flex: 1, minWidth: 0 }}>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                  aria-label="Copy compliance email address to clipboard"
                >
                  {copiedEmail ? <Check size={15} color="var(--color-status-available)" /> : <Copy size={15} />}
                  <span>{copiedEmail ? 'Copied to Clipboard' : 'Copy compliance@medifind.dev'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* WORKSPACE SECTIONS: ATTENTION ITEMS, INVENTORY & PROFILE          */}
      {/* ================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* ATTENTION ITEMS & RECONFIRMATION PANEL (Verified Pharmacies) */}
        {currentStatus === 'verified' && resolvedPharmacyId && trackedInventory !== null && (
          <section
            className="card pharmacy-section-card"
            aria-labelledby="attention-items-heading"
            style={{
              borderColor:
                attentionItems.length > 0
                  ? 'var(--color-status-caution-border)'
                  : 'var(--color-border-default)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: attentionItems.length > 0 || attentionSuccess || attentionError ? '14px' : '0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2
                  id="attention-items-heading"
                  style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}
                >
                  Attention Items &amp; Reconfirmation
                </h2>
                {attentionItems.length > 0 ? (
                  <span
                    role="status"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-status-caution-bg)',
                      color: 'var(--color-status-caution)',
                      border: '1px solid var(--color-status-caution-border)',
                    }}
                  >
                    <AlertTriangle size={13} aria-hidden="true" />
                    <span>
                      {attentionItems.length} {attentionItems.length === 1 ? 'item needs' : 'items need'} check
                    </span>
                  </span>
                ) : (
                  <span
                    role="status"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-status-available-bg)',
                      color: 'var(--color-status-available)',
                      border: '1px solid var(--color-status-available-border)',
                    }}
                  >
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <span>All stock reports fresh</span>
                  </span>
                )}
              </div>

              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Physically check stock before reconfirming stale or unverified entries
              </span>
            </div>

            {attentionSuccess && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-available-bg)',
                  border: '1px solid var(--color-status-available-border)',
                  color: 'var(--color-status-available)',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span>{attentionSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttentionSuccess(null)}
                  aria-label="Dismiss reconfirmation message"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-status-available)',
                    cursor: 'pointer',
                    minWidth: '32px',
                    minHeight: '32px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}

            {attentionError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-problem-bg)',
                  border: '1px solid var(--color-status-problem-border)',
                  color: 'var(--color-status-problem)',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span>{attentionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttentionError(null)}
                  aria-label="Dismiss reconfirmation error"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-status-problem)',
                    cursor: 'pointer',
                    minWidth: '32px',
                    minHeight: '32px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}

            {attentionItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {attentionItems.slice(0, 5).map((item) => {
                  const isBusy = reconfirmingStockId === item.stockId;
                  const stale = isStockRecordStale(item);
                  const isUnverified = item.status === 'unverified';
                  return (
                    <div
                      key={item.stockId}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ minWidth: '200px', flex: '1 1 240px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                          {item.medicineName}{' '}
                          <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                            ({item.strength} • {item.form})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <AvailabilityStatus status={item.status} quantity={item.quantity} size="sm" />
                          <FreshnessBadge updatedAt={item.updatedAt} isStale={stale} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {isUnverified ? (
                          (['available', 'low', 'out'] as const).map((statusChoice) => (
                            <button
                              key={statusChoice}
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleAttentionReconfirm(resolvedPharmacyId, item, statusChoice)
                              }
                              className="btn-secondary inventory-status-btn"
                              style={{
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border-default)',
                                backgroundColor: 'var(--color-surface-panel)',
                                color: 'var(--color-text-primary)',
                                cursor: isBusy ? 'not-allowed' : 'pointer',
                                opacity: isBusy ? 0.65 : 1,
                              }}
                            >
                              {isBusy ? (
                                <span className="spinner-small" aria-hidden="true" />
                              ) : (
                                <ShieldCheck size={13} aria-hidden="true" />
                              )}
                              <span>Confirm {STOCK_STATUS_LABELS[statusChoice]}</span>
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleAttentionReconfirm(resolvedPharmacyId, item)}
                            className="btn-primary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              minHeight: '42px',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '13px',
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                              opacity: isBusy ? 0.7 : 1,
                            }}
                          >
                            {isBusy ? (
                              <span className="spinner-small" aria-hidden="true" />
                            ) : (
                              <ShieldCheck size={14} aria-hidden="true" />
                            )}
                            <span>
                              {isBusy
                                ? 'Reconfirming...'
                                : `Reconfirm as ${STOCK_STATUS_LABELS[item.status]}`}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {attentionItems.length > 5 && (
                  <div style={{ textAlign: 'right' }}>
                    <Link
                      to="/pharmacy/inventory"
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-action-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      View all {attentionItems.length} attention items in Full Workbench →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* SECTION 1: MEDICINE INVENTORY WORKBENCH */}
        <section
          className="card pharmacy-section-card"
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
                Medicine Inventory &amp; Availability Reports
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Report stock levels (Available, Low stock, Out of stock) to patients
              </span>
            </div>

            {currentStatus === 'verified' ? (
              <Link
                to="/pharmacy/inventory"
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  color: 'var(--color-action-primary)',
                  textDecoration: 'none',
                }}
              >
                <span>Open Full Workbench</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ) : (
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {showFirstApprovalNotice && (
                <div
                  style={{
                    padding: '16px 20px',
                    backgroundColor: 'var(--color-status-available-bg)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(24, 115, 75, 0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '15px', color: 'var(--color-status-available)', display: 'block', marginBottom: '2px' }}>
                      ✓ Inventory Operations Unlocked
                    </strong>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Select a status below for any medicine to save an updated pharmacy-reported availability status and timestamp.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-status-available)',
                      }}
                    >
                      {approvalCountdown}s
                    </span>
                    <button
                      type="button"
                      onClick={dismissFirstApprovalNotice}
                      aria-label="Close inventory unlocked notice"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(24, 115, 75, 0.3)',
                        backgroundColor: 'var(--color-surface-panel)',
                        color: 'var(--color-status-available)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* One-Tap Stock Control Component (resolves TECH-04 & UI-01) */}
              {resolvedPharmacyId ? (
                <OneTapStockControl
                  pharmacyId={resolvedPharmacyId}
                  pharmacyName={pharmacyName}
                  onInventoryChange={handleInventorySync}
                  externalRefreshNonce={inventoryRefreshNonce}
                />
              ) : (
                <div
                  role="alert"
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-status-problem-bg)',
                    color: 'var(--color-status-problem)',
                    fontSize: '13px',
                  }}
                >
                  Pharmacy identifier could not be resolved from your session. Please refresh status or sign in again.
                </div>
              )}
            </div>
          )}
        </section>

        {/* SECTION 2: STOCK UPDATE REMINDER NOTIFICATIONS (Verified Pharmacies) */}
        {currentStatus === 'verified' && <StockReminderSettings />}

        {/* SECTION 2: PHARMACY PROFILE & SCHEDULE OVERVIEW */}
        <section
          className="card pharmacy-section-card"
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

          <div className="pharmacy-grid-2">
            {/* Contact Person */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
              <Building2 size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Representative / Owner
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{ownerName}</strong>
              </div>
            </div>

            {/* Drug License */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
              <FileText size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Drug Trade License
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{licenseNumber}</strong>
              </div>
            </div>

            {/* Phone & Email */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
              <Phone size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Contact Information
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {phoneString || 'No phone'} {emailString ? `• ${emailString}` : ''}
                </span>
              </div>
            </div>

            {/* Address */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
              <MapPin size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Physical Address
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{addressString}</span>
              </div>
            </div>

            {/* Operating Hours */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', gridColumn: '1 / -1', minWidth: 0 }}>
              <Clock size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Operating Hours Summary
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{openingHoursString}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <DeleteApplicationModal
        isOpen={showDeleteModal}
        pharmacyName={pharmacyName}
        isDeleting={isDeleting}
        error={deleteError}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteApplication}
        titleId="dashboard-delete-modal-title"
      />
    </div>
  );
};
