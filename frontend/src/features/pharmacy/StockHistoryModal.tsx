// src/features/pharmacy/StockHistoryModal.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { StockHistoryRecord, StockInventoryRecord } from '../../types/medicine';
import { stockService, StockServiceError } from '../../services/stockService';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import {
  formatExactTimestamp,
  formatTimeAgo,
  getZeroQuantityFeedback,
  isStockRecordStale,
} from './inventoryUtils';
import {
  X,
  History,
  Lock,
  ArrowRight,
  User,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface StockHistoryModalProps {
  pharmacyId: string;
  item: StockInventoryRecord;
  onClose: () => void;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
  pharmacyId,
  item,
  onClose,
}) => {
  const [entries, setEntries] = useState<StockHistoryRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotExposed, setIsNotExposed] = useState<boolean>(false);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const loadHistory = useCallback(
    async (cursor?: string | null) => {
      const appending = Boolean(cursor);
      if (appending) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);
      setIsNotExposed(false);

      try {
        const res = await stockService.getStockHistory(pharmacyId, item.stockId, {
          limit: 20,
          cursor: cursor || undefined,
        });
        setEntries((prev) => (appending ? [...prev, ...res.data] : res.data));
        setNextCursor(res.page?.nextCursor ?? null);
      } catch (err: unknown) {
        if (err instanceof StockServiceError && (err.status === 404 || err.status === 501)) {
          setIsNotExposed(true);
          setErrorMessage(
            'Stock update history is not currently exposed by the server for this item.'
          );
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to load stock update history.'
          );
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pharmacyId, item.stockId]
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;

    stockService
      .getStockHistory(pharmacyId, item.stockId, { limit: 20 })
      .then((res) => {
        if (!active) return;
        setEntries(res.data);
        setNextCursor(res.page?.nextCursor ?? null);
        setErrorMessage(null);
        setIsNotExposed(false);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof StockServiceError && (err.status === 404 || err.status === 501)) {
          setIsNotExposed(true);
          setErrorMessage(
            'Stock update history is not currently exposed by the server for this item.'
          );
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to load stock update history.'
          );
        }
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pharmacyId, item.stockId]);

  const stale = isStockRecordStale(item);
  const zeroQty = getZeroQuantityFeedback(item.status, item.quantity);

  const formatQtyValue = (qty?: number | null): string | null => {
    if (qty === null || qty === undefined) return null;
    return `${qty} ${qty === 1 ? 'unit' : 'units'}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-history-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23, 43, 58, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 270,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--color-border-default)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <History size={20} color="var(--color-action-primary)" aria-hidden="true" />
              <h2
                id="stock-history-modal-title"
                style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}
              >
                Stock Update History
              </h2>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {item.medicineName}{' '}
              <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                ({item.strength} • {item.form})
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Generic: {item.genericName}
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close stock history"
            style={{
              width: '44px',
              height: '44px',
              flexShrink: 0,
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-canvas)',
              color: 'var(--color-text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Current Reported State Summary */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Current Reported State
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <AvailabilityStatus status={item.status} quantity={item.quantity} size="sm" />
            <FreshnessBadge updatedAt={item.updatedAt} isStale={stale} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Updated {formatExactTimestamp(item.updatedAt)}
            </span>
          </div>
          {zeroQty && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {zeroQty.explanation}
            </div>
          )}
        </div>

        {/* Read-Only Audit Trail Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-neutral-bg)',
            border: '1px solid var(--color-border-default)',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Lock size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            Read-only audit trail — update records are append-only and cannot be edited or deleted.
          </span>
        </div>

        {/* History Timeline Region */}
        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            minHeight: '140px',
            paddingRight: '2px',
          }}
        >
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 16px',
                gap: '10px',
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
              }}
            >
              <div className="spinner" aria-hidden="true" />
              <span>Loading stock history...</span>
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              style={{
                padding: '18px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isNotExposed
                  ? 'var(--color-status-neutral-bg)'
                  : 'var(--color-status-problem-bg)',
                border: isNotExposed
                  ? '1px solid var(--color-border-default)'
                  : '1px solid rgba(180, 35, 47, 0.3)',
                color: isNotExposed
                  ? 'var(--color-text-primary)'
                  : 'var(--color-status-problem)',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => loadHistory()}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  minHeight: '38px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border-default)',
                backgroundColor: '#f8fafc',
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
              }}
            >
              No stock update history has been recorded for this item yet.
            </div>
          ) : (
            <ol
              aria-label="Chronological stock update history"
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {entries.map((entry) => {
                const oldQtyText = formatQtyValue(entry.oldQuantity);
                const newQtyText = formatQtyValue(entry.newQuantity);
                const hasQuantityDetails = oldQtyText !== null || newQtyText !== null;
                const updaterLabel =
                  entry.changedByName || entry.changedBy || 'Updater not provided';

                return (
                  <li
                    key={entry.historyId}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Status transition */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {entry.oldStatus ? (
                        <AvailabilityStatus status={entry.oldStatus} size="sm" />
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--color-status-neutral-bg)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border-default)',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Initial listing
                        </span>
                      )}

                      <ArrowRight
                        size={14}
                        color="var(--color-text-secondary)"
                        aria-hidden="true"
                      />

                      <AvailabilityStatus status={entry.newStatus} size="sm" />
                    </div>

                    {/* Quantity transition (when returned by service) */}
                    {hasQuantityDetails && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                        <strong>Quantity:</strong>{' '}
                        {oldQtyText !== null ? oldQtyText : 'Not specified'}{' '}
                        <span aria-hidden="true">→</span>{' '}
                        {newQtyText !== null ? newQtyText : 'Cleared'}
                      </div>
                    )}

                    {/* Updater & Timestamp */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <User size={13} aria-hidden="true" />
                        <span>Updated by: {updaterLabel}</span>
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={13} aria-hidden="true" />
                        <span>
                          {formatExactTimestamp(entry.changedAt)} ({formatTimeAgo(entry.changedAt)})
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {nextCursor && !isLoading && !errorMessage && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => loadHistory(nextCursor)}
                disabled={isLoadingMore}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  minHeight: '42px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-action-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoadingMore && <span className="spinner-small" aria-hidden="true" />}
                <span>{isLoadingMore ? 'Loading...' : 'Load Older Updates'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '8px',
            borderTop: '1px solid var(--color-border-default)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{
              padding: '9px 18px',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

