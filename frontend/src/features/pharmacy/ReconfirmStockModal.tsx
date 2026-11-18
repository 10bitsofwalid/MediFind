// src/features/pharmacy/ReconfirmStockModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type { StockInventoryRecord } from '../../types/medicine';
import {
  STOCK_STATUS_LABELS,
  formatExactTimestamp,
  formatTimeAgo,
  isStockRecordStale,
  validateOptionalQuantityInput,
} from './inventoryUtils';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldAlert,
  HelpCircle,
  FileCheck2,
} from 'lucide-react';

interface ReconfirmStockModalProps {
  isOpen: boolean;
  item: StockInventoryRecord | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (
    stockId: string,
    status: StockStatus,
    quantity?: number | null,
    notes?: string
  ) => Promise<void>;
}

const RECONFIRM_OPTIONS: {
  value: 'available' | 'low' | 'out';
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  color: string;
  bg: string;
}[] = [
  {
    value: 'available',
    label: 'Available',
    description: 'Medicine is physically in stock and ready for patient dispensing.',
    icon: CheckCircle2,
    color: 'var(--color-status-available)',
    bg: 'var(--color-status-available-bg)',
  },
  {
    value: 'low',
    label: 'Low Stock',
    description: 'Limited units remaining on shelf; patient should confirm before travelling.',
    icon: AlertTriangle,
    color: 'var(--color-status-caution)',
    bg: 'var(--color-status-caution-bg)',
  },
  {
    value: 'out',
    label: 'Out of Stock',
    description: 'Medicine is currently depleted or unavailable on shelf.',
    icon: XCircle,
    color: 'var(--color-status-problem)',
    bg: 'var(--color-status-problem-bg)',
  },
];

export const ReconfirmStockModal: React.FC<ReconfirmStockModalProps> = ({
  isOpen,
  item,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<'available' | 'low' | 'out'>('available');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (item && isOpen) {
      if (item.status === 'low') setSelectedStatus('low');
      else if (item.status === 'out') setSelectedStatus('out');
      else setSelectedStatus('available');

      setQuantityInput(
        item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : ''
      );
      setQuantityError(null);
      setNotesInput('');
    }
  }, [item, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !item) return null;

  const isStale = isStockRecordStale(item);
  const isUnverified = item.status === 'unverified';
  const hasSpecificReason = Boolean(item.attentionReason || item.reconfirmationReason);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyResult = validateOptionalQuantityInput(quantityInput);
    if (!qtyResult.valid) {
      setQuantityError(qtyResult.error || 'Please enter a valid non-negative whole number.');
      return;
    }

    setQuantityError(null);
    await onConfirm(
      item.stockId,
      selectedStatus,
      qtyResult.value,
      notesInput.trim() ? notesInput.trim() : undefined
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconfirm-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(23, 43, 58, 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--color-border-default)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-action-subtle)',
                color: 'var(--color-action-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <FileCheck2 size={22} />
            </div>
            <div>
              <h2
                id="reconfirm-modal-title"
                style={{ fontSize: '19px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}
              >
                Physical Stock Reconfirmation
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Verify physical shelf availability before confirming report to patients
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close reconfirmation dialog"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-text-secondary)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* MODAL CONTENT BODY (SCROLLABLE) */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* MEDICINE IDENTITY & CURRENT CONTEXT BANNER */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {item.medicineName}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-action-primary)' }}>
                {item.strength}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                ({item.form})
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Generic: <em>{item.genericName}</em>
              {item.manufacturer && ` • ${item.manufacturer}`}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                Current Status: <strong>{STOCK_STATUS_LABELS[item.status]}</strong>
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                <Clock size={13} aria-hidden="true" />
                <span>Last updated: {formatExactTimestamp(item.updatedAt)} ({formatTimeAgo(item.updatedAt)})</span>
              </span>
            </div>
          </div>

          {/* ATTENTION REASON CALLOUT */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isUnverified ? 'var(--color-status-problem-bg)' : 'var(--color-status-caution-bg)',
              border: isUnverified ? '1px solid rgba(180, 35, 47, 0.3)' : '1px solid rgba(152, 88, 0, 0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <ShieldAlert
              size={18}
              color={isUnverified ? 'var(--color-status-problem)' : 'var(--color-status-caution)'}
              style={{ flexShrink: 0, marginTop: '2px' }}
              aria-hidden="true"
            />
            <div style={{ fontSize: '13px', lineHeight: 1.45 }}>
              <strong
                style={{
                  display: 'block',
                  color: isUnverified ? 'var(--color-status-problem)' : 'var(--color-status-caution)',
                  marginBottom: '2px',
                }}
              >
                {isUnverified
                  ? 'Attention: Unverified Report'
                  : isStale
                  ? 'Attention: Stale Availability Report'
                  : 'Attention: Reconfirmation Required'}
              </strong>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {hasSpecificReason
                  ? item.attentionReason || item.reconfirmationReason
                  : isUnverified
                  ? 'Report flagged Unverified following patient feedback or administrative review. Physical stock check is required before resuming public availability.'
                  : isStale
                  ? 'This listing was last reported more than 24 hours ago. Please inspect your shelf to ensure patients receive accurate availability information.'
                  : 'Administrative compliance check requires physical reconfirmation of this record.'}
              </span>
            </div>
          </div>

          {/* SERVER REJECTION ERROR ALERT (IF APPLICABLE) */}
          {error && (
            <div
              role="alert"
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-status-problem-bg)',
                border: '1px solid rgba(180, 35, 47, 0.3)',
                color: 'var(--color-status-problem)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* STATUS SELECTION CONTROL */}
          <div>
            <label
              id="reconfirm-status-label"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: '8px',
              }}
            >
              Verified Physical Shelf Status <span style={{ color: 'var(--color-status-problem)' }}>*</span>
            </label>

            <div
              role="radiogroup"
              aria-labelledby="reconfirm-status-label"
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {RECONFIRM_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedStatus === opt.value;

                return (
                  <div
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => !isSubmitting && setSelectedStatus(opt.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isSubmitting) {
                        e.preventDefault();
                        setSelectedStatus(opt.value);
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-lg)',
                      border: isSelected ? `2px solid ${opt.color}` : '1px solid var(--color-border-default)',
                      backgroundColor: isSelected ? opt.bg : 'var(--color-surface-panel)',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    }}
                  >
                    <div style={{ marginTop: '2px', color: opt.color }} aria-hidden="true">
                      <Icon size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: isSelected ? opt.color : 'var(--color-text-primary)' }}>
                          {opt.label}
                        </strong>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: opt.color,
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: '#ffffff',
                              border: `1px solid ${opt.color}`,
                            }}
                          >
                            Selected
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '2px' }}>
                        {opt.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OPTIONAL QUANTITY INPUT */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                htmlFor="reconfirm-quantity-input"
                style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}
              >
                Verified Quantity <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>(Optional)</span>
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Non-negative whole number
              </span>
            </div>

            <input
              id="reconfirm-quantity-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={quantityInput}
              onChange={(e) => {
                setQuantityInput(e.target.value);
                if (quantityError) setQuantityError(null);
              }}
              disabled={isSubmitting}
              placeholder="e.g., 20 (leave blank if not tracking exact count)"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: quantityError ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                fontSize: '14px',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
              }}
              aria-invalid={Boolean(quantityError)}
              aria-describedby={quantityError ? 'reconfirm-quantity-error' : undefined}
            />

            {quantityError && (
              <span
                id="reconfirm-quantity-error"
                role="alert"
                style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'block' }}
              >
                {quantityError}
              </span>
            )}
          </div>

          {/* OPTIONAL SHELF NOTES */}
          <div>
            <label
              htmlFor="reconfirm-notes-input"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
            >
              Shelf Verification Notes <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>(Optional)</span>
            </label>
            <input
              id="reconfirm-notes-input"
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              disabled={isSubmitting}
              maxLength={120}
              placeholder="e.g., Verified on shelf 3B, unexpired batch"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                fontSize: '13px',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {/* HEALTHCARE ACCURACY DECLARATION */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <HelpCircle size={15} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>
              Reconfirming clears any unverified or stale flags and records a fresh server-verified timestamp. Changes are not final until confirmed by the server.
            </span>
          </div>

          {/* ACTION BUTTONS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-border-default)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
              style={{
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-secondary)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              ref={initialFocusRef}
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.75 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small" aria-hidden="true" />
                  <span>Confirming with Server...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Confirm &amp; Update Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
