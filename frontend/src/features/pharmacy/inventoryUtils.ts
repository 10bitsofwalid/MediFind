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

const STOCK_STATUS_ALIASES: Record<string, StockStatus> = {
  available: 'available',
  in_stock: 'available',
  low: 'low',
  low_stock: 'low',
  'low stock': 'low',
  out: 'out',
  out_of_stock: 'out',
  'out of stock': 'out',
  unverified: 'unverified',
  unverified_report: 'unverified',
  'unverified report': 'unverified',
};

/**
 * Normalizes API or database stock status strings into canonical frontend StockStatus values.
 * Returns null if the value is not a recognized status, avoiding fabricated states.
 */
export function normalizeStockStatus(raw: unknown): StockStatus | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (cleaned in STOCK_STATUS_ALIASES) {
    return STOCK_STATUS_ALIASES[cleaned];
  }
  const spaceCleaned = raw.trim().toLowerCase();
  return STOCK_STATUS_ALIASES[spaceCleaned] ?? null;
}

/**
 * Formats an ISO timestamp into a concise relative age string.
 */
export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'Update time unavailable';
  try {
    const updated = new Date(isoString);
    if (Number.isNaN(updated.getTime())) return 'Update time unavailable';

    const diffMs = Date.now() - updated.getTime();
    if (diffMs < 0) return 'Just now';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Update time unavailable';
  }
}

/**
 * Evaluates whether a timestamp exceeds the freshness threshold (default 24 hours).
 */
export function isReportStale(
  isoString?: string,
  thresholdHours = DEFAULT_STALE_THRESHOLD_HOURS
): boolean {
  if (!isoString) return true;
  try {
    const updated = new Date(isoString);
    if (Number.isNaN(updated.getTime())) return true;
    const diffHours = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
    return diffHours >= thresholdHours;
  } catch {
    return true;
  }
}

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

export interface ZeroQuantityFeedback {
  explanation: string;
  wasStatusNormalized: boolean;
}

/**
 * Determines whether a stock record is stale based on explicit server flag/freshness
 * or elapsed hours since updatedAt. Keeps freshness separate from stock status.
 */
export function isStockRecordStale(
  item: Pick<StockInventoryRecord, 'updatedAt' | 'isStale' | 'freshness'>,
  thresholdHours = DEFAULT_STALE_THRESHOLD_HOURS
): boolean {
  if (typeof item.isStale === 'boolean') {
    return item.isStale;
  }
  if (item.freshness === 'stale') return true;
  if (item.freshness === 'fresh') return false;
  return isReportStale(item.updatedAt, thresholdHours);
}

/**
 * Merges an authoritative server update response into an existing inventory record.
 * Handles partial PATCH responses (e.g. API.md §10.1 returning stockId, medicineId, status, quantity, updatedAt)
 * without losing catalogue identity fields or overriding server freshness/status values.
 */
export function mergeServerStockRecord(
  existing: StockInventoryRecord,
  serverUpdate: Partial<StockInventoryRecord> & {
    stockId: string;
    status: StockStatus;
    updatedAt: string;
  }
): StockInventoryRecord {
  const hasExplicitQuantity = 'quantity' in serverUpdate;
  const resolvedQuantity = hasExplicitQuantity
    ? serverUpdate.quantity === null || serverUpdate.quantity === undefined
      ? undefined
      : serverUpdate.quantity
    : existing.quantity;

  const hasExplicitPrice = 'price' in serverUpdate;
  const resolvedPrice = hasExplicitPrice
    ? serverUpdate.price === null || serverUpdate.price === undefined
      ? undefined
      : serverUpdate.price
    : existing.price;

  return {
    ...existing,
    ...serverUpdate,
    quantity: resolvedQuantity,
    price: resolvedPrice,
    // Do not retain a stale boolean from the prior record if the server returned a fresh update without isStale
    isStale: 'isStale' in serverUpdate ? serverUpdate.isStale : undefined,
    freshness: 'freshness' in serverUpdate ? serverUpdate.freshness : undefined,
  };
}

/**
 * Produces concise, non-invented user feedback when quantity is reported as 0.
 * Per PRD §7.2, displays the server-returned status and a concise explanation without
 * inventing client-side status transition rules.
 */
export function getZeroQuantityFeedback(
  status: StockStatus,
  quantity?: number | null,
  requestedStatus?: StockStatus
): ZeroQuantityFeedback | null {
  if (quantity !== 0) return null;

  if (requestedStatus && requestedStatus !== status) {
    return {
      wasStatusNormalized: true,
      explanation: `Quantity is 0 — server saved status as ${STOCK_STATUS_LABELS[status]}.`,
    };
  }

  if (status === 'out') {
    return {
      wasStatusNormalized: false,
      explanation: 'Quantity is 0 — reported as Out of Stock.',
    };
  }

  return {
    wasStatusNormalized: false,
    explanation: `Quantity is 0 — status reflects server-reported ${STOCK_STATUS_LABELS[status]}.`,
  };
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

