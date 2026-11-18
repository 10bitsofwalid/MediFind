// frontend/tests/stockAndComponents.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortInventory,
  formatExactTimestamp,
  formatTimeAgo,
  getZeroQuantityFeedback,
  isDuplicateInventoryMedicine,
  isReportStale,
  isStockRecordStale,
  mergeServerStockRecord,
  normalizeStockStatus,
  summarizeInventory,
  validateOptionalQuantityInput,
} from '../src/features/pharmacy/inventoryUtils.ts';

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

test('normalizeStockStatus handles API enum and display label variants without guessing', () => {
  assert.equal(normalizeStockStatus('AVAILABLE'), 'available');
  assert.equal(normalizeStockStatus('low'), 'low');
  assert.equal(normalizeStockStatus('OUT_OF_STOCK'), 'out');
  assert.equal(normalizeStockStatus('Out of Stock'), 'out');
  assert.equal(normalizeStockStatus('UNVERIFIED'), 'unverified');
  assert.equal(normalizeStockStatus('unknown_status'), null);
});

test('Freshness rules treat staleness separately from reported availability status', () => {
  const recentIso = new Date(Date.now() - 2 * 3600000).toISOString();
  const oldIso = new Date(Date.now() - 30 * 3600000).toISOString();

  assert.equal(isReportStale(recentIso), false);
  assert.equal(isReportStale(oldIso), true);
  assert.equal(formatTimeAgo(recentIso), '2h ago');

  // Available item marked stale by server remains Available + Stale
  assert.equal(
    isStockRecordStale({ updatedAt: recentIso, freshness: 'stale' }),
    true
  );
  assert.equal(
    isStockRecordStale({ updatedAt: oldIso, isStale: false }),
    false,
    'Explicit server isStale:false is respected'
  );
});

test('mergeServerStockRecord preserves catalogue metadata across partial PATCH responses', () => {
  const recentUpdatedAt = new Date().toISOString();
  const existing = {
    stockId: 'stk_101',
    pharmacyId: 'pharm_1',
    medicineName: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500mg + 65mg',
    form: 'Tablet',
    status: 'available',
    quantity: 18,
    updatedAt: '2026-04-01T10:00:00.000Z',
    isStale: true,
    freshness: 'stale',
  };

  const serverPatch = {
    stockId: 'stk_101',
    status: 'low',
    quantity: 4,
    updatedAt: recentUpdatedAt,
  };

  const merged = mergeServerStockRecord(existing, serverPatch);
  assert.equal(merged.medicineName, 'Napa Extra');
  assert.equal(merged.genericName, 'Paracetamol + Caffeine');
  assert.equal(merged.strength, '500mg + 65mg');
  assert.equal(merged.status, 'low');
  assert.equal(merged.quantity, 4);
  assert.equal(merged.updatedAt, recentUpdatedAt);
  // Clears prior isStale/freshness instead of fabricating them when omitted by PATCH
  assert.equal(merged.isStale, undefined);
  assert.equal(merged.freshness, undefined);
  assert.equal(isStockRecordStale(merged), false);
});

test('getZeroQuantityFeedback reflects server-returned status without inventing normalization', () => {
  // Quantity > 0 or missing does not produce zero-quantity feedback
  assert.equal(getZeroQuantityFeedback('available', 5), null);
  assert.equal(getZeroQuantityFeedback('out', undefined), null);

  // Server returned "out" after client requested "available" with 0 units
  const normalized = getZeroQuantityFeedback('out', 0, 'available');
  assert.ok(normalized);
  assert.equal(normalized.wasStatusNormalized, true);
  assert.match(normalized.explanation, /Out of Stock/i);

  // Server accepted "available" with 0 units — UI still displays server-returned status cleanly
  const preserved = getZeroQuantityFeedback('available', 0, 'available');
  assert.ok(preserved);
  assert.equal(preserved.wasStatusNormalized, false);
  assert.match(preserved.explanation, /Available/i);
});
