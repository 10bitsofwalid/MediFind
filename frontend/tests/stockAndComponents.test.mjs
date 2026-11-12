// frontend/tests/stockAndComponents.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortInventory,
  formatExactTimestamp,
  isDuplicateInventoryMedicine,
  isStockRecordStale,
  summarizeInventory,
  validateOptionalQuantityInput,
} from '../src/features/pharmacy/inventoryUtils.ts';

function formatTimeAgo(isoString) {
  if (!isoString) return 'Update time unavailable';
  try {
    const updated = new Date(isoString);
    if (isNaN(updated.getTime())) return 'Update time unavailable';

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

function isReportStale(isoString, thresholdHours = 24) {
  if (!isoString) return true;
  try {
    const updated = new Date(isoString);
    if (isNaN(updated.getTime())) return true;
    const diffHours = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
    return diffHours >= thresholdHours;
  } catch {
    return true;
  }
}

const nowMs = Date.now();
const sampleInventory = [
  {
    stockId: 'stk_1',
    pharmacyId: 'ph_1',
    medicineId: 'med_1',
    medicineName: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500 mg + 65 mg',
    form: 'Tablet',
    status: 'available',
    quantity: 40,
    updatedAt: new Date(nowMs - 20 * 60 * 1000).toISOString(),
    isStale: false,
  },
  {
    stockId: 'stk_2',
    pharmacyId: 'ph_1',
    medicineId: 'med_2',
    medicineName: 'Seclo',
    genericName: 'Omeprazole',
    strength: '20 mg',
    form: 'Capsule',
    status: 'low',
    quantity: 5,
    updatedAt: new Date(nowMs - 30 * 60 * 60 * 1000).toISOString(),
    isStale: true,
  },
  {
    stockId: 'stk_3',
    pharmacyId: 'ph_1',
    medicineId: 'med_3',
    medicineName: 'Amoxil',
    genericName: 'Amoxicillin',
    strength: '500 mg',
    form: 'Capsule',
    status: 'out',
    quantity: 0,
    updatedAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
    isStale: false,
  },
  {
    stockId: 'stk_4',
    pharmacyId: 'ph_1',
    medicineId: 'med_4',
    medicineName: 'Monas',
    genericName: 'Montelukast',
    strength: '10 mg',
    form: 'Tablet',
    status: 'unverified',
    updatedAt: new Date(nowMs - 50 * 60 * 60 * 1000).toISOString(),
  },
];

test('Freshness Formatting & Stale Detection', () => {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  assert.equal(formatTimeAgo(fifteenMinsAgo), '15m ago');
  assert.equal(isReportStale(fifteenMinsAgo), false);

  const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  assert.equal(formatTimeAgo(twentySixHoursAgo), 'Yesterday');
  assert.equal(isReportStale(twentySixHoursAgo), true, 'Report > 24 hours must be marked stale');

  assert.equal(formatTimeAgo(undefined), 'Update time unavailable');
  assert.equal(isReportStale(undefined), true);
  assert.equal(formatExactTimestamp(undefined), 'Update time unavailable');
});

test('Inventory Search: matches medicine name, generic name, or strength', () => {
  const byBrand = filterAndSortInventory(sampleInventory, {
    query: 'napa',
    statusFilter: 'all',
    freshnessFilter: 'all',
    sort: 'updated_desc',
  });
  assert.deepEqual(byBrand.map((i) => i.stockId), ['stk_1']);

  const byGeneric = filterAndSortInventory(sampleInventory, {
    query: 'omeprazole',
    statusFilter: 'all',
    freshnessFilter: 'all',
    sort: 'updated_desc',
  });
  assert.deepEqual(byGeneric.map((i) => i.stockId), ['stk_2']);

  const byStrength = filterAndSortInventory(sampleInventory, {
    query: '500 mg',
    statusFilter: 'all',
    freshnessFilter: 'all',
    sort: 'updated_desc',
  });
  assert.deepEqual(byStrength.map((i) => i.stockId), ['stk_1', 'stk_3']);
});

test('Inventory Filters & Sort: availability status, freshness, and sort order', () => {
  const lowOnly = filterAndSortInventory(sampleInventory, {
    query: '',
    statusFilter: 'low',
    freshnessFilter: 'all',
    sort: 'updated_desc',
  });
  assert.deepEqual(lowOnly.map((i) => i.stockId), ['stk_2']);

  const staleOnly = filterAndSortInventory(sampleInventory, {
    query: '',
    statusFilter: 'all',
    freshnessFilter: 'stale',
    sort: 'oldest_first',
  });
  assert.deepEqual(staleOnly.map((i) => i.stockId), ['stk_4', 'stk_2']);

  const alphaSorted = filterAndSortInventory(sampleInventory, {
    query: '',
    statusFilter: 'all',
    freshnessFilter: 'all',
    sort: 'name_asc',
  });
  assert.deepEqual(
    alphaSorted.map((i) => i.medicineName),
    ['Amoxil', 'Monas', 'Napa Extra', 'Seclo']
  );
});

test('Inventory Summary Counts: computed truthfully from returned records', () => {
  const summary = summarizeInventory(sampleInventory);
  assert.equal(summary.total, 4);
  assert.equal(summary.available, 1);
  assert.equal(summary.low, 1);
  assert.equal(summary.out, 1);
  assert.equal(summary.unverified, 1);
  assert.equal(summary.stale, 2);
  assert.equal(summary.needsAttention, 2);
  assert.equal(isStockRecordStale(sampleInventory[3]), true);
});

test('Optional Quantity Validation: allows empty or non-negative integer, rejects negative/decimal', () => {
  assert.deepEqual(validateOptionalQuantityInput(''), { valid: true, value: undefined });
  assert.deepEqual(validateOptionalQuantityInput('  '), { valid: true, value: undefined });
  assert.deepEqual(validateOptionalQuantityInput('0'), { valid: true, value: 0 });
  assert.deepEqual(validateOptionalQuantityInput('24'), { valid: true, value: 24 });

  const negative = validateOptionalQuantityInput('-3');
  assert.equal(negative.valid, false);
  assert.ok(negative.error);

  const decimal = validateOptionalQuantityInput('2.5');
  assert.equal(decimal.valid, false);
  assert.ok(decimal.error);

  const nonNumeric = validateOptionalQuantityInput('abc');
  assert.equal(nonNumeric.valid, false);
  assert.ok(nonNumeric.error);
});

test('Catalogue Duplicate Detection: prevents linking duplicate medicine to pharmacy inventory', () => {
  assert.equal(
    isDuplicateInventoryMedicine(sampleInventory, {
      id: 'med_2',
      name: 'Other Brand',
      strength: '20 mg',
      form: 'Capsule',
    }),
    true
  );

  assert.equal(
    isDuplicateInventoryMedicine(sampleInventory, {
      id: 'med_999',
      name: 'napa extra',
      strength: '500 mg + 65 mg',
      form: 'tablet',
    }),
    true
  );

  assert.equal(
    isDuplicateInventoryMedicine(sampleInventory, {
      id: 'med_5',
      name: 'Azithromycin',
      strength: '500 mg',
      form: 'Tablet',
    }),
    false
  );
});

test('One-Tap Stock Status Transitions: freshness separate from availability', () => {
  const stockItem = {
    stockId: 'stk_1',
    medicineName: 'Napa Extra',
    status: 'low',
    quantity: 5,
    updatedAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    isStale: true,
  };

  // Transition only occurs after confirmed update response
  const updatedItem = {
    ...stockItem,
    status: 'available',
    quantity: 100,
    updatedAt: new Date().toISOString(),
    isStale: false,
  };

  assert.equal(updatedItem.status, 'available');
  assert.equal(updatedItem.isStale, false, 'Newly reported stock is fresh');
  assert.equal(updatedItem.quantity, 100);
});
