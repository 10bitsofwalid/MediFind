// src/features/pharmacy/OneTapStockControl.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type {
  StockInventoryRecord,
  AddInventoryMedicinePayload,
  UpdateInventoryMedicinePayload,
  InventoryStatusFilter,
  InventoryFreshnessFilter,
  InventorySortOption,
} from '../../types/medicine';
import { stockService } from '../../services/stockService';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { InventoryMedicineModal } from './InventoryMedicineModal';
import {
  STOCK_STATUS_LABELS,
  filterAndSortInventory,
  formatExactTimestamp,
  isStockRecordStale,
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
} from 'lucide-react';

interface OneTapStockControlProps {
  pharmacyId: string;
  pharmacyName?: string;
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
}) => {
  const [inventory, setInventory] = useState<StockInventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>('all');
  const [freshnessFilter, setFreshnessFilter] = useState<InventoryFreshnessFilter>('all');
  const [sortOption, setSortOption] = useState<InventorySortOption>('updated_desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<StockStatus | 'quantity' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    item: StockInventoryRecord | null;
  }>({ isOpen: false, mode: 'add', item: null });

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await stockService.getInventory(pharmacyId);
      setInventory(items);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Unable to load pharmacy inventory. Please try again.'
      );
    } finally {
      setIsLoading(false);
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
  }, [pharmacyId]);

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

  const handleSaveQuantityOnly = async (item: StockInventoryRecord) => {
    const raw = getQuantityInputValue(item);
    const validation = validateOptionalQuantityInput(raw);
    if (!validation.valid) {
      setQuantityErrors((prev) => ({
        ...prev,
        [item.stockId]: validation.error || 'Invalid quantity.',
      }));
      return;
    }

    setUpdatingStockId(item.stockId);
    setUpdatingAction('quantity');
    setSuccessMessage(null);
    setActionErrorMessage(null);

    try {
      const updated = await stockService.updateInventoryItem(pharmacyId, item.stockId, {
        quantity: validation.value === undefined ? null : validation.value,
      });
      setInventory((prev) => prev.map((i) => (i.stockId === updated.stockId ? updated : i)));
      handleResetQuantityDraft(item.stockId);
      const qtySummary =
        updated.quantity !== undefined ? `${updated.quantity} units` : 'quantity cleared';
      setSuccessMessage(
        `Saved ${updated.medicineName} (${qtySummary}) • Updated ${formatExactTimestamp(updated.updatedAt)}`
      );
    } catch (err: unknown) {
      setActionErrorMessage(
        err instanceof Error
          ? err.message
          : `Could not update quantity for ${item.medicineName}. Your draft was kept so you can retry.`
      );
    } finally {
      setUpdatingStockId(null);
      setUpdatingAction(null);
    }
  };

  const handleOneTapUpdate = async (
    item: StockInventoryRecord,
    newStatus: 'available' | 'low' | 'out'
  ) => {
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

    setUpdatingStockId(item.stockId);
    setUpdatingAction(newStatus);
    setSuccessMessage(null);
    setActionErrorMessage(null);

    try {
      const updated = await stockService.updateStockStatus(
        pharmacyId,
        item.stockId,
        newStatus,
        quantityToSubmit
      );
      setInventory((prev) => prev.map((i) => (i.stockId === updated.stockId ? updated : i)));
      if (qtyDirty) {
        handleResetQuantityDraft(item.stockId);
      }
      const statusLabel = STOCK_STATUS_LABELS[updated.status] || newStatus;
      const qtyPart =
        updated.quantity !== undefined ? ` (${updated.quantity} in stock)` : '';
      setSuccessMessage(
        `Saved ${updated.medicineName} as ${statusLabel}${qtyPart} • Updated ${formatExactTimestamp(updated.updatedAt)}`
      );
    } catch (err: unknown) {
      setActionErrorMessage(
        err instanceof Error
          ? err.message
          : `Failed to save status for ${item.medicineName}. Changes were not saved.`
      );
    } finally {
      setUpdatingStockId(null);
      setUpdatingAction(null);
    }
  };

  const handleSaveAddModal = async (payload: AddInventoryMedicinePayload) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    const created = await stockService.addInventoryItem(pharmacyId, payload);
    setInventory((prev) => [created, ...prev]);
    setSuccessMessage(
      `Added ${created.medicineName} (${created.strength}) as ${
        STOCK_STATUS_LABELS[created.status]
      } • Updated ${formatExactTimestamp(created.updatedAt)}`
    );
  };

  const handleSaveEditModal = async (
    stockId: string,
    payload: UpdateInventoryMedicinePayload
  ) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    const updated = await stockService.updateInventoryItem(pharmacyId, stockId, payload);
    setInventory((prev) => prev.map((i) => (i.stockId === updated.stockId ? updated : i)));
    handleResetQuantityDraft(stockId);
    setSuccessMessage(
      `Updated ${updated.medicineName} (${STOCK_STATUS_LABELS[updated.status]}) • Updated ${formatExactTimestamp(updated.updatedAt)}`
    );
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
              width: compact ? '90px' : '78px',
              minHeight: '38px',
              padding: '6px 8px',
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

          {dirty && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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

  const renderStatusControls = (item: StockInventoryRecord) => {
    const isUpdating = updatingStockId === item.stockId;
    const stale = isStockRecordStale(item);

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
        <div style={{ flex: 1, minWidth: '220px' }}>
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
              minHeight: '42px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} aria-hidden={true} />
            <span>Add Medicine</span>
          </button>

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
              padding: '10px 14px',
              minHeight: '42px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-secondary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            aria-label="Refresh medicine inventory"
          >
            <RefreshCw
              size={14}
              aria-hidden={true}
              style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Truthful Inventory Summary Strip */}
      {!isLoading && !loadError && inventory.length > 0 && (
        <div className="inventory-summary-grid" aria-label="Inventory summary counts">
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Total Listed
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {summary.total}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(24, 115, 75, 0.25)',
              backgroundColor: 'var(--color-status-available-bg)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-status-available)' }}>
              Available
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-available)' }}>
              {summary.available}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(152, 88, 0, 0.25)',
              backgroundColor: 'var(--color-status-caution-bg)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-status-caution)' }}>
              Low Stock
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-caution)' }}>
              {summary.low}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(180, 35, 47, 0.25)',
              backgroundColor: 'var(--color-status-problem-bg)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-status-problem)' }}>
              Out of Stock
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-problem)' }}>
              {summary.out}
            </div>
          </div>

          {summary.stale > 0 && (
            <button
              type="button"
              onClick={() => setFreshnessFilter((prev) => (prev === 'stale' ? 'all' : 'stale'))}
              aria-pressed={freshnessFilter === 'stale'}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border:
                  freshnessFilter === 'stale'
                    ? '2px solid var(--color-status-caution)'
                    : '1px solid rgba(152, 88, 0, 0.3)',
                backgroundColor: 'var(--color-status-caution-bg)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-status-caution)' }}>
                Stale (&ge; 24h)
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
                style={{
                  width: '100%',
                  minHeight: '42px',
                  padding: '9px 36px 9px 36px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear inventory search"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '6px',
                    width: '30px',
                    height: '30px',
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
                  <X size={14} aria-hidden="true" />
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
              style={{
                width: '100%',
                minHeight: '42px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
              }}
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
              style={{
                width: '100%',
                minHeight: '42px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
              }}
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
              style={{
                width: '100%',
                minHeight: '42px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
              }}
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
              padding: '4px',
              display: 'inline-flex',
            }}
          >
            <X size={14} aria-hidden="true" />
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
            border: '1px solid rgba(180, 35, 47, 0.3)',
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
              padding: '4px',
              display: 'inline-flex',
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Main Content States: Loading / Error / Empty / No Match / Results */}
      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            textAlign: 'center',
            padding: '44px 16px',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div className="spinner" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
          <span>Loading medicine inventory...</span>
        </div>
      ) : loadError ? (
        <div
          role="alert"
          style={{
            padding: '28px 20px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
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
            onClick={fetchInventory}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(180, 35, 47, 0.35)',
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
                  minHeight: '42px',
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
                    padding: '8px 14px',
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
          {/* Desktop Table View */}
          <div className="inventory-table-wrap">
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
                      <td style={{ minWidth: '190px' }}>
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
                          {item.status === 'unverified' && (
                            <span style={{ fontSize: '11px', color: 'var(--color-status-caution)' }}>
                              Flagged unverified — select a status to reconfirm.
                            </span>
                          )}
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

                    {item.status === 'unverified' && (
                      <div style={{ fontSize: '12px', color: 'var(--color-status-caution)', marginTop: '6px' }}>
                        Flagged unverified — select a status below after checking physical stock.
                      </div>
                    )}
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
    </div>
  );
};
