// src/features/pharmacy/OneTapStockControl.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type {
  StockInventoryRecord,
  AddInventoryMedicinePayload,
  UpdateInventoryMedicinePayload,
  InventoryStatusFilter,
  InventoryFreshnessFilter,
  InventorySortOption,
} from '../../types/medicine';
import { stockService, StockServiceError } from '../../services/stockService';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { InventoryMedicineModal } from './InventoryMedicineModal';
import { StockHistoryModal } from './StockHistoryModal';
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
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Pill,
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
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

interface OneTapStockControlProps {
  pharmacyId: string;
  pharmacyName?: string;
  onInventoryChange?: (items: StockInventoryRecord[]) => void;
  externalRefreshNonce?: number;
}

const STATUS_CONTROLS: {
  value: 'available' | 'low' | 'out';
  label: string;
  color: string;
  bg: string;
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
}[] = [
  {
    value: 'available',
    label: 'Available',
    color: 'var(--color-status-available)',
    bg: 'var(--color-status-available-bg)',
    icon: CheckCircle2,
  },
  {
    value: 'low',
    label: 'Low',
    color: 'var(--color-status-caution)',
    bg: 'var(--color-status-caution-bg)',
    icon: AlertTriangle,
  },
  {
    value: 'out',
    label: 'Out of Stock',
    color: 'var(--color-status-problem)',
    bg: 'var(--color-status-problem-bg)',
    icon: XCircle,
  },
];

export const OneTapStockControl: React.FC<OneTapStockControlProps> = ({
  pharmacyId,
  pharmacyName,
  onInventoryChange,
  externalRefreshNonce = 0,
}) => {
  const [inventory, setInventory] = useState<StockInventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>('all');
  const [freshnessFilter, setFreshnessFilter] = useState<InventoryFreshnessFilter>('all');
  const [sortOption, setSortOption] = useState<InventorySortOption>('updated_desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<
    StockStatus | 'quantity' | 'reconfirm' | null
  >(null);
  const inFlightStockIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [lastSavedFeedback, setLastSavedFeedback] = useState<{
    stockId: string;
    status: StockStatus;
    updatedAt: string;
    message: string;
  } | null>(null);
  const [rowErrorFeedback, setRowErrorFeedback] = useState<{
    stockId: string;
    message: string;
    isConflict?: boolean;
    retryAction?: () => void;
  } | null>(null);

  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    item: StockInventoryRecord | null;
  }>({ isOpen: false, mode: 'add', item: null });
  const [historyItem, setHistoryItem] = useState<StockInventoryRecord | null>(null);

  const fetchInventory = useCallback(async (preserveVisibleList = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (preserveVisibleList) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    setActionErrorMessage(null);
    try {
      const items = await stockService.getInventory(pharmacyId);
      setInventory(items);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to load pharmacy inventory. Please try again.';
      if (preserveVisibleList) {
        setActionErrorMessage(message);
      } else {
        setLoadError(message);
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    let isMounted = true;

    stockService
      .getInventory(pharmacyId)
      .then((items) => {
        if (isMounted) {
          setInventory(items);
          setLoadError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Unable to load pharmacy inventory. Please try again.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pharmacyId, externalRefreshNonce]);

  useEffect(() => {
    if (!isLoading && !loadError && onInventoryChange) {
      onInventoryChange(inventory);
    }
  }, [inventory, isLoading, loadError, onInventoryChange]);

  const summary = useMemo(() => summarizeInventory(inventory), [inventory]);

  const filteredItems = useMemo(
    () =>
      filterAndSortInventory(inventory, {
        query: searchQuery,
        statusFilter,
        freshnessFilter,
        sort: sortOption,
      }),
    [inventory, searchQuery, statusFilter, freshnessFilter, sortOption]
  );

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'all' || freshnessFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setFreshnessFilter('all');
  };

  const getQuantityInputValue = (item: StockInventoryRecord): string => {
    if (Object.prototype.hasOwnProperty.call(draftQuantities, item.stockId)) {
      return draftQuantities[item.stockId];
    }
    return item.quantity !== undefined ? String(item.quantity) : '';
  };

  const hasUnsavedQuantity = (item: StockInventoryRecord): boolean => {
    if (!Object.prototype.hasOwnProperty.call(draftQuantities, item.stockId)) {
      return false;
    }
    const savedStr = item.quantity !== undefined ? String(item.quantity) : '';
    return draftQuantities[item.stockId].trim() !== savedStr;
  };

  const handleQuantityChange = (stockId: string, nextRaw: string) => {
    setDraftQuantities((prev) => ({ ...prev, [stockId]: nextRaw }));
    const validation = validateOptionalQuantityInput(nextRaw);
    setQuantityErrors((prev) => {
      const next = { ...prev };
      if (!validation.valid && validation.error) {
        next[stockId] = validation.error;
      } else {
        delete next[stockId];
      }
      return next;
    });
  };

  const handleStepQuantity = (item: StockInventoryRecord, delta: number) => {
    const currentRaw = getQuantityInputValue(item).trim();
    const currentNum = currentRaw === '' ? 0 : Number(currentRaw);
    const safeBase = Number.isFinite(currentNum) && currentNum >= 0 ? Math.floor(currentNum) : 0;
    const nextVal = Math.max(0, safeBase + delta);
    handleQuantityChange(item.stockId, String(nextVal));
  };

  const handleResetQuantityDraft = (stockId: string) => {
    setDraftQuantities((prev) => {
      const next = { ...prev };
      delete next[stockId];
      return next;
    });
    setQuantityErrors((prev) => {
      const next = { ...prev };
      delete next[stockId];
      return next;
    });
  };

  const applyRowSaveError = (
    item: StockInventoryRecord,
    err: unknown,
    fallbackMessage: string,
    retryAction?: () => void
  ) => {
    const message = err instanceof Error ? err.message : fallbackMessage;
    const isConflict = err instanceof StockServiceError && err.status === 409;

    if (err instanceof StockServiceError && err.fields?.quantity) {
      setQuantityErrors((prev) => ({
        ...prev,
        [item.stockId]: err.fields?.quantity || message,
      }));
    }

    setActionErrorMessage(message);
    setRowErrorFeedback({
      stockId: item.stockId,
      message,
      isConflict,
      retryAction,
    });
  };

  const handleSaveQuantityOnly = async (item: StockInventoryRecord) => {
    if (updatingStockId === item.stockId || inFlightStockIdsRef.current.has(item.stockId)) {
      return;
    }

    const raw = getQuantityInputValue(item);
    const validation = validateOptionalQuantityInput(raw);
    if (!validation.valid) {
      setQuantityErrors((prev) => ({
        ...prev,
        [item.stockId]: validation.error || 'Invalid quantity.',
      }));
      return;
    }

    inFlightStockIdsRef.current.add(item.stockId);
    setUpdatingStockId(item.stockId);
    setUpdatingAction('quantity');
    setSuccessMessage(null);
    setActionErrorMessage(null);
    if (lastSavedFeedback?.stockId === item.stockId) {
      setLastSavedFeedback(null);
    }
    if (rowErrorFeedback?.stockId === item.stockId) {
      setRowErrorFeedback(null);
    }

    try {
      const serverUpdate = await stockService.updateInventoryItem(pharmacyId, item.stockId, {
        quantity: validation.value === undefined ? null : validation.value,
      });
      const merged = mergeServerStockRecord(item, serverUpdate);
      setInventory((prev) => prev.map((i) => (i.stockId === merged.stockId ? merged : i)));
      handleResetQuantityDraft(item.stockId);

      const zeroFeedback = getZeroQuantityFeedback(merged.status, merged.quantity, item.status);
      const qtySummary =
        merged.quantity !== undefined ? `${merged.quantity} units` : 'quantity cleared';
      const detail = zeroFeedback
        ? `${merged.medicineName} (${qtySummary}) — ${zeroFeedback.explanation}`
        : `${merged.medicineName} (${qtySummary})`;
      const confirmationText = `Saved ${detail} • Updated ${formatExactTimestamp(merged.updatedAt)}`;

      setSuccessMessage(confirmationText);
      setLastSavedFeedback({
        stockId: merged.stockId,
        status: merged.status,
        updatedAt: merged.updatedAt,
        message: zeroFeedback
          ? `Saved • ${zeroFeedback.explanation}`
          : `Saved (${qtySummary}) at ${formatExactTimestamp(merged.updatedAt)}`,
      });
    } catch (err: unknown) {
      applyRowSaveError(
        item,
        err,
        `Could not update quantity for ${item.medicineName}. Your draft was kept so you can retry.`,
        () => {
          void handleSaveQuantityOnly(item);
        }
      );
    } finally {
      inFlightStockIdsRef.current.delete(item.stockId);
      setUpdatingStockId(null);
      setUpdatingAction(null);
    }
  };

  const handleReconfirmStock = async (
    item: StockInventoryRecord,
    confirmedStatus?: 'available' | 'low' | 'out'
  ) => {
    if (updatingStockId === item.stockId || inFlightStockIdsRef.current.has(item.stockId)) {
      return;
    }

    const targetStatus: 'available' | 'low' | 'out' | undefined =
      confirmedStatus ??
      (item.status === 'available' || item.status === 'low' || item.status === 'out'
        ? item.status
        : undefined);

    inFlightStockIdsRef.current.add(item.stockId);
    setUpdatingStockId(item.stockId);
    setUpdatingAction('reconfirm');
    setSuccessMessage(null);
    setActionErrorMessage(null);
    if (lastSavedFeedback?.stockId === item.stockId) {
      setLastSavedFeedback(null);
    }
    if (rowErrorFeedback?.stockId === item.stockId) {
      setRowErrorFeedback(null);
    }

    try {
      const serverUpdate = await stockService.reconfirmStockItem(pharmacyId, item.stockId, {
        status: targetStatus,
        quantity: item.quantity,
      });
      const merged = mergeServerStockRecord(item, serverUpdate);
      setInventory((prev) => prev.map((i) => (i.stockId === merged.stockId ? merged : i)));

      const statusLabel = STOCK_STATUS_LABELS[merged.status] || merged.status;
      setSuccessMessage(
        `Reconfirmed ${merged.medicineName} as ${statusLabel} • Updated ${formatExactTimestamp(merged.updatedAt)}`
      );
      setLastSavedFeedback({
        stockId: merged.stockId,
        status: merged.status,
        updatedAt: merged.updatedAt,
        message: `Reconfirmed as ${statusLabel} at ${formatExactTimestamp(merged.updatedAt)}`,
      });
    } catch (err: unknown) {
      applyRowSaveError(
        item,
        err,
        `Could not reconfirm ${item.medicineName}. Please verify status and try again.`,
        () => {
          void handleReconfirmStock(item, confirmedStatus);
        }
      );
    } finally {
      inFlightStockIdsRef.current.delete(item.stockId);
      setUpdatingStockId(null);
      setUpdatingAction(null);
    }
  };

  const handleOneTapUpdate = async (
    item: StockInventoryRecord,
    newStatus: 'available' | 'low' | 'out'
  ) => {
    if (updatingStockId === item.stockId || inFlightStockIdsRef.current.has(item.stockId)) {
      return;
    }

    const stale = isStockRecordStale(item);
    const qtyDirty = hasUnsavedQuantity(item);
    if (item.status === newStatus && !stale && !qtyDirty) {
      return;
    }

    let quantityToSubmit: number | null | undefined = item.quantity;
    if (qtyDirty) {
      const raw = getQuantityInputValue(item);
      const validation = validateOptionalQuantityInput(raw);
      if (!validation.valid) {
        setQuantityErrors((prev) => ({
          ...prev,
          [item.stockId]: validation.error || 'Invalid quantity.',
        }));
        setActionErrorMessage(
          `Review the quantity for ${item.medicineName} before saving status.`
        );
        return;
      }
      quantityToSubmit = validation.value === undefined ? null : validation.value;
    }

    inFlightStockIdsRef.current.add(item.stockId);
    setUpdatingStockId(item.stockId);
    setUpdatingAction(newStatus);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    if (lastSavedFeedback?.stockId === item.stockId) {
      setLastSavedFeedback(null);
    }
    if (rowErrorFeedback?.stockId === item.stockId) {
      setRowErrorFeedback(null);
    }

    try {
      const shouldUseReconfirm =
        item.status === 'unverified' || (stale && item.status === newStatus && !qtyDirty);
      const serverUpdate = shouldUseReconfirm
        ? await stockService.reconfirmStockItem(pharmacyId, item.stockId, {
            status: newStatus,
            quantity: quantityToSubmit,
          })
        : await stockService.updateStockStatus(
            pharmacyId,
            item.stockId,
            newStatus,
            quantityToSubmit
          );
      const merged = mergeServerStockRecord(item, serverUpdate);
      setInventory((prev) => prev.map((i) => (i.stockId === merged.stockId ? merged : i)));
      if (qtyDirty) {
        handleResetQuantityDraft(item.stockId);
      }

      const statusLabel = STOCK_STATUS_LABELS[merged.status] || merged.status;
      const zeroFeedback = getZeroQuantityFeedback(merged.status, merged.quantity, newStatus);
      const qtyPart =
        merged.quantity !== undefined
          ? ` (${merged.quantity === 0 ? '0 units' : `${merged.quantity} in stock`})`
          : '';
      const confirmationText = zeroFeedback
        ? `Saved ${merged.medicineName}: ${statusLabel}${qtyPart} — ${zeroFeedback.explanation} • Updated ${formatExactTimestamp(merged.updatedAt)}`
        : `Saved ${merged.medicineName} as ${statusLabel}${qtyPart} • Updated ${formatExactTimestamp(merged.updatedAt)}`;

      setSuccessMessage(confirmationText);
      setLastSavedFeedback({
        stockId: merged.stockId,
        status: merged.status,
        updatedAt: merged.updatedAt,
        message: zeroFeedback
          ? `Saved as ${statusLabel} • ${zeroFeedback.explanation}`
          : `Saved as ${statusLabel} at ${formatExactTimestamp(merged.updatedAt)}`,
      });
    } catch (err: unknown) {
      applyRowSaveError(
        item,
        err,
        `Failed to save status for ${item.medicineName}. Changes were not saved.`,
        () => {
          void handleOneTapUpdate(item, newStatus);
        }
      );
    } finally {
      inFlightStockIdsRef.current.delete(item.stockId);
      setUpdatingStockId(null);
      setUpdatingAction(null);
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap' }}>
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
                minHeight: '40px',
                padding: '6px 6px',
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => handleSaveQuantityOnly(item)}
                disabled={isUpdating || Boolean(errorText)}
                className="btn-primary inventory-qty-action-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
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
                className="btn-secondary inventory-qty-action-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>

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
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-status-problem-border)',
              backgroundColor: 'var(--color-status-problem-bg)',
              color: 'var(--color-status-problem)',
              fontSize: '11px',
            }}
          >
            <span style={{ fontWeight: 600 }}>{rowError.message}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {rowError.isConflict ? (
                <button
                  type="button"
                  onClick={() => void fetchInventory(inventory.length > 0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    color: 'var(--color-action-primary)',
                    fontSize: '12px',
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
                      padding: '4px 0',
                      color: 'var(--color-action-primary)',
                      fontSize: '12px',
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
                  padding: '4px 0',
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
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
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
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

        {stale &&
          (item.status === 'available' || item.status === 'low' || item.status === 'out') && (
            <button
              type="button"
              onClick={() => void handleReconfirmStock(item)}
              disabled={isUpdating}
              className="btn-secondary inventory-status-btn"
              style={{
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-status-caution-border)',
                backgroundColor: 'var(--color-status-caution-bg)',
                color: 'var(--color-status-caution)',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
              }}
              aria-label={`Reconfirm current ${STOCK_STATUS_LABELS[item.status]} stock for ${item.medicineName}`}
            >
              {isUpdating && updatingAction === 'reconfirm' ? (
                <span className="spinner-small" aria-hidden="true" />
              ) : (
                <ShieldCheck size={13} aria-hidden="true" />
              )}
              <span>
                {isUpdating && updatingAction === 'reconfirm' ? 'Reconfirming...' : 'Reconfirm'}
              </span>
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

  return (
    <div className="inventory-workbench" data-view={viewMode}>
      {/* Top Action Header + Disclaimer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          {pharmacyName && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Active Pharmacy: {pharmacyName}
            </div>
          )}
          <DisclaimerBanner variant="inline" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setModalState({ isOpen: true, mode: 'add', item: null })}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '10px 16px',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} aria-hidden={true} />
            <span>Add Medicine</span>
          </button>

          <button
            type="button"
            onClick={() => void fetchInventory(inventory.length > 0)}
            disabled={isLoading || isRefreshing}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              padding: '10px 14px',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-secondary)',
              cursor: isLoading || isRefreshing ? 'not-allowed' : 'pointer',
            }}
            aria-label="Refresh medicine inventory"
          >
            <RefreshCw
              size={14}
              aria-hidden={true}
              style={{ animation: isLoading || isRefreshing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Truthful Interactive Inventory Summary Strip */}
      {!isLoading && !loadError && inventory.length > 0 && (
        <div className="inventory-summary-grid" role="group" aria-label="Inventory summary filters">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setFreshnessFilter('all');
            }}
            aria-pressed={statusFilter === 'all' && freshnessFilter === 'all'}
            className="inventory-summary-card"
            style={{
              border:
                statusFilter === 'all' && freshnessFilter === 'all'
                  ? '2px solid var(--color-action-primary)'
                  : '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              <Pill size={12} aria-hidden="true" />
              <span>Total Listed</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {summary.total}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'available' ? 'all' : 'available'))}
            aria-pressed={statusFilter === 'available'}
            className="inventory-summary-card"
            style={{
              border:
                statusFilter === 'available'
                  ? '2px solid var(--color-status-available)'
                  : '1px solid var(--color-status-available-border)',
              backgroundColor: 'var(--color-status-available-bg)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--color-status-available)' }}>
              <CheckCircle2 size={12} aria-hidden="true" />
              <span>Available</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-available)' }}>
              {summary.available}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'low' ? 'all' : 'low'))}
            aria-pressed={statusFilter === 'low'}
            className="inventory-summary-card"
            style={{
              border:
                statusFilter === 'low'
                  ? '2px solid var(--color-status-caution)'
                  : '1px solid var(--color-status-caution-border)',
              backgroundColor: 'var(--color-status-caution-bg)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--color-status-caution)' }}>
              <AlertTriangle size={12} aria-hidden="true" />
              <span>Low Stock</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-caution)' }}>
              {summary.low}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'out' ? 'all' : 'out'))}
            aria-pressed={statusFilter === 'out'}
            className="inventory-summary-card"
            style={{
              border:
                statusFilter === 'out'
                  ? '2px solid var(--color-status-problem)'
                  : '1px solid var(--color-status-problem-border)',
              backgroundColor: 'var(--color-status-problem-bg)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--color-status-problem)' }}>
              <XCircle size={12} aria-hidden="true" />
              <span>Out of Stock</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-problem)' }}>
              {summary.out}
            </div>
          </button>

          {summary.unverified > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === 'unverified' ? 'all' : 'unverified'))}
              aria-pressed={statusFilter === 'unverified'}
              className="inventory-summary-card"
              style={{
                border:
                  statusFilter === 'unverified'
                    ? '2px solid var(--color-status-neutral)'
                    : '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-status-neutral-bg)',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--color-status-neutral)' }}>
                <HelpCircle size={12} aria-hidden="true" />
                <span>Unverified</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-neutral)' }}>
                {summary.unverified}
              </div>
            </button>
          )}

          {summary.stale > 0 && (
            <button
              type="button"
              onClick={() => setFreshnessFilter((prev) => (prev === 'stale' ? 'all' : 'stale'))}
              aria-pressed={freshnessFilter === 'stale'}
              className="inventory-summary-card"
              style={{
                border:
                  freshnessFilter === 'stale'
                    ? '2px solid var(--color-status-caution)'
                    : '1px solid var(--color-status-caution-border)',
                backgroundColor: 'var(--color-status-caution-bg)',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--color-status-caution)' }}>
                <Clock size={12} aria-hidden="true" />
                <span>Stale (&ge; 24h)</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-caution)' }}>
                {summary.stale}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Search, Filters & View Controls Toolbar */}
      <div className="inventory-toolbar" role="search" aria-label="Search and filter inventory">
        <div className="inventory-toolbar-row">
          {/* Search Input */}
          <div style={{ flex: '2 1 240px', minWidth: 0 }}>
            <label
              htmlFor="inventory-search-input"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '5px',
              }}
            >
              Search Inventory
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                color="var(--color-text-secondary)"
                style={{ position: 'absolute', left: '12px', top: '13px', pointerEvents: 'none' }}
                aria-hidden="true"
              />
              <input
                id="inventory-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Medicine name, generic name, or strength..."
                className="medifind-input"
                style={{
                  padding: '9px 40px 9px 36px',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear inventory search"
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '4px',
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Availability Status Filter */}
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <label
              htmlFor="inventory-status-filter"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '5px',
              }}
            >
              Availability Status
            </label>
            <select
              id="inventory-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InventoryStatusFilter)}
              className="medifind-select"
              style={{ fontSize: '13px', padding: '9px 12px' }}
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="unverified">Unverified Report</option>
            </select>
          </div>

          {/* Freshness Filter */}
          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label
              htmlFor="inventory-freshness-filter"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '5px',
              }}
            >
              Report Freshness
            </label>
            <select
              id="inventory-freshness-filter"
              value={freshnessFilter}
              onChange={(e) => setFreshnessFilter(e.target.value as InventoryFreshnessFilter)}
              className="medifind-select"
              style={{ fontSize: '13px', padding: '9px 12px' }}
            >
              <option value="all">All updates</option>
              <option value="fresh">Fresh (&lt; 24h)</option>
              <option value="stale">Stale (&ge; 24h)</option>
            </select>
          </div>

          {/* Sort Order */}
          <div style={{ flex: '1 1 155px', minWidth: 0 }}>
            <label
              htmlFor="inventory-sort-select"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '5px',
              }}
            >
              Sort By
            </label>
            <select
              id="inventory-sort-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as InventorySortOption)}
              className="medifind-select"
              style={{ fontSize: '13px', padding: '9px 12px' }}
            >
              <option value="updated_desc">Recently updated</option>
              <option value="oldest_first">Oldest / stale first</option>
              <option value="name_asc">Medicine name (A–Z)</option>
            </select>
          </div>

          {/* Desktop View Mode Toggle */}
          <div className="inventory-view-toggle" role="group" aria-label="Inventory layout view">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                minHeight: '42px',
                padding: '8px 12px',
                border: '1px solid var(--color-border-default)',
                borderRight: 'none',
                borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                backgroundColor:
                  viewMode === 'table' ? 'var(--color-action-subtle)' : 'var(--color-surface-panel)',
                color:
                  viewMode === 'table'
                    ? 'var(--color-action-primary)'
                    : 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Table2 size={14} aria-hidden="true" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                minHeight: '42px',
                padding: '8px 12px',
                border: '1px solid var(--color-border-default)',
                borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                backgroundColor:
                  viewMode === 'cards' ? 'var(--color-action-subtle)' : 'var(--color-surface-panel)',
                color:
                  viewMode === 'cards'
                    ? 'var(--color-action-primary)'
                    : 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={14} aria-hidden="true" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips & Result Count */}
        {(hasActiveFilters || inventory.length > 0) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              paddingTop: '4px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Showing {filteredItems.length} of {inventory.length}{' '}
              {inventory.length === 1 ? 'medicine' : 'medicines'}
            </span>

            {hasActiveFilters && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={`Remove search filter: ${searchQuery.trim()}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span>Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

                {statusFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    aria-label={`Remove status filter: ${STOCK_STATUS_LABELS[statusFilter]}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span>Status: {STOCK_STATUS_LABELS[statusFilter]}</span>
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

                {freshnessFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFreshnessFilter('all')}
                    aria-label={`Remove freshness filter: ${freshnessFilter}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span>
                      Freshness: {freshnessFilter === 'stale' ? 'Stale (>= 24h)' : 'Fresh (< 24h)'}
                    </span>
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearAllFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-action-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 6px',
                  }}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explicit Success Confirmation Banner */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-available-bg)',
            color: 'var(--color-status-available)',
            border: '1px solid rgba(24, 115, 75, 0.25)',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss confirmation message"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-status-available)',
              cursor: 'pointer',
              minWidth: '36px',
              minHeight: '36px',
              borderRadius: 'var(--radius-full)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Explicit Action Error Banner (never styled as success) */}
      {actionErrorMessage && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-problem-bg)',
            color: 'var(--color-status-problem)',
            border: '1px solid var(--color-status-problem-border)',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{actionErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionErrorMessage(null)}
            aria-label="Dismiss error message"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-status-problem)',
              cursor: 'pointer',
              minWidth: '36px',
              minHeight: '36px',
              borderRadius: 'var(--radius-full)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Main Content States: Loading Skeleton / Error / Empty / No Match / Results */}
      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <span className="sr-only">Loading medicine inventory...</span>
          <div className="inventory-summary-grid" aria-hidden="true">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="skeleton-shimmer"
                style={{ height: '62px', borderRadius: 'var(--radius-md)' }}
              />
            ))}
          </div>
          {[1, 2, 3].map((rowIdx) => (
            <div
              key={rowIdx}
              aria-hidden="true"
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div className="skeleton-shimmer" style={{ width: '210px', maxWidth: '100%', height: '20px' }} />
                <div className="skeleton-shimmer" style={{ width: '120px', height: '24px', borderRadius: 'var(--radius-full)' }} />
              </div>
              <div className="skeleton-shimmer" style={{ width: '280px', maxWidth: '100%', height: '14px' }} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div className="skeleton-shimmer" style={{ width: '92px', height: '38px', borderRadius: 'var(--radius-full)' }} />
                <div className="skeleton-shimmer" style={{ width: '76px', height: '38px', borderRadius: 'var(--radius-full)' }} />
                <div className="skeleton-shimmer" style={{ width: '112px', height: '38px', borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div
          role="alert"
          style={{
            padding: '28px 20px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid var(--color-status-problem-border)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={28} color="var(--color-status-problem)" aria-hidden="true" />
          <div>
            <strong style={{ display: 'block', fontSize: '15px', color: 'var(--color-status-problem)', marginBottom: '4px' }}>
              Could Not Load Inventory
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchInventory(false)}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-status-problem-border)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-status-problem)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Retry Loading Inventory</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-default)',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
          }}
        >
          {inventory.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Pill size={28} color="var(--color-action-primary)" aria-hidden="true" />
              <div>
                <strong style={{ display: 'block', fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                  No medicines in your inventory yet
                </strong>
                <span style={{ fontSize: '13px' }}>
                  Link active medicines from the MediFind catalogue to start reporting stock availability.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalState({ isOpen: true, mode: 'add', item: null })}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  padding: '10px 18px',
                  minHeight: '44px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} aria-hidden="true" />
                <span>Add First Medicine</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                No matching inventory items
              </strong>
              <span style={{ fontSize: '13px' }}>
                Try broadening your search term or clearing active filters.
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="btn-secondary"
                  style={{
                    padding: '10px 16px',
                    minHeight: '44px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-action-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (Labeled Keyboard-Scrollable Region) */}
          <div
            className="inventory-table-wrap"
            role="region"
            aria-label="Pharmacy medicine inventory table"
            tabIndex={0}
          >
            <table className="inventory-table" aria-label="Pharmacy medicine inventory">
              <thead>
                <tr>
                  <th scope="col">Medicine</th>
                  <th scope="col">Reported Status &amp; Last Updated</th>
                  <th scope="col">Quantity (Optional)</th>
                  <th scope="col">Quick Status Update</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const stale = isStockRecordStale(item);
                  return (
                    <tr key={item.stockId}>
                      {/* Medicine Identity */}
                      <td style={{ minWidth: '210px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
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
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          Generic: {item.genericName}
                          {item.manufacturer ? ` • ${item.manufacturer}` : ''}
                          {item.price !== undefined ? ` • Price: ${item.price.toFixed(2)}` : ''}
                        </div>
                        {item.notes && (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                            Note: {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Reported Status & Timestamp */}
                      <td style={{ minWidth: '210px' }}>
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
                            }}
                          >
                            <Clock size={11} aria-hidden="true" />
                            <span>{formatExactTimestamp(item.updatedAt)}</span>
                          </div>
                          {renderItemStateNotices(item)}
                        </div>
                      </td>

                      {/* Optional Quantity Control */}
                      <td style={{ minWidth: '175px' }}>
                        {renderQuantityControl(item, false)}
                      </td>

                      {/* Status Controls + Edit */}
                      <td style={{ minWidth: '280px' }}>
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
                    </span>
                    {renderQuantityControl(item, true)}
                  </div>

                  {/* Status Controls */}
                  <div
                    style={{
                      paddingTop: '10px',
                      borderTop: '1px solid var(--color-border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Update Availability Status
                    </span>
                    {renderStatusControls(item)}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {modalState.isOpen && (
        <InventoryMedicineModal
          key={`${modalState.mode}_${modalState.item?.stockId || 'new'}`}
          mode={modalState.mode}
          initialItem={modalState.item}
          existingInventory={inventory}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          onSaveAdd={handleSaveAddModal}
          onSaveEdit={handleSaveEditModal}
        />
      )}

      {historyItem && (
        <StockHistoryModal
          pharmacyId={pharmacyId}
          item={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  );
};
