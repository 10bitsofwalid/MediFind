# MediFind Pharmacy Operations — Release Demo & Handoff Guide

**Scope:** Pharmacy Owner Web Experience (`PH-FE-01` through `PH-FE-09` core P0 release scope)  
**Authoritative Requirements Source:** `agent_contents_pharmacy_operations/` (`PRD.md`, `API.md`, `Auth.md`, `Features.md`, `UI_Rulebook.md`, `Agent_Guardrails.md`, `Testing.md`)  
**Last Verified:** 2026-11-18  

---

## 1. Environment Configuration & Setup

### Prerequisites
- **Node.js** v18+ LTS (verified with Node v26.12.1) and **npm** v9+
- Modern browser (Chrome, Edge, Firefox, or Safari)

### Install Dependencies
From the repository root:

```bash
npm install --prefix frontend
```

### Frontend Environment Variables (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env` and configure for your target mode. Never place secrets, signing keys, SMTP credentials, or database connection strings in `VITE_*` variables.

```env
# Team REST API Base URL (used when VITE_USE_MOCK_API=false)
VITE_API_BASE_URL=http://localhost:5000/api

# Local mock adapter toggle:
#   true  = standalone browser mock adapter (localStorage/sessionStorage) for demo/UI review while team API is offline
#   false = live HTTP requests against VITE_API_BASE_URL
VITE_USE_MOCK_API=true

# Default Geolocation Fallback (Central Dhaka)
VITE_DEFAULT_LAT=23.8103
VITE_DEFAULT_LNG=90.4125
VITE_DEFAULT_SEARCH_RADIUS_KM=5

# OSRM Routing Endpoint
VITE_OSRM_API_URL=https://router.project-osrm.org
```

> **Runtime Override Note:** In local development, the Onboarding page (`/pharmacy/register`) also provides an **API Connection** checkbox (`medifind_dev_mock_api` in `localStorage`) to switch between the Development Adapter (Mock) and Live API without restarting Vite. Clear `localStorage.removeItem('medifind_dev_mock_api')` to fall back strictly to `VITE_USE_MOCK_API`.

---

## 2. Starting the Frontend & Required Services

### Start the Frontend Dev Server
From the repository root:

```bash
npm run dev
```

Vite serves the application at `http://localhost:5173/` (or the next available port, e.g. `5174`, if `5173` is already in use).

### Verification Commands
From the repository root:

```bash
# Frontend Verification
npm test --prefix frontend        # Runs 94 unit, integration, and API hardening tests
npm run lint --prefix frontend    # Runs ESLint across frontend/
npm run build --prefix frontend   # Runs TypeScript check (tsc -b) + Vite production build

# Backend Verification
npm run build --prefix backend    # Runs TypeScript check (tsc) producing dist/
npm test --prefix backend         # Runs 81 integration, concurrency, idempotency & security tests
```

### Backend Service Status & Live API Integration
- **Current Repository State:** Complete hardened Express 5 / Mongoose 9 backend implemented under `backend/src/` with synthetic development fallback, JWT authentication, optimistic concurrency, response caching for idempotency, and batch catalogue preloading.
- **Starting Backend Server:**
  ```bash
  npm run build --prefix backend
  npm run start --prefix backend
  ```
  The API listens at `http://localhost:5000` (endpoints mounted under both `/api/*` and `/*`).
- **Running in Live API Mode:** Set `VITE_USE_MOCK_API=false` in `frontend/.env` and ensure `localStorage.removeItem('medifind_dev_mock_api')` is cleared.

### Concurrency, Retry Guarantees & Scope Gate Status
1. **Concurrency Control:** `If-Match` / `expectedUpdatedAt` prevents simultaneous edits from overwriting newer stock or profile state, returning actionable `409 CONFLICT`.
2. **Idempotency & Retries:** `Idempotency-Key` response caching ensures retries after network timeouts do not duplicate stock items, duplicate application records, or duplicate history entries.
3. **High-Volume Scaling:** Batch catalogue preloading resolves inventories of 1,000+ items in ~20ms, eliminating N+1 query overhead.
4. **Reservation Scope Gate:** Verified all 3 scope gate conditions (Release scope, frontend queue readiness, P0 exit gate). In accordance with guardrails, reservation endpoints are excluded from this release and deferred to P1.

---

## 3. Demo Account Requirements (No Credentials Exposed)

No real user accounts, production records, or hardcoded passwords are included in source control or documentation.

- **Local Mock Mode (`VITE_USE_MOCK_API=true`):**
  - Mock accounts are stored locally in browser `localStorage` and start empty.
  - Create a clearly labeled **synthetic** Pharmacy Owner account on `/register` (for example, name `Demo Pharmacy Owner`, email `demo.owner@medifind.example`, synthetic phone, and a local test password chosen at demo time).
  - Do not reuse real personal emails, phone numbers, licence numbers, or production passwords.
- **Live Team API Mode (`VITE_USE_MOCK_API=false`):**
  - Obtain a synthetic test Pharmacy Owner account (and, if demonstrating admin verification end-to-end, a provisioned staging Administrator account) through the backend team's staging onboarding/provisioning process.
  - Role assignment is server-authoritative: public registration cannot create Administrator accounts.

---

## 4. Obtaining or Seeding Demo Data

- **Backend Seed Script:** Not currently available in this repository (`backend/package.json` does not define a `seed` script and backend source files are unimplemented). When demonstrating against the team API, coordinate with the backend owner to seed staging catalogue medicines and synthetic owner/pharmacy fixtures.
- **Local Mock Mode Walkthrough Data:**
  - **Pharmacy Profile & Verification States:** Created directly via the 5-step onboarding wizard (`/pharmacy/register`). Once submitted, the **Reviewer Simulator** bar on `/pharmacy/dashboard` (visible only when mock mode is active) lets presenters switch instantly among `Pending`, `Verified`, `Rejected`, and `Suspended` states, or approve via the local Administrator Verification Queue (`/admin/verification`).
  - **Curated Catalogue & Inventory:** In mock mode, administrators can add curated medicines in `/admin/catalogue` (which then appear in the owner's catalogue search picker), or owners can use **"Enter Manually (Mock Mode)"** inside the **Add Medicine from Catalogue** modal to populate synthetic inventory items (e.g., `Available`, `Low`, and `Out of Stock` entries).
  - **Resetting Local Demo State:** Clear site storage (`localStorage` and `sessionStorage`) in browser DevTools to start a clean walkthrough.

---

## 5. Recommended Pharmacy Owner Demo Walkthrough

| Step | Route | What to Demonstrate | Reference Screenshot |
|---|---|---|---|
| 1. Role Entry & Sign-In | `/` -> `/login` -> `/register` | Select **Pharmacy Owner** in the Welcome modal; show role-specific navigation, sign-in view, and synthetic account registration. | [Owner Sign In](screenshots/01-owner-login-desktop.png) |
| 2. 5-Step Onboarding Application | `/pharmacy/register` | Walk through Business Info, Address & interactive Leaflet map pin/quick-jump presets, DGDA License details (with inline validation), Weekly Opening Hours builder, and Review + Legal Declaration. | [Onboarding Location Step](screenshots/02-onboarding-location-desktop.png) |
| 3. Pending Confirmation & Trust Boundary | `/pharmacy/register` -> `/pharmacy/dashboard` | Confirm newly submitted application starts strictly as `Pending`, is not publicly listed, and locks inventory reporting until administrator approval. | [Submitted Confirmation](screenshots/03-onboarding-submitted-pending.png) · [Pending Workspace](screenshots/04-dashboard-pending-desktop.png) |
| 4. Rejected & Suspended Feedback | `/pharmacy/dashboard` | Demonstrate Rejected state (decision reason/fallback + Correct & Resubmit / Delete Application) and Suspended state (compliance contact + copy email). | [Rejected Workspace](screenshots/05-dashboard-rejected-desktop.png) |
| 5. Verified Workspace, One-Tap Stock & Attention Items | `/pharmacy/dashboard` | Switch to `Verified`; add medicines, perform one-tap status changes (`Available` / `Low` / `Out of Stock`), adjust optional quantity, and show stale freshness (`Stale • Reported Yesterday`) kept distinct from stock status with one-click reconfirmation. | [Verified Dashboard](screenshots/06-dashboard-verified-desktop.png) |
| 6. Dedicated Inventory Workbench & Read-Only History | `/pharmacy/inventory` | Filter by status, freshness, or search query; demonstrate empty/no-match recovery; open **History** modal to show the append-only audit trail (`Escape` dismisses). | [Inventory Workbench](screenshots/07-inventory-workbench-desktop.png) · [Stock History Modal](screenshots/08-stock-history-modal-desktop.png) |
| 7. Profile & Operating Hours Editing | `/pharmacy/profile` | Show View mode (inline map preview, TODAY highlight, read-only locked License section), switch to Edit mode, trigger the accessible Discard Unsaved Changes modal, then save changes with server confirmation. | [Profile View](screenshots/09-profile-view-desktop.png) · [Profile Edit](screenshots/10-profile-edit-desktop.png) |
| 8. Mobile 360 px Responsiveness | 360×800 viewport | Show compact mobile header with visible role indicator, accessible mobile drawer (`Escape` + backdrop close), single-column reflow, and automatic table-to-card switch with zero horizontal overflow. | [Mobile Dashboard](screenshots/11-dashboard-mobile-360.png) · [Mobile Inventory](screenshots/12-inventory-mobile-360.png) · [Mobile Profile](screenshots/13-profile-mobile-360.png) |
| 9. Live API Failure Recovery | `/pharmacy/dashboard` (Live API mode) | With backend offline, show honest network-error alert with **Retry** (no fake empty state or false success). | [Live API Offline Error](screenshots/14-live-api-error-state-desktop.png) |

---

## 6. Manual Prerequisites for the Team API

When connecting the frontend (`VITE_USE_MOCK_API=false`) to the team backend, the API must satisfy the following contract (aligned with `agent_contents_pharmacy_operations/API.md`):

### Authentication & CORS
- Allow frontend origin (e.g. `http://localhost:5173`) in CORS headers with `Authorization` header support.
- `POST /auth/register`, `POST /auth/login` returning `{ token, user }` (or `{ data: { token, user } }`) where `user` includes `id`, `email`, `name`, `role` (`PHARMACY` / `owner`), and `status`.
- `POST /auth/logout` and `GET /me` validating `Authorization: Bearer <token>` and returning `401` on expired/invalid tokens (triggers automatic client session cleanup and redirect to `/login?reason=session_expired&returnTo=...`).

### Pharmacy Owner Endpoints Consumed by Frontend
| Capability | Method & Path | Notes |
|---|---|---|
| Submit application | `POST /owner/pharmacy-applications` | Server must assign initial `pending` status and validate licence uniqueness (`409` on duplicate). |
| Read application status | `GET /owner/pharmacy-application` | Returns `pending`, `verified`, `rejected`, or `suspended`, plus optional `decisionReason`/`verificationReason` and `nextStep`. |
| Resubmit / correct application | `PATCH /owner/pharmacy-application` | Allowed only when server state permits correction. |
| Withdraw application | `DELETE /owner/pharmacy-application` (or `/owner/pharmacy-applications/:id`) | Allowed only for unapproved (`pending`/`rejected`) applications. |
| Read / update profile | `GET /owner/pharmacy`, `PATCH /owner/pharmacy` | Server derives pharmacy context from authenticated session; regulatory licence fields remain protected. |
| Read / replace opening hours | `GET /owner/pharmacy/opening-hours`, `PUT /owner/pharmacy/opening-hours` | Weekly schedule persistence. |
| Active catalogue lookup | `GET /medicines` | Query params: `q`, `form`, `limit`. Used by owner "Add Medicine from Catalogue" modal. |
| Inventory list / add / read | `GET /owner/inventory`, `POST /owner/inventory`, `GET /owner/inventory/:stockId` | Server enforces ownership, verification state, and `(pharmacyId, medicineId)` uniqueness (`409`). |
| One-action stock update | `PATCH /owner/inventory/:stockId` | Returns saved `status`, optional `quantity`, and authoritative ISO 8601 `updatedAt`; atomically appends history. |
| Reconfirm stale/unverified stock | `POST /owner/inventory/:stockId/reconfirm` | Clears stale/unverified flags only under server policy; returns updated item and timestamp. |
| Read-only stock history | `GET /owner/inventory/:stockId/history` | Append-only entries (`oldStatus`, `newStatus`, optional quantities, `changedBy`/`changedByName`, `changedAt`, optional `page.nextCursor`). |
| Optional summary | `GET /owner/summary` | Optional; frontend computes inventory counts truthfully from returned inventory records. |

### Normalized Error Contract
Expected JSON shape for error mapping (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `5xx`):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation",
    "fields": { "quantity": "Must be a whole number of 0 or greater." }
  }
}
```

---

## 7. Known Limitations, Verified Behavior vs. Assumptions, and Scope Exclusions

### Verified Behavior (Observed in This Build)
- **Automated Checks:** `npm test` (93/93 unit & contract-hardening tests passing), `npm run lint` (0 errors/warnings), and `npm run build` (`tsc -b && vite build` succeeding with code-split chunks).
- **Live Browser QA (Headless Chrome at 1280×900 and 360×800):**
  - End-to-end owner flow verified in mock mode with 0 console errors and 0 uncaught page exceptions.
  - 360 px mobile layout verified with zero page-level horizontal overflow (`scrollWidth === 360`) across Dashboard, Inventory Workbench, Profile, and Onboarding Confirmation; inventory table cleanly switches to stacked cards below 768 px.
  - Keyboard & accessibility checks verified: skip-to-main-content link, visible focus outlines, modal focus entry/restoration and `Escape` dismissal, mobile drawer `aria-expanded` and `Escape`/backdrop close, inline field error associations (`aria-invalid`, `aria-describedby`, `role="alert"`), and non-color status badges + separate freshness indicators.
  - Live API offline check verified: switching to Live API mode (`VITE_USE_MOCK_API=false` / `medifind_dev_mock_api=false`) against unreachable `http://localhost:5000/api` surfaces an honest recoverable error screen with a **Retry** control and no fabricated success or empty state.

### Unavailable API Behavior & Unresolved Dependencies
- **Backend API Not Present in Repo:** Because `backend/` has no server implementation yet, live end-to-end persistence, JWT verification, server-side RBAC/ownership rejection (`403`), real MongoDB `2dsphere` queries, and cross-browser customer-sees-owner-update integration could **not** be exercised against a live server. Those paths are verified via unit/adapter tests (`frontend/tests/pharmacyApiHardening.test.mjs`) and offline network-error testing only.
- **Endpoint Naming Divergence (`API.md` vs. `README.MD`):** Frontend services target `agent_contents_pharmacy_operations/API.md` paths (`/owner/pharmacy`, `/owner/inventory`, `/me`), whereas root `README.MD` lists earlier draft paths (`/api/pharmacies/my`, `/api/inventory`, `/api/users/me`). Confirm the canonical backend route table before production integration.
- **Unresolved Product Decisions (Temporary Assumptions in UI):**
  1. **Ownership Cardinality:** Frontend assumes one active pharmacy context per owner session (aligned with SRS BR-02). If multi-pharmacy ownership (ERD `1..N`) is adopted, a pharmacy selector and `:pharmacyId` route scoping will be required.
  2. **Authorized Staff Accounts (`PHA-13`):** Not implemented; current workspace assumes the `PHARMACY` owner role.
  3. **Stale Freshness Threshold:** Defaults to 24 hours (`DEFAULT_STALE_THRESHOLD_HOURS = 24`) unless the backend supplies an explicit `isStale` / `freshness` flag.
  4. **Local Stock Reminders:** `StockReminderSettings` and `PharmacyStockReminderManager` run client-side via browser storage/timers only; there is no server-side push/email notification delivery.

### Release-Scope Exclusions (Not Included in P0 Pharmacy Owner Release)
- **Reservation Queue (`PH-FE-10` / `PHA-10`):** Marked conditional (P1) in `PRD.md` pending canonical reservation lifecycle settlement (`Confirmed` vs. `Accepted`, `Released` vs. `Rejected`, hold duration, and backend API readiness). Not shipped in the owner workspace.
- **Bulk Inventory Updates (`PH-FE-12` / `PHA-12`) & Search Analytics:** Deferred to P1 / future scope.
- **Excluded Product Capabilities:** Online sales, payments, delivery, automatic POS/ERP synchronization, guaranteed/live inventory claims, and clinical/dosage/medical advice.
