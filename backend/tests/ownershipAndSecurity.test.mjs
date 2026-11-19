// backend/tests/ownershipAndSecurity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  AuthorizationError,
  assertPharmacyOwnership,
  assertPharmacyRole,
  assertPharmacyVerifiedForInventoryWrite,
  sanitizeClientPayload,
} from '../dist/auth/ownership.js';
import { Pharmacy } from '../dist/models/Pharmacy.js';

test('Security: Client payload sanitization strips untrusted ownership and lifecycle fields', () => {
  const maliciousClientPayload = {
    name: 'Tampered Pharmacy',
    phone: '+8801711223344',
    ownerId: 'attacker_user_id_6789',
    pharmacyId: 'victim_pharmacy_id_1234',
    status: 'verified', // Client attempting self-verification!
    verificationStatus: 'verified',
    verificationReason: 'Self-approved',
    decisionReason: 'Self-approved',
    nextStep: 'None',
    verifiedBy: 'attacker_user_id_6789',
    verifiedAt: new Date().toISOString(),
    _id: 'injected_object_id',
    id: 'injected_id',
  };

  const sanitized = sanitizeClientPayload(maliciousClientPayload);

  assert.equal(sanitized.name, 'Tampered Pharmacy');
  assert.equal(sanitized.phone, '+8801711223344');

  // Verify all injected identity/status fields were stripped
  assert.equal(sanitized.ownerId, undefined, 'ownerId must be stripped');
  assert.equal(sanitized.pharmacyId, undefined, 'pharmacyId must be stripped');
  assert.equal(sanitized.status, undefined, 'status must be stripped');
  assert.equal(sanitized.verificationStatus, undefined, 'verificationStatus must be stripped');
  assert.equal(sanitized.verifiedBy, undefined, 'verifiedBy must be stripped');
  assert.equal(sanitized._id, undefined, '_id must be stripped');
});

test('Security: Pharmacy Owner RBAC role enforcement', () => {
  // Unauthenticated user
  assert.throws(
    () => assertPharmacyRole(null),
    (err) => err instanceof AuthorizationError && err.status === 401 && err.code === 'UNAUTHORIZED'
  );

  // Non-pharmacy customer role
  assert.throws(
    () => assertPharmacyRole({ userId: 'cust_123', role: 'CUSTOMER' }),
    (err) => err instanceof AuthorizationError && err.status === 403 && err.code === 'FORBIDDEN'
  );

  // Authorized PHARMACY role succeeds
  assert.doesNotThrow(() => {
    assertPharmacyRole({ userId: 'owner_123', role: 'PHARMACY' });
  });
});

test('Security: Cross-tenant pharmacy ownership assertion', () => {
  const genuineOwnerId = new mongoose.Types.ObjectId();
  const attackerUserId = new mongoose.Types.ObjectId();

  const mockPharmacy = new Pharmacy({
    _id: new mongoose.Types.ObjectId(),
    ownerId: genuineOwnerId,
    name: 'Genuine Pharmacy',
    phone: '+8801711223344',
    address: 'Dhaka',
    licenseNo: 'DGDA-1111',
    location: { type: 'Point', coordinates: [90.38, 23.75] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
    status: 'verified',
  });

  // Legitimate owner access succeeds
  assert.doesNotThrow(() => {
    assertPharmacyOwnership(mockPharmacy, genuineOwnerId.toString());
  });

  // Cross-tenant access attempt by different authenticated user is rejected with 403
  assert.throws(
    () => assertPharmacyOwnership(mockPharmacy, attackerUserId.toString()),
    (err) => {
      return (
        err instanceof AuthorizationError &&
        err.status === 403 &&
        err.code === 'PHARMACY_OWNERSHIP_DENIED'
      );
    },
    'Cross-tenant access attempt must be rejected with 403 PHARMACY_OWNERSHIP_DENIED'
  );
});

test('Security: Verification gatekeeping rejects inventory writes when unverified', () => {
  // Pending review status -> writes locked (403)
  assert.throws(
    () => assertPharmacyVerifiedForInventoryWrite('pending'),
    (err) => {
      return (
        err instanceof AuthorizationError &&
        err.status === 403 &&
        err.code === 'PHARMACY_NOT_VERIFIED'
      );
    }
  );

  // Rejected status -> writes locked (403)
  assert.throws(
    () => assertPharmacyVerifiedForInventoryWrite('rejected'),
    (err) => err instanceof AuthorizationError && err.code === 'PHARMACY_NOT_VERIFIED'
  );

  // Suspended status -> writes locked (403)
  assert.throws(
    () => assertPharmacyVerifiedForInventoryWrite('suspended'),
    (err) => err instanceof AuthorizationError && err.code === 'PHARMACY_NOT_VERIFIED'
  );

  // Verified status -> writes permitted
  assert.doesNotThrow(() => {
    assertPharmacyVerifiedForInventoryWrite('verified');
  });
});
