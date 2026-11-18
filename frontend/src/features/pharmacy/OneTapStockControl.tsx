// src/features/pharmacy/OneTapStockControl.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type { StockInventoryRecord } from '../../types/medicine';
import { stockService } from '../../services/stockService';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
<<<<<<< Updated upstream
=======
import { InventoryMedicineModal } from './InventoryMedicineModal';
import { StockHistoryModal } from './StockHistoryModal';
import { ReconfirmStockModal } from './ReconfirmStockModal';
import {
  STOCK_STATUS_LABELS,
  filterAndSortInventory,
  formatExactTimestamp,
  getZeroQuantityFeedback,
  isStockRecordStale,
  mergeServerStockRecord,
  summarizeInventory,
  validateOptionalQuantityInput,
} from './inventoryUtils';
>>>>>>> Stashed changes
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Pill,
<<<<<<< Updated upstream
=======
  Plus,
  Edit3,
  AlertCircle,
  X,
  Minus,
  Check,
  LayoutGrid,
  Table2,
  Clock,
  History,
  FileCheck2,
>>>>>>> Stashed changes
} from 'lucide-react';

interface OneTapStockControlProps {
  pharmacyId: string;
}

export const OneTapStockControl: React.FC<OneTapStockControlProps> = ({
  pharmacyId,
}) => {
  const [inventory, setInventory] = useState<StockInventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

<<<<<<< Updated upstream
  const fetchInventory = async () => {
=======
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    item: StockInventoryRecord | null;
  }>({ isOpen: false, mode: 'add', item: null });
  const [historyItem, setHistoryItem] = useState<StockInventoryRecord | null>(null);

  // Quality Attention Reconfirmation Modal state
  const [reconfirmModalItem, setReconfirmModalItem] = useState<StockInventoryRecord | null>(null);
  const [isReconfirming, setIsReconfirming] = useState<boolean>(false);
  const [reconfirmError, setReconfirmError] = useState<string | null>(null);

  const handleReconfirmStock = async (
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

      setInventory((prev) =>
        prev.map((item) => {
          if (item.stockId !== stockId) return item;
          return {
            ...item,
            status: serverResult.status,
            quantity: serverResult.quantity !== undefined ? serverResult.quantity : item.quantity,
            updatedAt: serverResult.updatedAt,
            isStale: false,
            freshness: 'fresh',
            reconfirmationRequired: false,
            attentionReason: undefined,
            reconfirmationReason: undefined,
          };
        })
      );

      const statusLabel = STOCK_STATUS_LABELS[serverResult.status];
      setSuccessMessage(`Stock for ${reconfirmModalItem?.medicineName || 'medicine'} physically reconfirmed as ${statusLabel}.`);
      setLastSavedFeedback({
        stockId,
        status: serverResult.status,
        updatedAt: serverResult.updatedAt,
        message: `Physically reconfirmed as ${statusLabel} at ${formatExactTimestamp(serverResult.updatedAt)}`,
      });

      setReconfirmModalItem(null);
      window.dispatchEvent(new CustomEvent('medifind:stock-updated'));
    } catch (err: unknown) {
      setReconfirmError(
        err instanceof Error ? err.message : 'Failed to reconfirm stock on the server.'
      );
    } finally {
      setIsReconfirming(false);
    }
  };

  const fetchInventory = useCallback(async () => {
>>>>>>> Stashed changes
    setIsLoading(true);
    try {
      const items = await stockService.getInventory(pharmacyId);
      setInventory(items);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    stockService
      .getInventory(pharmacyId)
      .then((items) => {
        if (isMounted) {
          setInventory(items);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pharmacyId]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (item) =>
        item.medicineName.toLowerCase().includes(q) ||
        item.genericName.toLowerCase().includes(q) ||
        item.strength.toLowerCase().includes(q)
    );
  }, [inventory, searchQuery]);

  const handleOneTapUpdate = async (item: StockInventoryRecord, newStatus: StockStatus) => {
    if (item.status === newStatus && !item.isStale) return;

    setUpdatingStockId(item.stockId);
    setLastSavedMessage(null);

    try {
      const updated = await stockService.updateStockStatus(
        pharmacyId,
        item.stockId,
        newStatus,
        item.quantity
      );
      setInventory((prev) =>
        prev.map((i) => (i.stockId === updated.stockId ? updated : i))
      );
      setLastSavedMessage(`Updated ${updated.medicineName} to ${newStatus.toUpperCase()}`);
    } catch {
      setLastSavedMessage(`Failed to update status for ${item.medicineName}.`);
    } finally {
      setUpdatingStockId(null);
    }
  };

<<<<<<< Updated upstream
=======
  const handleSaveAddModal = async (payload: AddInventoryMedicinePayload) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    const created = await stockService.addInventoryItem(pharmacyId, payload);
    setInventory((prev) => [created, ...prev]);
    const zeroFeedback = getZeroQuantityFeedback(
      created.status,
      created.quantity,
      payload.status
    );
    const statusLabel = STOCK_STATUS_LABELS[created.status];
    setSuccessMessage(
      zeroFeedback
        ? `Added ${created.medicineName} (${created.strength}) as ${statusLabel} — ${zeroFeedback.explanation} • Updated ${formatExactTimestamp(created.updatedAt)}`
        : `Added ${created.medicineName} (${created.strength}) as ${statusLabel} • Updated ${formatExactTimestamp(created.updatedAt)}`
    );
    setLastSavedFeedback({
      stockId: created.stockId,
      status: created.status,
      updatedAt: created.updatedAt,
      message: zeroFeedback
        ? `Added as ${statusLabel} • ${zeroFeedback.explanation}`
        : `Added at ${formatExactTimestamp(created.updatedAt)}`,
    });
  };

  const handleSaveEditModal = async (
    stockId: string,
    payload: UpdateInventoryMedicinePayload
  ) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    const existing = inventory.find((i) => i.stockId === stockId);
    const serverUpdate = await stockService.updateInventoryItem(pharmacyId, stockId, payload);
    const merged = existing
      ? mergeServerStockRecord(existing, serverUpdate)
      : (serverUpdate as StockInventoryRecord);
    setInventory((prev) => prev.map((i) => (i.stockId === merged.stockId ? merged : i)));
    handleResetQuantityDraft(stockId);
    if (rowErrorFeedback?.stockId === stockId) {
      setRowErrorFeedback(null);
    }

    const statusLabel = STOCK_STATUS_LABELS[merged.status];
    const zeroFeedback = getZeroQuantityFeedback(
      merged.status,
      merged.quantity,
      payload.status
    );
    setSuccessMessage(
      zeroFeedback
        ? `Updated ${merged.medicineName} (${statusLabel}) — ${zeroFeedback.explanation} • Updated ${formatExactTimestamp(merged.updatedAt)}`
        : `Updated ${merged.medicineName} (${statusLabel}) • Updated ${formatExactTimestamp(merged.updatedAt)}`
    );
    setLastSavedFeedback({
      stockId: merged.stockId,
      status: merged.status,
      updatedAt: merged.updatedAt,
      message: zeroFeedback
        ? `Saved as ${statusLabel} • ${zeroFeedback.explanation}`
        : `Updated at ${formatExactTimestamp(merged.updatedAt)}`,
    });
  };

  const renderQuantityControl = (item: StockInventoryRecord, compact = false) => {
    const isUpdating = updatingStockId === item.stockId;
    const rawVal = getQuantityInputValue(item);
    const errorText = quantityErrors[item.stockId];
    const dirty = hasUnsavedQuantity(item);
    const inputId = `qty-${compact ? 'card' : 'table'}-${item.stockId}`;
    const errorId = `${inputId}-err`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
          <label
            htmlFor={inputId}
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
            }}
          >
            Optional stock quantity for {item.medicineName}
          </label>

          <button
            type="button"
            className="inventory-stepper-btn"
            onClick={() => handleStepQuantity(item, -1)}
            disabled={isUpdating || rawVal === '0'}
            aria-label={`Decrease quantity for ${item.medicineName}`}
          >
            <Minus size={14} aria-hidden="true" />
          </button>

          <input
            id={inputId}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={rawVal}
            onChange={(e) => handleQuantityChange(item.stockId, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty && !errorText && !isUpdating) {
                e.preventDefault();
                handleSaveQuantityOnly(item);
              }
            }}
            placeholder="Optional"
            disabled={isUpdating}
            aria-invalid={Boolean(errorText)}
            aria-describedby={errorText ? errorId : undefined}
            style={{
              width: compact ? '84px' : '64px',
              minHeight: '36px',
              padding: '5px 8px',
              borderRadius: 'var(--radius-md)',
              border: errorText
                ? '1px solid var(--color-status-problem)'
                : dirty
                ? '1px solid var(--color-action-primary)'
                : '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
              textAlign: 'center',
            }}
          />

          <button
            type="button"
            className="inventory-stepper-btn"
            onClick={() => handleStepQuantity(item, 1)}
            disabled={isUpdating}
            aria-label={`Increase quantity for ${item.medicineName}`}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>

        {dirty && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={() => handleSaveQuantityOnly(item)}
              disabled={isUpdating || Boolean(errorText)}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                minHeight: '36px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                cursor: isUpdating || errorText ? 'not-allowed' : 'pointer',
                opacity: isUpdating || errorText ? 0.65 : 1,
              }}
            >
              {isUpdating && updatingAction === 'quantity' ? (
                <span className="spinner-small" aria-hidden="true" />
              ) : (
                <Check size={13} aria-hidden="true" />
              )}
              <span>{isUpdating && updatingAction === 'quantity' ? 'Saving' : 'Save Qty'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetQuantityDraft(item.stockId)}
              disabled={isUpdating}
              aria-label={`Discard unsaved quantity for ${item.medicineName}`}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 8px',
                minHeight: '36px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        )}

        {dirty && !errorText && (
          <span style={{ fontSize: '11px', color: 'var(--color-action-primary)', fontWeight: 500 }}>
            Unsaved draft — save quantity or choose a status
          </span>
        )}

        {errorText && (
          <span
            id={errorId}
            role="alert"
            style={{ fontSize: '11px', color: 'var(--color-status-problem)', fontWeight: 500 }}
          >
            {errorText}
          </span>
        )}
      </div>
    );
  };

  const renderItemStateNotices = (item: StockInventoryRecord) => {
    const isUpdating = updatingStockId === item.stockId;
    const stale = isStockRecordStale(item);
    const zeroFeedback = getZeroQuantityFeedback(item.status, item.quantity);
    const rowSaved = lastSavedFeedback?.stockId === item.stockId ? lastSavedFeedback : null;
    const rowError = rowErrorFeedback?.stockId === item.stockId ? rowErrorFeedback : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
        {isUpdating && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-action-primary)',
            }}
          >
            <span className="spinner-small" aria-hidden="true" />
            <span>Saving update to server...</span>
          </div>
        )}

        {!isUpdating && rowSaved && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-status-available)',
            }}
          >
            <CheckCircle2 size={12} aria-hidden="true" />
            <span>{rowSaved.message}</span>
          </div>
        )}

        {!isUpdating && rowError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-status-danger-border)',
              backgroundColor: 'var(--color-status-danger-bg)',
              color: 'var(--color-status-danger)',
              fontSize: '11px',
            }}
          >
            <span style={{ fontWeight: 600 }}>{rowError.message}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {rowError.isConflict ? (
                <button
                  type="button"
                  onClick={() => void fetchInventory()}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-action-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Refresh Inventory
                </button>
              ) : (
                rowError.retryAction && (
                  <button
                    type="button"
                    onClick={rowError.retryAction}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--color-action-primary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Retry Update
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setRowErrorFeedback(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--color-text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {item.status === 'unverified' && (
          <span style={{ fontSize: '11px', color: 'var(--color-status-caution)' }}>
            Flagged unverified — select a status to reconfirm.
          </span>
        )}

        {stale && item.status !== 'unverified' && (
          <span style={{ fontSize: '11px', color: 'var(--color-status-caution)' }}>
            Stale report — choose a status to reconfirm current stock.
          </span>
        )}

        {zeroFeedback && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {zeroFeedback.explanation}
          </span>
        )}
      </div>
    );
  };

  const renderStatusControls = (item: StockInventoryRecord) => {
    const isUpdating = updatingStockId === item.stockId;
    const stale = isStockRecordStale(item);
    const qtyDirty = hasUnsavedQuantity(item);

    return (
      <div
        role="group"
        aria-label={`Set availability status for ${item.medicineName}`}
        aria-busy={isUpdating}
        className="inventory-status-group"
      >
        {STATUS_CONTROLS.map((ctrl) => {
          const Icon = ctrl.icon;
          const isCurrent = item.status === ctrl.value;
          const isSavingThis = isUpdating && updatingAction === ctrl.value;

          return (
            <button
              key={ctrl.value}
              type="button"
              onClick={() => handleOneTapUpdate(item, ctrl.value)}
              disabled={isUpdating}
              aria-pressed={isCurrent}
              title={
                isCurrent && stale
                  ? `Reconfirm ${ctrl.label} status to refresh timestamp`
                  : isCurrent && !qtyDirty
                    ? `Current reported status: ${ctrl.label}`
                    : `Set status to ${ctrl.label}`
              }
              className="inventory-status-btn"
              style={{
                border: isCurrent
                  ? `2px solid ${ctrl.color}`
                  : '1px solid var(--color-border-default)',
                backgroundColor: isCurrent ? ctrl.bg : 'var(--color-surface-panel)',
                color: isCurrent ? ctrl.color : 'var(--color-text-secondary)',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                opacity: isUpdating && !isSavingThis ? 0.6 : 1,
              }}
            >
              {isSavingThis ? (
                <span className="spinner-small" aria-hidden="true" />
              ) : (
                <Icon size={14} aria-hidden={true} />
              )}
              <span>{isSavingThis ? 'Saving...' : ctrl.label}</span>
            </button>
          );
        })}

        {(item.status === 'unverified' || stale || item.reconfirmationRequired) && (
          <button
            type="button"
            onClick={() => {
              setReconfirmError(null);
              setReconfirmModalItem(item);
            }}
            disabled={isUpdating}
            className="inventory-status-btn"
            style={{
              borderRadius: 'var(--radius-md)',
              border:
                item.status === 'unverified'
                  ? '1px solid rgba(180, 35, 47, 0.45)'
                  : '1px solid rgba(152, 88, 0, 0.45)',
              backgroundColor:
                item.status === 'unverified'
                  ? 'var(--color-status-problem-bg)'
                  : 'var(--color-status-caution-bg)',
              color:
                item.status === 'unverified'
                  ? 'var(--color-status-problem)'
                  : 'var(--color-status-caution)',
              fontWeight: 700,
              cursor: isUpdating ? 'not-allowed' : 'pointer',
            }}
            aria-label={`Reconfirm physical shelf stock for ${item.medicineName}`}
          >
            <FileCheck2 size={13} aria-hidden="true" />
            <span>Reconfirm</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setModalState({ isOpen: true, mode: 'edit', item })}
          disabled={isUpdating}
          className="btn-secondary inventory-status-btn"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-panel)',
            color: 'var(--color-action-primary)',
            cursor: isUpdating ? 'not-allowed' : 'pointer',
          }}
          aria-label={`Edit details for ${item.medicineName}`}
        >
          <Edit3 size={13} aria-hidden="true" />
          <span>Edit</span>
        </button>

        <button
          type="button"
          onClick={() => setHistoryItem(item)}
          className="btn-secondary inventory-status-btn"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-panel)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
          aria-label={`View read-only stock history for ${item.medicineName}`}
        >
          <History size={13} aria-hidden="true" />
          <span>History</span>
        </button>
      </div>
    );
  };

>>>>>>> Stashed changes
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Notice & Disclaimer */}
      <DisclaimerBanner variant="inline" />

      {/* Search & Stats Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search
            size={16}
            color="var(--color-text-secondary)"
            style={{ position: 'absolute', left: '12px', top: '12px', pointerEvents: 'none' }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicine by trade or generic name..."
            aria-label="Search medicine catalogue inventory"
            style={{
              width: '100%',
              padding: '9px 14px 9px 36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              fontSize: '14px',
            }}
          />
        </div>

        <button
          type="button"
          onClick={fetchInventory}
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
          aria-label="Refresh medicine inventory"
        >
          <RefreshCw size={13} aria-hidden={true} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Confirmation feedback banner */}
      {lastSavedMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-available-bg)',
            color: 'var(--color-status-available)',
            border: '1px solid rgba(24, 115, 75, 0.25)',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>{lastSavedMessage}</span>
        </div>
      )}

      {/* Inventory Item Cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
          <span>Loading medicine inventory...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-canvas)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-default)',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
          }}
        >
          No medicines match your search.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredItems.map((item) => {
            const isUpdating = updatingStockId === item.stockId;

<<<<<<< Updated upstream
            return (
              <div
                key={item.stockId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Left: Medicine Info */}
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Pill size={16} color="var(--color-action-primary)" aria-hidden="true" />
                    <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                      {item.medicineName}
                    </strong>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-surface-canvas)',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border-default)',
                      }}
                    >
                      {item.strength} • {item.form}
=======
                      {/* Reported Status & Timestamp */}
                      <td style={{ minWidth: '205px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                          <AvailabilityStatus status={item.status} quantity={item.quantity} size="sm" />
                          <FreshnessBadge updatedAt={item.updatedAt} isStale={stale} />
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: 'var(--color-text-secondary)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Clock size={11} aria-hidden="true" />
                            <span>{formatExactTimestamp(item.updatedAt)}</span>
                          </div>
                          {renderItemStateNotices(item)}
                        </div>
                      </td>

                      {/* Optional Quantity Control */}
                      <td>
                        {renderQuantityControl(item, false)}
                      </td>

                      {/* Status Controls + Edit + History */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {renderStatusControls(item)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Card View */}
          <div className="inventory-cards-wrap">
            {filteredItems.map((item) => {
              const stale = isStockRecordStale(item);
              return (
                <article
                  key={item.stockId}
                  aria-label={`${item.medicineName} ${item.strength}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Medicine Info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <Pill size={16} color="var(--color-action-primary)" aria-hidden="true" />
                      <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                        {item.medicineName}
                      </strong>
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '1px 7px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#f8fafc',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border-default)',
                        }}
                      >
                        {item.strength} • {item.form}
                      </span>
                      {item.prescriptionRequired && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--color-status-caution-bg)',
                            color: 'var(--color-status-caution)',
                          }}
                        >
                          Rx Required
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      Generic: {item.genericName}
                      {item.manufacturer ? ` • ${item.manufacturer}` : ''}
                      {item.price !== undefined ? ` • Price: ${item.price.toFixed(2)}` : ''}
                    </div>

                    {item.notes && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Note: {item.notes}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <AvailabilityStatus status={item.status} quantity={item.quantity} size="sm" />
                      <FreshnessBadge updatedAt={item.updatedAt} isStale={stale} />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        Updated {formatExactTimestamp(item.updatedAt)}
                      </span>
                    </div>

                    <div style={{ marginTop: '6px' }}>{renderItemStateNotices(item)}</div>
                  </div>

                  {/* Optional Quantity */}
                  <div
                    style={{
                      paddingTop: '10px',
                      borderTop: '1px solid var(--color-border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Quantity (Optional)
>>>>>>> Stashed changes
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    Generic: {item.genericName}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <AvailabilityStatus status={item.status} quantity={item.quantity} size="sm" />
                    <FreshnessBadge updatedAt={item.updatedAt} isStale={item.isStale} />
                  </div>
                </div>

                {/* Right: One-Tap Fast Status Selection Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginRight: '4px' }}>
                    Set:
                  </span>

                  {/* Available Button */}
                  <button
                    type="button"
                    onClick={() => handleOneTapUpdate(item, 'available')}
                    disabled={isUpdating}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      border:
                        item.status === 'available'
                          ? '2px solid var(--color-status-available)'
                          : '1px solid var(--color-border-default)',
                      backgroundColor:
                        item.status === 'available' ? 'var(--color-status-available-bg)' : 'var(--color-surface-canvas)',
                      color:
                        item.status === 'available' ? 'var(--color-status-available)' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isUpdating ? 'not-allowed' : 'pointer',
                    }}
                    aria-pressed={item.status === 'available'}
                  >
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <span>Available</span>
                  </button>

                  {/* Low Stock Button */}
                  <button
                    type="button"
                    onClick={() => handleOneTapUpdate(item, 'low')}
                    disabled={isUpdating}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      border:
                        item.status === 'low'
                          ? '2px solid var(--color-status-caution)'
                          : '1px solid var(--color-border-default)',
                      backgroundColor:
                        item.status === 'low' ? 'var(--color-status-caution-bg)' : 'var(--color-surface-canvas)',
                      color: item.status === 'low' ? 'var(--color-status-caution)' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isUpdating ? 'not-allowed' : 'pointer',
                    }}
                    aria-pressed={item.status === 'low'}
                  >
                    <AlertTriangle size={13} aria-hidden="true" />
                    <span>Low</span>
                  </button>

                  {/* Out of Stock Button */}
                  <button
                    type="button"
                    onClick={() => handleOneTapUpdate(item, 'out')}
                    disabled={isUpdating}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      border:
                        item.status === 'out'
                          ? '2px solid var(--color-status-problem)'
                          : '1px solid var(--color-border-default)',
                      backgroundColor:
                        item.status === 'out' ? 'var(--color-status-problem-bg)' : 'var(--color-surface-canvas)',
                      color: item.status === 'out' ? 'var(--color-status-problem)' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isUpdating ? 'not-allowed' : 'pointer',
                    }}
                    aria-pressed={item.status === 'out'}
                  >
                    <XCircle size={13} aria-hidden="true" />
                    <span>Out</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reconfirmModalItem && (
        <ReconfirmStockModal
          isOpen={Boolean(reconfirmModalItem)}
          item={reconfirmModalItem}
          isSubmitting={isReconfirming}
          error={reconfirmError}
          onClose={() => {
            if (!isReconfirming) {
              setReconfirmModalItem(null);
              setReconfirmError(null);
            }
          }}
          onConfirm={handleReconfirmStock}
        />
      )}
    </div>
  );
};
