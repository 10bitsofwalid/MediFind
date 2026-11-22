// backend/tests/stockOperations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import server from '../dist/server.js';
import { createTestClient } from './testClient.mjs';
import {
  clearInMemoryPharmacyStore,
  seedPharmacy,
} from '../dist/services/pharmacyService.js';
import {
  clearInMemoryStore as clearApplicationStore,
  submitApplication,
} from '../dist/services/pharmacyApplicationService.js';
import {
  clearInMemoryStockStore,
  seedStockItem,
  seedStockHistory,
} from '../dist/services/stockService.js';
import {
  syntheticVerifiedPharmacy,
  syntheticPharmacyApplicationPayload,
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
// 1. PATCH /owner/inventory/:stockId — Stock Updates
// ============================================================================

test('PATCH /owner/inventory/:stockId — Authentication, RBAC & Verification Gatekeeping', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  clearApplicationStore();

  const verifiedOwner = 'owner_patch_auth_test';
  const pharmacy = await seedPharmacy({
    ownerId: verifiedOwner,
    name: 'Verified Patch Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/PATCH-01',
  });
  const pharmacyId = String(pharmacy._id);

  const stockItem = await seedStockItem({
    pharmacyId,
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
    price: 3.5,
  });

  const validPayload = { status: 'low', quantity: 10 };

  // 1. Unauthenticated -> 401 UNAUTHORIZED
  const resNoAuth = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .send(validPayload);
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.error?.code, 'UNAUTHORIZED');

  // 2. Customer role -> 403 FORBIDDEN
  const resCustomer = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader('cust_123', 'CUSTOMER'))
    .send(validPayload);
  assert.equal(resCustomer.status, 403);
  assert.equal(resCustomer.body.error?.code, 'FORBIDDEN');

  // 3. Pending pharmacy status -> 403 PHARMACY_NOT_VERIFIED
  const pendingOwner = 'pending_owner_patch_lock';
  const pendingApp = await submitApplication(pendingOwner, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Pending Patch Chemist',
    licenseNo: 'DGDA/PATCH-PEND',
  });
  const pendingPharmacyId = String(pendingApp.pharmacyId);
  const pendingStock = await seedStockItem({
    pharmacyId: pendingPharmacyId,
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 50,
  });

  const resPending = await request
    .patch(`/api/owner/inventory/${pendingStock.stockId}`)
    .set(authHeader(pendingOwner))
    .send(validPayload);
  assert.equal(resPending.status, 403);
  assert.equal(resPending.body.error?.code, 'PHARMACY_NOT_VERIFIED');

  // 4. Suspended pharmacy status -> 403 PHARMACY_NOT_VERIFIED
  const suspendedOwner = 'suspended_owner_patch_lock';
  const suspendedPh = await seedPharmacy({
    ownerId: suspendedOwner,
    name: 'Suspended Chemist',
    status: 'suspended',
    licenseNo: 'DGDA/PATCH-SUSP',
  });
  const suspendedStock = await seedStockItem({
    pharmacyId: String(suspendedPh._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 30,
  });

  const resSuspended = await request
    .patch(`/api/owner/inventory/${suspendedStock.stockId}`)
    .set(authHeader(suspendedOwner))
    .send(validPayload);
  assert.equal(resSuspended.status, 403);
  assert.equal(resSuspended.body.error?.code, 'PHARMACY_NOT_VERIFIED');
});

test('PATCH /owner/inventory/:stockId — Single Item Ownership & Cross-Tenant Privacy', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerA = 'owner_patch_cross_A';
  const pharmacyA = await seedPharmacy({
    ownerId: ownerA,
    name: 'Pharmacy Patch A',
    status: 'verified',
    licenseNo: 'DGDA/PT-A',
  });

  const ownerB = 'owner_patch_cross_B';
  const pharmacyB = await seedPharmacy({
    ownerId: ownerB,
    name: 'Pharmacy Patch B',
    status: 'verified',
    licenseNo: 'DGDA/PT-B',
  });

  const itemA = await seedStockItem({
    pharmacyId: String(pharmacyA._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
  });

  // 1. Missing item returns 404 NOT_FOUND
  const resMissing = await request
    .patch('/api/owner/inventory/non_existent_stock_id')
    .set(authHeader(ownerA))
    .send({ status: 'low' });
  assert.equal(resMissing.status, 404);
  assert.equal(resMissing.body.error?.code, 'NOT_FOUND');

  // 2. Cross-tenant modification: Owner B attempting to modify itemA MUST return 404 NOT_FOUND
  // without revealing the existence of itemA under Pharmacy A
  const resCross = await request
    .patch(`/api/owner/inventory/${itemA.stockId}`)
    .set(authHeader(ownerB))
    .send({ status: 'low' });
  assert.equal(resCross.status, 404);
  assert.equal(resCross.body.error?.code, 'NOT_FOUND');
});

test('PATCH /owner/inventory/:stockId — Validation Rules & Schema Checks (HTTP 422)', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const owner = 'owner_patch_validation';
  const pharmacy = await seedPharmacy({
    ownerId: owner,
    name: 'Validation Tester Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/VAL-PATCH',
  });
  const stockItem = await seedStockItem({
    pharmacyId: String(pharmacy._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
    price: 4.0,
  });

  // 1. Owner attempts to set system-managed 'unverified' status -> 422 INVALID_STATUS
  const resUnverified = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ status: 'unverified' });
  assert.equal(resUnverified.status, 422);
  assert.equal(resUnverified.body.error?.code, 'INVALID_STATUS');
  assert.ok(resUnverified.body.error?.fields?.status);

  // 2. Invalid status enum string -> 422 INVALID_STATUS
  const resInvalidStatus = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ status: 'in_stock_now' });
  assert.equal(resInvalidStatus.status, 422);
  assert.equal(resInvalidStatus.body.error?.code, 'INVALID_STATUS');

  // 3. Negative quantity -> 422 VALIDATION_ERROR
  const resNegQty = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ quantity: -10 });
  assert.equal(resNegQty.status, 422);
  assert.ok(resNegQty.body.error?.fields?.quantity);

  // 4. Non-integer decimal quantity -> 422 VALIDATION_ERROR
  const resDecQty = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ quantity: 15.5 });
  assert.equal(resDecQty.status, 422);
  assert.ok(resDecQty.body.error?.fields?.quantity);

  // 5. Negative price -> 422 VALIDATION_ERROR
  const resNegPrice = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ price: -5.0 });
  assert.equal(resNegPrice.status, 422);
  assert.ok(resNegPrice.body.error?.fields?.price);

  // 6. Notes exceeding 500 characters -> 422 VALIDATION_ERROR
  const longNotes = 'A'.repeat(501);
  const resLongNotes = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ notes: longNotes });
  assert.equal(resLongNotes.status, 422);
  assert.ok(resLongNotes.body.error?.fields?.notes);
});

test('PATCH /owner/inventory/:stockId — Zero Quantity Normalization Rule', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const owner = 'owner_zero_qty_test';
  const pharmacy = await seedPharmacy({
    ownerId: owner,
    name: 'Zero Qty Normalization Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/ZERO-QTY',
  });
  const stockItem = await seedStockItem({
    pharmacyId: String(pharmacy._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
  });

  // Explicit quantity: 0 with status: 'available' MUST normalize status to 'out'
  const resAvailWithZero = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ status: 'available', quantity: 0 });

  assert.equal(resAvailWithZero.status, 200);
  assert.equal(resAvailWithZero.body.data.status, 'out', 'Status must normalize to out when quantity is 0');
  assert.equal(resAvailWithZero.body.data.quantity, 0);

  // Explicit quantity: 0 with status: 'low' MUST normalize status to 'out'
  const resLowWithZero = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ status: 'low', quantity: 0 });

  assert.equal(resLowWithZero.status, 200);
  assert.equal(resLowWithZero.body.data.status, 'out', 'Status must normalize to out when quantity is 0');
  assert.equal(resLowWithZero.body.data.quantity, 0);

  // Explicit quantity: 0 with NO status supplied MUST normalize status to 'out'
  const resOnlyZero = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ quantity: 0 });

  assert.equal(resOnlyZero.status, 200);
  assert.equal(resOnlyZero.body.data.status, 'out', 'Status must normalize to out when quantity is 0');
  assert.equal(resOnlyZero.body.data.quantity, 0);
});

test('PATCH /owner/inventory/:stockId — Field Preservation, Explicit Null & Server Metadata', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const owner = 'owner_patch_preservation';
  const pharmacy = await seedPharmacy({
    ownerId: owner,
    name: 'Preservation Chemist',
    status: 'verified',
    licenseNo: 'DGDA/PRESERV-01',
  });
  const stockItem = await seedStockItem({
    pharmacyId: String(pharmacy._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
    price: 3.5,
    notes: 'Existing batch note',
  });

  // 1. Partial update: only status provided -> preserves quantity, price, notes
  const resStatusOnly = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({ status: 'low' });

  assert.equal(resStatusOnly.status, 200);
  assert.equal(resStatusOnly.body.data.status, 'low');
  assert.equal(resStatusOnly.body.data.quantity, 100, 'Must preserve omitted quantity');
  assert.equal(resStatusOnly.body.data.price, 3.5, 'Must preserve omitted price');
  assert.equal(resStatusOnly.body.data.notes, 'Existing batch note', 'Must preserve omitted notes');
  assert.ok(resStatusOnly.body.data.updatedAt);
  assert.equal(resStatusOnly.body.data.isStale, false);
  assert.equal(resStatusOnly.body.data.freshness, 'fresh');

  // 2. Explicit null clearing: quantity = null, price = null, notes = null
  const resClear = await request
    .patch(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner))
    .send({
      quantity: null,
      price: null,
      notes: null,
      pharmacyId: 'spoofed_pharmacy_id', // Must be ignored
      updatedBy: 'spoofed_actor_id',     // Must be ignored
    });

  assert.equal(resClear.status, 200);
  assert.equal(resClear.body.data.status, 'low', 'Preserves status when omitted');
  assert.equal(resClear.body.data.quantity, undefined, 'Explicit null clears quantity');
  assert.equal(resClear.body.data.price, undefined, 'Explicit null clears price');
  assert.equal(resClear.body.data.notes, undefined, 'Explicit null clears notes');

  // 3. Verify single item read reflects cleared fields
  const resRead = await request
    .get(`/api/owner/inventory/${stockItem.stockId}`)
    .set(authHeader(owner));
  assert.equal(resRead.status, 200);
  assert.equal(resRead.body.data.status, 'low');
  assert.equal(resRead.body.data.quantity, undefined);
  assert.equal(resRead.body.data.price, undefined);
  assert.equal(resRead.body.data.notes, undefined);
});

// ============================================================================
// 2. POST /owner/inventory/:stockId/reconfirm — Physical Stock Recheck
// ============================================================================

test('POST /owner/inventory/:stockId/reconfirm — Authentication, RBAC & Verification Gatekeeping', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  clearApplicationStore();

  const verifiedOwner = 'owner_reconfirm_auth';
  const pharmacy = await seedPharmacy({
    ownerId: verifiedOwner,
    name: 'Verified Reconfirm Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/RECONF-01',
  });
  const stockItem = await seedStockItem({
    pharmacyId: String(pharmacy._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 50,
  });

  // 1. Unauthenticated -> 401 UNAUTHORIZED
  const resNoAuth = await request
    .post(`/api/owner/inventory/${stockItem.stockId}/reconfirm`)
    .send({});
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.error?.code, 'UNAUTHORIZED');

  // 2. Customer role -> 403 FORBIDDEN
  const resCust = await request
    .post(`/api/owner/inventory/${stockItem.stockId}/reconfirm`)
    .set(authHeader('cust_reconf', 'CUSTOMER'))
    .send({});
  assert.equal(resCust.status, 403);
  assert.equal(resCust.body.error?.code, 'FORBIDDEN');

  // 3. Pending pharmacy status -> 403 PHARMACY_NOT_VERIFIED
  const pendingOwner = 'pending_owner_reconf_lock';
  const pendingApp = await submitApplication(pendingOwner, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Pending Reconfirm Chemist',
    licenseNo: 'DGDA/RECONF-PEND',
  });
  const pendingStock = await seedStockItem({
    pharmacyId: String(pendingApp.pharmacyId),
    medicineId: 'med_paracetamol_500',
    status: 'available',
  });

  const resPending = await request
    .post(`/api/owner/inventory/${pendingStock.stockId}/reconfirm`)
    .set(authHeader(pendingOwner))
    .send({});
  assert.equal(resPending.status, 403);
  assert.equal(resPending.body.error?.code, 'PHARMACY_NOT_VERIFIED');
});

test('POST /owner/inventory/:stockId/reconfirm — Restores Unverified Stock, Bumps Timestamp & Clears Staleness', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const owner = 'owner_reconfirm_action';
  const pharmacy = await seedPharmacy({
    ownerId: owner,
    name: 'Reconfirm Active Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/RECONF-ACT',
  });
  const pharmacyId = String(pharmacy._id);

  // 1. Reconfirm unverified stock: restores to 'available' and clears stale/unverified state
  const unverifiedItem = await seedStockItem({
    pharmacyId,
    medicineId: 'med_metformin_500',
    status: 'unverified',
    quantity: 20,
    updatedAt: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(), // 40h ago (stale)
  });

  const resRestore = await request
    .post(`/api/owner/inventory/${unverifiedItem.stockId}/reconfirm`)
    .set(authHeader(owner))
    .send({});

  assert.equal(resRestore.status, 200);
  assert.equal(resRestore.body.data.status, 'available', 'Unverified stock must restore to available on reconfirm');
  assert.equal(resRestore.body.data.isStale, false, 'Reconfirmation must clear staleness');
  assert.equal(resRestore.body.data.freshness, 'fresh');
  assert.ok(resRestore.body.data.updatedAt);

  // 2. Reconfirm stale stock with explicit status 'low' and quantity: 5
  const staleItem = await seedStockItem({
    pharmacyId,
    medicineId: 'med_azithromycin_500',
    status: 'available',
    quantity: 35,
    updatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), // 36h ago
  });

  const resExplicit = await request
    .post(`/api/owner/inventory/${staleItem.stockId}/reconfirm`)
    .set(authHeader(owner))
    .send({ status: 'low', quantity: 5 });

  assert.equal(resExplicit.status, 200);
  assert.equal(resExplicit.body.data.status, 'low');
  assert.equal(resExplicit.body.data.quantity, 5);
  assert.equal(resExplicit.body.data.isStale, false);
  assert.equal(resExplicit.body.data.freshness, 'fresh');

  // 3. Reconfirm with quantity 0 normalizes status to 'out'
  const resZero = await request
    .post(`/api/owner/inventory/${staleItem.stockId}/reconfirm`)
    .set(authHeader(owner))
    .send({ status: 'available', quantity: 0 });

  assert.equal(resZero.status, 200);
  assert.equal(resZero.body.data.status, 'out');
  assert.equal(resZero.body.data.quantity, 0);

  // 4. Owner cannot set status: 'unverified' -> 422 INVALID_STATUS
  const resDisallowUnverified = await request
    .post(`/api/owner/inventory/${staleItem.stockId}/reconfirm`)
    .set(authHeader(owner))
    .send({ status: 'unverified' });

  assert.equal(resDisallowUnverified.status, 422);
  assert.equal(resDisallowUnverified.body.error?.code, 'INVALID_STATUS');
});

// ============================================================================
// 3. GET /owner/inventory/:stockId/history — Audit Log & Cursor Pagination
// ============================================================================

test('GET /owner/inventory/:stockId/history — Authentication, Ownership & Cross-Tenant Privacy', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerA = 'owner_hist_A';
  const pharmacyA = await seedPharmacy({
    ownerId: ownerA,
    name: 'History Pharmacy A',
    status: 'verified',
    licenseNo: 'DGDA/HIST-A',
  });

  const ownerB = 'owner_hist_B';
  const pharmacyB = await seedPharmacy({
    ownerId: ownerB,
    name: 'History Pharmacy B',
    status: 'verified',
    licenseNo: 'DGDA/HIST-B',
  });

  const itemA = await seedStockItem({
    pharmacyId: String(pharmacyA._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
  });

  // 1. Unauthenticated -> 401 UNAUTHORIZED
  const resNoAuth = await request
    .get(`/api/owner/inventory/${itemA.stockId}/history`);
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.error?.code, 'UNAUTHORIZED');

  // 2. Customer role -> 403 FORBIDDEN
  const resCust = await request
    .get(`/api/owner/inventory/${itemA.stockId}/history`)
    .set(authHeader('cust_hist', 'CUSTOMER'));
  assert.equal(resCust.status, 403);
  assert.equal(resCust.body.error?.code, 'FORBIDDEN');

  // 3. Missing stock item -> 404 NOT_FOUND
  const resMissing = await request
    .get('/api/owner/inventory/missing_stock_id/history')
    .set(authHeader(ownerA));
  assert.equal(resMissing.status, 404);
  assert.equal(resMissing.body.error?.code, 'NOT_FOUND');

  // 4. Cross-tenant privacy: Owner B attempting to read history for itemA MUST return 404
  const resCross = await request
    .get(`/api/owner/inventory/${itemA.stockId}/history`)
    .set(authHeader(ownerB));
  assert.equal(resCross.status, 404);
  assert.equal(resCross.body.error?.code, 'NOT_FOUND');
});

test('GET /owner/inventory/:stockId/history — Stable Ordering, Limit & Cursor Pagination Parity', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const owner = 'owner_pagination_tester';
  const pharmacy = await seedPharmacy({
    ownerId: owner,
    name: 'Pagination Model Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/PAGE-TEST',
  });
  const pharmacyId = String(pharmacy._id);

  const stockItem = await seedStockItem({
    pharmacyId,
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 100,
  });
  const stockId = stockItem.stockId;

  // Seed 5 sequential history records with distinct timestamps
  const baseTime = Date.now() - 10 * 60 * 1000;
  for (let i = 1; i <= 5; i++) {
    await seedStockHistory({
      historyId: `hist_page_00${i}`,
      stockId,
      pharmacyId,
      medicineId: 'med_paracetamol_500',
      oldStatus: i === 1 ? null : i === 5 ? 'low' : 'available',
      newStatus: i === 5 ? 'out' : i === 4 ? 'low' : 'available',
      oldQuantity: i === 1 ? null : 100 - (i - 1) * 20,
      newQuantity: 100 - i * 20,
      changedBy: owner,
      changedByName: 'Pagination Tester',
      changedAt: new Date(baseTime + i * 60 * 1000).toISOString(),
    });
  }

  // 1. Fetch Page 1 with limit = 2
  const resPage1 = await request
    .get(`/api/owner/inventory/${stockId}/history?limit=2`)
    .set(authHeader(owner));

  assert.equal(resPage1.status, 200);
  assert.ok(Array.isArray(resPage1.body.data));
  assert.equal(resPage1.body.data.length, 2, 'Page 1 must return exactly 2 entries');
  assert.equal(resPage1.body.page.limit, 2);
  assert.ok(resPage1.body.page.nextCursor, 'Page 1 must return nextCursor when more records exist');

  // Verify newest-first ordering: entry with i=5 should be first, i=4 second
  assert.equal(resPage1.body.data[0].historyId, 'hist_page_005');
  assert.equal(resPage1.body.data[1].historyId, 'hist_page_004');

  // Verify response contract shape matches specification
  const firstEntry = resPage1.body.data[0];
  assert.ok(firstEntry.historyId);
  assert.equal(firstEntry.stockId, stockId);
  assert.equal(firstEntry.pharmacyId, pharmacyId);
  assert.equal(firstEntry.medicineId, 'med_paracetamol_500');
  assert.equal(firstEntry.oldStatus, 'low');
  assert.equal(firstEntry.newStatus, 'out');
  assert.equal(firstEntry.oldQuantity, 20);
  assert.equal(firstEntry.newQuantity, 0);
  assert.equal(firstEntry.changedBy, owner);
  assert.equal(firstEntry.changedByName, 'Pagination Tester');
  assert.ok(firstEntry.changedAt);

  // 2. Fetch Page 2 with cursor from Page 1 and limit = 2
  const cursor1 = resPage1.body.page.nextCursor;
  const resPage2 = await request
    .get(`/api/owner/inventory/${stockId}/history?limit=2&cursor=${encodeURIComponent(cursor1)}`)
    .set(authHeader(owner));

  assert.equal(resPage2.status, 200);
  assert.equal(resPage2.body.data.length, 2, 'Page 2 must return exactly 2 entries');
  assert.equal(resPage2.body.data[0].historyId, 'hist_page_003');
  assert.equal(resPage2.body.data[1].historyId, 'hist_page_002');
  assert.ok(resPage2.body.page.nextCursor, 'Page 2 must return nextCursor');

  // 3. Fetch Page 3 (final page) with cursor from Page 2
  const cursor2 = resPage2.body.page.nextCursor;
  const resPage3 = await request
    .get(`/api/owner/inventory/${stockId}/history?limit=2&cursor=${encodeURIComponent(cursor2)}`)
    .set(authHeader(owner));

  assert.equal(resPage3.status, 200);
  assert.equal(resPage3.body.data.length, 1, 'Final page must return remaining 1 entry');
  assert.equal(resPage3.body.data[0].historyId, 'hist_page_001');
  assert.equal(resPage3.body.page.nextCursor, null, 'nextCursor must be null on terminal page');

  // 4. Invalid limit query parameter -> 422 VALIDATION_ERROR
  const resInvalidLimit = await request
    .get(`/api/owner/inventory/${stockId}/history?limit=-5`)
    .set(authHeader(owner));
  assert.equal(resInvalidLimit.status, 422);
  assert.ok(resInvalidLimit.body.error?.fields?.limit);

  // 5. Invalid pagination cursor -> 422 VALIDATION_ERROR
  const resInvalidCursor = await request
    .get(`/api/owner/inventory/${stockId}/history?cursor=totally_unparseable_garbage_cursor`)
    .set(authHeader(owner));
  assert.equal(resInvalidCursor.status, 422);
  assert.ok(resInvalidCursor.body.error?.fields?.cursor);
});

test('Integration Audit Trail: PATCH & POST Reconfirm Automatically Append History', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const owner = 'owner_audit_trail_integration';
  const pharmacy = await seedPharmacy({
    ownerId: owner,
    name: 'Audit Trail Model Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/AUDIT-INTEG',
  });
  const pharmacyId = String(pharmacy._id);

  // 1. Initial stock addition (creates 1 history record)
  const resAdd = await request
    .post('/api/owner/inventory')
    .set(authHeader(owner))
    .send({
      medicineId: 'med_paracetamol_500',
      status: 'available',
      quantity: 100,
      price: 3.5,
    });
  assert.equal(resAdd.status, 201);
  const stockId = resAdd.body.data.stockId;

  // Verify initial history entry
  const resHist1 = await request
    .get(`/api/owner/inventory/${stockId}/history`)
    .set(authHeader(owner));
  assert.equal(resHist1.status, 200);
  assert.equal(resHist1.body.data.length, 1);
  assert.equal(resHist1.body.data[0].oldStatus, null);
  assert.equal(resHist1.body.data[0].newStatus, 'available');
  assert.equal(resHist1.body.data[0].oldQuantity, null);
  assert.equal(resHist1.body.data[0].newQuantity, 100);

  // 2. PATCH update status to 'low' and quantity to 8
  await new Promise((r) => setTimeout(r, 10));
  const resPatch = await request
    .patch(`/api/owner/inventory/${stockId}`)
    .set(authHeader(owner))
    .send({ status: 'low', quantity: 8 });
  assert.equal(resPatch.status, 200);
  assert.equal(resPatch.body.data.status, 'low');
  assert.equal(resPatch.body.data.quantity, 8);

  // Verify history appended (now 2 entries, newest first)
  const resHist2 = await request
    .get(`/api/owner/inventory/${stockId}/history`)
    .set(authHeader(owner));
  assert.equal(resHist2.status, 200);
  assert.equal(resHist2.body.data.length, 2);
  assert.equal(resHist2.body.data[0].oldStatus, 'available');
  assert.equal(resHist2.body.data[0].newStatus, 'low');
  assert.equal(resHist2.body.data[0].oldQuantity, 100);
  assert.equal(resHist2.body.data[0].newQuantity, 8);

  // 3. POST reconfirm with unchanged status and quantity
  await new Promise((r) => setTimeout(r, 10));
  const resReconfirm = await request
    .post(`/api/owner/inventory/${stockId}/reconfirm`)
    .set(authHeader(owner))
    .send({ status: 'low', quantity: 8 });
  assert.equal(resReconfirm.status, 200);
  assert.equal(resReconfirm.body.data.status, 'low');

  // Verify history appended (now 3 entries: reconfirmation is an audit action)
  const resHist3 = await request
    .get(`/api/owner/inventory/${stockId}/history`)
    .set(authHeader(owner));
  assert.equal(resHist3.status, 200);
  assert.equal(resHist3.body.data.length, 3);
  assert.equal(resHist3.body.data[0].oldStatus, 'low');
  assert.equal(resHist3.body.data[0].newStatus, 'low');
  assert.equal(resHist3.body.data[0].oldQuantity, 8);
  assert.equal(resHist3.body.data[0].newQuantity, 8);
});
