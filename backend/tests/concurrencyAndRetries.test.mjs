// backend/tests/concurrencyAndRetries.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import server from '../dist/server.js';
import { createTestClient } from './testClient.mjs';
import {
  clearInMemoryPharmacyStore,
  seedPharmacy,
} from '../dist/services/pharmacyService.js';
import {
  clearInMemoryStore as clearApplicationStore,
} from '../dist/services/pharmacyApplicationService.js';
import {
  clearInMemoryStockStore,
  seedStockItem,
  seedMedicine,
  getOwnerInventory,
} from '../dist/services/stockService.js';
import { syntheticPharmacyApplicationPayload } from '../dist/fixtures/syntheticFixtures.js';
import * as idempotencyModule from '../dist/utils/idempotency.js';
const idempotency = idempotencyModule.default || idempotencyModule;
const clearIdempotencyCache = idempotency.clearIdempotencyCache || idempotency.clearIdempotencyStore;

const app = server.default || server;
const request = createTestClient(app);

const JWT_SECRET = process.env.JWT_SECRET || 'medifind_jwt_secret_dev_key_2026';

function validToken(userId = 'owner_usr_concurrency_01', role = 'PHARMACY') {
  return jwt.sign(
    {
      userId,
      id: userId,
      role,
      email: `${userId}@medifind.example`,
      name: 'Concurrency Tester',
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

function expiredToken(userId = 'owner_usr_expired_01', role = 'PHARMACY') {
  return jwt.sign(
    {
      userId,
      id: userId,
      role,
      email: `${userId}@medifind.example`,
      name: 'Expired Tester',
    },
    JWT_SECRET,
    { expiresIn: '-10s' } // Expired 10 seconds ago
  );
}

test('Session Expiry: Expired JWT token returns 401 SESSION_EXPIRED', async () => {
  const token = expiredToken();
  const res = await request
    .get('/api/owner/pharmacy')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 401);
  assert.equal(res.body.error?.code, 'SESSION_EXPIRED');
});

test('Concurrency: Pharmacy Profile update with stale expectedUpdatedAt returns 409 CONFLICT', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();
  clearIdempotencyCache();

  const ownerId = 'owner_usr_conc_profile';
  const pharmacyId = 'ph_conc_profile_01';
  const initialUpdatedAt = '2026-11-20T10:00:00.000Z';

  seedPharmacy({
    _id: pharmacyId,
    id: pharmacyId,
    ownerId,
    name: 'Initial Pharmacy Name',
    phone: '+8801711223344',
    address: 'Dhaka',
    licenseNo: 'DGDA-CONC-01',
    status: 'verified',
    location: { type: 'Point', coordinates: [90.38, 23.75] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
    updatedAt: initialUpdatedAt,
  });

  const token = validToken(ownerId);

  // 1. Concurrent update #1 succeeds and bumps updatedAt
  const res1 = await request
    .patch('/api/owner/pharmacy')
    .set('Authorization', `Bearer ${token}`)
    .set('If-Match', initialUpdatedAt)
    .send({
      name: 'First Successful Update',
      expectedUpdatedAt: initialUpdatedAt,
    });

  assert.equal(res1.status, 200);
  const newUpdatedAt = res1.body.data?.updatedAt || res1.body.updatedAt;
  assert.notEqual(newUpdatedAt, initialUpdatedAt);

  // 2. Concurrent update #2 with old initialUpdatedAt is rejected with 409 CONFLICT
  const res2 = await request
    .patch('/api/owner/pharmacy')
    .set('Authorization', `Bearer ${token}`)
    .set('If-Match', initialUpdatedAt)
    .send({
      name: 'Stale Overwriting Update',
      expectedUpdatedAt: initialUpdatedAt,
    });

  assert.equal(res2.status, 409);
  assert.equal(res2.body.error?.code, 'CONFLICT');
  assert.match(res2.body.error?.message, /updated elsewhere|conflicts/i);
});

test('Concurrency: Stock Item update with stale expectedUpdatedAt returns 409 CONFLICT', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  clearIdempotencyCache();

  const ownerId = 'owner_usr_conc_stock';
  const pharmacyId = 'ph_conc_stock_01';
  const stockId = 'stk_conc_01';
  const medicineId = 'med_napa_500';
  const initialUpdatedAt = '2026-11-20T12:00:00.000Z';

  seedPharmacy({
    _id: pharmacyId,
    id: pharmacyId,
    ownerId,
    name: 'Stock Concurrency Pharmacy',
    phone: '+8801711223344',
    address: 'Dhaka',
    licenseNo: 'DGDA-STOCK-01',
    status: 'verified',
    location: { type: 'Point', coordinates: [90.38, 23.75] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
  });

  seedStockItem({
    _id: stockId,
    stockId,
    pharmacyId,
    medicineId,
    status: 'available',
    quantity: 100,
    updatedAt: initialUpdatedAt,
  });

  const token = validToken(ownerId);

  // 1. First update succeeds with matching token
  const res1 = await request
    .patch(`/api/owner/inventory/${stockId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('If-Match', initialUpdatedAt)
    .send({
      status: 'low',
      quantity: 15,
      expectedUpdatedAt: initialUpdatedAt,
    });

  assert.equal(res1.status, 200);

  // 2. Second update using stale token is rejected with 409 CONFLICT
  const res2 = await request
    .patch(`/api/owner/inventory/${stockId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('If-Match', initialUpdatedAt)
    .send({
      status: 'out',
      quantity: 0,
      expectedUpdatedAt: initialUpdatedAt,
    });

  assert.equal(res2.status, 409);
  assert.equal(res2.body.error?.code, 'CONFLICT');
});

test('Concurrency: Stock Item reconfirmation with stale expectedUpdatedAt returns 409 CONFLICT', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  clearIdempotencyCache();

  const ownerId = 'owner_usr_conc_reconfirm';
  const pharmacyId = 'ph_conc_reconfirm_01';
  const stockId = 'stk_conc_reconfirm_01';
  const initialUpdatedAt = '2026-11-20T12:00:00.000Z';

  seedPharmacy({
    _id: pharmacyId,
    id: pharmacyId,
    ownerId,
    name: 'Reconfirm Concurrency Pharmacy',
    phone: '+8801711223344',
    address: 'Dhaka',
    licenseNo: 'DGDA-RECONF-01',
    status: 'verified',
    location: { type: 'Point', coordinates: [90.38, 23.75] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
  });

  seedStockItem({
    _id: stockId,
    stockId,
    pharmacyId,
    medicineId: 'med_napa_500',
    status: 'unverified',
    quantity: 50,
    updatedAt: initialUpdatedAt,
  });

  const token = validToken(ownerId);

  // Update item first to bump updatedAt
  await request
    .patch(`/api/owner/inventory/${stockId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'low' });

  // Now attempt reconfirm with the stale initialUpdatedAt
  const res = await request
    .post(`/api/owner/inventory/${stockId}/reconfirm`)
    .set('Authorization', `Bearer ${token}`)
    .set('If-Match', initialUpdatedAt)
    .send({
      expectedUpdatedAt: initialUpdatedAt,
    });

  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code, 'CONFLICT');
});

test('Retry & Idempotency: POST /owner/inventory retry returns committed item without duplicate records or history', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  clearIdempotencyCache();

  const ownerId = 'owner_usr_idemp_add';
  const pharmacyId = 'ph_idemp_add_01';
  const idempotencyKey = 'idemp_key_add_unique_001';

  seedPharmacy({
    _id: pharmacyId,
    id: pharmacyId,
    ownerId,
    name: 'Idempotent Add Pharmacy',
    phone: '+8801711223344',
    address: 'Dhaka',
    licenseNo: 'DGDA-IDEMP-ADD',
    status: 'verified',
    location: { type: 'Point', coordinates: [90.38, 23.75] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
  });

  seedMedicine({
    id: 'med_napa_500',
    name: 'Napa 500mg',
    genericName: 'Paracetamol',
    form: 'Tablet',
    strength: '500 mg',
    active: true,
  });

  const token = validToken(ownerId);

  // 1. Initial POST request
  const res1 = await request
    .post('/api/owner/inventory')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .send({
      medicineId: 'med_napa_500',
      status: 'available',
      quantity: 80,
    });

  assert.equal(res1.status, 201);
  const createdStockId = res1.body.data?.stockId || res1.body.stockId;
  assert.ok(createdStockId);

  // 2. Simulated retry after client timeout using the exact same Idempotency-Key
  const res2 = await request
    .post('/api/owner/inventory')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .send({
      medicineId: 'med_napa_500',
      status: 'available',
      quantity: 80,
    });

  // Must return the committed result (201/200) without throwing duplicate error
  assert.ok(res2.status === 201 || res2.status === 200);
  const retryStockId = res2.body.data?.stockId || res2.body.stockId;
  assert.equal(retryStockId, createdStockId);

  // 3. Verify total inventory has exactly 1 item (no duplicate stock created)
  const inventory = await getOwnerInventory(ownerId);
  assert.equal(inventory.length, 1);
});

test('Retry & Idempotency: PATCH /owner/inventory/:stockId retry does not append duplicate history', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();
  clearIdempotencyCache();

  const ownerId = 'owner_usr_idemp_patch';
  const pharmacyId = 'ph_idemp_patch_01';
  const stockId = 'stk_idemp_patch_01';
  const idempotencyKey = 'idemp_key_patch_unique_002';

  seedPharmacy({
    _id: pharmacyId,
    id: pharmacyId,
    ownerId,
    name: 'Idempotent Patch Pharmacy',
    phone: '+8801711223344',
    address: 'Dhaka',
    licenseNo: 'DGDA-IDEMP-PATCH',
    status: 'verified',
    location: { type: 'Point', coordinates: [90.38, 23.75] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
  });

  seedStockItem({
    _id: stockId,
    stockId,
    pharmacyId,
    medicineId: 'med_napa_500',
    status: 'available',
    quantity: 100,
  });

  const token = validToken(ownerId);

  // 1. Initial PATCH request
  const res1 = await request
    .patch(`/api/owner/inventory/${stockId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .send({
      status: 'low',
      quantity: 10,
    });

  assert.equal(res1.status, 200);

  // 2. Check history count
  const historyRes1 = await request
    .get(`/api/owner/inventory/${stockId}/history`)
    .set('Authorization', `Bearer ${token}`);
  const countAfterFirstPatch = (historyRes1.body.data || historyRes1.body).length;

  // 3. Retry identical PATCH with same idempotency key
  const res2 = await request
    .patch(`/api/owner/inventory/${stockId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .send({
      status: 'low',
      quantity: 10,
    });

  assert.equal(res2.status, 200);

  // 4. Check history count again: must be identical (no duplicate history appended)
  const historyRes2 = await request
    .get(`/api/owner/inventory/${stockId}/history`)
    .set('Authorization', `Bearer ${token}`);
  const countAfterRetry = (historyRes2.body.data || historyRes2.body).length;

  assert.equal(countAfterRetry, countAfterFirstPatch, 'Retry must not append duplicate audit history');
});

test('Retry & Idempotency: POST /owner/pharmacy-applications retry returns original application without 409', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();
  clearIdempotencyCache();

  const ownerId = 'owner_usr_idemp_app';
  const idempotencyKey = 'idemp_key_app_unique_003';
  const token = validToken(ownerId);

  const applicationPayload = {
    ...syntheticPharmacyApplicationPayload,
    name: 'Idempotent Application Pharmacy',
    licenseNo: 'DGDA-IDEMP-APP-99',
  };

  // 1. Initial application submission
  const res1 = await request
    .post('/api/owner/pharmacy-applications')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .send(applicationPayload);

  assert.equal(res1.status, 201);
  const applicationId1 = res1.body.data?.applicationId || res1.body.applicationId;
  assert.ok(applicationId1);

  // 2. Retry with same Idempotency-Key returns committed application without 409 ACTIVE_APPLICATION_EXISTS
  const res2 = await request
    .post('/api/owner/pharmacy-applications')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .send(applicationPayload);

  assert.ok(res2.status === 201 || res2.status === 200);
  const applicationId2 = res2.body.data?.applicationId || res2.body.applicationId;
  assert.equal(applicationId2, applicationId1);
});

test('Performance: Batch preloading scales to 1,000 synthetic inventory items without N+1 regression', async () => {
  clearInMemoryPharmacyStore();
  clearInMemoryStockStore();

  const ownerId = 'owner_usr_high_volume';
  const pharmacyId = 'ph_high_volume_01';

  seedPharmacy({
    _id: pharmacyId,
    id: pharmacyId,
    ownerId,
    name: 'High Volume Pharmacy',
    phone: '+8801711223344',
    address: 'Dhaka',
    licenseNo: 'DGDA-VOLUME-01',
    status: 'verified',
    location: { type: 'Point', coordinates: [90.38, 23.75] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
  });

  // Seed 1,000 synthetic stock items
  for (let i = 1; i <= 1000; i++) {
    seedStockItem({
      _id: `stk_vol_${i}`,
      stockId: `stk_vol_${i}`,
      pharmacyId,
      medicineId: 'med_napa_500',
      status: i % 3 === 0 ? 'out' : i % 2 === 0 ? 'low' : 'available',
      quantity: i,
    });
  }

  const token = validToken(ownerId);
  const startTime = Date.now();

  const res = await request
    .get('/api/owner/inventory')
    .set('Authorization', `Bearer ${token}`);

  const durationMs = Date.now() - startTime;

  assert.equal(res.status, 200);
  const items = res.body.data || res.body;
  assert.equal(items.length, 1000);
  assert.ok(durationMs < 1000, `1,000 items read took ${durationMs}ms, should be well under 1000ms`);
});
