# Developer 1: Customer Discovery Scope & Implementation Log

## Overview
- **Owner:** Developer 1 (Customer / Patient Discovery Track)
- **Git Branch:** `Jawad`
- **Scope Reference:** docs/4__Frontend_Roadmap.pdf (Track 1) & docs/12__UI_Design.pdf (Pages 2, 4, 5, 11)

---

## Phase 1 Summary: Customer Route Map, Search Fields, and Mobile Wireframe

### Goals Accomplished
1. Defined agreed customer journey route map (`/`, `/search`, `/medicine/:id`, `/medicine`).
2. Established typed contracts for customer search queries and nearby pharmacy availability responses (`src/features/customer/types.ts`).
3. Built customer landing/search wireframe in `HomePage.tsx` adhering to UI Design Page 2 and Page 11 mobile layout (down to 360px viewport).
4. Created reusable search component `CustomerSearchBar.tsx` supporting medicine search (brand/generic/strength), manual area fallback, and GPS geolocation toggle.
5. Created mobile results preview card `MobileResultsPreview.tsx` displaying verified badge, availability status, freshness timestamp with stale warning, and direct call trigger.
6. Added Node test suite (`tests/customerWireframe.test.mjs`) verifying search query validation, trust boundary rules, and non-color availability indicators.
7. Verified full backward compatibility: all 20 Dev 2 tests pass, `eslint .` passes with zero errors/warnings, and `npm run build` succeeds.

---

### Files Created
- `frontend/src/features/customer/types.ts`: Type definitions for `CustomerSearchParams`, `NearbyPharmacyResult`, and `MedicineSuggestion`.
- `frontend/src/features/customer/components/CustomerSearchBar.tsx`: Accessible customer search bar with medicine and area inputs.
- `frontend/src/features/customer/components/MobileResultsPreview.tsx`: Mobile-first 360px result preview cards.
- `frontend/src/features/customer/HomePage.tsx`: Main landing wireframe matching UI Design Page 2 and Page 11.
- `frontend/src/features/customer/SearchResults.tsx`: Initial wireframe placeholder for search result listing.
- `frontend/src/features/customer/MedicineDetailPage.tsx`: Initial wireframe placeholder for medicine detail.
- `frontend/tests/customerWireframe.test.mjs`: Test suite for customer field contracts, trust boundary enforcement, and freshness.
- `docs/DEV1_SCOPE.md`: Ownership, files touched, routes, and integration tracking.

---

### Shared Files Touched (Exact Minimal Additive Changes)
1. **`frontend/src/app/routes.tsx`**:
   - Added lazy imports for `HomePage`, `SearchResults`, `MedicineDetailPage`.
   - Registered `/` to point to `<HomePage />` for customer guest discovery.
   - Added `/search` &rarr; `<SearchResults />`, `/medicine` &rarr; `<MedicineDetailPage />`, `/medicine/:id` &rarr; `<MedicineDetailPage />`.
   - Changed fallback catch-all `*` from redirecting to `/pharmacy/register` to `/`.
   - **Preserved unchanged:** all Dev 2 pharmacy routes (`/pharmacy/register`, `/pharmacy/dashboard`, `/pharmacy/profile`, `/pharmacy/status`) and shared auth routes (`/login`, `/register`).
2. **`frontend/src/components/Navbar.tsx`**:
   - Added "Find medicine", "Sign in", "Create account", and "For pharmacies" navigation links for customers/guests.
   - Preserved all Dev 2 owner links (`Owner Workspace`, `Pharmacy Profile`, `Onboarding Application`) when role is `PHARMACY` or `ADMIN`.
   - Maintained test role switcher and updated logo redirect based on active role.

---

### Routes Added / Handled
| Route | Component | Access | Description |
|---|---|---|---|
| `/` | `HomePage` | Public / Guest | Front door landing, medicine search bar, Dhaka map preview, 360px mobile preview card, responsible search notices |
| `/search` | `SearchResults` | Public / Guest | Search query results wireframe (to be connected in Phase 2 & 3) |
| `/medicine/:id` | `MedicineDetailPage` | Public / Guest | Medicine & pharmacy availability details (to be connected in Phase 4) |

---

### API Endpoints Used / Planned
- **Phase 1 Status:** Frontend wireframe and field contract agreed. Seeded demo data flagged with `isDemoData: true`.
- **Planned Endpoints (Phase 2 & 3):**
  - `GET /api/medicines/search?q={query}` (Medicine catalogue autocomplete & suggestions)
  - `GET /api/pharmacies/nearby?medicineId={id}&lat={lat}&lng={lng}&radius={radius}` (Live pharmacy availability, distance, and stock state)

---

### Open Questions & Notes for Teammates
- **For Dev 2 (Pharmacy Operations):**
  - Our customer search response structure aligns with your `StockInventoryRecord` and `Pharmacy` models (`status`, `quantity`, `updatedAt`, `openingHours`).
  - When pharmacy owners update stock via `OneTapStockControl.tsx`, customer search will consume the updated timestamp to refresh the `FreshnessBadge`.
- **For Dev 3 (Trust & Administration):**
  - Customer screens enforce that pharmacies without `status === 'verified'` are never displayed with a verified badge.

