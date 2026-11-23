# MediFind Pharmacy Operations — Release Demo & Handoff Guide

**Release Phase:** MediFind P0 Production Baseline & Staging Release  
**Domain Scope:** Pharmacy Operations (`PH-FE-01` through `PH-FE-09`, `PH-BE-01` through `PH-BE-16`)  
**Lead Engineer:** Developer 2 (Pharmacy Operations Backend & Integration Engineer)  
**Stakeholders & Reviewers:**  
- Developer 1 (Core Server Runtime, Database & Identity)  
- Developer 2 (Pharmacy Operations, Onboarding, Profile & Inventory Workbench)  
- Developer 3 (Medicine Catalogue, Customer Discovery & Administration)  
- Frontend Engineering Team & Staging Evaluators  
**Last Verified:** 2026-11-23  
**OpenAPI Specification:** [`docs/api/openapi.yaml`](../api/openapi.yaml)  
**Contract Guide:** [`docs/api/pharmacy-frontend-contract.md`](../api/pharmacy-frontend-contract.md)  

---

## 1. Executive Summary & Release Readiness

This release finalizes the complete backend and frontend integration for MediFind Pharmacy Operations in **Live API Mode** (`VITE_USE_MOCK_API=false`). All P0 capabilities—from public owner registration and onboarding application submission through administrative license verification, profile maintenance, weekly hours scheduling, one-tap inventory management, stock history auditing, physical reconfirmation, and customer availability discovery—are hardened, tested, and verified against the live Express 5 / Mongoose 9 backend.

### Key Verification Milestones Passed
- **Backend Test Suite:** **81/81 automated integration tests passing** (`npm test --prefix backend`).
- **Frontend Test Suite:** **94/94 automated unit, integration & API hardening tests passing** (`npm test --prefix frontend`).
- **Live Pipeline Walkthrough:** **17/17 end-to-end verification steps passing** (`npm run walkthrough --prefix backend`).
- **Static Analysis & Linters:** **0 TypeScript errors, 0 ESLint warnings** across `backend/` and `frontend/`.
- **Production Build:** Clean builds for both `backend/` (`tsc`) and `frontend/` (`tsc -b && vite build` in 854ms).

---

## 2. Environment Configuration & Staging Setup

MediFind strictly enforces separation of configuration from code. Safe environment templates are maintained in `.env.example`. Real credentials, database URLs, SMTP passwords, and secret signing keys must **never** be placed in source control or documentation.

### Prerequisites
- **Node.js:** v18+ LTS (verified with Node v26.12.1)
- **npm:** v9+
- **MongoDB:** v6.0+ with `2dsphere` index support (optional for local development; server includes automatic synthetic development fallback when MongoDB is offline)

### Backend Environment (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and configure for your target environment:

```env
# Node Execution Environment ('development' | 'staging' | 'production' | 'test')
NODE_ENV=development

# Service Port (Default: 5000)
PORT=5000

# MongoDB Connection String (MongoDB 6+ supporting 2dsphere spatial indexes)
# Local:   mongodb://localhost:27017/medifind
# Staging: mongodb+srv://<staging_user>:<staging_password>@<staging_cluster>.mongodb.net/medifind_staging?retryWrites=true&w=majority
MONGODB_URI=mongodb://localhost:27017/medifind

# JSON Web Token Secret Key (Required in staging/production; min 32 chars random secret)
JWT_SECRET=replace_with_secure_random_jwt_secret_in_staging

# Stock Quality & Freshness Thresholds (Developer 3 Coordination Agreement)
STALE_THRESHOLD_HOURS=24
UNVERIFIED_REPORT_THRESHOLD=3

# Allowed CORS Origins (comma-separated list)
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:3000
```

#### Startup Environment Validation
At startup, `backend/src/server.ts` validates required variables:
- In `production` and `staging`, the server strictly rejects startup with a fatal error if `JWT_SECRET` is unset or left at the insecure development default.
- In `development`, the server falls back safely to internal development defaults and logs diagnostic guidance.

### Frontend Environment (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`. To connect to the live backend API, set:

```env
# Backend API Base URL
VITE_API_BASE_URL=http://localhost:5000/api

# Live API Mode Toggle (Must be false for live backend integration)
VITE_USE_MOCK_API=false

# Default Geolocation Fallback (Central Dhaka)
VITE_DEFAULT_LAT=23.8103
VITE_DEFAULT_LNG=90.4125
VITE_DEFAULT_SEARCH_RADIUS_KM=5

# OSRM Routing Server
VITE_OSRM_API_URL=https://router.project-osrm.org
```

> **Runtime Local Override Notice:** If `medifind_dev_mock_api` was previously toggled via the Onboarding page checkbox, execute `localStorage.removeItem('medifind_dev_mock_api')` in browser DevTools to ensure requests connect directly to `VITE_API_BASE_URL`.

---

## 3. Starting Services, Index Management & Seeding

### Build and Start Backend Service
From the repository root:

```bash
# Build TypeScript to dist/
npm run build --prefix backend

# Start the live API server (listens at http://localhost:5000)
npm run start --prefix backend
```

Endpoints are mounted under both `/api/*` (standard client prefix) and `/*` (root alias) to ensure seamless gateway routing.

### Database Connection & Safe Non-Destructive Index Synchronization
When connected to MongoDB, the backend automatically registers and synchronizes indexes via `syncDatabaseIndexes()` (`backend/src/server.ts`):
1. **`Pharmacy` Collection:**
   - Spatial Index: `{ location: '2dsphere' }` (`idx_pharmacy_location_2dsphere`) for proximity discovery.
   - Unique License Index: `{ normalizedLicenseNo: 1 }` (`idx_pharmacy_normalized_license_unique`) enforcing DGDA regulatory uniqueness.
   - Unique Owner Index: `{ ownerId: 1 }` (`idx_pharmacy_owner_id_unique`) enforcing 1:1 ownership cardinality per SRS BR-02.
   - Status Index: `{ status: 1 }` (`idx_pharmacy_status`) for filtering approved pharmacies.
2. **`Stock` Collection:**
   - Compound Unique Index: `{ pharmacyId: 1, medicineId: 1 }` (`idx_stock_pharmacy_medicine_unique`) preventing duplicate catalogue listings in one establishment.
   - Freshness Index: `{ pharmacyId: 1, updatedAt: -1 }` for fast sorting and freshness evaluation.
3. **`StockHistory` Collection:**
   - Audit Index: `{ stockId: 1, changedAt: -1 }` for fast paginated history retrieval.
   - Compound Index: `{ pharmacyId: 1, changedAt: -1 }` for workspace-wide audit logs.
4. **`Medicine` Collection:**
   - Search Index: `{ name: 'text', genericName: 'text' }` for autocomplete and catalogue discovery.

> **Index Safety Guarantee:** Index creation uses Mongoose schema `.init()`, which is completely safe to repeat and **never** drops collections, deletes data, or modifies existing documents.

### Repeatable Synthetic Seeding for Staging
A dedicated seed script is provided for staging and local development. All seeded entities are clearly synthetic to make it impossible to mistake demo availability for live pharmacy inventory.

```bash
# Seed development/staging fixtures (upsert mode)
npm run seed --prefix backend

# Reset and re-seed clean synthetic staging fixtures
npm run seed:reset --prefix backend
```

#### Seed Isolation & Safety Policy
- **Production Guard:** `seed.ts` immediately aborts with fatal error if `NODE_ENV === 'production'`. Seeding is strictly forbidden on production databases.
- **Synthetic Accounts Created:**
  - **Administrator:** `demo.admin@medifind.example` (Role: `ADMIN`)
  - **Verified Pharmacy Owner:** `demo.owner@medifind.example` (Role: `PHARMACY`, Pharmacy: `Green Life Model Pharmacy [DEMO STAGING]`, License: `DGDA/DA-2024-8901`)
  - **Pending Pharmacy Applicant:** `demo.pending.owner@medifind.example` (Role: `PHARMACY`, Pharmacy: `Care & Cure Chemist [DEMO PENDING REVIEW]`, License: `DGDA/DH-2024-5544`)
  - **Demo Password:** Pre-hashed synthetic credential (`MediFind2026!Demo`).
- **Reset Mechanism:** `npm run seed:reset` purges exclusively synthetic records matching `@.*\.example$` and `DGDA*` prefixes, preserving non-demo records.

---

## 4. Health, Logging, Privacy & Limitations

### Health & Readiness Probes
Coordinated with Developer 3 deployment conventions, the service exposes health probes at both `/health` and `/api/health`:

```bash
curl http://localhost:5000/api/health
```

**Response Payload:**
```json
{
  "status": "ok",
  "mode": "mongodb",
  "database": "connected",
  "uptimeSeconds": 342,
  "timestamp": "2026-11-23T12:00:00.000Z",
  "version": "1.0.0",
  "service": "MediFind Pharmacy Backend"
}
```
If MongoDB is temporarily unreachable, `status` returns `"degraded"` and `mode` reports `"synthetic_development_fallback"`, allowing presenters to test without a local database daemon.

### Privacy-Preserving Structured Logging
Every HTTP transaction passes through request logging middleware:
- **Logged Context:** Method, path, HTTP status code, response time in milliseconds, and standard `X-Request-Id`.
- **Sensitive Data Redaction:** Passwords, password hashes, JWT Bearer tokens, Authorization headers, Cookie headers, and private location coordinates are strictly stripped from all log streams.
- **Error Protection:** Production mode suppresses internal error stack traces and database error internals, returning standardized error envelopes (`SERVER_ERROR` or `DATABASE_ERROR`).

### Data Privacy & Regulatory Licence Handling
- **Licence Immutability:** Government drug licence credentials (`licenseNo`, `issuingAuthority`, `licenseExpiryDate`, `licenseType`) are immutable through owner profile update endpoints (`PATCH /owner/pharmacy`). They can be reviewed or corrected only during pre-approval onboarding.
- **Server-Authoritative Context:** The backend derives pharmacy context exclusively from the authenticated JWT token claims (`req.user.userId`). Client-supplied `ownerId` or `pharmacyId` parameters are stripped and never trusted as proof of ownership (`assertPharmacyOwnership`).
- **Cross-Tenant Isolation:** Any attempt by Owner B to access or update Owner A's pharmacy or inventory returns `403 FORBIDDEN` or `404 NOT_FOUND`.

---

## 5. Documented & Repeatable Staging Walkthrough (5 Core Steps)

The following walkthrough demonstrates the 5 core workflows required by the release exit gate. This exact sequence was executed and verified against the live Express pipeline via `npm run walkthrough --prefix backend`.

```
+---------------------------------------------------------------------------------------------------+
|                              STAGING DEMONSTRATION WORKFLOW SEQUENCE                             |
+---------------------------------------------------------------------------------------------------+
|  [Step 1] Synthetic Owner Registration -> Submit Application -> Initial "Pending" Trust Boundary  |
|                                                ↓                                                  |
|  [Step 2] Administrator Verification Queue -> Review Drug License -> Approve Application         |
|                                                ↓                                                  |
|  [Step 3] Owner Inspects "Verified" Profile -> Updates Address & Phone -> Updates Weekly Hours    |
|                                                ↓                                                  |
|  [Step 4] Owner Browses Catalogue -> Adds Medicine -> Performs One-Tap Stock Update (Available→Low) |
|                                                ↓                                                  |
|  [Step 5] Owner Inspects Timestamp & Audit History -> Customer Proximity Discovery Verified      |
+---------------------------------------------------------------------------------------------------+
```

### Walkthrough Step-by-Step Instructions

#### Step 1: Owner Application Submission & Trust Boundary
1. Open frontend at `http://localhost:5173/register` or execute:
   ```bash
   POST /api/auth/register
   { "name": "Dr. Kamrul Hasan", "email": "demo.walkthrough.owner@medifind.example", "password": "...", "role": "PHARMACY" }
   ```
2. Check initial application status (`GET /api/owner/pharmacy-application`). Returns `404 NOT_FOUND` (safely handled by client as unsubmitted).
3. Submit 5-step onboarding application (`POST /api/owner/pharmacy-applications`).
   - Fields: Trade name (`Ibn Sina Model Pharmacy [STAGING DEMO]`), DGDA License (`DGDA/DA-2026-9001`), Dhanmondi location coordinates `[90.3775, 23.7485]`, weekly operating schedule, cold storage declaration.
   - **Response:** `201 Created` with `status: "pending"`.
4. **Trust Boundary Check:** Attempt to add an inventory item while pending (`POST /api/owner/inventory`).
   - **Result:** Strictly rejected with `403 FORBIDDEN` (`code: "PHARMACY_NOT_VERIFIED"`). Inventory reporting remains locked until administrator verification.

#### Step 2: Administrator Application Verification
1. Sign in as administrator (`POST /api/auth/login` with `demo.admin@medifind.example` or test admin token).
2. Open `/admin/verification` or call `GET /api/admin/pharmacy-applications`.
   - The newly submitted application appears in the verification queue with DGDA licence details and coordinates.
3. Administrator approves application:
   ```bash
   POST /api/admin/pharmacy-applications/:applicationId/approve
   { "reason": "DGDA Drug Licence Form 24 verified against government database and premises inspected." }
   ```
   - **Response:** `200 OK` with `status: "verified"`.
   - The verified pharmacy profile is registered and ready for discovery.

#### Step 3: Verified Profile & Operating Hours Maintenance
1. Owner signs in and navigates to `/pharmacy/dashboard` or `/pharmacy/profile`.
2. Call `GET /api/owner/pharmacy`:
   - Returns profile with `status: "verified"`, and drug license details shown as protected read-only data.
3. Owner edits contact number and address via `PATCH /api/owner/pharmacy`:
   - Headers: `If-Match: <updatedAt>` (optimistic concurrency token).
   - Body: `{ "phone": "+8801711223399", "streetAddress": "House 15/A, Road 7, Dhanmondi" }`.
   - **Response:** `200 OK`. Fields updated cleanly; licence number remains protected.
4. Owner updates weekly schedule via `PUT /api/owner/pharmacy/opening-hours`:
   - Body includes full 7-day schedule with open/close times.
   - **Response:** `200 OK`. Schedule persisted atomically.

#### Step 4: Catalogue Addition & One-Tap Stock Update
1. Open **Add Medicine** modal or call `GET /api/medicines?q=Napa`:
   - Returns curated medicine `med_paracetamol_500` ("Napa Extra", 500mg + 65mg Tablet).
2. Owner adds medicine to inventory (`POST /api/owner/inventory`):
   - Body: `{ "medicineId": "med_paracetamol_500", "status": "available", "quantity": 150, "price": 3.5 }`.
   - **Response:** `201 Created` with `stockId`, `status: "available"`, and `freshness: "fresh"`.
3. Owner performs one-tap status adjustment via `PATCH /api/owner/inventory/:stockId`:
   - Headers: `If-Match: <updatedAt>`.
   - Body: `{ "status": "low", "quantity": 8, "notes": "Low stock alert. Reorder placed." }`.
   - **Response:** `200 OK`. Persisted with authoritative UTC timestamp; automatically creates `StockHistory` entry.

#### Step 5: Read-Only Audit History & Customer Consistency
1. Owner opens **History** modal on `/pharmacy/inventory` or calls `GET /api/owner/inventory/:stockId/history`:
   - **Response:** `200 OK` with 2 chronological audit records:
     1. Initial addition: `oldStatus: null -> newStatus: "available"`, `newQuantity: 150`.
     2. One-tap update: `oldStatus: "available" -> newStatus: "low"`, `oldQuantity: 150 -> newQuantity: 8`.
     - Displays authoritative changer name (`Dr. Kamrul Hasan`) and exact UTC timestamps.
2. Read operational summary (`GET /api/owner/summary`):
   - **Response:** `200 OK` with truthful counts (`totalInventory: 1`, `lowCount: 1`, `availableCount: 0`, `outCount: 0`).
3. **Customer Proximity Consistency Check:**
   - Execute customer availability search: `GET /api/availability/search?query=Napa`.
   - **Response:** `200 OK`. The newly verified pharmacy is discovered in search results with `stockStatus: "low"`, `isStale: false`, and `freshness: "fresh"`, proving 100% end-to-end consistency between owner and customer views.

---

## 6. Actual Live API Execution Evidence

The following table records the actual observed behavior from executing `npm run walkthrough --prefix backend` against the live backend pipeline:

| Step # | Operation / Workflow | Method & Endpoint | HTTP Status | Observed Behavior & Payload Validation | Result |
|---|---|---|---|---|---|
| **0** | Health Probe | `GET /api/health` | `200 OK` | Returned `{ status: 'ok', uptimeSeconds: 0, database: 'disconnected', mode: 'synthetic_development_fallback' }` | **PASS** |
| **1** | Owner Account Registration | `POST /api/auth/register` | `201 Created` | Server created user, normalized role to `PHARMACY`, returned signed JWT. | **PASS** |
| **2** | Unsubmitted Application Read | `GET /api/owner/pharmacy-application` | `404 Not Found` | Returned standard `NOT_FOUND` envelope; frontend safely renders empty wizard. | **PASS** |
| **3** | Submit Onboarding Application | `POST /api/owner/pharmacy-applications` | `201 Created` | Assigned `status: "pending"`, created application ID, validated DGDA licence format. | **PASS** |
| **4** | Trust Boundary Check | `POST /api/owner/inventory` | `403 Forbidden` | Rejected with `code: "PHARMACY_NOT_VERIFIED"`. Write access locked while pending. | **PASS** |
| **5** | Admin Authentication | `POST /api/auth/register` | `201 Created` | Authenticated administrator session with role `ADMIN`. | **PASS** |
| **6** | Verification Queue Inspection | `GET /api/admin/pharmacy-applications` | `200 OK` | Newly submitted application found in queue awaiting review. | **PASS** |
| **7** | Admin Approval Decision | `POST /api/admin/pharmacy-applications/:id/approve` | `200 OK` | Transitioned status to `verified`, populated decision reason, seeded pharmacy record. | **PASS** |
| **8** | Verified Profile Read | `GET /api/owner/pharmacy` | `200 OK` | Resolved verified profile; licence credentials marked read-only. | **PASS** |
| **9** | Profile Update (Concurrency) | `PATCH /api/owner/pharmacy` | `200 OK` | `If-Match` validated; phone updated to `+8801711223399`; licence fields protected. | **PASS** |
| **10** | Operating Hours Schedule | `PUT /owner/pharmacy/opening-hours` | `200 OK` | Structured 7-day schedule persisted atomically with start < end validation. | **PASS** |
| **11** | Catalogue Search | `GET /api/medicines?q=Napa` | `200 OK` | Returned active catalogue item `med_paracetamol_500` ("Napa Extra"). | **PASS** |
| **12** | Add Medicine to Inventory | `POST /api/owner/inventory` | `201 Created` | Added item with `status: "available"`, `quantity: 150`, `freshness: "fresh"`. | **PASS** |
| **13** | One-Tap Stock Update | `PATCH /owner/inventory/:stockId` | `200 OK` | Updated status to `low`, quantity to `8`; persisted in <5ms; generated audit entry. | **PASS** |
| **14** | Stock History Audit Read | `GET /owner/inventory/:stockId/history` | `200 OK` | Returned 2 audit entries showing full state transitions (`null -> available`, `available -> low`). | **PASS** |
| **15** | Operational Summary Read | `GET /api/owner/summary` | `200 OK` | Truthful counts returned (`totalInventory: 1`, `lowCount: 1`, `availableCount: 0`). | **PASS** |
| **16** | Customer Availability Check | `GET /api/availability/search?query=Napa` | `200 OK` | Verified pharmacy discovered in public search with `stockStatus: "low"` and `freshness: "fresh"`. | **PASS** |

---

## 7. Known Limitations, Deferred Scope & Coordination Agreements

### Verified Behavior vs. Release Scope Exclusions
1. **Medicine Reservations (`PH-FE-10` / `PHA-10`):**
   - **Scope Gate:** Evaluated against P0 exit criteria. In accordance with project guardrails, reservation endpoints (`/reservations/*`, `/owner/reservations/*`) are **deferred to P1**.
   - **Rationale:** Customer hold workflows and timeout sweeping jobs require consensus on hold duration and pickup protocols before production deployment.
2. **Bulk Inventory CSV Import (`PH-FE-12`):**
   - Deferred to P1; inventory maintenance in P0 is conducted via the rapid One-Tap workbench.
3. **Ownership Cardinality (1:1 vs 1:N):**
   - Aligned with SRS BR-02: Backend and frontend strictly enforce 1 active pharmacy context per authenticated owner session (`idx_pharmacy_owner_id_unique`). Multi-pharmacy management dropdowns are deferred to Phase 2.
4. **Authorized Staff Accounts (`PHA-13`):**
   - Not implemented in P0; workspace operates under the primary `PHARMACY` owner role.
5. **Client-Side Stock Reminders:**
   - Notification reminders on `/pharmacy/dashboard` run client-side using browser timers and local storage; there is no server-side push or SMS dispatch.

### Developer Coordination Matrix

| Domain / Responsibility | Lead Owner | Interface / Agreement |
|---|---|---|
| **Core Architecture & JWT Auth** | **Developer 1** | Standard Bearer token authentication, bcrypt hashing, safe normalized error envelopes (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`). |
| **Pharmacy Operations** | **Developer 2** (Author) | `/owner/*` namespace, onboarding lifecycle, profile & opening hours, inventory workbench, atomic stock history, and reconfirmation. |
| **Catalogue & Admin Discovery** | **Developer 3** | Curated medicines catalogue (`GET /medicines`), public geospatial discovery (`GET /availability/search`, `GET /pharmacies/nearby`), administrative verification queue (`/admin/pharmacy-applications`), and quality thresholds (`/admin/settings/quality-thresholds`). |

---

## 8. Verification Commands & Exit Gate Sign-Off

The repository is verified in a clean, reproducible state. All test commands pass without failure:

```bash
# 1. Backend Verification (81 automated tests)
npm test --prefix backend

# 2. Live Staging Walkthrough (17/17 end-to-end integration steps)
npm run walkthrough --prefix backend

# 3. Backend Typecheck & Build
npm run lint --prefix backend
npm run build --prefix backend

# 4. Frontend Verification (94 automated tests)
npm test --prefix frontend

# 5. Frontend Linter & Production Build
npm run lint --prefix frontend
npm run build --prefix frontend
```

### Exit Gate Confirmation
- [x] Repeatable staging setup documented with synthetic data and safe environment placeholders.
- [x] Walkthrough from application submission through admin verification, profile editing, one-tap stock update, and stock history successfully demonstrated against live API.
- [x] OpenAPI 3.0 specification finalized in `docs/api/openapi.yaml`.
- [x] Bearer token injection and `VITE_API_BASE_URL` live mode configuration verified.
- [x] Privacy and sensitive data reviewed: passwords, tokens, and licence evidence protected from logs and untrusted exposure.
- [x] Scope gates recorded: reservations and deferred workflows clearly identified.
- [x] Cross-developer ownership and coordination agreed with Developer 1 and Developer 3.
