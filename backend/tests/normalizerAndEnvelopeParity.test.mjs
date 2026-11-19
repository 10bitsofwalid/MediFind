// backend/tests/normalizerAndEnvelopeParity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

// Register hook for extensionless TypeScript resolution in frontend imports
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !path.extname(specifier) &&
      context.parentURL?.startsWith('file:')
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const tsCandidate = path.resolve(parentDir, `${specifier}.ts`);
      if (fs.existsSync(tsCandidate)) {
        return { url: pathToFileURL(tsCandidate).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

// Import frontend service normalizers directly
const {
  normalizeApplicationResponse,
  normalizePharmacyRecord,
} = await import('../../frontend/src/services/pharmacyService.ts');

const {
  formatApplicationResponse,
  formatPharmacyResponse,
  formatStockRecord,
  formatServerStockUpdate,
  formatStockHistoryResponse,
  wrapEnvelope,
  unwrapEnvelope,
} = await import('../dist/utils/responseEnvelope.js');

const {
  syntheticPendingApplication,
  syntheticVerifiedPharmacy,
  syntheticStockItems,
  syntheticStockHistory,
  syntheticMedicines,
} = await import('../dist/fixtures/syntheticFixtures.js');

test('Response Enveloping: wrapEnvelope and unwrapEnvelope utility helpers', () => {
  const payload = { testKey: 'testValue' };
  const wrapped = wrapEnvelope(payload, { limit: 20, nextCursor: 'cur_123' });

  assert.deepEqual(wrapped.data, payload);
  assert.equal(wrapped.page?.limit, 20);
  assert.equal(wrapped.page?.nextCursor, 'cur_123');

  // unwrapEnvelope extracts .data from wrapped object
  assert.deepEqual(unwrapEnvelope(wrapped), payload);

  // unwrapEnvelope returns flat object unchanged
  assert.deepEqual(unwrapEnvelope(payload), payload);
});

test('Parity: Frontend normalizeApplicationResponse processes both flat object and { data: ... } envelope', () => {
  // 1. Wrapped { data: ... } envelope (standard MediFind REST envelope)
  const wrappedEnvelope = formatApplicationResponse(syntheticPendingApplication, true);
  assert.ok('data' in wrappedEnvelope, 'Must be wrapped in { data: ... }');

  const normalizedFromEnvelope = normalizeApplicationResponse(wrappedEnvelope);
  assert.ok(normalizedFromEnvelope, 'Normalizer must process { data: ... } envelope');
  assert.equal(normalizedFromEnvelope.applicationId, syntheticPendingApplication.applicationId);
  assert.equal(normalizedFromEnvelope.status, 'pending');
  assert.equal(normalizedFromEnvelope.data.name, 'Green Life Model Pharmacy');
  assert.equal(normalizedFromEnvelope.data.licenseNo, 'DGDA/DA-2024-8901');
  assert.equal(normalizedFromEnvelope.data.location.type, 'Point');
  assert.equal(normalizedFromEnvelope.data.latitude, 23.7465);

  // 2. Flat object (resilient API fallback)
  const flatObject = formatApplicationResponse(syntheticPendingApplication, false);
  assert.ok(!('data' in flatObject && 'status' in flatObject && !flatObject.applicationId));

  const normalizedFromFlat = normalizeApplicationResponse(flatObject);
  assert.ok(normalizedFromFlat, 'Normalizer must process flat object');
  assert.equal(normalizedFromFlat.applicationId, syntheticPendingApplication.applicationId);
  assert.equal(normalizedFromFlat.status, 'pending');
  assert.equal(normalizedFromFlat.data.name, 'Green Life Model Pharmacy');
});

test('Parity: Frontend normalizePharmacyRecord processes both flat object and { data: ... } envelope', () => {
  // 1. Wrapped { data: ... } envelope
  const wrappedEnvelope = formatPharmacyResponse(syntheticVerifiedPharmacy, true);
  assert.ok('data' in wrappedEnvelope);

  const normalizedFromEnvelope = normalizePharmacyRecord(wrappedEnvelope);
  assert.ok(normalizedFromEnvelope, 'Normalizer must process { data: ... } envelope');
  assert.equal(normalizedFromEnvelope._id, syntheticVerifiedPharmacy._id);
  assert.equal(normalizedFromEnvelope.name, 'Green Life Model Pharmacy');
  assert.equal(normalizedFromEnvelope.status, 'verified');
  assert.equal(normalizedFromEnvelope.location.type, 'Point');
  assert.equal(normalizedFromEnvelope.latitude, 23.7465);
  assert.equal(normalizedFromEnvelope.longitude, 90.3760);

  // 2. Flat object
  const flatObject = formatPharmacyResponse(syntheticVerifiedPharmacy, false);
  const normalizedFromFlat = normalizePharmacyRecord(flatObject);
  assert.ok(normalizedFromFlat, 'Normalizer must process flat object');
  assert.equal(normalizedFromFlat._id, syntheticVerifiedPharmacy._id);
  assert.equal(normalizedFromFlat.name, 'Green Life Model Pharmacy');
  assert.equal(normalizedFromFlat.status, 'verified');
});

test('Parity: Stock update and inventory formatters match contract shapes', () => {
  const stockItem = syntheticStockItems[0];
  const medicine = syntheticMedicines[0];

  // 1. Stock item formatting
  const wrappedStock = formatStockRecord(stockItem, medicine, true);
  assert.ok('data' in wrappedStock);
  assert.equal(wrappedStock.data.stockId, stockItem.stockId);
  assert.equal(wrappedStock.data.medicineName, 'Napa Extra');
  assert.equal(wrappedStock.data.status, 'available');
  assert.equal(wrappedStock.data.quantity, 150);
  assert.equal(wrappedStock.data.isStale, false);

  const flatStock = formatStockRecord(stockItem, medicine, false);
  assert.equal(flatStock.stockId, stockItem.stockId);
  assert.equal(flatStock.medicineName, 'Napa Extra');

  // 2. Server stock update (for PATCH /reconfirm)
  const wrappedUpdate = formatServerStockUpdate(stockItem, true);
  assert.ok('data' in wrappedUpdate);
  assert.equal(wrappedUpdate.data.stockId, stockItem.stockId);
  assert.equal(wrappedUpdate.data.status, 'available');

  const flatUpdate = formatServerStockUpdate(stockItem, false);
  assert.equal(flatUpdate.stockId, stockItem.stockId);

  // 3. Stock history pagination envelope
  const historyResponse = formatStockHistoryResponse(syntheticStockHistory, {
    limit: 20,
    nextCursor: null,
  }, true);
  assert.ok('data' in historyResponse);
  assert.equal(historyResponse.data.length, syntheticStockHistory.length);
  assert.equal(historyResponse.page?.limit, 20);
});
