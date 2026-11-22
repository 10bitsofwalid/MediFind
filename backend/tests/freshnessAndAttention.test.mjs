// backend/tests/freshnessAndAttention.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import server from '../dist/server.js';
import { createTestClient } from './testClient.mjs';
import {
  clearInMemoryPharmacyStore,
  seedPharmacy,
} from '../dist/services/pharmacyService.js';
import {
  clearInMemoryStockStore,
  seedStockItem,
  seedMedicine,
} from '../dist/services/stockService.js';
import {
  calculateFreshness,
  isReportStale,
  DEFAULT_STALE_THRESHOLD_HOURS,
} from '../dist/utils/freshness.js';
import {
  getStaleThresholdHours,
  setStaleThresholdHours,
  setTestStaleThreshold,
  getQualityThresholds,
  setQualityThresholds,
  resetSystemSettingsStore,
} from '../dist/services/systemSettingService.js';
import {
  syntheticVerifiedPharmacy,
  syntheticPendingApplication,
  syntheticMedicines,
} from '../dist/fixtures/syntheticFixtures.js';

const app = server.default || server;
const request = createTestClient(app);

function authHeader(userId = '673e1a0b1234567890111111', role = 'PHARMACY') {
  return {
    Authorization: `Bearer local_session_${userId}`,
    'x-test-role': role,
  };
}

// ============================================================================
// 1. Freshness Calculations — Controlled Clock, UTC, Just Below, At, and Above
// ============================================================================

test('Freshness: default 24-hour behavior when no threshold is configured', async () => {
  resetSystemSettingsStore();
  const threshold = await getStaleThresholdHours();
  assert.equal(threshold, 24);
  assert.equal(DEFAULT_STALE_THRESHOLD_HOURS, 24);

  // Controlled reference time: 2026-11-22T12:00:00.000Z
  const fixedNow = new Date('2026-11-22T12:00:00.000Z');

  // Just below 24 hours: 23 hours 50 minutes ago -> fresh
  const justBelow = new Date(fixedNow.getTime() - 23.83 * 60 * 60 * 1000);
  const resultBelow = calculateFreshness(justBelow.toISOString(), undefined, fixedNow);
  assert.equal(resultBelow.isStale, false);
  assert.equal(resultBelow.freshness, 'fresh');
  assert.equal(resultBelow.thresholdHours, 24);

  // Exactly at 24 hours ago -> stale
  const exactlyAt = new Date(fixedNow.getTime() - 24 * 60 * 60 * 1000);
  const resultAt = calculateFreshness(exactlyAt.toISOString(), undefined, fixedNow);
  assert.equal(resultAt.isStale, true);
  assert.equal(resultAt.freshness, 'stale');

  // Just above 24 hours: 24 hours 10 minutes ago -> stale
  const justAbove = new Date(fixedNow.getTime() - 24.17 * 60 * 60 * 1000);
  const resultAbove = calculateFreshness(justAbove.toISOString(), undefined, fixedNow);
  assert.equal(resultAbove.isStale, true);
  assert.equal(resultAbove.freshness, 'stale');
});

test('Freshness: dynamically configured threshold (12 hours) just below, at, and above', async () => {
  resetSystemSettingsStore();
  setTestStaleThreshold(12);

  const fixedNow = new Date('2026-11-22T12:00:00.000Z');

  // 11.9 hours ago -> fresh
  const justBelow12 = new Date(fixedNow.getTime() - 11.9 * 60 * 60 * 1000);
  const resBelow = calculateFreshness(justBelow12, 12, fixedNow);
  assert.equal(resBelow.isStale, false);
  assert.equal(resBelow.freshness, 'fresh');

  // Exactly 12.0 hours ago -> stale
  const exactly12 = new Date(fixedNow.getTime() - 12.0 * 60 * 60 * 1000);
  const resAt = calculateFreshness(exactly12, 12, fixedNow);
  assert.equal(resAt.isStale, true);
  assert.equal(resAt.freshness, 'stale');

  // 12.1 hours ago -> stale
  const justAbove12 = new Date(fixedNow.getTime() - 12.1 * 60 * 60 * 1000);
  const resAbove = calculateFreshness(justAbove12, 12, fixedNow);
  assert.equal(resAbove.isStale, true);
  assert.equal(resAbove.freshness, 'stale');

  setTestStaleThreshold(null); // clear
});

test('Freshness: invalid, empty, or missing timestamps safely report stale without throwing', () => {
  assert.equal(calculateFreshness(undefined).isStale, true);
  assert.equal(calculateFreshness('').isStale, true);
  assert.equal(calculateFreshness('invalid-timestamp-string').isStale, true);
  assert.equal(isReportStale(null), true);
});

// ============================================================================
// 2. Freshness Independent of Stock Status
// ============================================================================

test('Freshness: stale stock maintains its reported status (available, low, out) and never sets unverified', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  resetSystemSettingsStore();

  const ownerId = 'test_owner_status_isolation';
  const pharmacyId = 'test_pharma_status_isolation';

  await seedPharmacy({
    _id: pharmacyId,
    ownerId,
    status: 'verified',
    name: 'Test Verified Pharmacy',
  });

  // Seed 4 records:
  // 1. Available but stale (30 hours ago)
  // 2. Low but stale (36 hours ago)
  // 3. Out of stock but stale (48 hours ago)
  // 4. Unverified but fresh (2 hours ago)
  const now = Date.now();
  await seedStockItem({
    stockId: 'stk_stale_available',
    pharmacyId,
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 50,
    updatedAt: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
  });
  await seedStockItem({
    stockId: 'stk_stale_low',
    pharmacyId,
    medicineId: 'med_omeprazole_20',
    status: 'low',
    quantity: 4,
    updatedAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
  });
  await seedStockItem({
    stockId: 'stk_stale_out',
    pharmacyId,
    medicineId: 'med_amoxicillin_500',
    status: 'out',
    quantity: 0,
    updatedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
  });
  await seedStockItem({
    stockId: 'stk_fresh_unverified',
    pharmacyId,
    medicineId: 'med_azithromycin_500',
    status: 'unverified',
    quantity: 15,
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  });

  // Fetch inventory
  const res = await request
    .get('/api/owner/inventory')
    .set(authHeader(ownerId));

  assert.equal(res.status, 200);
  const items = res.body.data;
  assert.equal(items.length, 4);

  const staleAvail = items.find((i) => i.stockId === 'stk_stale_available');
  assert.ok(staleAvail);
  assert.equal(staleAvail.status, 'available'); // Status preserved!
  assert.equal(staleAvail.isStale, true);
  assert.equal(staleAvail.freshness, 'stale');

  const staleLow = items.find((i) => i.stockId === 'stk_stale_low');
  assert.ok(staleLow);
  assert.equal(staleLow.status, 'low'); // Status preserved!
  assert.equal(staleLow.isStale, true);
  assert.equal(staleLow.freshness, 'stale');

  const staleOut = items.find((i) => i.stockId === 'stk_stale_out');
  assert.ok(staleOut);
  assert.equal(staleOut.status, 'out'); // Status preserved!
  assert.equal(staleOut.isStale, true);
  assert.equal(staleOut.freshness, 'stale');

  const freshUnverified = items.find((i) => i.stockId === 'stk_fresh_unverified');
  assert.ok(freshUnverified);
  assert.equal(freshUnverified.status, 'unverified');
  assert.equal(freshUnverified.isStale, false);
  assert.equal(freshUnverified.freshness, 'fresh');
});

// ============================================================================
// 3. Attention Query (GET /owner/inventory?attention=true)
// ============================================================================

test('Attention query: GET /owner/inventory?attention=true filters for unverified and stale items, sorted unverified first', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerId = 'test_owner_attention_isolation';
  const pharmacyId = 'test_pharma_attention_isolation';

  await seedPharmacy({
    _id: pharmacyId,
    ownerId,
    status: 'verified',
    name: 'Attention Query Pharmacy',
  });

  const now = Date.now();
  // Fresh Available (should NOT appear in attention query)
  await seedStockItem({
    stockId: 'stk_fresh_ok',
    pharmacyId,
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
    updatedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
  });

  // Stale Available (30 hours old) -> Attention Item
  await seedStockItem({
    stockId: 'stk_stale_30h',
    pharmacyId,
    medicineId: 'med_omeprazole_20',
    status: 'available',
    quantity: 20,
    updatedAt: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
  });

  // Stale Low (50 hours old) -> Attention Item (older)
  await seedStockItem({
    stockId: 'stk_stale_50h',
    pharmacyId,
    medicineId: 'med_amoxicillin_500',
    status: 'low',
    quantity: 5,
    updatedAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
  });

  // Unverified Item (fresh 3 hours old) -> Attention Item (prioritized first)
  await seedStockItem({
    stockId: 'stk_unverified_item',
    pharmacyId,
    medicineId: 'med_azithromycin_500',
    status: 'unverified',
    quantity: 10,
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  });

  const res = await request
    .get('/api/owner/inventory?attention=true')
    .set(authHeader(ownerId));

  assert.equal(res.status, 200);
  const items = res.body.data;

  // Exactly 3 attention items (stk_fresh_ok excluded)
  assert.equal(items.length, 3);
  assert.ok(!items.some((i) => i.stockId === 'stk_fresh_ok'));

  // Priority order: Unverified items first
  assert.equal(items[0].stockId, 'stk_unverified_item');
  assert.equal(items[0].status, 'unverified');

  // Then oldest stale reports first (50h before 30h)
  assert.equal(items[1].stockId, 'stk_stale_50h');
  assert.equal(items[2].stockId, 'stk_stale_30h');
});

// ============================================================================
// 4. Operational Summary (GET /owner/summary)
// ============================================================================

test('GET /owner/summary — Derived strictly from authenticated owner persisted inventory with no fabricated scores', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerId = 'test_owner_summary_isolation';
  const pharmacyId = 'test_pharma_summary_isolation';

  await seedPharmacy({
    _id: pharmacyId,
    ownerId,
    status: 'verified',
    name: 'Summary Test Pharmacy',
  });

  const now = Date.now();
  // 1. Fresh available
  await seedStockItem({
    stockId: 'sum_fresh_avail',
    pharmacyId,
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 80,
    updatedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
  });
  // 2. Fresh low
  await seedStockItem({
    stockId: 'sum_fresh_low',
    pharmacyId,
    medicineId: 'med_omeprazole_20',
    status: 'low',
    quantity: 6,
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  });
  // 3. Stale available (28h old)
  await seedStockItem({
    stockId: 'sum_stale_avail',
    pharmacyId,
    medicineId: 'med_amoxicillin_500',
    status: 'available',
    quantity: 40,
    updatedAt: new Date(now - 28 * 60 * 60 * 1000).toISOString(),
  });
  // 4. Stale out (40h old)
  await seedStockItem({
    stockId: 'sum_stale_out',
    pharmacyId,
    medicineId: 'med_azithromycin_500',
    status: 'out',
    quantity: 0,
    updatedAt: new Date(now - 40 * 60 * 60 * 1000).toISOString(),
  });
  // 5. Unverified (5h old)
  await seedStockItem({
    stockId: 'sum_unverified',
    pharmacyId,
    medicineId: 'med_metformin_500',
    status: 'unverified',
    quantity: 15,
    updatedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
  });

  // Call GET /owner/summary
  const res = await request
    .get('/api/owner/summary')
    .set(authHeader(ownerId));

  assert.equal(res.status, 200);
  const summary = res.body.data;

  // Verify exact derived counts
  assert.equal(summary.totalInventory, 5);
  assert.equal(summary.availableCount, 2); // sum_fresh_avail + sum_stale_avail
  assert.equal(summary.lowCount, 1);       // sum_fresh_low
  assert.equal(summary.outCount, 1);       // sum_stale_out
  assert.equal(summary.staleCount, 2);     // sum_stale_avail + sum_stale_out
  assert.equal(summary.unverifiedCount, 1);// sum_unverified

  // Verify attentionItems list inside summary
  assert.equal(summary.attentionItems.length, 3);
  // Unverified first
  assert.equal(summary.attentionItems[0].stockId, 'sum_unverified');
  // Then oldest stale
  assert.equal(summary.attentionItems[1].stockId, 'sum_stale_out');
  assert.equal(summary.attentionItems[2].stockId, 'sum_stale_avail');

  // Verify NO fabricated reliability scores or percentages exist
  assert.equal(summary.reliabilityScore, undefined);
  assert.equal(summary.complianceScore, undefined);
  assert.equal(summary.freshnessPercentage, undefined);
});

// ============================================================================
// 5. Owner Scoping & Cross-Tenant Privacy
// ============================================================================

test('GET /owner/summary — Cross-tenant isolation: owner B cannot see owner A summary or items', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerA = 'owner_A_111111';
  const pharmaA = 'pharma_A_111111';
  const ownerB = 'owner_B_222222';
  const pharmaB = 'pharma_B_222222';

  await seedPharmacy({
    _id: pharmaA,
    ownerId: ownerA,
    status: 'verified',
    name: 'Pharmacy A',
  });
  await seedPharmacy({
    _id: pharmaB,
    ownerId: ownerB,
    status: 'verified',
    name: 'Pharmacy B',
  });

  // Seed 3 items for Pharmacy A
  await seedStockItem({
    stockId: 'stk_A1',
    pharmacyId: pharmaA,
    medicineId: 'med_paracetamol_500',
    status: 'available',
  });
  await seedStockItem({
    stockId: 'stk_A2',
    pharmacyId: pharmaA,
    medicineId: 'med_omeprazole_20',
    status: 'low',
  });
  await seedStockItem({
    stockId: 'stk_A3',
    pharmacyId: pharmaA,
    medicineId: 'med_amoxicillin_500',
    status: 'out',
  });

  // Seed 1 item for Pharmacy B
  await seedStockItem({
    stockId: 'stk_B1',
    pharmacyId: pharmaB,
    medicineId: 'med_azithromycin_500',
    status: 'available',
  });

  // Query as Owner A
  const resA = await request.get('/api/owner/summary').set(authHeader(ownerA));
  assert.equal(resA.status, 200);
  assert.equal(resA.body.data.totalInventory, 3);
  assert.ok(resA.body.data.attentionItems.every((i) => i.pharmacyId === pharmaA));

  // Query as Owner B
  const resB = await request.get('/api/owner/summary').set(authHeader(ownerB));
  assert.equal(resB.status, 200);
  assert.equal(resB.body.data.totalInventory, 1);
  assert.ok(resB.body.data.attentionItems.every((i) => i.pharmacyId === pharmaB));

  // Client-supplied pharmacy ID query parameter must be ignored (server resolves strictly from JWT)
  const resIgnored = await request
    .get(`/api/owner/summary?pharmacyId=${pharmaA}`)
    .set(authHeader(ownerB));
  assert.equal(resIgnored.status, 200);
  assert.equal(resIgnored.body.data.totalInventory, 1); // Still Owner B's 1 item!
});

// ============================================================================
// 6. Customer-Facing Availability Exposes Stock Status and Freshness Separately
// ============================================================================

test('Customer availability: GET /pharmacies/nearby and /availability/search expose status and freshness separately', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const pharmaId = '673e1a0b1234567890fedcba';
  const ownerId = '673e1a0b1234567890111111';

  await seedPharmacy({
    _id: pharmaId,
    ownerId,
    status: 'verified',
    name: 'Customer Discovery Pharmacy',
    latitude: 23.7465,
    longitude: 90.3760,
  });

  const now = Date.now();
  // 1. Available but stale stock (30 hours old)
  await seedStockItem({
    stockId: 'stk_cust_stale',
    pharmacyId: pharmaId,
    medicineId: 'med_paracetamol_500',
    medicineName: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500 mg + 65 mg',
    form: 'Tablet',
    status: 'available',
    quantity: 45,
    updatedAt: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
  });

  // Call GET /pharmacies/nearby
  const resNearby = await request
    .get('/api/pharmacies/nearby')
    .set({}); // Public unauthenticated

  assert.equal(resNearby.status, 200);
  const results = resNearby.body.results;
  assert.ok(Array.isArray(results));
  const found = results.find((r) => r.id === 'stk_cust_stale');
  assert.ok(found);

  // CRITICAL: Stock status and Freshness are distinct fields!
  assert.equal(found.stockStatus, 'available'); // Reported status is available
  assert.equal(found.isStale, true);           // Freshness indicates stale
  assert.equal(found.freshness, 'stale');      // Freshness badge value
  assert.equal(found.isVerified, true);        // Verified pharmacy flag

  // Also call GET /availability/search
  const resSearch = await request
    .get('/api/availability/search?q=Napa')
    .set({});
  assert.equal(resSearch.status, 200);
  assert.ok(Array.isArray(resSearch.body.results));
  const searchFound = resSearch.body.results.find((r) => r.id === 'stk_cust_stale');
  assert.ok(searchFound);
  assert.equal(searchFound.stockStatus, 'available');
  assert.equal(searchFound.isStale, true);
  assert.equal(searchFound.freshness, 'stale');
});

test('Customer availability: Unverified/pending pharmacies are strictly excluded from public search', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const pendingPharmaId = 'pharma_pending_999';
  await seedPharmacy({
    _id: pendingPharmaId,
    ownerId: 'owner_pending_999',
    status: 'pending', // NOT verified!
    name: 'Pending Unapproved Pharmacy',
    latitude: 23.7465,
    longitude: 90.3760,
  });

  await seedStockItem({
    stockId: 'stk_pending_item',
    pharmacyId: pendingPharmaId,
    medicineId: 'med_paracetamol_500',
    status: 'available',
  });

  const res = await request.get('/api/pharmacies/nearby');
  assert.equal(res.status, 200);
  assert.ok(!res.body.results.some((r) => r.pharmacyId === pendingPharmaId));
});

// ============================================================================
// 7. Reconfirmation Consistency with Developer 3 Rules
// ============================================================================

test('Reconfirm: restores unverified stock to available, bumps timestamp, clears staleness, and records audit', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerId = '673e1a0b1234567890111111';
  const pharmacyId = '673e1a0b1234567890fedcba';

  await seedPharmacy({
    _id: pharmacyId,
    ownerId,
    status: 'verified',
    name: 'Reconfirm Pharmacy',
  });

  const now = Date.now();
  // Unverified stock item older than 24 hours
  await seedStockItem({
    stockId: 'stk_reconfirm_target',
    pharmacyId,
    medicineId: 'med_metformin_500',
    status: 'unverified',
    quantity: 12,
    updatedAt: new Date(now - 35 * 60 * 60 * 1000).toISOString(),
  });

  // Execute reconfirm without status payload -> defaults to available
  const res = await request
    .post('/api/owner/inventory/stk_reconfirm_target/reconfirm')
    .set(authHeader(ownerId))
    .send({});

  assert.equal(res.status, 200);
  const update = res.body.data;

  // Unverified restored to available
  assert.equal(update.status, 'available');
  // Freshness cleared
  assert.equal(update.isStale, false);
  assert.equal(update.freshness, 'fresh');
  // Updated timestamp is now fresh (within 5 seconds)
  const diff = Date.now() - new Date(update.updatedAt).getTime();
  assert.ok(diff < 5000);

  // Check history modal endpoint has new record with oldStatus: 'unverified', newStatus: 'available'
  const histRes = await request
    .get('/api/owner/inventory/stk_reconfirm_target/history')
    .set(authHeader(ownerId));
  assert.equal(histRes.status, 200);
  assert.ok(histRes.body.data.length > 0);
  const latest = histRes.body.data[0];
  assert.equal(latest.oldStatus, 'unverified');
  assert.equal(latest.newStatus, 'available');
});

// ============================================================================
// 8. Admin Quality Thresholds Configuration (Developer 3 Agreement)
// ============================================================================

test('Admin settings: GET and PATCH /admin/settings/quality-thresholds updates system configuration', async () => {
  resetSystemSettingsStore();

  // Read initial default
  const resGet = await request.get('/api/admin/settings/quality-thresholds');
  assert.equal(resGet.status, 200);
  assert.equal(resGet.body.data.staleThresholdHours, 24);
  assert.equal(resGet.body.data.unverifiedReportThreshold, 3);

  // Update threshold to 48 hours
  const resPatch = await request
    .patch('/api/admin/settings/quality-thresholds')
    .send({ staleThresholdHours: 48, unverifiedReportThreshold: 5 });
  assert.equal(resPatch.status, 200);
  assert.equal(resPatch.body.data.staleThresholdHours, 48);
  assert.equal(resPatch.body.data.unverifiedReportThreshold, 5);

  // Verify freshness calculation now uses 48h:
  // Item updated 30h ago was stale under 24h, but is fresh under 48h
  const now = Date.now();
  const item30h = new Date(now - 30 * 60 * 60 * 1000).toISOString();
  assert.equal(calculateFreshness(item30h, 48).isStale, false);

  resetSystemSettingsStore();
});
