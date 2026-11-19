// backend/tests/pharmacyProfileAndHours.test.mjs
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
  adminSetApplicationStatus,
} from '../dist/services/pharmacyApplicationService.js';
import {
  syntheticDhakaLocation,
  syntheticPharmacyApplicationPayload,
  syntheticVerifiedPharmacy,
  syntheticSuspendedPharmacy,
} from '../dist/fixtures/syntheticFixtures.js';
import {
  createDefaultWeeklyHours,
  formatWeeklyHours,
} from '../dist/validation/commonValidators.js';

const app = server.default || server;
const request = createTestClient(app);

function authHeader(userId = 'owner_usr_001', role = 'PHARMACY') {
  return {
    Authorization: `Bearer local_session_${userId}`,
    'x-test-role': role,
  };
}

test('GET /owner/pharmacy — Authentication, Authorization & 404 Unsubmitted', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  // 1. Missing Authorization header -> 401 UNAUTHORIZED
  const resNoAuth = await request.get('/api/owner/pharmacy');
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.error?.code, 'UNAUTHORIZED');

  // 2. Non-pharmacy customer role -> 403 FORBIDDEN
  const resForbidden = await request
    .get('/api/owner/pharmacy')
    .set(authHeader('cust_999', 'CUSTOMER'));
  assert.equal(resForbidden.status, 403);
  assert.equal(resForbidden.body.error?.code, 'FORBIDDEN');

  // 3. Authenticated owner with no submitted application or pharmacy record -> 404 NOT_FOUND
  const resNotFound = await request
    .get('/api/owner/pharmacy')
    .set(authHeader('fresh_owner_no_records'));
  assert.equal(resNotFound.status, 404);
  assert.equal(resNotFound.body.error?.code, 'NOT_FOUND');
});

test('GET /owner/pharmacy — Resolves Verified, Pending, Rejected, and Suspended Statuses', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  // Case A: Verified Pharmacy
  const verifiedOwnerId = 'owner_usr_verified_101';
  await seedPharmacy({
    ownerId: verifiedOwnerId,
    name: 'Verified Model Pharmacy',
    status: 'verified',
    licenseNo: 'DGDA/DH-2024-1111',
    phone: '+8801711223344',
  });

  const resVerified = await request
    .get('/api/owner/pharmacy')
    .set(authHeader(verifiedOwnerId));
  assert.equal(resVerified.status, 200);
  assert.ok(resVerified.body.data);
  assert.equal(resVerified.body.data.status, 'verified');
  assert.equal(resVerified.body.data.name, 'Verified Model Pharmacy');
  assert.equal(resVerified.body.data.licenseNo, 'DGDA/DH-2024-1111');

  // Case B: Pending Application — returns application data as profile with status strictly 'pending'
  const pendingOwnerId = 'owner_usr_pending_202';
  await submitApplication(pendingOwnerId, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Pending Review Chemist',
    licenseNo: 'DGDA/DH-2024-2222',
  });

  const resPending = await request
    .get('/api/owner/pharmacy')
    .set(authHeader(pendingOwnerId));
  assert.equal(resPending.status, 200);
  assert.ok(resPending.body.data);
  assert.equal(resPending.body.data.status, 'pending');
  assert.equal(resPending.body.data.name, 'Pending Review Chemist');
  assert.equal(resPending.body.data.licenseNo, 'DGDA/DH-2024-2222');

  // Case C: Rejected Application — returns rejection reason & nextStep guidance
  const rejectedOwnerId = 'owner_usr_rejected_303';
  const submittedApp = await submitApplication(rejectedOwnerId, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Rejected Review Chemist',
    licenseNo: 'DGDA/DH-2024-3333',
  });
  await adminSetApplicationStatus(
    submittedApp._id,
    'rejected',
    'Uploaded licence scan is blurred and illegible.',
    'Please submit a clear high-res scan of Form 24.'
  );

  const resRejected = await request
    .get('/api/owner/pharmacy')
    .set(authHeader(rejectedOwnerId));
  assert.equal(resRejected.status, 200);
  assert.ok(resRejected.body.data);
  assert.equal(resRejected.body.data.status, 'rejected');
  assert.equal(resRejected.body.data.decisionReason, 'Uploaded licence scan is blurred and illegible.');
  assert.equal(resRejected.body.data.nextStep, 'Please submit a clear high-res scan of Form 24.');

  // Case D: Suspended Pharmacy Profile
  const suspendedOwnerId = 'owner_usr_suspended_404';
  await seedPharmacy({
    ownerId: suspendedOwnerId,
    name: 'Suspended Pharmacy Outlet',
    status: 'suspended',
    licenseNo: 'DGDA/DH-2024-4444',
  });

  const resSuspended = await request
    .get('/api/owner/pharmacy')
    .set(authHeader(suspendedOwnerId));
  assert.equal(resSuspended.status, 200);
  assert.equal(resSuspended.body.data.status, 'suspended');
});

test('PATCH /owner/pharmacy — Update Allowlisted Profile Fields Successfully', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  const ownerId = 'owner_usr_editor_501';
  await seedPharmacy({
    ownerId,
    name: 'Old Pharmacy Trade Name',
    ownerName: 'Old Owner',
    phone: '+8801711000000',
    email: 'old@example.com',
    streetAddress: 'Old Street 1',
    area: 'Old Area',
    city: 'Dhaka',
    postalCode: '1000',
    latitude: 23.7500,
    longitude: 90.3800,
    location: { type: 'Point', coordinates: [90.3800, 23.7500] },
    status: 'verified',
  });

  const updatePayload = {
    name: 'Updated Care Model Pharmacy',
    ownerName: 'Dr. Salma Begum',
    phone: '+8801812345678',
    email: 'salma@updatedcare.example',
    streetAddress: 'House 55, Road 11',
    area: 'Banani',
    city: 'Dhaka',
    postalCode: '1213',
    latitude: 23.7937,
    longitude: 90.4043,
    location: {
      type: 'Point',
      coordinates: [90.4043, 23.7937],
    },
  };

  const res = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send(updatePayload);

  assert.equal(res.status, 200);
  assert.ok(res.body.data);
  const updated = res.body.data;
  assert.equal(updated.name, 'Updated Care Model Pharmacy');
  assert.equal(updated.ownerName, 'Dr. Salma Begum');
  assert.equal(updated.phone, '+8801812345678');
  assert.equal(updated.email, 'salma@updatedcare.example');
  assert.equal(updated.streetAddress, 'House 55, Road 11');
  assert.equal(updated.area, 'Banani');
  assert.equal(updated.city, 'Dhaka');
  assert.equal(updated.postalCode, '1213');
  assert.equal(updated.latitude, 23.7937);
  assert.equal(updated.longitude, 90.4043);
  assert.equal(updated.location.type, 'Point');
  assert.deepEqual(updated.location.coordinates, [90.4043, 23.7937]);

  // Read back to confirm authoritative persistence
  const resRead = await request
    .get('/api/owner/pharmacy')
    .set(authHeader(ownerId));
  assert.equal(resRead.body.data.name, 'Updated Care Model Pharmacy');
  assert.equal(resRead.body.data.area, 'Banani');
  assert.deepEqual(resRead.body.data.location.coordinates, [90.4043, 23.7937]);
});

test('PATCH /owner/pharmacy — Preserve Compatibility With structuredHours in Profile Payload', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  const ownerId = 'owner_usr_hours_compat_601';
  await seedPharmacy({
    ownerId,
    name: 'Schedule Test Pharmacy',
    status: 'verified',
  });

  const customHours = createDefaultWeeklyHours();
  customHours.monday = { isOpen: true, openTime: '07:00', closeTime: '23:30', is24Hours: false };
  customHours.friday = { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true };
  customHours.sunday = { isOpen: false, openTime: '', closeTime: '' };

  const res = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send({
      name: 'Schedule Test Pharmacy',
      structuredHours: customHours,
    });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.structuredHours);
  assert.equal(res.body.data.structuredHours.monday.openTime, '07:00');
  assert.equal(res.body.data.structuredHours.monday.closeTime, '23:30');
  assert.equal(res.body.data.structuredHours.friday.is24Hours, true);
  assert.equal(res.body.data.structuredHours.sunday.isOpen, false);

  // Authoritative openingHours string summary derived from structuredHours
  assert.ok(res.body.data.openingHours.includes('Mon: 07:00 - 23:30'));
  assert.ok(res.body.data.openingHours.includes('Fri: 24 Hours'));
  assert.ok(res.body.data.openingHours.includes('Sun: Closed'));

  // Opening hours endpoint immediately matches
  const resHours = await request
    .get('/api/owner/pharmacy/opening-hours')
    .set(authHeader(ownerId));
  assert.equal(resHours.status, 200);
  assert.equal(resHours.body.data.structuredHours.monday.openTime, '07:00');
  assert.equal(resHours.body.data.openingHours, res.body.data.openingHours);
});

test('PATCH /owner/pharmacy — Strictly Rejects Protected Regulatory Credentials (HTTP 422)', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  const ownerId = 'owner_usr_attacker_701';
  await seedPharmacy({
    ownerId,
    name: 'Tamper Test Pharmacy',
    status: 'verified',
    licenseNo: 'ORIGINAL-DGDA-1111',
  });

  const maliciousPayload = {
    name: 'Tampered Pharmacy',
    licenseNo: 'NEW-DGDA-INJECTED-9999',
    issuingAuthority: 'Forged Authority',
    licenseExpiryDate: '2035-01-01',
    licenseType: 'Wholesale Special',
  };

  const res = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send(maliciousPayload);

  assert.equal(res.status, 422);
  assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error?.fields?.licenseNo, 'Must flag licenseNo as protected');
  assert.ok(res.body.error?.fields?.issuingAuthority, 'Must flag issuingAuthority as protected');
  assert.ok(res.body.error?.fields?.licenseExpiryDate, 'Must flag licenseExpiryDate as protected');
  assert.ok(res.body.error?.fields?.licenseType, 'Must flag licenseType as protected');

  // Verify license was NOT modified
  const resCheck = await request
    .get('/api/owner/pharmacy')
    .set(authHeader(ownerId));
  assert.equal(resCheck.body.data.licenseNo, 'ORIGINAL-DGDA-1111');
});

test('PATCH /owner/pharmacy — Strips Server-Controlled Fields & Status Injection', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  const ownerId = 'owner_usr_pending_tamper_801';
  await submitApplication(ownerId, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Pending Tamper Outlet',
    licenseNo: 'DGDA/TAMPER-801',
  });

  const injectionPayload = {
    name: 'Renamed Pending Outlet',
    status: 'verified',
    verificationStatus: 'verified',
    ownerId: 'injected_attacker_user',
    pharmacyId: 'injected_pharmacy_id',
    verifiedBy: 'injected_admin_id',
    verifiedAt: new Date().toISOString(),
  };

  const res = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send(injectionPayload);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.name, 'Renamed Pending Outlet');
  // Status must remain strictly 'pending'
  assert.equal(res.body.data.status, 'pending');
  // Owner ID must remain server-authoritative
  assert.equal(res.body.data.ownerId, ownerId);
});

test('PATCH /owner/pharmacy — Coordinate Validation: Bounds, Incomplete & Contradictory Pairs', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  const ownerId = 'owner_usr_coords_901';
  await seedPharmacy({
    ownerId,
    name: 'Coords Test Pharmacy',
    status: 'verified',
  });

  // 1. Latitude out of bounds (> 90)
  const resBadLat = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send({ latitude: 95.0, longitude: 90.0 });
  assert.equal(resBadLat.status, 422);
  assert.ok(resBadLat.body.error?.fields?.latitude);

  // 2. Longitude out of bounds (> 180)
  const resBadLng = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send({ latitude: 23.0, longitude: 195.0 });
  assert.equal(resBadLng.status, 422);
  assert.ok(resBadLng.body.error?.fields?.longitude);

  // 3. Incomplete coordinate pair: latitude supplied without longitude
  const resIncompleteLat = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send({ latitude: 23.75 });
  assert.equal(resIncompleteLat.status, 422);
  assert.ok(resIncompleteLat.body.error?.fields?.longitude);

  // 4. Incomplete coordinate pair: longitude supplied without latitude
  const resIncompleteLng = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send({ longitude: 90.38 });
  assert.equal(resIncompleteLng.status, 422);
  assert.ok(resIncompleteLng.body.error?.fields?.latitude);

  // 5. Contradictory pair: explicit lat/lng does not match GeoJSON Point coordinates
  const resContradictory = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(ownerId))
    .send({
      latitude: 23.75,
      longitude: 90.38,
      location: {
        type: 'Point',
        coordinates: [90.50, 23.90], // Mismatched coordinates
      },
    });
  assert.equal(resContradictory.status, 422);
  assert.ok(resContradictory.body.error?.fields?.latitude || resContradictory.body.error?.fields?.longitude);
});

test('PATCH & PUT — State Gatekeeping: Suspended & Rejected Access Rejection', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  // 1. Suspended Pharmacy -> 403 FORBIDDEN_SUSPENDED
  const suspendedOwner = 'owner_usr_suspended_guard';
  await seedPharmacy({
    ownerId: suspendedOwner,
    name: 'Suspended Outlet Guard',
    status: 'suspended',
  });

  const resPatchSuspended = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(suspendedOwner))
    .send({ name: 'Attempted Renaming' });
  assert.equal(resPatchSuspended.status, 403);
  assert.equal(resPatchSuspended.body.error?.code, 'FORBIDDEN_SUSPENDED');

  const resPutSuspended = await request
    .put('/api/owner/pharmacy/opening-hours')
    .set(authHeader(suspendedOwner))
    .send({ structuredHours: createDefaultWeeklyHours() });
  assert.equal(resPutSuspended.status, 403);
  assert.equal(resPutSuspended.body.error?.code, 'FORBIDDEN_SUSPENDED');

  // 2. Rejected Application -> 403 FORBIDDEN_REJECTED
  const rejectedOwner = 'owner_usr_rejected_guard';
  const app = await submitApplication(rejectedOwner, {
    ...syntheticPharmacyApplicationPayload,
    name: 'Rejected Outlet Guard',
    licenseNo: 'DGDA/GUARD-REJECTED',
  });
  await adminSetApplicationStatus(app._id, 'rejected', 'Missing proof of pharmacist.');

  const resPatchRejected = await request
    .patch('/api/owner/pharmacy')
    .set(authHeader(rejectedOwner))
    .send({ name: 'Direct Edit Attempt' });
  assert.equal(resPatchRejected.status, 403);
  assert.equal(resPatchRejected.body.error?.code, 'FORBIDDEN_REJECTED');
});

test('GET & PUT /owner/pharmacy/opening-hours — Schedule Validation and Atomic Persistence', async () => {
  clearInMemoryPharmacyStore();
  clearApplicationStore();

  const ownerId = 'owner_usr_hours_endpoint_test';
  await seedPharmacy({
    ownerId,
    name: 'Operating Hours Dedicated Test',
    status: 'verified',
  });

  // 1. GET initial schedule
  const resInitial = await request
    .get('/api/owner/pharmacy/opening-hours')
    .set(authHeader(ownerId));
  assert.equal(resInitial.status, 200);
  assert.ok(resInitial.body.data?.structuredHours);
  assert.ok(resInitial.body.data?.openingHours);

  // 2. Reject closing time earlier than opening time (HTTP 422)
  const invalidSchedule = createDefaultWeeklyHours();
  invalidSchedule.monday = {
    isOpen: true,
    openTime: '22:00',
    closeTime: '09:00', // Overnight not supported in frontend validation
    is24Hours: false,
  };

  const resInvalid = await request
    .put('/api/owner/pharmacy/opening-hours')
    .set(authHeader(ownerId))
    .send({ structuredHours: invalidSchedule });

  assert.equal(resInvalid.status, 422);
  assert.equal(resInvalid.body.error?.code, 'VALIDATION_ERROR');
  assert.ok(
    resInvalid.body.error?.fields?.['structuredHours.monday.closeTime'] ||
    resInvalid.body.error?.fields?.['openingHours.monday.closeTime'],
    'Must return field-level error on monday closeTime'
  );

  // 3. Reject all days closed (HTTP 422)
  const allClosedSchedule = createDefaultWeeklyHours();
  for (const day of Object.keys(allClosedSchedule)) {
    allClosedSchedule[day] = { isOpen: false, openTime: '', closeTime: '' };
  }

  const resAllClosed = await request
    .put('/api/owner/pharmacy/opening-hours')
    .set(authHeader(ownerId))
    .send({ structuredHours: allClosedSchedule });

  assert.equal(resAllClosed.status, 422);
  assert.ok(
    resAllClosed.body.error?.fields?.structuredHours ||
    resAllClosed.body.error?.fields?.openingHours,
    'Must report at least one open day required'
  );

  // 4. Successful schedule replacement
  const validNewSchedule = createDefaultWeeklyHours();
  validNewSchedule.monday = { isOpen: true, openTime: '08:00', closeTime: '20:00', is24Hours: false };
  validNewSchedule.friday = { isOpen: true, openTime: '15:00', closeTime: '22:00', is24Hours: false };
  validNewSchedule.saturday = { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true };
  validNewSchedule.sunday = { isOpen: false, openTime: '', closeTime: '' };

  const resSuccess = await request
    .put('/api/owner/pharmacy/opening-hours')
    .set(authHeader(ownerId))
    .send({ structuredHours: validNewSchedule });

  assert.equal(resSuccess.status, 200);
  assert.ok(resSuccess.body.data?.structuredHours);
  assert.equal(resSuccess.body.data.structuredHours.monday.openTime, '08:00');
  assert.equal(resSuccess.body.data.structuredHours.monday.closeTime, '20:00');
  assert.equal(resSuccess.body.data.structuredHours.saturday.is24Hours, true);
  assert.equal(resSuccess.body.data.structuredHours.sunday.isOpen, false);

  // Authoritative openingHours string summary derived accurately
  assert.ok(resSuccess.body.data.openingHours.includes('Mon: 08:00 - 20:00'));
  assert.ok(resSuccess.body.data.openingHours.includes('Sat: 24 Hours'));
  assert.ok(resSuccess.body.data.openingHours.includes('Sun: Closed'));

  // Subsequent GET /owner/pharmacy immediately reflects updated canonical schedule
  const resProfile = await request
    .get('/api/owner/pharmacy')
    .set(authHeader(ownerId));
  assert.equal(resProfile.body.data.structuredHours.monday.openTime, '08:00');
  assert.equal(resProfile.body.data.openingHours, resSuccess.body.data.openingHours);
});
