// src/features/admin/VerificationQueue.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService, type AdminPharmacyApplicationItem } from '../../services/adminService';
import type { VerificationStatus } from '../../types/pharmacy';
import {
  ChevronLeft,
  Search,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock3,
  RefreshCw,
  Building2,
  FileText,
  MapPin,
  AlertCircle,
} from 'lucide-react';

type StatusFilter = 'all' | VerificationStatus;

export const VerificationQueue: React.FC = () => {
  const [items, setItems] = useState<AdminPharmacyApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reason dialog state for reject / suspend actions
  const [reasonTarget, setReasonTarget] = useState<{
    item: AdminPharmacyApplicationItem;
    decision: 'rejected' | 'suspended';
  } | null>(null);
  const [reasonText, setReasonText] = useState<string>('');

  const loadApplications = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const list = await adminService.getPharmacyApplications();
      setItems(list);
    } catch {
      setActionError('Failed to load pharmacy verification queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    adminService
      .getPharmacyApplications()
      .then((list) => {
        if (isMounted) {
          setItems(list);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setActionError('Failed to load pharmacy verification queue.');
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(({ application }) => {
      if (statusFilter !== 'all' && application.status !== statusFilter) return false;
      if (!q) return true;
      return (
        application.data.name.toLowerCase().includes(q) ||
        application.data.licenseNo.toLowerCase().includes(q) ||
        application.data.ownerName.toLowerCase().includes(q) ||
        application.data.city.toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, searchQuery]);

  const handleDecision = async (
    item: AdminPharmacyApplicationItem,
    decision: VerificationStatus,
    reason?: string
  ) => {
    setProcessingId(item.application.applicationId);
    setActionError(null);
    setActionFeedback(null);

    try {
      const updated = await adminService.reviewPharmacyApplication(
        item.application.applicationId,
        decision,
        reason,
        item.storageKey
      );
      setItems((prev) =>
        prev.map((entry) =>
          entry.application.applicationId === updated.applicationId
            ? { ...entry, application: updated }
            : entry
        )
      );
      setActionFeedback(`Updated "${updated.data.name}" status to ${updated.status.toUpperCase()}.`);
      setReasonTarget(null);
      setReasonText('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to record verification decision.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '24px 16px 80px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link
          to="/admin/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: 'var(--color-action-primary)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Back to Admin Dashboard</span>
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            Pharmacy Verification Queue
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Inspect submitted business identity and drug trade license credentials before approving public visibility.
          </p>
        </div>

        <button
          type="button"
          onClick={loadApplications}
          disabled={isLoading}
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
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="tablist" aria-label="Filter by verification status">
          {(['all', 'pending', 'verified', 'rejected', 'suspended'] as StatusFilter[]).map((st) => {
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: active ? '1px solid var(--color-action-primary)' : '1px solid var(--color-border-default)',
                  backgroundColor: active ? 'var(--color-action-primary)' : 'var(--color-surface-panel)',
                  color: active ? '#ffffff' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {st}
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 260px', maxWidth: '360px' }}>
          <Search
            size={15}
            color="var(--color-text-secondary)"
            style={{ position: 'absolute', left: '12px', top: '12px', pointerEvents: 'none' }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by pharmacy name, license, city..."
            aria-label="Filter pharmacy applications"
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
            }}
          />
        </div>
      </div>

      {/* Feedback & Errors */}
      {actionError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {actionFeedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid rgba(24, 115, 75, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-available)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Queue List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
          <span>Loading verification queue...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px dashed var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Building2 size={32} style={{ margin: '0 auto 10px' }} aria-hidden="true" />
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            No Pharmacy Applications Found
          </h2>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {items.length === 0
              ? 'Submitted pharmacy onboarding applications will appear here for regulatory review.'
              : 'No applications match the selected status filter or search term.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredItems.map((item) => {
            const { application } = item;
            const d = application.data;
            const isBusy = processingId === application.applicationId;
            const status = application.status;

            return (
              <article
                key={application.applicationId}
                className="card"
                style={{
                  backgroundColor: 'var(--color-surface-panel)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                      {d.name}
                    </h2>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      Applicant: <strong>{d.ownerName}</strong> • Submitted{' '}
                      {new Date(application.submittedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase',
                      backgroundColor:
                        status === 'verified'
                          ? 'var(--color-status-available-bg)'
                          : status === 'pending'
                          ? 'var(--color-status-caution-bg)'
                          : 'var(--color-status-problem-bg)',
                      color:
                        status === 'verified'
                          ? 'var(--color-status-available)'
                          : status === 'pending'
                          ? 'var(--color-status-caution)'
                          : 'var(--color-status-problem)',
                    }}
                  >
                    {status === 'verified' && <CheckCircle2 size={13} aria-hidden="true" />}
                    {status === 'pending' && <Clock3 size={13} aria-hidden="true" />}
                    {status === 'rejected' && <XCircle size={13} aria-hidden="true" />}
                    {status === 'suspended' && <AlertOctagon size={13} aria-hidden="true" />}
                    <span>{status}</span>
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    padding: '12px 14px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <FileText size={15} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Drug License</div>
                      <code style={{ fontWeight: 600 }}>{d.licenseNo}</code>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.issuingAuthority}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={15} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Location</div>
                      <div>{d.formattedAddress}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Contact</div>
                    <div>{d.phone}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.email}</div>
                  </div>
                </div>

                {(application.decisionReason || application.verificationReason) && (
                  <div
                    style={{
                      fontSize: '13px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-status-problem-bg)',
                      color: 'var(--color-status-problem)',
                    }}
                  >
                    <strong>Recorded Reason:</strong> {application.decisionReason || application.verificationReason}
                  </div>
                )}

                {/* Decision Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
                  {status !== 'verified' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(item, 'verified')}
                      className="btn-primary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '13px',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <CheckCircle2 size={14} aria-hidden="true" />
                      <span>{status === 'suspended' ? 'Reactivate & Verify' : 'Approve & Verify'}</span>
                    </button>
                  )}

                  {status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setReasonTarget({ item, decision: 'rejected' });
                        setReasonText('');
                      }}
                      className="btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(180, 35, 47, 0.35)',
                        backgroundColor: 'var(--color-status-problem-bg)',
                        color: 'var(--color-status-problem)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <XCircle size={14} aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                  )}

                  {status === 'verified' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setReasonTarget({ item, decision: 'suspended' });
                        setReasonText('');
                      }}
                      className="btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(180, 35, 47, 0.35)',
                        backgroundColor: 'var(--color-status-problem-bg)',
                        color: 'var(--color-status-problem)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <AlertOctagon size={14} aria-hidden="true" />
                      <span>Suspend</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Reason Modal for Rejection / Suspension */}
      {reasonTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-reason-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 43, 58, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 250,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--color-surface-panel)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 id="decision-reason-title" style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>
              {reasonTarget.decision === 'rejected' ? 'Reject Pharmacy Application' : 'Suspend Pharmacy Account'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
              Provide an official reason for <strong>{reasonTarget.item.application.data.name}</strong>. This reason will
              be shown to the pharmacy owner.
            </p>

            <label
              htmlFor="admin-decision-reason"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}
            >
              Decision Reason *
            </label>
            <textarea
              id="admin-decision-reason"
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Enter reason for this decision..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                fontSize: '14px',
                marginBottom: '16px',
                resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setReasonTarget(null)}
                className="btn-secondary"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reasonText.trim() || processingId === reasonTarget.item.application.applicationId}
                onClick={() => handleDecision(reasonTarget.item, reasonTarget.decision, reasonText)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: 'var(--color-status-problem)',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: reasonText.trim() ? 'pointer' : 'not-allowed',
                  opacity: reasonText.trim() ? 1 : 0.6,
                }}
              >
                Confirm {reasonTarget.decision === 'rejected' ? 'Rejection' : 'Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

