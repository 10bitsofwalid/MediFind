// frontend/src/features/customer/components/ReportDiscrepancyModal.tsx
import React, { useState } from 'react';
import { reportService, type AvailabilityReportPayload } from '../services/reportService';
import { AlertTriangle, CheckCircle2, X, Send, Loader } from 'lucide-react';
import type { NearbyPharmacyResult } from '../types';

interface ReportDiscrepancyModalProps {
  pharmacy: NearbyPharmacyResult;
  medicineName: string;
  medicineId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReportDiscrepancyModal: React.FC<ReportDiscrepancyModalProps> = ({
  pharmacy,
  medicineName,
  medicineId = 'unknown',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [issueType, setIssueType] = useState<AvailabilityReportPayload['issueType']>('out_of_stock');
  const [observedStatus, setObservedStatus] = useState<'out' | 'low' | 'available'>('out');
  const [notes, setNotes] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await reportService.submitReport({
        pharmacyId: pharmacy.pharmacyId,
        pharmacyName: pharmacy.pharmacyName,
        medicineId,
        medicineName,
        issueType,
        reportedStatus: observedStatus,
        notes: notes.trim() || undefined,
        reporterEmail: reporterEmail.trim() || undefined,
      });

      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setErrorMessage(null);
    setNotes('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
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
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleResetAndClose}
          aria-label="Close report modal"
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

        {isSuccess ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              textAlign: 'center',
              padding: '20px 0',
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
              id="report-modal-title"
              style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}
            >
              Discrepancy Reported
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Thank you for helping keep MediFind accurate for Dhaka patients! Our team and the pharmacy will be notified to review this listing.
            </p>
            <button
              type="button"
              onClick={handleResetAndClose}
              className="btn-primary"
              style={{
                marginTop: '12px',
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
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(217, 56, 58, 0.1)',
                  color: 'var(--color-status-problem)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <AlertTriangle size={18} aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="report-modal-title"
                  style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}
                >
                  Report Availability Discrepancy
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {pharmacy.pharmacyName} • <em>{medicineName}</em>
                </p>
              </div>
            </div>

            {/* Error banner if submit fails */}
            {errorMessage && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(217, 56, 58, 0.08)',
                  border: '1px solid var(--color-status-problem)',
                  fontSize: '12px',
                  color: 'var(--color-status-problem)',
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Discrepancy type radio group */}
            <div>
              <label
                id="issue-type-label"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '8px',
                }}
              >
                What discrepancy did you find?
              </label>
              <div
                role="radiogroup"
                aria-labelledby="issue-type-label"
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                {[
                  { value: 'out_of_stock', label: 'Medicine is out of stock (listed as available)' },
                  { value: 'incorrect_quantity', label: 'Stock quantity is much lower than listed' },
                  { value: 'closed_unannounced', label: 'Pharmacy was closed during listed open hours' },
                  { value: 'wrong_price', label: 'Price discrepancy or unexpected condition' },
                  { value: 'other', label: 'Other discrepancy' },
                ].map((item) => (
                  <label
                    key={item.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: issueType === item.value ? 'rgba(23, 107, 135, 0.06)' : 'var(--color-surface-canvas)',
                      border: `1px solid ${issueType === item.value ? 'var(--color-action-primary)' : 'var(--color-border-default)'}`,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="issueType"
                      value={item.value}
                      checked={issueType === item.value}
                      onChange={() => setIssueType(item.value as AvailabilityReportPayload['issueType'])}
                      style={{ margin: 0 }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actual Observed Status */}
            <div>
              <label
                htmlFor="observed-status-select"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Actual stock observed at the pharmacy:
              </label>
              <select
                id="observed-status-select"
                value={observedStatus}
                onChange={(e) => setObservedStatus(e.target.value as 'out' | 'low' | 'available')}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="out">Completely out of stock</option>
                <option value="low">Very limited quantity remaining</option>
                <option value="available">In stock (different strength or packaging)</option>
              </select>
            </div>

            {/* Additional details */}
            <div>
              <label
                htmlFor="report-notes"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Additional details (optional):
              </label>
              <textarea
                id="report-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Pharmacist told me they ran out an hour ago..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  fontSize: '12px',
                  color: 'var(--color-text-primary)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Optional contact email */}
            <div>
              <label
                htmlFor="report-email"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Your email (optional, for follow-up verification):
              </label>
              <input
                id="report-email"
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="name@example.com"
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

            {/* Actions */}
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
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} aria-hidden="true" />
                    <span>Submit Report</span>
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
