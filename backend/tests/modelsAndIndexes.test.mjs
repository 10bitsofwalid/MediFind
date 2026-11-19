// backend/tests/modelsAndIndexes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  PharmacyApplication,
  PharmacyApplicationSchema,
} from '../dist/models/PharmacyApplication.js';
import {
  Pharmacy,
  PharmacySchema,
} from '../dist/models/Pharmacy.js';
import {
  Stock,
  StockSchema,
} from '../dist/models/Stock.js';
import {
  StockHistory,
  StockHistorySchema,
} from '../dist/models/StockHistory.js';
import {
  syntheticDhakaLocation,
  syntheticPharmacyApplicationPayload,
  syntheticVerifiedPharmacy,
  syntheticWeeklyHours,
} from '../dist/fixtures/syntheticFixtures.js';

test('Pharmacy Model — Database Indexes and Purpose Verification', () => {
  const indexes = PharmacySchema.indexes();

  // 1. Geospatial 2dsphere index for nearby discovery
  const geoIndex = indexes.find(([fields]) => fields.location === '2dsphere');
  assert.ok(geoIndex, 'Pharmacy must define 2dsphere index on location field');
  assert.equal(geoIndex[1].name, 'idx_pharmacy_location_2dsphere');

  // 2. Unique normalized licence index
  const licenseIndex = indexes.find(([fields]) => fields.normalizedLicenseNo === 1 && fields.ownerId === undefined);
  assert.ok(licenseIndex, 'Pharmacy must define index on normalizedLicenseNo');
  assert.equal(licenseIndex[1].unique, true, 'Licence index must be unique');
  assert.equal(licenseIndex[1].name, 'idx_pharmacy_normalized_license_unique');

  // 3. Unique ownerId index (1:1 owner constraint per SRS BR-02)
  const ownerIndex = indexes.find(([fields]) => fields.ownerId === 1 && fields.normalizedLicenseNo === undefined);
  assert.ok(ownerIndex, 'Pharmacy must define unique index on ownerId');
  assert.equal(ownerIndex[1].unique, true, 'ownerId index must be unique (1:1 cardinality)');
  assert.equal(ownerIndex[1].name, 'idx_pharmacy_owner_id_unique');

  // 4. Status index for fast filtering of verified pharmacies in discovery search
  const statusIndex = indexes.find(([fields]) => fields.status === 1);
  assert.ok(statusIndex, 'Pharmacy must define index on status');
  assert.equal(statusIndex[1].name, 'idx_pharmacy_status');

  // Confirm no duplicate indexes were registered
  assert.equal(indexes.length, 4, 'Pharmacy must define exactly 4 non-duplicate indexes');
});

test('Pharmacy Model — Schema Validation and Hooks', async () => {
  const dummyOwnerId = new mongoose.Types.ObjectId();

  // Valid pharmacy document
  const validPharmacy = new Pharmacy({
    ownerId: dummyOwnerId,
    name: 'Apollo Pharmacy Dhanmondi',
    phone: '+8801711223344',
    address: 'Road 27, Dhanmondi, Dhaka',
    licenseNo: '  dgda/da-2024-9999  ',
    location: syntheticDhakaLocation,
    openingHours: 'Mon-Sun: 08:00 - 23:00',
    status: 'verified',
  });

  await validPharmacy.validate();

  // Auto-normalizes licence number
  assert.equal(
    validPharmacy.normalizedLicenseNo,
    'DGDA/DA-2024-9999',
    'Pre-validate hook / default must uppercase and trim licenseNo into normalizedLicenseNo'
  );

  // Synchronizes coordinates
  assert.equal(validPharmacy.longitude, 90.3760);
  assert.equal(validPharmacy.latitude, 23.7465);

  // Validation failure on missing required fields
  const invalidPharmacy = new Pharmacy({});
  let validationError;
  try {
    await invalidPharmacy.validate();
  } catch (err) {
    validationError = err;
  }
  assert.ok(validationError, 'Document missing required fields must fail validation');
  assert.ok(validationError.errors.name, 'Name is required');
  assert.ok(validationError.errors.phone, 'Phone is required');
  assert.ok(validationError.errors.address, 'Address is required');
  assert.ok(validationError.errors.licenseNo, 'LicenseNo is required');
});

test('PharmacyApplication Model — Database Indexes and Purpose Verification', () => {
  const indexes = PharmacyApplicationSchema.indexes();

  // 1. Unique sparse normalized licence index
  const licenseIndex = indexes.find(([fields]) => fields.normalizedLicenseNo === 1);
  assert.ok(licenseIndex, 'PharmacyApplication must define index on normalizedLicenseNo');
  assert.equal(licenseIndex[1].unique, true);
  assert.equal(licenseIndex[1].sparse, true, 'Licence index must be sparse');
  assert.equal(licenseIndex[1].name, 'idx_application_normalized_license');

  // 2. Owner lookup index
  const ownerIndex = indexes.find(([fields]) => fields.ownerId === 1);
  assert.ok(ownerIndex, 'PharmacyApplication must define index on ownerId');
  assert.equal(ownerIndex[1].name, 'idx_application_owner_id');

  // 3. Queue review sort index (status + submittedAt)
  const queueIndex = indexes.find(([fields]) => fields.status === 1 && fields.submittedAt === 1);
  assert.ok(queueIndex, 'PharmacyApplication must define compound queue index on status and submittedAt');
  assert.equal(queueIndex[1].name, 'idx_application_queue_sort');

  assert.equal(indexes.length, 3, 'PharmacyApplication must define exactly 3 non-duplicate indexes');
});

test('PharmacyApplication Model — Pre-validate normalization', async () => {
  const dummyOwnerId = new mongoose.Types.ObjectId();

  const app = new PharmacyApplication({
    ownerId: dummyOwnerId,
    status: 'pending',
    data: {
      ...syntheticPharmacyApplicationPayload,
      licenseNo: '  dgda-dh-2024-5544  ',
    },
  });

  await app.validate();
  assert.equal(
    app.normalizedLicenseNo,
    'DGDA-DH-2024-5544',
    'Pre-validate hook / default must uppercase and trim licenseNo'
  );
  assert.equal(app.status, 'pending', 'Default status must be pending');
});

test('Stock Model — Compound Unique Index and Constraints Verification', () => {
  const indexes = StockSchema.indexes();

  // 1. Compound unique index on (pharmacyId, medicineId)
  const compoundUnique = indexes.find(
    ([fields]) => fields.pharmacyId === 1 && fields.medicineId === 1
  );
  assert.ok(compoundUnique, 'Stock must define compound index on (pharmacyId, medicineId)');
  assert.equal(compoundUnique[1].unique, true, 'Compound index must be unique');
  assert.equal(compoundUnique[1].name, 'idx_stock_pharmacy_medicine_unique');

  // 2. (pharmacyId, status)
  const statusFilterIndex = indexes.find(
    ([fields]) => fields.pharmacyId === 1 && fields.status === 1
  );
  assert.ok(statusFilterIndex, 'Stock must define (pharmacyId, status) index');

  // 3. (pharmacyId, updatedAt DESC)
  const sortIndex = indexes.find(
    ([fields]) => fields.pharmacyId === 1 && fields.updatedAt === -1
  );
  assert.ok(sortIndex, 'Stock must define (pharmacyId, updatedAt: -1) index');

  // 4. (medicineId, status) discovery index
  const discIndex = indexes.find(
    ([fields]) => fields.medicineId === 1 && fields.status === 1
  );
  assert.ok(discIndex, 'Stock must define (medicineId, status) discovery index');

  assert.equal(indexes.length, 4, 'Stock must define exactly 4 indexes');
});

test('Stock Model — Schema Constraints (Quantity Integer and Non-Negative Price)', async () => {
  const pharmacyId = new mongoose.Types.ObjectId();
  const medicineId = new mongoose.Types.ObjectId();

  // Valid stock
  const validStock = new Stock({
    pharmacyId,
    medicineId,
    status: 'available',
    quantity: 50,
    price: 3.5,
  });
  await validStock.validate();

  // Helper to validate and capture error
  async function getValidationError(doc) {
    try {
      await doc.validate();
      return null;
    } catch (err) {
      return err;
    }
  }

  // Negative quantity must fail
  const negativeQty = new Stock({
    pharmacyId,
    medicineId,
    status: 'available',
    quantity: -5,
  });
  const negErr = await getValidationError(negativeQty);
  assert.ok(negErr?.errors.quantity, 'Negative quantity must fail validation');

  // Decimal quantity must fail (must be whole number integer)
  const decimalQty = new Stock({
    pharmacyId,
    medicineId,
    status: 'available',
    quantity: 4.5,
  });
  const decErr = await getValidationError(decimalQty);
  assert.ok(decErr?.errors.quantity, 'Decimal quantity must fail integer validation');

  // Negative price must fail
  const negativePrice = new Stock({
    pharmacyId,
    medicineId,
    status: 'available',
    price: -10,
  });
  const priceErr = await getValidationError(negativePrice);
  assert.ok(priceErr?.errors.price, 'Negative price must fail validation');

  // Invalid status enum must fail
  const invalidStatus = new Stock({
    pharmacyId,
    medicineId,
    status: 'unknown_status',
  });
  const statusErr = await getValidationError(invalidStatus);
  assert.ok(statusErr?.errors.status, 'Invalid status enum must fail validation');
});

test('StockHistory Model — Append-Only Immutability Guardrails', () => {
  const indexes = StockHistorySchema.indexes();

  // 1. Compound index on (pharmacyId, medicineId, changedAt DESC)
  const historyCompound = indexes.find(
    ([fields]) => fields.pharmacyId === 1 && fields.medicineId === 1 && fields.changedAt === -1
  );
  assert.ok(historyCompound, 'StockHistory must define (pharmacyId, medicineId, changedAt: -1) index');
  assert.equal(historyCompound[1].name, 'idx_stock_history_pharmacy_medicine_time');

  // 2. stockId index
  const stockIndex = indexes.find(
    ([fields]) => fields.stockId === 1 && fields.changedAt === -1
  );
  assert.ok(stockIndex, 'StockHistory must define (stockId, changedAt: -1) index');

  // 3. changedBy audit index
  const actorIndex = indexes.find(([fields]) => fields.changedBy === 1);
  assert.ok(actorIndex, 'StockHistory must define changedBy audit index');

  assert.equal(indexes.length, 3, 'StockHistory must define exactly 3 indexes');

  // Immutability test: verify pre-save hook blocks updating existing documents
  const record = new StockHistory({
    pharmacyId: new mongoose.Types.ObjectId(),
    medicineId: new mongoose.Types.ObjectId(),
    oldStatus: 'available',
    newStatus: 'low',
    oldQuantity: 50,
    newQuantity: 10,
    changedAt: new Date(),
  });

  // Emulate existing document (isNew = false)
  record.isNew = false;
  assert.throws(
    () => {
      // Trigger pre-save middleware
      const hooks = StockHistorySchema.s.hooks._pres.get('save');
      for (const hook of hooks) {
        hook.fn.call(record);
      }
    },
    /StockHistory is an append-only audit trail and cannot be modified/,
    'Modifying an existing StockHistory record must throw immutability error'
  );
});
