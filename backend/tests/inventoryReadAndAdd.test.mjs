// backend/tests/inventoryReadAndAdd.test.mjs
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
  seedMedicine,
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

// ==========================================
// 1. GET /owner/inventory — Inventory Read
// ==========================================

test('GET /owner/inventory — Authentication & Authorization Boundaries', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  // 1. Unauthenticated -> 401 UNAUTHORIZED
  const resNoAuth = await request.get('/api/owner/inventory');
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.error?.code, 'UNAUTHORIZED');

  // 2. Non-pharmacy customer role -> 403 FORBIDDEN
  const resForbidden = await request
    .get('/api/owner/inventory')
    .set(authHeader('cust_999', 'CUSTOMER'));
  assert.equal(resForbidden.status, 403);
  assert.equal(resForbidden.body.error?.code, 'FORBIDDEN');

  // 3. Authenticated owner with no pharmacy record -> 404 NOT_FOUND
  const resNotFound = await request
    .get('/api/owner/inventory')
    .set(authHeader('unregistered_owner_usr'));
  assert.equal(resNotFound.status, 404);
  assert.equal(resNotFound.body.error?.code, 'NOT_FOUND');
});

test('GET /owner/inventory — Read Access, Ownership Scoping & Field Parity', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const verifiedOwnerId = String(syntheticVerifiedPharmacy.ownerId);

  // Read inventory for verified owner
  const res = await request
    .get('/api/owner/inventory')
    .set(authHeader(verifiedOwnerId));

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data), 'Response data must be an array');
  assert.ok(res.body.data.length >= 4, 'Should contain seeded synthetic stock items');

  // Validate complete record fields consumed by frontend
  const firstItem = res.body.data[0];
  assert.ok(firstItem.stockId, 'stockId is required');
  assert.equal(firstItem.pharmacyId, String(syntheticVerifiedPharmacy._id));
  assert.ok(firstItem.medicineId, 'medicineId is required');
  assert.ok(firstItem.medicineName, 'medicineName is required');
  assert.ok(firstItem.genericName, 'genericName is required');
  assert.ok(firstItem.strength, 'strength is required');
  assert.ok(firstItem.form, 'form is required');
  assert.ok(firstItem.status, 'status is required');
  assert.ok(firstItem.updatedAt, 'updatedAt ISO timestamp is required');
  assert.equal(typeof firstItem.isStale, 'boolean', 'isStale must be boolean');
  assert.ok(firstItem.freshness === 'fresh' || firstItem.freshness === 'stale');

  // Trust boundary: browser cannot supply pharmacyId to bypass owner derivation
  const spoofRes = await request
    .get('/api/owner/inventory?pharmacyId=spoofed_other_pharmacy_id')
    .set(authHeader(verifiedOwnerId));
  assert.equal(spoofRes.status, 200);
  assert.ok(spoofRes.body.data.every((i) => i.pharmacyId === String(syntheticVerifiedPharmacy._id)));

  // Read access is permitted even when pharmacy is pending
  const pendingOwnerId = 'pending_owner_read_prep';
  await submitApplication(pendingOwnerId, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Pending Preparation Pharmacy',
    licenseNo: 'DGDA/PEND-2026-001',
  });

  const resPending = await request
    .get('/api/owner/inventory')
    .set(authHeader(pendingOwnerId));
  assert.equal(resPending.status, 200);
  assert.deepEqual(resPending.body.data, [], 'New pending pharmacy starts with empty inventory');
});

test('GET /owner/inventory — Filters (q, status, freshness) and Sorting', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const verifiedOwnerId = String(syntheticVerifiedPharmacy.ownerId);

  // 1. Search filter: q matches medicineName
  const resSearchBrand = await request
    .get('/api/owner/inventory?q=Napa')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resSearchBrand.status, 200);
  assert.ok(resSearchBrand.body.data.length > 0);
  assert.ok(resSearchBrand.body.data.every((i) => i.medicineName.toLowerCase().includes('napa')));

  // 2. Search filter: q matches genericName
  const resSearchGeneric = await request
    .get('/api/owner/inventory?q=omeprazole')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resSearchGeneric.status, 200);
  assert.ok(resSearchGeneric.body.data.length > 0);
  assert.ok(resSearchGeneric.body.data.some((i) => i.genericName.toLowerCase().includes('omeprazole')));

  // 3. Search filter: q matches strength
  const resSearchStrength = await request
    .get('/api/owner/inventory?q=20%20mg')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resSearchStrength.status, 200);
  assert.ok(resSearchStrength.body.data.some((i) => i.strength.toLowerCase().includes('20 mg')));

  // 4. Search filter: non-matching query returns empty list
  const resNoMatch = await request
    .get('/api/owner/inventory?q=NonExistentMedicineX99')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resNoMatch.status, 200);
  assert.equal(resNoMatch.body.data.length, 0);

  // 5. Status filter: available
  const resAvail = await request
    .get('/api/owner/inventory?status=available')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resAvail.status, 200);
  assert.ok(resAvail.body.data.length > 0);
  assert.ok(resAvail.body.data.every((i) => i.status === 'available'));

  // 6. Status filter: low
  const resLow = await request
    .get('/api/owner/inventory?status=low')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resLow.status, 200);
  assert.ok(resLow.body.data.length > 0);
  assert.ok(resLow.body.data.every((i) => i.status === 'low'));

  // 7. Freshness filter: stale vs fresh
  const resFresh = await request
    .get('/api/owner/inventory?freshness=fresh')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resFresh.status, 200);
  assert.ok(resFresh.body.data.every((i) => i.isStale === false && i.freshness === 'fresh'));

  const resStale = await request
    .get('/api/owner/inventory?freshness=stale')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resStale.status, 200);
  assert.ok(resStale.body.data.length > 0);
  assert.ok(resStale.body.data.every((i) => i.isStale === true && i.freshness === 'stale'));

  // 8. Sort: name_asc (alphabetical A-Z)
  const resSortName = await request
    .get('/api/owner/inventory?sort=name_asc')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resSortName.status, 200);
  const names = resSortName.body.data.map((i) => i.medicineName);
  const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names, sortedNames, 'name_asc must sort alphabetically');

  // 9. Sort: oldest_first
  const resSortOldest = await request
    .get('/api/owner/inventory?sort=oldest_first')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resSortOldest.status, 200);
  const times = resSortOldest.body.data.map((i) => new Date(i.updatedAt).getTime());
  for (let k = 1; k < times.length; k++) {
    assert.ok(times[k] >= times[k - 1], 'oldest_first must sort ascending by updatedAt');
  }

  // 10. Default sort: updated_desc (newest first)
  const resSortDesc = await request
    .get('/api/owner/inventory?sort=updated_desc')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resSortDesc.status, 200);
  const timesDesc = resSortDesc.body.data.map((i) => new Date(i.updatedAt).getTime());
  for (let k = 1; k < timesDesc.length; k++) {
    assert.ok(timesDesc[k] <= timesDesc[k - 1], 'updated_desc must sort descending by updatedAt');
  }
});

// ==========================================
// 2. GET /owner/inventory/:stockId
// ==========================================

test('GET /owner/inventory/:stockId — Single Item Read & Cross-Tenant Privacy', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerA = 'owner_usr_A';
  const pharmacyA = await seedPharmacy({
    ownerId: ownerA,
    name: 'Pharmacy A',
    status: 'verified',
    licenseNo: 'DGDA/A-1111',
  });

  const ownerB = 'owner_usr_B';
  const pharmacyB = await seedPharmacy({
    ownerId: ownerB,
    name: 'Pharmacy B',
    status: 'verified',
    licenseNo: 'DGDA/B-2222',
  });

  // Seed item in Pharmacy A
  const itemA = await seedStockItem({
    pharmacyId: String(pharmacyA._id),
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 80,
    price: 3.5,
  });

  // Owner A can read itemA
  const resA = await request
    .get(`/api/owner/inventory/${itemA.stockId}`)
    .set(authHeader(ownerA));
  assert.equal(resA.status, 200);
  assert.equal(resA.body.data.stockId, itemA.stockId);
  assert.equal(resA.body.data.medicineName, 'Napa Extra');
  assert.equal(resA.body.data.quantity, 80);

  // Missing item returns 404
  const resMissing = await request
    .get('/api/owner/inventory/non_existent_stock_id')
    .set(authHeader(ownerA));
  assert.equal(resMissing.status, 404);
  assert.equal(resMissing.body.error?.code, 'NOT_FOUND');

  // Cross-tenant privacy assertion: Owner B attempting to read itemA MUST return 404
  // and must NOT reveal that the item exists under another pharmacy
  const resCrossTenant = await request
    .get(`/api/owner/inventory/${itemA.stockId}`)
    .set(authHeader(ownerB));
  assert.equal(resCrossTenant.status, 404);
  assert.equal(resCrossTenant.body.error?.code, 'NOT_FOUND');
});

// ==========================================
// 3. GET /medicines — Catalogue Search
// ==========================================

test('GET /medicines — Public Catalogue Search, Active Filter & Input Limits', async () => {
  clearInMemoryStockStore();

  // Seed an inactive medicine to verify it is excluded from search
  await seedMedicine({
    id: 'med_discontinued_sample',
    name: 'Discontinued Brand Capsule',
    genericName: 'Old Generic',
    form: 'Capsule',
    strength: '10 mg',
    active: false,
  });

  // 1. Available without authentication at /medicines and /api/medicines
  const resPublic1 = await request.get('/medicines');
  assert.equal(resPublic1.status, 200);
  assert.ok(Array.isArray(resPublic1.body.data));

  const resPublic2 = await request.get('/api/medicines');
  assert.equal(resPublic2.status, 200);
  assert.ok(Array.isArray(resPublic2.body.data));

  // 2. Excludes inactive medicines
  const allMeds = resPublic1.body.data;
  assert.ok(allMeds.every((m) => m.active === true));
  assert.ok(!allMeds.some((m) => m.id === 'med_discontinued_sample'));

  // 3. Includes required frontend catalogue fields
  const sample = allMeds[0];
  assert.ok(sample.id);
  assert.ok(sample.name);
  assert.ok(sample.genericName);
  assert.ok(sample.strength);
  assert.ok(sample.form);
  assert.equal(sample.active, true);

  // 4. Query filter (q)
  const resQuery = await request.get('/api/medicines?q=Napa');
  assert.equal(resQuery.status, 200);
  assert.ok(resQuery.body.data.length > 0);
  assert.ok(resQuery.body.data.every((m) => m.name.toLowerCase().includes('napa') || m.genericName.toLowerCase().includes('napa')));

  // 5. Dosage form filter (form)
  const resForm = await request.get('/api/medicines?form=Tablet');
  assert.equal(resForm.status, 200);
  assert.ok(resForm.body.data.every((m) => m.form.toLowerCase() === 'tablet'));

  // 6. Safe limit
  const resLimit = await request.get('/api/medicines?limit=2');
  assert.equal(resLimit.status, 200);
  assert.equal(resLimit.body.data.length, 2);
});

// ==========================================
// 4. POST /owner/inventory — Inventory Add
// ==========================================

test('POST /owner/inventory — Authentication, RBAC & Verification Gatekeeping', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  clearApplicationStore();

  const validPayload = {
    medicineId: 'med_paracetamol_500',
    status: 'available',
    quantity: 50,
    price: 3.5,
  };

  // 1. Unauthenticated -> 401
  const resNoAuth = await request.post('/api/owner/inventory').send(validPayload);
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.error?.code, 'UNAUTHORIZED');

  // 2. Customer role -> 403 FORBIDDEN
  const resCust = await request
    .post('/api/owner/inventory')
    .set(authHeader('cust_111', 'CUSTOMER'))
    .send(validPayload);
  assert.equal(resCust.status, 403);
  assert.equal(resCust.body.error?.code, 'FORBIDDEN');

  // 3. Owner without pharmacy -> 404
  const resNoPh = await request
    .post('/api/owner/inventory')
    .set(authHeader('orphan_owner'))
    .send(validPayload);
  assert.equal(resNoPh.status, 404);
  assert.equal(resNoPh.body.error?.code, 'NOT_FOUND');

  // 4. Pending pharmacy status -> 403 PHARMACY_NOT_VERIFIED
  const pendingOwner = 'pending_owner_write_test';
  await submitApplication(pendingOwner, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Pending Lock Chemist',
    licenseNo: 'DGDA/LOCK-001',
  });

  const resPending = await request
    .post('/api/owner/inventory')
    .set(authHeader(pendingOwner))
    .send(validPayload);
  assert.equal(resPending.status, 403);
  assert.equal(resPending.body.error?.code, 'PHARMACY_NOT_VERIFIED');

  // 5. Suspended pharmacy status -> 403 PHARMACY_NOT_VERIFIED
  const suspendedOwner = 'suspended_owner_write_test';
  await seedPharmacy({
    ownerId: suspendedOwner,
    name: 'Suspended Pharmacy',
    status: 'suspended',
    licenseNo: 'DGDA/SUSP-002',
  });

  const resSuspended = await request
    .post('/api/owner/inventory')
    .set(authHeader(suspendedOwner))
    .send(validPayload);
  assert.equal(resSuspended.status, 403);
  assert.equal(resSuspended.body.error?.code, 'PHARMACY_NOT_VERIFIED');
});

test('POST /owner/inventory — Validation Rules, Schema Checks & Error Envelopes', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const verifiedOwner = 'verified_owner_validation_tester';
  await seedPharmacy({
    ownerId: verifiedOwner,
    name: 'Validated Model Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/VAL-2026',
  });

  // Seed inactive medicine
  await seedMedicine({
    id: 'med_inactive_catalogue_item',
    name: 'Inactive Banned Tablet',
    genericName: 'Banned Generic',
    form: 'Tablet',
    strength: '5 mg',
    active: false,
  });

  // 1. Missing medicineId -> 422 MEDICINE_ID_REQUIRED
  const resNoMedId = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ status: 'available', quantity: 10 });
  assert.equal(resNoMedId.status, 422);
  assert.equal(resNoMedId.body.error?.code, 'MEDICINE_ID_REQUIRED');
  assert.ok(resNoMedId.body.error?.fields?.medicineId);

  // 2. Non-existent medicine in catalogue -> 422 VALIDATION_ERROR
  const resBadMed = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ medicineId: 'med_non_existent_fake_id', status: 'available' });
  assert.equal(resBadMed.status, 422);
  assert.equal(resBadMed.body.error?.code, 'VALIDATION_ERROR');
  assert.equal(resBadMed.body.error?.fields?.medicineId, 'Select an active catalogue medicine.');

  // 3. Inactive medicine in catalogue -> 422 VALIDATION_ERROR
  const resInactive = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ medicineId: 'med_inactive_catalogue_item', status: 'available' });
  assert.equal(resInactive.status, 422);
  assert.equal(resInactive.body.error?.code, 'VALIDATION_ERROR');
  assert.equal(resInactive.body.error?.fields?.medicineId, 'Select an active catalogue medicine.');

  // 4. Owner attempts to submit system-managed 'unverified' status -> 422 INVALID_STATUS
  const resUnverified = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ medicineId: 'med_paracetamol_500', status: 'unverified' });
  assert.equal(resUnverified.status, 422);
  assert.equal(resUnverified.body.error?.code, 'INVALID_STATUS');
  assert.ok(resUnverified.body.error?.fields?.status);

  // 5. Invalid status string -> 422 INVALID_STATUS
  const resInvalidStatus = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ medicineId: 'med_paracetamol_500', status: 'in_stock_now' });
  assert.equal(resInvalidStatus.status, 422);
  assert.equal(resInvalidStatus.body.error?.code, 'INVALID_STATUS');

  // 6. Negative quantity -> 422
  const resNegQty = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ medicineId: 'med_paracetamol_500', status: 'available', quantity: -5 });
  assert.equal(resNegQty.status, 422);
  assert.ok(resNegQty.body.error?.fields?.quantity);

  // 7. Non-integer decimal quantity -> 422
  const resDecQty = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ medicineId: 'med_paracetamol_500', status: 'available', quantity: 2.5 });
  assert.equal(resDecQty.status, 422);
  assert.ok(resDecQty.body.error?.fields?.quantity);

  // 8. Negative price -> 422
  const resNegPrice = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({ medicineId: 'med_paracetamol_500', status: 'available', price: -10 });
  assert.equal(resNegPrice.status, 422);
  assert.ok(resNegPrice.body.error?.fields?.price);
});

test('POST /owner/inventory — Successful Addition, Duplicate Prevention (409) & Audit History', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const verifiedOwner = 'verified_owner_successful_add';
  const pharmacy = await seedPharmacy({
    ownerId: verifiedOwner,
    name: 'Success Care Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/SUCC-9900',
  });
  const pharmacyId = String(pharmacy._id);

  // 1. Valid addition succeeds with 201 Created
  const resAdd = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({
      medicineId: 'med_paracetamol_500',
      status: 'available',
      quantity: 120,
      price: 3.5,
      notes: 'Initial opening stock',
      pharmacyId: 'spoofed_browser_pharmacy_id', // Must be ignored!
    });

  assert.equal(resAdd.status, 201);
  assert.ok(resAdd.body.data);
  const created = resAdd.body.data;
  assert.ok(created.stockId);
  assert.equal(created.pharmacyId, pharmacyId, 'Must derive pharmacyId from server context');
  assert.equal(created.medicineId, 'med_paracetamol_500');
  assert.equal(created.medicineName, 'Napa Extra');
  assert.equal(created.genericName, 'Paracetamol + Caffeine');
  assert.equal(created.status, 'available');
  assert.equal(created.quantity, 120);
  assert.equal(created.price, 3.5);
  assert.equal(created.notes, 'Initial opening stock');
  assert.equal(created.isStale, false);
  assert.equal(created.freshness, 'fresh');
  assert.ok(created.updatedAt);
  assert.equal(created.updatedBy, verifiedOwner);

  // 2. Duplicate addition for same (pharmacyId, medicineId) -> 409 CONFLICT
  const resDuplicate = await request
    .post('/api/owner/inventory')
    .set(authHeader(verifiedOwner))
    .send({
      medicineId: 'med_paracetamol_500',
      status: 'low',
      quantity: 10,
    });
  assert.equal(resDuplicate.status, 409);
  assert.ok(
    resDuplicate.body.error?.code === 'CONFLICT' ||
    resDuplicate.body.error?.code === 'DUPLICATE_INVENTORY_ITEM'
  );

  // 3. Confirm newly added item is returned by GET /owner/inventory
  const resList = await request
    .get('/api/owner/inventory')
    .set(authHeader(verifiedOwner));
  assert.equal(resList.status, 200);
  assert.equal(resList.body.data.length, 1);
  assert.equal(resList.body.data[0].stockId, created.stockId);

  // 4. Confirm single item read works via GET /owner/inventory/:stockId
  const resSingle = await request
    .get(`/api/owner/inventory/${created.stockId}`)
    .set(authHeader(verifiedOwner));
  assert.equal(resSingle.status, 200);
  assert.equal(resSingle.body.data.stockId, created.stockId);
  assert.equal(resSingle.body.data.medicineName, 'Napa Extra');
});
