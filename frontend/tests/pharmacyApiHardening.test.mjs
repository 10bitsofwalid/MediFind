// frontend/tests/pharmacyApiHardening.test.mjs
// Exercises the real api.ts (request/response interceptors), authService.ts,
// pharmacyService.ts, and stockService.ts against an in-process Axios contract adapter
// simulating the MediFind team API responses and failure modes without binding OS ports.

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

// Allow Node's native TypeScript loader to resolve extensionless relative TS imports used by Vite
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

// Minimal browser storage & window shims for exercising frontend services in Node
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const localStorageShim = new MemoryStorage();
const sessionStorageShim = new MemoryStorage();
const dispatchedEvents = [];
const assignedUrls = [];

globalThis.localStorage = localStorageShim;
globalThis.sessionStorage = sessionStorageShim;
globalThis.window = {
  location: {
    pathname: '/pharmacy/inventory',
    search: '?filter=stale',
    assign(url) {
      assignedUrls.push(url);
    },
  },
  dispatchEvent(evt) {
    dispatchedEvents.push(evt);
    return true;
  },
};

const { AxiosError } = await import('axios');
const { api, SESSION_EXPIRED_EVENT, isSafeReturnPath, resetSessionExpiryGuard } = await import(
  '../src/services/api.ts'
);
const { authService, AuthServiceError } = await import('../src/services/authService.ts');
const {
  submitPharmacyApplication,
  updatePharmacyApplication,
  getPharmacyApplication,
  getPharmacyProfile,
  updatePharmacyProfile,
  PharmacyServiceError,
  createDefaultWeeklyHours,
} = await import('../src/services/pharmacyService.ts');
const { stockService, StockServiceError } = await import('../src/services/stockService.ts');

let routeHandler = () => ({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found' } } });
const receivedRequests = [];

function normalizeHeaders(headers) {
  const out = {};
  if (!headers) return out;
  const raw = typeof headers.toJSON === 'function' ? headers.toJSON() : headers;
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) out[k.toLowerCase()] = String(v);
  }
  return out;
}

// In-process Axios adapter that faithfully enforces timeout, AbortSignal, and HTTP status semantics
api.defaults.baseURL = 'http://contract.medifind.local/api';
api.defaults.adapter = async (config) => {
  const method = (config.method || 'get').toUpperCase();
  const base = (config.baseURL || '').replace(/\/+$/, '');
  const rel = (config.url || '').startsWith('/') ? config.url : `/${config.url || ''}`;
  const fullUrl = new URL(`${base}${rel}`);
  if (config.params && typeof config.params === 'object') {
    for (const [k, v] of Object.entries(config.params)) {
      if (v !== undefined && v !== null) fullUrl.searchParams.set(k, String(v));
    }
  }

  let parsedBody = config.data;
  if (typeof config.data === 'string' && config.data.trim()) {
    try {
      parsedBody = JSON.parse(config.data);
    } catch {
      parsedBody = config.data;
    }
  }

  const headers = normalizeHeaders(config.headers);
  receivedRequests.push({
    method,
    pathname: fullUrl.pathname,
    searchParams: Object.fromEntries(fullUrl.searchParams.entries()),
    headers,
    body: parsedBody,
  });

  if (config.signal?.aborted) {
    throw new AxiosError('Request canceled', 'ERR_CANCELED', config);
  }

  const outcome = await routeHandler({
    method,
    pathname: fullUrl.pathname,
    searchParams: fullUrl.searchParams,
    headers,
    body: parsedBody,
  });

  if (outcome.delayMs) {
    const timeoutMs = config.timeout || 0;
    if (timeoutMs > 0 && outcome.delayMs > timeoutMs) {
      await new Promise((r) => setTimeout(r, timeoutMs));
      throw new AxiosError(`timeout of ${timeoutMs}ms exceeded`, 'ECONNABORTED', config);
    }
    await new Promise((r) => setTimeout(r, outcome.delayMs));
  }

  if (config.signal?.aborted) {
    throw new AxiosError('Request canceled', 'ERR_CANCELED', config);
  }

  if (outcome.networkError) {
    throw new AxiosError('Network Error', 'ERR_NETWORK', config);
  }

  const response = {
    data: outcome.body,
    status: outcome.status,
    statusText: String(outcome.status),
    headers: { 'content-type': outcome.contentType || 'application/json' },
    config,
  };

  if (outcome.status >= 200 && outcome.status < 300) {
    return response;
  }

  throw new AxiosError(
    `Request failed with status code ${outcome.status}`,
    outcome.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    config,
    null,
    response
  );
};

beforeEach(() => {
  localStorageShim.clear();
  sessionStorageShim.clear();
  localStorageShim.setItem('medifind_dev_mock_api', 'false');
  dispatchedEvents.length = 0;
  assignedUrls.length = 0;
  receivedRequests.length = 0;
  resetSessionExpiryGuard();
  api.defaults.timeout = 15000;
  globalThis.window.location.pathname = '/pharmacy/inventory';
  globalThis.window.location.search = '?filter=stale';
});

const SAMPLE_APPLICATION = {
  name: 'Beacon Care Pharmacy',
  ownerName: 'Dr. Farhana Ahmed',
  phone: '+8801711223344',
  email: 'owner@beaconcare.test',
  streetAddress: 'House 14, Road 7',
  city: 'Dhaka',
  area: 'Dhanmondi',
  postalCode: '1209',
  formattedAddress: 'House 14, Road 7, Dhanmondi, Dhaka - 1209',
  licenseNo: 'DGDA-DHK-90421',
  issuingAuthority: 'DGDA',
  latitude: 23.7465,
  longitude: 90.376,
  location: { type: 'Point', coordinates: [90.376, 23.7465] },
  openingHours: 'Mon: 08:30 - 22:30',
  structuredHours: createDefaultWeeklyHours(),
};

test('isSafeReturnPath accepts internal workspace routes and blocks open redirects', () => {
  assert.equal(isSafeReturnPath('/pharmacy/inventory'), true);
  assert.equal(isSafeReturnPath('/pharmacy/profile?edit=true'), true);
  assert.equal(isSafeReturnPath('//evil.example/phish'), false);
  assert.equal(isSafeReturnPath('https://evil.example'), false);
  assert.equal(isSafeReturnPath('/login?reason=session_expired'), false);
  assert.equal(isSafeReturnPath('/register'), false);
  assert.equal(isSafeReturnPath(''), false);
});

test('Auth journey: register normalizes envelope/role, login 401 does NOT trigger session expiry, logout sends Bearer token', async () => {
  routeHandler = ({ method, pathname, body }) => {
    if (method === 'POST' && pathname === '/api/auth/register') {
      return {
        status: 201,
        body: {
          data: {
            accessToken: 'jwt_owner_token_1',
            user: {
              _id: 'usr_owner_1',
              name: body.name,
              email: body.email,
              role: 'pharmacy_owner',
              accountStatus: 'ACTIVE',
            },
          },
        },
      };
    }
    if (method === 'POST' && pathname === '/api/auth/login') {
      if (body.password !== 'correct-pass') {
        return {
          status: 401,
          body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } },
        };
      }
      return {
        status: 200,
        body: {
          data: {
            token: 'jwt_owner_token_2',
            user: { id: 'usr_owner_1', name: 'Dr. Farhana', email: body.email, role: 'PHARMACY' },
          },
        },
      };
    }
    if (method === 'GET' && pathname === '/api/me') {
      return {
        status: 200,
        body: {
          data: {
            id: 'usr_owner_1',
            name: 'Dr. Farhana Ahmed',
            email: 'owner@beaconcare.test',
            role: 'PHARMACY',
            status: 'active',
            pharmacyId: 'ph_101',
          },
        },
      };
    }
    if (method === 'POST' && pathname === '/api/auth/logout') {
      return { status: 204, body: {} };
    }
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found' } } };
  };

  // 1. Register normalizes _id, accessToken, and role variant
  const reg = await authService.register({
    name: 'Dr. Farhana',
    email: 'OWNER@BeaconCare.test',
    password: 'password123',
    role: 'PHARMACY',
  });
  assert.equal(reg.token, 'jwt_owner_token_1');
  assert.equal(reg.user.id, 'usr_owner_1');
  assert.equal(reg.user.role, 'PHARMACY');

  // 2. Wrong password on /auth/login returns 401 error WITHOUT triggering session-expired redirect
  await assert.rejects(
    () => authService.login({ email: 'owner@beaconcare.test', password: 'wrong' }),
    (err) => err instanceof AuthServiceError && err.status === 401
  );
  assert.equal(dispatchedEvents.length, 0, '401 on login must not fire SESSION_EXPIRED_EVENT');
  assert.equal(assignedUrls.length, 0, '401 on login must not hard-redirect');

  // 3. Valid login + GET /me hydration
  const loggedIn = await authService.login({
    email: 'owner@beaconcare.test',
    password: 'correct-pass',
  });
  assert.equal(loggedIn.token, 'jwt_owner_token_2');
  const me = await authService.getMe();
  assert.equal(me?.pharmacyId, 'ph_101');

  // 4. Logout clears storage immediately AND still transmits Bearer token to server
  authService.logout();
  assert.equal(authService.getToken(), null);
  await new Promise((r) => setTimeout(r, 20));
  const logoutReq = receivedRequests.find((r) => r.pathname === '/api/auth/logout');
  assert.ok(logoutReq, 'POST /auth/logout should be invoked');
  assert.equal(logoutReq.headers.authorization, 'Bearer jwt_owner_token_2');
});

test('Session expiry (401) during in-flight protected request clears auth, emits event, and deduplicates redirects', async () => {
  localStorageShim.setItem('token', 'expired_jwt');
  localStorageShim.setItem(
    'user',
    JSON.stringify({ id: 'usr_1', name: 'Owner', email: 'o@test.com', role: 'PHARMACY', status: 'active' })
  );

  routeHandler = () => ({
    status: 401,
    body: { error: { code: 'TOKEN_EXPIRED', message: 'Session expired.' } },
  });

  // Fire two concurrent protected requests (simulating Dashboard Promise.allSettled on load)
  const results = await Promise.allSettled([getPharmacyApplication(), getPharmacyProfile()]);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[0].reason.status, 401);

  assert.equal(localStorageShim.getItem('token'), null, 'Stale token must be cleared');
  assert.equal(localStorageShim.getItem('user'), null, 'Stale user must be cleared');
  assert.equal(dispatchedEvents.length, 1, 'Concurrent 401s must deduplicate SESSION_EXPIRED_EVENT');
  assert.equal(dispatchedEvents[0].type, SESSION_EXPIRED_EVENT);
  assert.equal(assignedUrls.length, 1, 'Concurrent 401s must trigger only one redirect');
  assert.equal(
    assignedUrls[0],
    '/login?reason=session_expired&returnTo=%2Fpharmacy%2Finventory%3Ffilter%3Dstale'
  );
});

test('Pharmacy application envelope normalization, uppercase status, conflict 409, malformed HTML guard, and PATCH resubmit fallback', async () => {
  localStorageShim.setItem('token', 'valid_jwt');

  // 1. Envelope { data: ... } with uppercase status PENDING
  routeHandler = ({ method, pathname }) => {
    if (method === 'POST' && pathname === '/api/owner/pharmacy-applications') {
      return {
        status: 201,
        body: {
          data: {
            applicationId: 'app_55',
            pharmacyId: 'ph_55',
            status: 'PENDING',
            submittedAt: '2026-11-18T07:00:00.000Z',
            name: SAMPLE_APPLICATION.name,
            licenseNo: SAMPLE_APPLICATION.licenseNo,
            location: SAMPLE_APPLICATION.location,
          },
        },
      };
    }
    return { status: 404, body: {} };
  };

  const created = await submitPharmacyApplication(SAMPLE_APPLICATION);
  assert.equal(created.applicationId, 'app_55');
  assert.equal(created.status, 'pending');
  assert.equal(created.data.latitude, 23.7465);

  // 2. Duplicate license 409 preserves error.fields
  routeHandler = () => ({
    status: 409,
    body: {
      error: {
        code: 'DUPLICATE_LICENSE',
        message: 'License already exists.',
        fields: { licenseNo: 'License number already registered.' },
      },
    },
  });
  await assert.rejects(
    () => submitPharmacyApplication(SAMPLE_APPLICATION),
    (err) =>
      err instanceof PharmacyServiceError &&
      err.status === 409 &&
      err.fields?.licenseNo === 'License number already registered.'
  );

  // 3. Malformed 200 HTML SPA fallback is rejected (never falsely confirmed!)
  routeHandler = () => ({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body>SPA fallback</body></html>',
  });
  await assert.rejects(
    () => submitPharmacyApplication(SAMPLE_APPLICATION),
    (err) => err instanceof PharmacyServiceError && err.code === 'INVALID_SERVER_RESPONSE'
  );

  // 4. GET /owner/pharmacy-application 404 returns null cleanly
  routeHandler = () => ({
    status: 404,
    body: { error: { code: 'NOT_FOUND', message: 'No application yet.' } },
  });
  assert.equal(await getPharmacyApplication(), null);

  // 5. PATCH /owner/pharmacy-application falls back to POST when PATCH returns 404
  routeHandler = ({ method, pathname }) => {
    if (method === 'PATCH' && pathname === '/api/owner/pharmacy-application') {
      return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not supported' } } };
    }
    if (method === 'POST' && pathname === '/api/owner/pharmacy-applications') {
      return {
        status: 201,
        body: {
          data: {
            applicationId: 'app_56',
            status: 'Pending',
            name: SAMPLE_APPLICATION.name,
            licenseNo: SAMPLE_APPLICATION.licenseNo,
          },
        },
      };
    }
    return { status: 500, body: {} };
  };
  const resubmitted = await updatePharmacyApplication(SAMPLE_APPLICATION);
  assert.equal(resubmitted.applicationId, 'app_56');
  assert.equal(resubmitted.status, 'pending');
});

test('Profile & opening hours: coordinates/status normalization, separate opening-hours endpoints, partial PATCH merge, and 409 conflict', async () => {
  localStorageShim.setItem('token', 'valid_jwt');
  const hours = createDefaultWeeklyHours();

  routeHandler = ({ method, pathname, body }) => {
    if (method === 'GET' && pathname === '/api/owner/pharmacy') {
      return {
        status: 200,
        body: {
          data: {
            pharmacyId: 'ph_200',
            name: 'Beacon Care Pharmacy',
            ownerName: 'Dr. Farhana Ahmed',
            phone: '+8801711223344',
            email: 'owner@beaconcare.test',
            address: 'House 14, Dhanmondi, Dhaka',
            licenseNo: 'DGDA-DHK-90421',
            issuingAuthority: 'DGDA',
            status: 'VERIFIED',
            location: { type: 'Point', coordinates: [90.376, 23.7465] },
          },
        },
      };
    }
    if (method === 'GET' && pathname === '/api/owner/pharmacy/opening-hours') {
      return { status: 200, body: { data: { structuredHours: hours } } };
    }
    if (method === 'PATCH' && pathname === '/api/owner/pharmacy') {
      // Partial response omits read-only licenseNo & issuingAuthority
      return {
        status: 200,
        body: {
          data: {
            id: 'ph_200',
            name: body.name,
            phone: body.phone,
            status: 'VERIFIED',
          },
        },
      };
    }
    if (method === 'PUT' && pathname === '/api/owner/pharmacy/opening-hours') {
      return {
        status: 200,
        body: { data: { structuredHours: body.structuredHours, openingHours: body.openingHours } },
      };
    }
    return { status: 404, body: {} };
  };

  const profile = await getPharmacyProfile();
  assert.ok(profile);
  assert.equal(profile._id, 'ph_200');
  assert.equal(profile.status, 'verified');
  assert.equal(profile.latitude, 23.7465);
  assert.equal(profile.longitude, 90.376);
  assert.ok(profile.structuredHours?.monday);

  const updated = await updatePharmacyProfile(
    { name: 'Beacon Care Model Pharmacy', phone: '+8801711999888', structuredHours: hours },
    profile
  );
  assert.equal(updated.name, 'Beacon Care Model Pharmacy');
  assert.equal(updated.licenseNo, 'DGDA-DHK-90421', 'Partial PATCH must preserve read-only licenseNo');
  assert.ok(
    receivedRequests.some((r) => r.method === 'PUT' && r.pathname === '/api/owner/pharmacy/opening-hours'),
    'PUT /owner/pharmacy/opening-hours should be called when hours are saved'
  );

  // Concurrent edit 409 Conflict
  routeHandler = () => ({
    status: 409,
    body: { error: { code: 'CONFLICT', message: 'Profile was modified by another session.' } },
  });
  await assert.rejects(
    () => updatePharmacyProfile({ name: 'Another Edit' }, profile),
    (err) => err instanceof PharmacyServiceError && err.status === 409
  );
});

test('Inventory, catalogue, stock update, reconfirmation, history pagination, and summary over contract API', async () => {
  localStorageShim.setItem('token', 'valid_jwt');

  routeHandler = ({ method, pathname, searchParams, body }) => {
    if (method === 'GET' && pathname === '/api/medicines') {
      return {
        status: 200,
        body: {
          data: [
            {
              _id: 'med_10',
              brandName: 'Napa Extra',
              genericName: 'Paracetamol + Caffeine',
              strength: '500 mg + 65 mg',
              dosageForm: 'Tablet',
              isActive: true,
            },
            {
              _id: 'med_inactive',
              brandName: 'Discontinued Drug',
              genericName: 'Old',
              strength: '10 mg',
              dosageForm: 'Tablet',
              isActive: false,
            },
          ],
        },
      };
    }
    if (method === 'POST' && pathname === '/api/owner/inventory') {
      // Minimal server confirmation omitting catalogue name/generic
      return {
        status: 201,
        body: {
          data: {
            stockId: 'stk_900',
            medicineId: body.medicineId,
            status: 'AVAILABLE',
            quantity: body.quantity,
            updatedAt: '2026-11-18T07:10:00.000Z',
          },
        },
      };
    }
    if (method === 'GET' && pathname === '/api/owner/inventory') {
      return {
        status: 200,
        body: {
          data: [
            {
              _id: 'stk_900',
              status: 'LOW',
              quantity: 4,
              updatedAt: '2026-11-16T07:10:00.000Z',
              isStale: true,
              medicine: {
                _id: 'med_10',
                name: 'Napa Extra',
                genericName: 'Paracetamol + Caffeine',
                strength: '500 mg + 65 mg',
                form: 'Tablet',
              },
            },
          ],
        },
      };
    }
    if (method === 'POST' && pathname === '/api/owner/inventory/stk_900/reconfirm') {
      return {
        status: 200,
        body: {
          data: {
            stockId: 'stk_900',
            status: 'LOW',
            quantity: 4,
            isStale: false,
            updatedAt: '2026-11-18T07:15:00.000Z',
          },
        },
      };
    }
    if (method === 'GET' && pathname === '/api/owner/inventory/stk_900/history') {
      const cursor = searchParams.get('cursor');
      if (!cursor) {
        return {
          status: 200,
          body: {
            data: [
              {
                _id: 'hist_2',
                previousStatus: 'AVAILABLE',
                toStatus: 'LOW',
                timestamp: '2026-11-18T07:15:00.000Z',
                changedBy: { id: 'usr_1', name: 'Dr. Farhana' },
              },
            ],
            page: { limit: 20, nextCursor: 'cur_page_2' },
          },
        };
      }
      return {
        status: 200,
        body: {
          data: [
            {
              _id: 'hist_1',
              oldStatus: null,
              newStatus: 'AVAILABLE',
              changedAt: '2026-11-16T07:10:00.000Z',
            },
          ],
          page: { limit: 20, nextCursor: null },
        },
      };
    }
    if (method === 'GET' && pathname === '/api/owner/summary') {
      return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Summary not enabled' } } };
    }
    return { status: 404, body: {} };
  };

  // Catalogue search filters out inactive entries and normalizes _id/brandName/dosageForm
  const meds = await stockService.searchCatalogue('napa');
  assert.equal(meds.length, 1);
  assert.equal(meds[0].id, 'med_10');
  assert.equal(meds[0].name, 'Napa Extra');
  assert.equal(meds[0].form, 'Tablet');

  // Add inventory item merges catalogue metadata when server returns partial confirmation
  const added = await stockService.addInventoryItem('ph_200', {
    medicineId: 'med_10',
    medicineName: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500 mg + 65 mg',
    form: 'Tablet',
    status: 'available',
    quantity: 25,
  });
  assert.equal(added.stockId, 'stk_900');
  assert.equal(added.medicineName, 'Napa Extra');
  assert.equal(added.status, 'available');

  // Get inventory normalizes nested medicine object and uppercase LOW enum
  const items = await stockService.getInventory('ph_200');
  assert.equal(items.length, 1);
  assert.equal(items[0].medicineName, 'Napa Extra');
  assert.equal(items[0].status, 'low');
  assert.equal(items[0].isStale, true);

  // Reconfirm stock clears stale state and updates timestamp
  const reconfirmed = await stockService.reconfirmStockItem('ph_200', 'stk_900', {
    status: 'low',
    quantity: 4,
  });
  assert.equal(reconfirmed.status, 'low');
  assert.equal(reconfirmed.isStale, false);
  assert.equal(reconfirmed.updatedAt, '2026-11-18T07:15:00.000Z');

  // History normalizes aliases and supports cursor pagination
  const page1 = await stockService.getStockHistory('ph_200', 'stk_900', { limit: 20 });
  assert.equal(page1.data.length, 1);
  assert.equal(page1.data[0].oldStatus, 'available');
  assert.equal(page1.data[0].newStatus, 'low');
  assert.equal(page1.data[0].changedByName, 'Dr. Farhana');
  assert.equal(page1.page?.nextCursor, 'cur_page_2');

  const page2 = await stockService.getStockHistory('ph_200', 'stk_900', {
    limit: 20,
    cursor: page1.page?.nextCursor,
  });
  assert.equal(page2.data.length, 1);
  assert.equal(page2.page?.nextCursor, null);

  // Conditional GET /owner/summary returns null cleanly on 404 without fabricating metrics
  assert.equal(await stockService.getOwnerSummary('ph_200'), null);
});

test('Hardening failure scenarios: 403 denied, 429 rate limit, 500 server error, empty inventory, AbortSignal cancel, and slow request timeout', async () => {
  localStorageShim.setItem('token', 'valid_jwt');

  // 1. 403 Forbidden (unverified pharmacy or wrong ownership)
  routeHandler = () => ({
    status: 403,
    body: {
      error: {
        code: 'PHARMACY_NOT_VERIFIED',
        message: 'Pharmacy must be verified before updating stock.',
      },
    },
  });
  await assert.rejects(
    () => stockService.reconfirmStockItem('ph_200', 'stk_900', { status: 'available' }),
    (err) => err instanceof StockServiceError && err.status === 403 && err.code === 'PHARMACY_NOT_VERIFIED'
  );

  // 2. 429 Rate Limit
  routeHandler = () => ({
    status: 429,
    body: { error: { code: 'RATE_LIMITED', message: 'Slow down.' } },
  });
  await assert.rejects(
    () => stockService.updateStockStatus('ph_200', 'stk_900', 'available'),
    (err) => err instanceof StockServiceError && err.status === 429 && err.code === 'RATE_LIMITED'
  );

  // 3. 500 Server Error
  routeHandler = () => ({
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Database unavailable.' } },
  });
  await assert.rejects(
    () => stockService.getInventory('ph_200'),
    (err) => err instanceof StockServiceError && err.status === 500
  );

  // 4. Empty inventory results
  routeHandler = () => ({ status: 200, body: { data: [] } });
  const emptyList = await stockService.getInventory('ph_200');
  assert.deepEqual(emptyList, []);

  // 5. AbortSignal cancellation for stale catalogue search requests
  const abortController = new AbortController();
  abortController.abort();
  await assert.rejects(
    () => stockService.searchCatalogue('paracetamol', undefined, abortController.signal),
    (err) => err instanceof StockServiceError && err.code === 'CANCELED'
  );

  // 6. Slow / pending request exceeding timeout surfaces TIMEOUT cleanly
  api.defaults.timeout = 40;
  routeHandler = () => ({ status: 200, delayMs: 180, body: { data: [] } });
  await assert.rejects(
    () => stockService.getInventory('ph_200'),
    (err) => err instanceof StockServiceError && err.code === 'TIMEOUT'
  );

  // 7. Network unreachable maps cleanly to NETWORK_ERROR
  api.defaults.timeout = 15000;
  routeHandler = () => ({ networkError: true });
  await assert.rejects(
    () => stockService.getInventory('ph_200'),
    (err) => err instanceof StockServiceError && err.code === 'NETWORK_ERROR'
  );
});

test('Concurrency & Retries: If-Match, Idempotency-Key headers, and 409 conflict handling', async () => {
  localStorageShim.setItem('token', 'valid_jwt');
  receivedRequests.length = 0;

  // 1. Pharmacy profile update sends If-Match when existing profile updatedAt is present
  routeHandler = (req) => {
    if (req.method === 'PATCH' && req.pathname === '/api/owner/pharmacy') {
      assert.equal(req.headers['if-match'], '2026-11-20T10:00:00.000Z');
      assert.equal(req.headers['idempotency-key'], 'idemp_prof_01');
      return {
        status: 200,
        body: {
          data: {
            id: 'ph_200',
            name: 'Updated Name',
            status: 'verified',
            updatedAt: '2026-11-20T10:05:00.000Z',
          },
        },
      };
    }
    return { status: 404 };
  };

  const existingProfile = {
    id: 'ph_200',
    name: 'Old Name',
    status: 'verified',
    updatedAt: '2026-11-20T10:00:00.000Z',
  };

  const updatedProfile = await updatePharmacyProfile(
    { name: 'Updated Name' },
    existingProfile,
    { idempotencyKey: 'idemp_prof_01' }
  );
  assert.equal(updatedProfile.name, 'Updated Name');

  // 2. Profile update returning 409 CONFLICT is mapped cleanly
  routeHandler = () => ({
    status: 409,
    body: {
      error: {
        code: 'CONFLICT',
        message: 'This record was modified by another session.',
      },
    },
  });

  await assert.rejects(
    () => updatePharmacyProfile({ name: 'Conflict Name' }, existingProfile),
    (err) => err instanceof PharmacyServiceError && err.status === 409 && err.code === 'CONFLICT'
  );

  // 3. Stock update sends If-Match and Idempotency-Key
  routeHandler = (req) => {
    if (req.method === 'PATCH' && req.pathname.startsWith('/api/owner/inventory/')) {
      assert.equal(req.headers['if-match'], '2026-11-20T12:00:00.000Z');
      assert.equal(req.headers['idempotency-key'], 'idemp_stock_01');
      return {
        status: 200,
        body: {
          data: {
            stockId: 'stk_1',
            status: 'low',
            updatedAt: '2026-11-20T12:05:00.000Z',
          },
        },
      };
    }
    return { status: 404 };
  };

  const stockUpdate = await stockService.updateStockStatus(
    'ph_200',
    'stk_1',
    'low',
    10,
    { expectedUpdatedAt: '2026-11-20T12:00:00.000Z', idempotencyKey: 'idemp_stock_01' }
  );
  assert.equal(stockUpdate.status, 'low');

  // 4. Stock update returning 409 CONFLICT maps to StockServiceError status 409
  routeHandler = () => ({
    status: 409,
    body: {
      error: {
        code: 'CONFLICT',
        message: 'Stock was updated elsewhere.',
      },
    },
  });

  await assert.rejects(
    () =>
      stockService.updateStockStatus('ph_200', 'stk_1', 'out', 0, {
        expectedUpdatedAt: '2026-11-20T12:00:00.000Z',
      }),
    (err) => err instanceof StockServiceError && err.status === 409 && err.code === 'CONFLICT'
  );
});
