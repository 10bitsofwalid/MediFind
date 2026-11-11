// src/features/pharmacy/OneTapStockControl.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type { StockInventoryRecord } from '../../types/medicine';
import { stockService } from '../../services/stockService';
import { AvailabilityStatus } from '../../components/AvailabilityStatus';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Pill,
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

  const fetchInventory = async () => {
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
          {inventory.length === 0
            ? 'No medicines in your pharmacy inventory yet.'
            : 'No medicines match your search.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredItems.map((item) => {
            const isUpdating = updatingStockId === item.stockId;

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
    </div>
  );
};
