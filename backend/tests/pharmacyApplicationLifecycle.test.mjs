// backend/tests/pharmacyApplicationLifecycle.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import server from '../dist/server.js';
import { createTestClient } from './testClient.mjs';
import {
  clearInMemoryStore,
  adminSetApplicationStatus,
} from '../dist/services/pharmacyApplicationService.js';
import { syntheticPharmacyApplicationPayload } from '../dist/fixtures/syntheticFixtures.js';

const app = server.default || server;
const request = createTestClient(app);

// Helper to generate a Bearer authorization token header for a given user ID and role
function authHeader(userId = 'owner_usr_001', role = 'PHARMACY') {
  return {
    Authorization: `Bearer local_session_${userId}`,
    'x-test-role': role,
  };
}

test('POST /owner/pharmacy-applications — Authentication & Authorization Enforcement', async () => {
  clearInMemoryStore();

  // 1. Missing Authorization header -> 401 UNAUTHORIZED
  const resNoAuth = await request
    .post('/api/owner/pharmacy-applications')
    .send(syntheticPharmacyApplicationPayload);

  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.error?.code, 'UNAUTHORIZED');
  assert.ok(resNoAuth.body.error?.message.includes('Authentication required'));

  // 2. Non-pharmacy customer role -> 403 FORBIDDEN
  const resForbidden = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('customer_usr_999', 'CUSTOMER'))
    .send(syntheticPharmacyApplicationPayload);

  assert.equal(resForbidden.status, 403);
  assert.equal(resForbidden.body.error?.code, 'FORBIDDEN');
  assert.ok(resForbidden.body.error?.message.includes('Pharmacy owner role required'));
});

test('POST /owner/pharmacy-applications — Validation and Field Errors (HTTP 422)', async () => {
  clearInMemoryStore();

  // Missing trade name, invalid phone, and missing address
  const invalidPayload = {
    ...syntheticPharmacyApplicationPayload,
    name: '  ',
    phone: '123',
    streetAddress: '',
  };

  const res = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_001'))
    .send(invalidPayload);

  assert.equal(res.status, 422);
  assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error?.fields?.name, 'Must report name field error');
  assert.ok(res.body.error?.fields?.phone, 'Must report phone field error');
  assert.ok(res.body.error?.fields?.streetAddress, 'Must report streetAddress field error');
});

test('POST /owner/pharmacy-applications — Successful Submission & Trust Boundaries', async () => {
  clearInMemoryStore();

  const clientPayload = {
    ...syntheticPharmacyApplicationPayload,
    name: 'MediTrust Model Pharmacy',
    licenseNo: '  dgda-dh-2024-8800  ',
    // Malicious client trying to inject approved status and forged owner ID
    status: 'verified',
    verificationStatus: 'verified',
    ownerId: 'injected_attacker_id',
    pharmacyId: 'injected_pharmacy_id',
    verifiedBy: 'injected_admin_id',
  };

  const res = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_001'))
    .send(clientPayload);

  assert.equal(res.status, 201);
  assert.ok(res.body.data, 'Must return data envelope');

  const appData = res.body.data;
  assert.ok(appData.applicationId, 'Must return assigned applicationId');
  // Server-authoritative: Status must strictly be 'pending', ignoring client 'verified' injection
  assert.equal(appData.status, 'pending');
  assert.equal(appData.data.name, 'MediTrust Model Pharmacy');
  // Normalized licence number: trimmed and uppercased
  assert.equal(appData.data.licenseNo, 'dgda-dh-2024-8800');
  assert.ok(appData.submittedAt);
  assert.ok(appData.message.includes('pending administrator review'));
});

test('POST /owner/pharmacy-applications — Duplicate Licence Rejection (HTTP 409)', async () => {
  clearInMemoryStore();

  // First owner submits with licence DGDA/DA-2024-9999
  const res1 = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_001'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      licenseNo: 'DGDA/DA-2024-9999',
    });
  assert.equal(res1.status, 201);

  // Second owner attempts to submit the same licence (with different casing and whitespace)
  const res2 = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_002'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      name: 'Copycat Pharmacy',
      licenseNo: '  dgda/da-2024-9999  ',
    });

  assert.equal(res2.status, 409);
  assert.equal(res2.body.error?.code, 'DUPLICATE_LICENSE');
  assert.equal(res2.body.error?.message, 'This licence number is already registered.');
  assert.ok(res2.body.error?.fields?.licenseNo);
});

test('POST /owner/pharmacy-applications — Enforce "One Active Application" Policy', async () => {
  clearInMemoryStore();

  // First submission by owner_usr_001
  const res1 = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_001'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      licenseNo: 'DGDA-TEST-001',
    });
  assert.equal(res1.status, 201);

  // Second submission attempt while first application is pending -> 409 Conflict
  const res2 = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_001'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      name: 'Second Pharmacy Attempt',
      licenseNo: 'DGDA-TEST-002',
    });

  assert.equal(res2.status, 409);
  assert.equal(res2.body.error?.code, 'ACTIVE_APPLICATION_EXISTS');
  assert.ok(res2.body.error?.message.includes('already have a pharmacy application pending'));
});

test('GET /owner/pharmacy-application — Read Status, 404 Unsubmitted & Cross-Tenant Privacy', async () => {
  clearInMemoryStore();

  // 1. Owner with no submitted application -> 404 NOT_FOUND (frontend safely maps this to null)
  const resNotFound = await request
    .get('/api/owner/pharmacy-application')
    .set(authHeader('owner_unsubmitted'));

  assert.equal(resNotFound.status, 404);
  assert.equal(resNotFound.body.error?.code, 'NOT_FOUND');
  assert.ok(resNotFound.body.error?.message.includes('No submitted pharmacy application found'));

  // 2. Submit application for owner_usr_001
  const submitRes = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_001'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      name: 'Owner 1 Pharmacy',
      licenseNo: 'DGDA-OWNER1',
    });
  assert.equal(submitRes.status, 201);

  // 3. Owner 1 reads own application -> 200 OK with formatted application
  const resOwner1 = await request
    .get('/api/owner/pharmacy-application')
    .set(authHeader('owner_usr_001'));

  assert.equal(resOwner1.status, 200);
  assert.equal(resOwner1.body.data?.data?.name, 'Owner 1 Pharmacy');
  assert.equal(resOwner1.body.data?.status, 'pending');

  // 4. Cross-tenant privacy: Owner 2 checks status -> returns 404 (does NOT see Owner 1's application)
  const resOwner2 = await request
    .get('/api/owner/pharmacy-application')
    .set(authHeader('owner_usr_002'));

  assert.equal(resOwner2.status, 404);
  assert.equal(resOwner2.body.error?.code, 'NOT_FOUND');
});

test('PATCH /owner/pharmacy-application — Correct & Resubmit Existing Application', async () => {
  clearInMemoryStore();

  // Submit initial application
  await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_001'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      name: 'Initial Trade Name',
      licenseNo: 'DGDA-PATCH-1',
    });

  // Owner patches trade name, street address, and contact phone
  const patchRes = await request
    .patch('/api/owner/pharmacy-application')
    .set(authHeader('owner_usr_001'))
    .send({
      name: 'Corrected Trade Name Pharmacy',
      streetAddress: 'House 99, Road 11, Gulshan 2',
      phone: '+8801812345678',
      // Injected malicious status must be ignored
      status: 'verified',
    });

  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.data?.data?.name, 'Corrected Trade Name Pharmacy');
  assert.equal(patchRes.body.data?.data?.streetAddress, 'House 99, Road 11, Gulshan 2');
  assert.equal(patchRes.body.data?.data?.phone, '+8801812345678');
  assert.equal(patchRes.body.data?.status, 'pending', 'Status remains server-controlled pending');

  // Verify persistent retrieval
  const getRes = await request
    .get('/api/owner/pharmacy-application')
    .set(authHeader('owner_usr_001'));

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.data?.data?.name, 'Corrected Trade Name Pharmacy');
});

test('Lifecycle: Rejected Application Correction & Duplicate Prevention', async () => {
  clearInMemoryStore();

  // 1. Submit initial application
  const submitRes = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_rejected'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      name: 'Pharmacy Awaiting Review',
      licenseNo: 'DGDA-REJECT-TEST',
    });
  const appId = submitRes.body.data.applicationId;

  // 2. Admin workflow (Developer 3) rejects application with reason & nextStep
  await adminSetApplicationStatus(
    appId,
    'rejected',
    'Uploaded DGDA license certificate was expired or unreadable.',
    'Please provide your current renewed Form 24 licence document and resubmit.'
  );

  // 3. Owner loads status -> sees rejected state and decision feedback
  const getRejected = await request
    .get('/api/owner/pharmacy-application')
    .set(authHeader('owner_usr_rejected'));

  assert.equal(getRejected.status, 200);
  assert.equal(getRejected.body.data.status, 'rejected');
  assert.equal(getRejected.body.data.decisionReason, 'Uploaded DGDA license certificate was expired or unreadable.');
  assert.equal(getRejected.body.data.nextStep, 'Please provide your current renewed Form 24 licence document and resubmit.');

  // 4. Owner corrects and resubmits via POST /owner/pharmacy-applications (or PATCH)
  // Per business rule, this updates the existing rejected application rather than creating a duplicate
  const resubmitRes = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_rejected'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      name: 'Pharmacy Awaiting Review (Updated)',
      licenseNo: 'DGDA-REJECT-TEST',
      licenseExpiryDate: '2029-12-31',
      notes: 'Attached renewed licence certificate.',
    });

  // Must update existing application (preserving ID) rather than creating duplicate
  assert.equal(resubmitRes.status, 201);
  assert.equal(resubmitRes.body.data.applicationId, appId);
  assert.equal(resubmitRes.body.data.status, 'pending');
  assert.equal(resubmitRes.body.data.data.name, 'Pharmacy Awaiting Review (Updated)');
});

test('DELETE /owner/pharmacy-applications/:applicationId — Lifecycle Deletion Policy', async () => {
  clearInMemoryStore();

  // 1. Submit pending application
  const submitRes = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_del'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      licenseNo: 'DGDA-DELETE-TEST',
    });
  const appId = submitRes.body.data.applicationId;

  // 2. Cross-tenant deletion attempt: Owner 2 tries to delete Owner 1's application -> 403
  const resCrossDelete = await request
    .delete(`/api/owner/pharmacy-applications/${appId}`)
    .set(authHeader('owner_usr_other'));

  assert.equal(resCrossDelete.status, 403);
  assert.equal(resCrossDelete.body.error?.code, 'PHARMACY_OWNERSHIP_DENIED');

  // 3. Deletion by genuine owner while pending -> 200 OK
  const resDeleteSuccess = await request
    .delete(`/api/owner/pharmacy-applications/${appId}`)
    .set(authHeader('owner_usr_del'));

  assert.equal(resDeleteSuccess.status, 200);

  // 4. Verify application is removed -> 404
  const resAfterDelete = await request
    .get('/api/owner/pharmacy-application')
    .set(authHeader('owner_usr_del'));

  assert.equal(resAfterDelete.status, 404);

  // 5. Deletion of unapproved parameterless path (/owner/pharmacy-application)
  await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_del'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      licenseNo: 'DGDA-DELETE-TEST-2',
    });

  const resParamlessDelete = await request
    .delete('/api/owner/pharmacy-application')
    .set(authHeader('owner_usr_del'));

  assert.equal(resParamlessDelete.status, 200);
});

test('DELETE Policy — Strictly Forbid Deletion of Approved (Verified) or Suspended Records', async () => {
  clearInMemoryStore();

  // 1. Approved application cannot be deleted (403 FORBIDDEN_APPROVED)
  const submitRes1 = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_approved'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      licenseNo: 'DGDA-APPROVED-1',
    });
  const approvedAppId = submitRes1.body.data.applicationId;
  await adminSetApplicationStatus(approvedAppId, 'verified');

  const resDeleteApproved = await request
    .delete(`/api/owner/pharmacy-applications/${approvedAppId}`)
    .set(authHeader('owner_usr_approved'));

  assert.equal(resDeleteApproved.status, 403);
  assert.equal(resDeleteApproved.body.error?.code, 'FORBIDDEN_APPROVED');
  assert.ok(resDeleteApproved.body.error?.message.includes('Approved pharmacy applications cannot be deleted'));

  // 2. Suspended application cannot be deleted (403 FORBIDDEN_SUSPENDED)
  const submitRes2 = await request
    .post('/api/owner/pharmacy-applications')
    .set(authHeader('owner_usr_suspended'))
    .send({
      ...syntheticPharmacyApplicationPayload,
      licenseNo: 'DGDA-SUSPENDED-1',
    });
  const suspendedAppId = submitRes2.body.data.applicationId;
  await adminSetApplicationStatus(suspendedAppId, 'suspended');

  const resDeleteSuspended = await request
    .delete(`/api/owner/pharmacy-applications/${suspendedAppId}`)
    .set(authHeader('owner_usr_suspended'));

  assert.equal(resDeleteSuspended.status, 403);
  assert.equal(resDeleteSuspended.body.error?.code, 'FORBIDDEN_SUSPENDED');
  assert.ok(resDeleteSuspended.body.error?.message.includes('Suspended pharmacy records cannot be deleted'));
});
