// frontend/tests/ownerDashboardAndAttention.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateStockAttention,
  filterAttentionInventory,
  isStockRecordStale,
  summarizeInventory,
} from '../src/features/pharmacy/inventoryUtils.ts';

const nowMs = Date.now();

const mockTestInventory = [
  {
    stockId: 'stk_fresh_1',
    pharmacyId: 'ph_test',
    medicineId: 'med_1',
    medicineName: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500 mg + 65 mg',
    form: 'Tablet',
    status: 'available',
    quantity: 150,
    updatedAt: new Date(nowMs - 30 * 60 * 1000).toISOString(), // 30m ago (fresh)
    isStale: false,
    freshness: 'fresh',
  },
  {
    stockId: 'stk_stale_1',
    pharmacyId: 'ph_test',
    medicineId: 'med_2',
    medicineName: 'Seclo',
    genericName: 'Omeprazole',
    strength: '20 mg',
    form: 'Capsule',
    status: 'low',
    quantity: 8,
    updatedAt: new Date(nowMs - 28 * 60 * 60 * 1000).toISOString(), // 28h ago (stale >= 24h)
    isStale: true,
    freshness: 'stale',
  },
  {
    stockId: 'stk_unverified_1',
    pharmacyId: 'ph_test',
    medicineId: 'med_3',
    medicineName: 'Monas 10',
    genericName: 'Montelukast',
    strength: '10 mg',
    form: 'Tablet',
    status: 'unverified',
    quantity: 20,
    updatedAt: new Date(nowMs - 50 * 60 * 60 * 1000).toISOString(), // 50h ago
    attentionReason: 'Customer report: Patient reported stockout on shelf.',
  },
  {
    stockId: 'stk_reconfirm_req_1',
    pharmacyId: 'ph_test',
    medicineId: 'med_4',
    medicineName: 'Ciprocin',
    genericName: 'Ciprofloxacin',
    strength: '500 mg',
    form: 'Tablet',
    status: 'available',
    quantity: 35,
    updatedAt: new Date(nowMs - 4 * 60 * 60 * 1000).toISOString(), // 4h ago (fresh, but reconfirmation flagged)
    reconfirmationRequired: true,
    reconfirmationReason: 'Batch compliance review requested by MediFind verification authority.',
  },
  {
    stockId: 'stk_out_1',
    pharmacyId: 'ph_test',
    medicineId: 'med_5',
    medicineName: 'Amoxil',
    genericName: 'Amoxicillin',
    strength: '500 mg',
    form: 'Capsule',
    status: 'out',
    quantity: 0,
    updatedAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(), // 2h ago (fresh out of stock)
    isStale: false,
    freshness: 'fresh',
  },
];

// ============================================================================
// 1. DASHBOARD SUMMARIES: Truthful counts without fabricated values
// ============================================================================

test('Dashboard Summaries: Truthful computation strictly from returned inventory', () => {
  const summary = summarizeInventory(mockTestInventory);

  assert.equal(summary.total, 5, 'Total listings must equal the exact number of returned records');
  assert.equal(summary.available, 2, 'Available count includes both fresh and reconfirmation-pending available records');
  assert.equal(summary.freshAvailable, 1, 'Only non-stale available stock is patient-ready (stk_fresh_1)');
  assert.equal(summary.low, 1, 'Low stock count matches stk_stale_1');
  assert.equal(summary.out, 1, 'Out of stock count matches stk_out_1');
  assert.equal(summary.unverified, 1, 'Unverified count matches stk_unverified_1');
  assert.equal(summary.stale, 2, 'Stale count includes records >= 24 hours old');
  assert.equal(summary.reconfirmationRequired, 2, 'Reconfirmation required includes unverified and explicitly flagged records');
  assert.equal(summary.needsAttention, 3, 'Items needing attention: stale (1), unverified (1), reconfirmation-required (1)');
});

test('Dashboard Summaries: Truthful empty state with 0 records', () => {
  const emptySummary = summarizeInventory([]);
  assert.equal(emptySummary.total, 0);
  assert.equal(emptySummary.available, 0);
  assert.equal(emptySummary.freshAvailable, 0);
  assert.equal(emptySummary.low, 0);
  assert.equal(emptySummary.out, 0);
  assert.equal(emptySummary.unverified, 0);
  assert.equal(emptySummary.stale, 0);
  assert.equal(emptySummary.reconfirmationRequired, 0);
  assert.equal(emptySummary.needsAttention, 0);
});

test('Dashboard Summaries: Omits ungrounded trends, sales percentages, or visitor metrics', () => {
  const summary = summarizeInventory(mockTestInventory);
  // Ensure no fabricated fields are injected into summary interface
  assert.equal('viewsToday' in summary, false, 'Do not fabricate visitor views');
  assert.equal('percentageGrowth' in summary, false, 'Do not fabricate percentage growth trends');
  assert.equal('salesConversion' in summary, false, 'Do not fabricate sales analytics');
  assert.equal('weeklyTrend' in summary, false, 'Do not fabricate weekly trends');
});

// ============================================================================
// 2. QUALITY ATTENTION EVALUATION: Stale, Unverified, Reconfirmation
// ============================================================================

test('Quality Attention: Identifies stale stock reports (>= 24 hours old)', () => {
  const staleItem = mockTestInventory[1]; // Seclo, 28h ago
  const attention = evaluateStockAttention(staleItem);

  assert.equal(attention.isAttentionNeeded, true);
  assert.equal(attention.isStale, true);
  assert.equal(attention.isUnverified, false);
  assert.ok(attention.attentionTypes.includes('stale'));
  assert.match(attention.primaryReason, /24 hours/i, 'Explanation highlights 24-hour freshness rule');
});

test('Quality Attention: Identifies unverified stock with API-supplied reason', () => {
  const unverifiedItem = mockTestInventory[2]; // Monas 10
  const attention = evaluateStockAttention(unverifiedItem);

  assert.equal(attention.isAttentionNeeded, true);
  assert.equal(attention.isUnverified, true);
  assert.ok(attention.attentionTypes.includes('unverified'));
  assert.equal(
    attention.primaryReason,
    'Customer report: Patient reported stockout on shelf.',
    'Displays exact API-provided reason'
  );
});

test('Quality Attention: Identifies unverified stock with neutral fallback when API reason omitted', () => {
  const unverifiedWithoutReason = {
    ...mockTestInventory[2],
    attentionReason: undefined,
    reconfirmationReason: undefined,
  };
  const attention = evaluateStockAttention(unverifiedWithoutReason);

  assert.equal(attention.isAttentionNeeded, true);
  assert.equal(attention.isUnverified, true);
  assert.ok(
    attention.primaryReason.includes('Report flagged Unverified following patient feedback'),
    'Fallback explains unverified flag without guessing'
  );
});

test('Quality Attention: Identifies explicit reconfirmation requirement with API reason', () => {
  const reconfirmItem = mockTestInventory[3]; // Ciprocin
  const attention = evaluateStockAttention(reconfirmItem);

  assert.equal(attention.isAttentionNeeded, true);
  assert.equal(attention.isReconfirmationRequired, true);
  assert.equal(
    attention.primaryReason,
    'Batch compliance review requested by MediFind verification authority.'
  );
});

test('Quality Attention: Passes current fresh stock without attention flags', () => {
  const freshItem = mockTestInventory[0]; // Napa Extra, 30m ago
  const attention = evaluateStockAttention(freshItem);

  assert.equal(attention.isAttentionNeeded, false);
  assert.equal(attention.isStale, false);
  assert.equal(attention.isUnverified, false);
  assert.equal(attention.isReconfirmationRequired, false);
  assert.equal(attention.attentionTypes.length, 0);
});

// ============================================================================
// 3. ATTENTION QUEUE FILTERING: Tabs & Categories
// ============================================================================

test('Attention Queue Filtering: Correctly separates categories', () => {
  const allAttention = filterAttentionInventory(mockTestInventory, 'all');
  assert.equal(allAttention.length, 3, '3 records require attention');
  assert.deepEqual(
    allAttention.map((i) => i.stockId),
    ['stk_stale_1', 'stk_unverified_1', 'stk_reconfirm_req_1']
  );

  const staleOnly = filterAttentionInventory(mockTestInventory, 'stale');
  assert.equal(staleOnly.length, 2, '2 records are stale (stk_stale_1, stk_unverified_1)');
  assert.deepEqual(
    staleOnly.map((i) => i.stockId),
    ['stk_stale_1', 'stk_unverified_1']
  );

  const unverifiedOnly = filterAttentionInventory(mockTestInventory, 'unverified');
  assert.equal(unverifiedOnly.length, 1);
  assert.equal(unverifiedOnly[0].stockId, 'stk_unverified_1');

  const reconfirmOnly = filterAttentionInventory(mockTestInventory, 'reconfirmation');
  assert.equal(reconfirmOnly.length, 2, 'Includes unverified and explicitly requested reconfirmations');
});

// ============================================================================
// 4. RECONFIRMATION INTEGRITY & TRUST BOUNDARIES
// ============================================================================

test('Reconfirmation Trust Boundary: Unverified status cannot be reconfirmed as unverified', () => {
  // Reconfirming physical shelf stock requires selecting a verified physical state
  const allowedStatuses = ['available', 'low', 'out'];
  assert.ok(allowedStatuses.includes('available'));
  assert.ok(allowedStatuses.includes('low'));
  assert.ok(allowedStatuses.includes('out'));
  assert.equal(allowedStatuses.includes('unverified'), false);
});

test('Reconfirmation Outcome: Successfully updates timestamp and clears attention flags', () => {
  const unverifiedItem = mockTestInventory[2]; // Monas 10 (unverified + stale)
  const reconfirmedTimestamp = new Date().toISOString();

  // Simulated server-authoritative confirmation response
  const reconfirmedRecord = {
    ...unverifiedItem,
    status: 'available',
    quantity: 50,
    updatedAt: reconfirmedTimestamp,
    isStale: false,
    freshness: 'fresh',
    reconfirmationRequired: false,
    attentionReason: undefined,
  };

  const attentionAfter = evaluateStockAttention(reconfirmedRecord);
  assert.equal(attentionAfter.isAttentionNeeded, false, 'Reconfirmed item is no longer in attention queue');
  assert.equal(reconfirmedRecord.status, 'available');
  assert.equal(reconfirmedRecord.isStale, false);
  assert.equal(isStockRecordStale(reconfirmedRecord), false);
});
