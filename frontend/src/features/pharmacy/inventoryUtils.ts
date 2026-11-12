// src/features/pharmacy/inventoryUtils.ts
import type { StockStatus } from '../../types/pharmacy';
import type {
  InventoryFreshnessFilter,
  InventorySortOption,
  InventoryStatusFilter,
  Medicine,
  StockInventoryRecord,
} from '../../types/medicine';

export const DEFAULT_STALE_THRESHOLD_HOURS = 24;

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  available: 'Available',
  low: 'Low Stock',
  out: 'Out of Stock',
  unverified: 'Unverified Report',
};

export interface InventoryFilterOptions {
  query: string;
  statusFilter: InventoryStatusFilter;
  freshnessFilter: InventoryFreshnessFilter;
  sort: InventorySortOption;
}

export interface InventorySummary {
  total: number;
  available: number;
  low: number;
  out: number;
  unverified: number;
  stale: number;
  needsAttention: number;
}

export interface QuantityValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * Determines whether a stock record is stale based on explicit server flag
 * or elapsed hours since updatedAt. Keeps freshness separate from stock status.
 */
export function isStockRecordStale(
  item: Pick<StockInventoryRecord, 'updatedAt' | 'isStale'>,
  thresholdHours = DEFAULT_STALE_THRESHOLD_HOURS
): boolean {
  if (typeof item.isStale === 'boolean') {
    return item.isStale;
  }
  if (!item.updatedAt) return true;
  const parsed = new Date(item.updatedAt);
  if (Number.isNaN(parsed.getTime())) return true;
  const diffHours = (Date.now() - parsed.getTime()) / (1000 * 60 * 60);
  return diffHours >= thresholdHours;
}

/**
 * Formats an ISO timestamp in the user's locale for explicit last-updated display.
 */
export function formatExactTimestamp(isoString?: string): string {
  if (!isoString) return 'Update time unavailable';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Update time unavailable';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
}

/**
 * Validates optional integer quantity input (>= 0). Empty input clears quantity (undefined).
 */
export function validateOptionalQuantityInput(raw: string): QuantityValidationResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { valid: true, value: undefined };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    return {
      valid: false,
      error: 'Quantity must be a whole number of 0 or greater.',
    };
  }
  return { valid: true, value: num };
}

/**
 * Filters inventory records by medicine name, generic name, or strength,
 * plus availability status and freshness, and applies the selected sort order.
 */
export function filterAndSortInventory(
  items: StockInventoryRecord[],
  options: InventoryFilterOptions
): StockInventoryRecord[] {
  const q = options.query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (q) {
      const matchesQuery =
        item.medicineName.toLowerCase().includes(q) ||
        item.genericName.toLowerCase().includes(q) ||
        item.strength.toLowerCase().includes(q);
      if (!matchesQuery) return false;
    }

    if (options.statusFilter !== 'all' && item.status !== options.statusFilter) {
      return false;
    }

    if (options.freshnessFilter !== 'all') {
      const stale = isStockRecordStale(item);
      if (options.freshnessFilter === 'stale' && !stale) return false;
      if (options.freshnessFilter === 'fresh' && stale) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (options.sort === 'name_asc') {
      return a.medicineName.localeCompare(b.medicineName);
    }

    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    const safeA = Number.isNaN(timeA) ? 0 : timeA;
    const safeB = Number.isNaN(timeB) ? 0 : timeB;

    if (options.sort === 'oldest_first') {
      return safeA - safeB;
    }
    return safeB - safeA;
  });

  return sorted;
}

/**
 * Computes summary counts strictly from the loaded inventory array.
 */
export function summarizeInventory(items: StockInventoryRecord[]): InventorySummary {
  const summary: InventorySummary = {
    total: items.length,
    available: 0,
    low: 0,
    out: 0,
    unverified: 0,
    stale: 0,
    needsAttention: 0,
  };

  for (const item of items) {
    if (item.status === 'available') summary.available += 1;
    else if (item.status === 'low') summary.low += 1;
    else if (item.status === 'out') summary.out += 1;
    else if (item.status === 'unverified') summary.unverified += 1;

    const stale = isStockRecordStale(item);
    if (stale) summary.stale += 1;
    if (stale || item.status === 'unverified') summary.needsAttention += 1;
  }

  return summary;
}

/**
 * Checks whether a catalogue medicine is already present in the pharmacy's inventory.
 */
export function isDuplicateInventoryMedicine(
  inventory: StockInventoryRecord[],
  candidate: Pick<Medicine, 'id' | 'name' | 'strength' | 'form'>
): boolean {
  const normName = candidate.name.trim().toLowerCase();
  const normStrength = candidate.strength.trim().toLowerCase();
  const normForm = candidate.form.trim().toLowerCase();

  return inventory.some(
    (item) =>
      (candidate.id && item.medicineId === candidate.id) ||
      (item.medicineName.trim().toLowerCase() === normName &&
        item.strength.trim().toLowerCase() === normStrength &&
        item.form.trim().toLowerCase() === normForm)
  );
}

