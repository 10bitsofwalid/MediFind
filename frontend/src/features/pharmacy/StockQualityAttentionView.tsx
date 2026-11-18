// src/features/pharmacy/StockQualityAttentionView.tsx
import React, { useState, useMemo } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type { StockInventoryRecord } from '../../types/medicine';
import { stockService } from '../../services/stockService';
import {
  STOCK_STATUS_LABELS,
  evaluateStockAttention,
  filterAttentionInventory,
  formatExactTimestamp,
  formatTimeAgo,
  type AttentionFilterType,
} from './inventoryUtils';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { ReconfirmStockModal } from './ReconfirmStockModal';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileCheck2,
  Check,
  HelpCircle,
  SlidersHorizontal,
} from 'lucide-react';

interface StockQualityAttentionViewProps {
  pharmacyId: string;
  pharmacyName?: string;
  inventory: StockInventoryRecord[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onItemReconfirmed?: (updated: StockInventoryRecord) => void;
  isVerified?: boolean;
}

export const StockQualityAttentionView: React.FC<StockQualityAttentionViewProps> = ({
  pharmacyId,
  inventory,
  isLoading,
  error,
  onRefresh,
  onItemReconfirmed,
  isVerified = true,
}) => {
  const [filterType, setFilterType] = useState<AttentionFilterType>('all');
  const [reconfirmItem, setReconfirmItem] = useState<StockInventoryRecord | null>(null);
  const [isReconfirming, setIsReconfirming] = useState<boolean>(false);
  const [reconfirmError, setReconfirmError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    medicineName: string;
    status: StockStatus;
    updatedAt: string;
  } | null>(null);

  // Group attention records
  const attentionItems = useMemo(() => {
    return filterAttentionInventory(inventory, filterType);
  }, [inventory, filterType]);

  const allAttentionCount = useMemo(() => {
    return filterAttentionInventory(inventory, 'all').length;
  }, [inventory]);

  const staleCount = useMemo(() => {
    return filterAttentionInventory(inventory, 'stale').length;
  }, [inventory]);

  const unverifiedCount = useMemo(() => {
    return filterAttentionInventory(inventory, 'unverified').length;
  }, [inventory]);

  const reconfirmReqCount = useMemo(() => {
    return filterAttentionInventory(inventory, 'reconfirmation').length;
  }, [inventory]);

  const handleOpenReconfirm = (item: StockInventoryRecord) => {
    setReconfirmError(null);
    setReconfirmItem(item);
  };

  const handleCloseReconfirm = () => {
    if (!isReconfirming) {
      setReconfirmItem(null);
      setReconfirmError(null);
    }
  };

  const handleConfirmStock = async (
    stockId: string,
    status: StockStatus,
    quantity?: number | null,
    notes?: string
  ) => {
    setIsReconfirming(true);
    setReconfirmError(null);
    try {
      const serverResult = await stockService.reconfirmStockItem(pharmacyId, stockId, {
        status,
        quantity,
        notes,
      });

      // Construct verified record only after server confirmation
      const targetItem = inventory.find((i) => i.stockId === stockId);
      if (targetItem) {
        const updatedRecord: StockInventoryRecord = {
          ...targetItem,
          status: serverResult.status,
          quantity: serverResult.quantity !== undefined ? serverResult.quantity : targetItem.quantity,
          updatedAt: serverResult.updatedAt,
          isStale: false,
          freshness: 'fresh',
          reconfirmationRequired: false,
          attentionReason: undefined,
          reconfirmationReason: undefined,
        };

        if (onItemReconfirmed) {
          onItemReconfirmed(updatedRecord);
        }

        setSuccessBanner({
          medicineName: targetItem.medicineName,
          status: serverResult.status,
          updatedAt: serverResult.updatedAt,
        });

        setTimeout(() => {
          setSuccessBanner((prev) => (prev?.medicineName === targetItem.medicineName ? null : prev));
        }, 5000);
      }

      setReconfirmItem(null);
    } catch (err: unknown) {
      setReconfirmError(
        err instanceof Error ? err.message : 'Failed to reconfirm stock on the server. Please try again.'
      );
    } finally {
      setIsReconfirming(false);
    }
  };

  return (
    <section
      id="stock-quality-attention-section"
      className="card"
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '28px',
      }}
      aria-labelledby="attention-section-heading"
    >
      {/* SECTION HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h2
              id="attention-section-heading"
              style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}
            >
              Stock Quality &amp; Verification Attention
            </h2>
            {allAttentionCount > 0 ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-status-problem-bg)',
                  color: 'var(--color-status-problem)',
                  border: '1px solid rgba(180, 35, 47, 0.3)',
                }}
              >
                <ShieldAlert size={12} aria-hidden="true" />
                <span>{allAttentionCount} {allAttentionCount === 1 ? 'Record' : 'Records'} Require Attention</span>
              </span>
            ) : !isLoading && inventory.length > 0 ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-status-available-bg)',
                  color: 'var(--color-status-available)',
                  border: '1px solid rgba(24, 115, 75, 0.3)',
                }}
              >
                <CheckCircle2 size={12} aria-hidden="true" />
                <span>All Stock Up to Date</span>
              </span>
            ) : null}
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Inventory records that require owner shelf inspection, reconfirmation, or freshness renewal to preserve patient discovery trust.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            padding: '7px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-panel)',
            color: 'var(--color-text-secondary)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          aria-label="Refresh stock quality queue"
        >
          <RefreshCw
            size={13}
            aria-hidden="true"
            style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }}
          />
          <span>{isLoading ? 'Checking...' : 'Refresh Queue'}</span>
        </button>
      </div>

      {/* RECONFIRMATION SUCCESS TOAST / BANNER */}
      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid rgba(24, 115, 75, 0.35)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-available)',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} aria-hidden="true" />
            <span>
              Stock for <strong>{successBanner.medicineName}</strong> successfully reconfirmed as{' '}
              <strong>{STOCK_STATUS_LABELS[successBanner.status]}</strong> with a fresh server timestamp.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="Dismiss reconfirmation notice"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-status-available)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px 6px',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* FILTER TABS */}
      {inventory.length > 0 && allAttentionCount > 0 && (
        <div
          role="tablist"
          aria-label="Filter quality attention items"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterType === 'all'}
            onClick={() => setFilterType('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: filterType === 'all' ? 700 : 500,
              backgroundColor: filterType === 'all' ? 'var(--color-action-primary)' : 'var(--color-surface-canvas)',
              color: filterType === 'all' ? '#ffffff' : 'var(--color-text-secondary)',
              border: filterType === 'all' ? '1px solid var(--color-action-primary)' : '1px solid var(--color-border-default)',
              cursor: 'pointer',
            }}
          >
            <span>All Attention Items</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: filterType === 'all' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                color: filterType === 'all' ? '#ffffff' : 'var(--color-text-primary)',
              }}
            >
              {allAttentionCount}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filterType === 'stale'}
            onClick={() => setFilterType('stale')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: filterType === 'stale' ? 700 : 500,
              backgroundColor: filterType === 'stale' ? 'var(--color-status-caution)' : 'var(--color-surface-canvas)',
              color: filterType === 'stale' ? '#ffffff' : 'var(--color-text-secondary)',
              border: filterType === 'stale' ? '1px solid var(--color-status-caution)' : '1px solid var(--color-border-default)',
              cursor: 'pointer',
            }}
          >
            <span>Stale Stock (&ge;24h)</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: filterType === 'stale' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                color: filterType === 'stale' ? '#ffffff' : 'var(--color-text-primary)',
              }}
            >
              {staleCount}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filterType === 'unverified'}
            onClick={() => setFilterType('unverified')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: filterType === 'unverified' ? 700 : 500,
              backgroundColor: filterType === 'unverified' ? 'var(--color-status-problem)' : 'var(--color-surface-canvas)',
              color: filterType === 'unverified' ? '#ffffff' : 'var(--color-text-secondary)',
              border: filterType === 'unverified' ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
              cursor: 'pointer',
            }}
          >
            <span>Unverified Reports</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: filterType === 'unverified' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                color: filterType === 'unverified' ? '#ffffff' : 'var(--color-text-primary)',
              }}
            >
              {unverifiedCount}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filterType === 'reconfirmation'}
            onClick={() => setFilterType('reconfirmation')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: filterType === 'reconfirmation' ? 700 : 500,
              backgroundColor: filterType === 'reconfirmation' ? 'var(--color-action-primary)' : 'var(--color-surface-canvas)',
              color: filterType === 'reconfirmation' ? '#ffffff' : 'var(--color-text-secondary)',
              border: filterType === 'reconfirmation' ? '1px solid var(--color-action-primary)' : '1px solid var(--color-border-default)',
              cursor: 'pointer',
            }}
          >
            <span>Reconfirmation Required</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: filterType === 'reconfirmation' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                color: filterType === 'reconfirmation' ? '#ffffff' : 'var(--color-text-primary)',
              }}
            >
              {reconfirmReqCount}
            </span>
          </button>
        </div>
      )}

      {/* STATE 1: LOADING */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div className="spinner" aria-hidden="true" />
          <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Evaluating stock reports for data freshness and quality flags...
          </span>
        </div>
      )}

      {/* STATE 2: ERROR */}
      {!isLoading && error && (
        <div
          role="alert"
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertTriangle size={20} color="var(--color-status-problem)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--color-status-problem)', display: 'block', marginBottom: '4px' }}>
              Failed to evaluate stock attention items
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {error} Please check your connection or sign in again.
            </span>
          </div>
        </div>
      )}

      {/* STATE 3: ALL CLEAR (NO ATTENTION ITEMS, INVENTORY > 0) */}
      {!isLoading && !error && inventory.length > 0 && allAttentionCount === 0 && (
        <div
          style={{
            padding: '36px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-status-available-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(24, 115, 75, 0.25)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              color: 'var(--color-status-available)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-hidden="true"
          >
            <CheckCircle2 size={26} />
          </div>

          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-status-available)', margin: '0 0 6px' }}>
            All Stock Reports Are Up to Date
          </h3>

          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '520px', margin: '0 auto 12px', lineHeight: 1.5 }}>
            All <strong>{inventory.length}</strong> listed medicines have fresh reports updated within the last 24 hours with no unverified flags.
            Nearby patients searching on MediFind are receiving reliable availability guidance.
          </p>

          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <HelpCircle size={13} aria-hidden="true" />
            <span>Reports automatically flag stale after 24 hours to maintain healthcare data integrity.</span>
          </span>
        </div>
      )}

      {/* STATE 4: NO INVENTORY AT ALL */}
      {!isLoading && !error && inventory.length === 0 && (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-default)',
          }}
        >
          <SlidersHorizontal size={28} color="var(--color-text-secondary)" style={{ margin: '0 auto 10px' }} aria-hidden="true" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            No Medicines in Inventory
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            To begin tracking stock availability, data freshness, and quality attention items, add medicines from the curated catalogue.
          </p>
        </div>
      )}

      {/* STATE 5: ATTENTION ITEMS EXIST */}
      {!isLoading && !error && attentionItems.length > 0 && (
        <div className="attention-records-container">
          {/* DESKTOP TABLE VIEW */}
          <div className="attention-desktop-table-wrap">
            <table className="inventory-table" aria-label="Stock quality attention items table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '32%' }}>Medicine &amp; Details</th>
                  <th scope="col" style={{ width: '18%' }}>Current Status</th>
                  <th scope="col" style={{ width: '28%' }}>Reason for Attention</th>
                  <th scope="col" style={{ width: '12%' }}>Last Updated</th>
                  <th scope="col" style={{ width: '10%', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {attentionItems.map((item) => {
                  const attention = evaluateStockAttention(item);

                  return (
                    <tr key={item.stockId}>
                      {/* Medicine Info */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {item.medicineName}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {item.genericName} • {item.strength} ({item.form})
                          </span>
                          {item.manufacturer && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              {item.manufacturer}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Status */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <AvailabilityStatus status={item.status} size="sm" />
                          {item.quantity !== undefined && item.quantity !== null && (
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                              Quantity: {item.quantity} units
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Attention Reason */}
                      <td>
                        <div
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: attention.isUnverified
                              ? 'var(--color-status-problem-bg)'
                              : 'var(--color-status-caution-bg)',
                            border: attention.isUnverified
                              ? '1px solid rgba(180, 35, 47, 0.25)'
                              : '1px solid rgba(152, 88, 0, 0.25)',
                            fontSize: '12px',
                            lineHeight: 1.4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                            <ShieldAlert
                              size={13}
                              color={attention.isUnverified ? 'var(--color-status-problem)' : 'var(--color-status-caution)'}
                              aria-hidden="true"
                            />
                            <strong
                              style={{
                                color: attention.isUnverified ? 'var(--color-status-problem)' : 'var(--color-status-caution)',
                              }}
                            >
                              {attention.isUnverified
                                ? 'Unverified Report'
                                : attention.isStale
                                ? 'Stale Report (≥24h)'
                                : 'Reconfirmation Required'}
                            </strong>
                          </div>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            {attention.primaryReason}
                          </span>
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-status-caution)' }}>
                            {formatTimeAgo(item.updatedAt)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            {formatExactTimestamp(item.updatedAt)}
                          </span>
                        </div>
                      </td>

                      {/* Action: Reconfirm */}
                      <td style={{ textAlign: 'right' }}>
                        {isVerified ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReconfirm(item)}
                            className="btn-primary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '7px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-md)',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                            aria-label={`Reconfirm shelf stock for ${item.medicineName}`}
                          >
                            <FileCheck2 size={13} aria-hidden="true" />
                            <span>Reconfirm</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--color-text-secondary)',
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--color-surface-canvas)',
                              border: '1px solid var(--color-border-default)',
                            }}
                          >
                            Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW (NO HORIZONTAL OVERFLOW AT 360PX) */}
          <div className="attention-mobile-cards-wrap" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
            {attentionItems.map((item) => {
              const attention = evaluateStockAttention(item);

              return (
                <article
                  key={item.stockId}
                  className="card"
                  style={{
                    backgroundColor: 'var(--color-surface-panel)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                  aria-label={`Attention record: ${item.medicineName}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                        {item.medicineName}
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {item.genericName} • {item.strength}
                      </span>
                    </div>

                    <AvailabilityStatus status={item.status} size="sm" />
                  </div>

                  {/* Attention Reason Box */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: attention.isUnverified
                        ? 'var(--color-status-problem-bg)'
                        : 'var(--color-status-caution-bg)',
                      border: attention.isUnverified
                        ? '1px solid rgba(180, 35, 47, 0.25)'
                        : '1px solid rgba(152, 88, 0, 0.25)',
                      fontSize: '12px',
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                      <ShieldAlert
                        size={14}
                        color={attention.isUnverified ? 'var(--color-status-problem)' : 'var(--color-status-caution)'}
                        aria-hidden="true"
                      />
                      <strong
                        style={{
                          color: attention.isUnverified ? 'var(--color-status-problem)' : 'var(--color-status-caution)',
                        }}
                      >
                        {attention.isUnverified
                          ? 'Unverified Report'
                          : attention.isStale
                          ? 'Stale Report (≥24h)'
                          : 'Reconfirmation Required'}
                      </strong>
                    </div>
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {attention.primaryReason}
                    </span>
                  </div>

                  {/* Timestamp & Details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} aria-hidden="true" />
                      <span>Updated: {formatTimeAgo(item.updatedAt)}</span>
                    </span>

                    {item.quantity !== undefined && item.quantity !== null && (
                      <span>Qty: {item.quantity}</span>
                    )}
                  </div>

                  {/* Mobile Action Button */}
                  {isVerified ? (
                    <button
                      type="button"
                      onClick={() => handleOpenReconfirm(item)}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                      aria-label={`Reconfirm shelf stock for ${item.medicineName}`}
                    >
                      <FileCheck2 size={16} aria-hidden="true" />
                      <span>Reconfirm Shelf Stock</span>
                    </button>
                  ) : (
                    <span
                      style={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        padding: '10px',
                        backgroundColor: 'var(--color-surface-canvas)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      Stock updating locked until verified
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* RECONFIRM MODAL INSTANCE */}
      <ReconfirmStockModal
        isOpen={Boolean(reconfirmItem)}
        item={reconfirmItem}
        isSubmitting={isReconfirming}
        error={reconfirmError}
        onClose={handleCloseReconfirm}
        onConfirm={handleConfirmStock}
      />
    </section>
  );
};
