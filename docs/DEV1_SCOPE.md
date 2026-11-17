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

## Phase 2 Summary: Search Page, Medicine Suggestions/Details, UI States, and Customer Auth UI

### Goals Accomplished
1. **Full Search Page Implementation (`SearchResults.tsx`):**
   - Synchronizes query parameters (`?q=...&area=...`) with medicine discovery.
   - Connected active search bar with live catalogue autocomplete suggestions.
   - Built verified catalogue reference header card (`MedicineCatalogueCard.tsx`) displaying brand name, generic name, dosage form, strength, manufacturer, prescription badge, and clickable same-generic alternatives.
2. **Comprehensive Search UI States (`SearchResultsList.tsx`):**
   - **Loading State:** Accessible loading spinner (`role="status"`, `aria-live="polite"`), explaining search progress.
   - **Empty State:** Helpful no-results guidance checklist (generic active ingredient search advice, dosage strength advice, expanding radius) plus clickable quick-search chips for common medicines.
   - **Error State:** Network and API error handling (`role="alert"`) with a dedicated "Retry Search" action button and plain-language messaging.
   - **Success State:** Verified pharmacy stock cards with `AvailabilityStatus` (Available/Low/Out of stock/Unverified), `FreshnessBadge` (real-time timestamps + stale report warning), distance in km, operating hours status, and direct call trigger.
3. **Medicine Catalogue & Autocomplete Service (`medicineCatalogueService.ts` & `MedicineSuggestions.tsx`):**
   - Implemented debounced query matching across brand name, generic name, and strength.
   - Provided accessible keyboard navigation (`role="listbox"`, `role="option"`, Enter/Space selection).
4. **Customer Login & Register UI Integration:**
   - Updated `LoginPage.tsx` and `RegisterPage.tsx` with minimal additive changes:
     - Customer role login/registration lands on `/` (Customer discovery front door) instead of pharmacy owner dashboard.
     - Added "Browse medicines without signing in" link per UI Design Page 3.
     - Preserved all Dev 2 pharmacy flows (`PHARMACY` role navigates to `/pharmacy/dashboard` or `/pharmacy/register`).
5. **Quality Assurance & Verification:**
   - Created test suite `tests/customerSearchPage.test.mjs` verifying suggestions filtering, state resolution, medical advice exclusion, customer post-auth redirects, and public guest discovery.

---

## Phase 3 Summary: Live API Search Connection, Dynamic Result Cards & Distance Calculation

### Goals Accomplished
1. **Medicine Discovery Service (`medicineService.ts`):**
   - Built official discovery service connecting search queries (brand, generic name, strength) to live backend API endpoints (`/api/medicines/search`, `/api/pharmacies/nearby`), with fallback to verified offline catalogue.
   - Integrated live stock synchronization with Dev 2's inventory store (`stockService`): changes made in `OneTapStockControl.tsx` are reflected in customer search results upon refresh.
2. **Accurate Geolocation & Distance Calculation (`geoUtils.ts`):**
   - Implemented standard Haversine distance algorithm calculating real distances in km between the user's coordinates/area and pharmacy locations.
   - Added Dhaka area coordinate lookup dictionary supporting manual area fallbacks (Dhanmondi, Gulshan, Banani, Mirpur, Uttara, Mohammadpur, etc.).
3. **Trust & Product Boundary Enforcement:**
   - Enforced that pending, unverified, or suspended pharmacies are never given a verified badge.
   - Automatically calculates data freshness: reports updated >= 24h ago trigger a prominent Stale Warning badge (`FreshnessBadge`).
   - Honestly labels mock/demo data records.
4. **Automated Testing Suite (`customerSearchApi.test.mjs`):**
   - Created 5 unit tests verifying distance calculations, area coordinate resolution, catalogue query matching, trust boundaries, and freshness calculations.

---

## Phase 4 Summary: Filters, Sorting, Medicine + Pharmacy Detail, and Customer Account Navigation

### Goals Accomplished
1. **Search Results Filtering & Sorting (`SearchFilterBar.tsx`):**
   - **Distance Filter:** Radius selection (Within 3 km, 5 km, 10 km, 15 km, 25 km).
   - **Availability Multi-select Filter:** Checkboxes for Available, Low stock, and Out of stock.
   - **Open Now Filter:** Toggle switch filtering pharmacies open today.
   - **Sorting:** Distance (closest first), Freshness (recently updated first), Availability (in-stock first).
   - Instant filter reset button and mobile-responsive collapsible layout.
2. **Complete Medicine + Pharmacy Details Screen (`MedicineDetailPage.tsx` & `SelectedPharmacyPanel.tsx`):**
   - Adheres to UI Design Page 5:
     - Rx header card with catalogue verification badge, specifications, and clinical advice disclaimer.
     - Nearby pharmacy list on the left with one-tap "View details" buttons.
     - Selected pharmacy panel on the right with real-time stock status, data freshness, operating hours, quantity selector (`- 1 +`), and [Get directions] & [Call pharmacy] actions.
     - Sign-in gated reservation button [Reserve for pickup] informing guest users that login is required to hold medicine.
     - Same-generic alternatives section with "Compare &rarr;" buttons.
3. **Customer Account Navigation Integration (`Navbar.tsx`):**
   - Added `Customer Account` and `Medicine details` navigation links when the user is logged in as a customer.
   - Retained complete role-aware compatibility for `PHARMACY` and `ADMIN` workspaces.
4. **Automated Testing Suite (`customerFiltersAndDetail.test.mjs`):**
   - Created 5 unit tests covering distance filtering, availability multi-select, open now toggle, sorting priority, and reservation sign-in gating.
   - All 41 automated tests pass cleanly.
   - Zero ESLint errors/warnings. Production build passes in 3.27s.

---

## Phase 5 Summary: Location Request (GPS), Map/List View Switching, Status Markers, and Sync

### Goals Accomplished
1. **Accurate Device Geolocation Hook (`useGeolocation.ts`):**
   - Implemented standard browser `navigator.geolocation` lifecycle with explicit states for `isLoading`, `permissionDenied`, `error`, coordinates, and accuracy.
   - Comprehensive handling for error codes: `PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, and `TIMEOUT` with actionable fallback guidance.
2. **Permission Request & Manual Area Fallback Banner (`LocationRequestBanner.tsx`):**
   - Responsive banner prompting user to enable GPS ("📍 Use my location") for hyper-local accuracy.
   - Graceful manual area fallback when permissions are denied or unavailable ("Location access denied — please type area name below").
   - Ability to dismiss the banner ("Not now") without interrupting discovery.
3. **Interactive Customer Map View (`CustomerMapView.tsx`):**
   - Custom numbered Leaflet pins matching result rankings.
   - Status color-coded pins: Available (Green `#0A7E51`), Low stock (Amber `#C28400`), Out of stock (Red `#D9383A`), and Unverified (Gray).
   - Rich interactive popup displaying pharmacy trade name, verified badge, address, distance, operating status, direct phone dialer, and "View Details" trigger.
   - Selected pharmacy pin sync displaying active card panel below the map.
   - Legend detailing status colors and parity assurance.
   - Wrapped in `ErrorBoundary` ensuring pharmacy search remains usable even if map tiles fail to load.
4. **Map / List View Toggle & URL Query Param Sync (`SearchResults.tsx`):**
   - High-contrast toggle switch between `[☰ List]` and `[🗺 Map]` views.
   - URL query parameter synchronization (`?view=map`) allowing deep linking directly into map exploration.
   - Seamless data parity: list and map share identical filtered and sorted results.
5. **Automated Testing Suite (`customerMapLocation.test.mjs`):**
   - 8 unit tests covering permission denial fallback, GPS unavailable messaging, map/list parity count, view toggle state retention, coordinate fallback, pin status colors, URL view query parsing, and selected pin synchronization.
   - All 49 automated tests pass cleanly.
   - Zero ESLint errors/warnings. Production build succeeds cleanly.

---

### Files Created
- `frontend/src/features/customer/hooks/useGeolocation.ts`: GPS location hook with fallback error handling.
- `frontend/src/features/customer/components/LocationRequestBanner.tsx`: Location permission invite, error, and manual fallback banner.
- `frontend/src/features/customer/components/CustomerMapView.tsx`: Interactive Leaflet map view with colored status pins and detail popups.
- `frontend/tests/customerMapLocation.test.mjs`: Test suite for Phase 5 GPS hook, map parity, pin colors, and URL sync.
- `frontend/src/features/customer/types.ts`: Type definitions for `CustomerSearchParams`, `NearbyPharmacyResult`, `MedicineSuggestion`, and `AvailabilityFilter`.
- `frontend/src/features/customer/utils/geoUtils.ts`: Haversine distance calculator and Dhaka area coordinate mapping.
- `frontend/src/features/customer/components/CustomerSearchBar.tsx`: Accessible customer search bar with medicine autocomplete and area inputs.
- `frontend/src/features/customer/components/MedicineSuggestions.tsx`: Accessible dropdown listing catalogue matches.
- `frontend/src/features/customer/components/MedicineCatalogueCard.tsx`: Reference details card with catalogue verification badge, alternatives, and medical advice disclaimer.
- `frontend/src/features/customer/components/SearchResultsList.tsx`: Complete state-driven results list (loading, empty, error, and results cards).
- `frontend/src/features/customer/components/SearchFilterBar.tsx`: Accessible filter bar for distance, availability, open now, and sorting.
- `frontend/src/features/customer/components/SelectedPharmacyPanel.tsx`: Pharmacy detail panel with quantity counter, directions, phone dialer, and gated reservation.
- `frontend/src/features/customer/components/MobileResultsPreview.tsx`: Mobile-first 360px result preview cards.
- `frontend/src/features/customer/services/medicineCatalogueService.ts`: Catalogue query service with offline DGDA catalogue fallback.
- `frontend/src/services/medicineService.ts`: Main customer medicine discovery and pharmacy stock search service.
- `frontend/src/features/customer/HomePage.tsx`: Main landing wireframe matching UI Design Page 2 and Page 11.
- `frontend/src/features/customer/SearchResults.tsx`: Full customer search results page with filters and sorting.
- `frontend/src/features/customer/MedicineDetailPage.tsx`: Complete Medicine and Pharmacy detail screen matching UI Design Page 5.
- `frontend/tests/customerWireframe.test.mjs`: Test suite for Phase 1 contracts.
- `frontend/tests/customerSearchPage.test.mjs`: Test suite for Phase 2 search states, catalogue filtering, and auth integration.
- `frontend/tests/customerSearchApi.test.mjs`: Test suite for Phase 3 distance calculation, API search, and inventory synchronization.
- `frontend/tests/customerFiltersAndDetail.test.mjs`: Test suite for Phase 4 filtering, sorting, and gated reservation rules.
- `docs/DEV1_SCOPE.md`: Ownership, files touched, routes, and integration tracking.

---

### Shared Files Touched (Exact Minimal Additive Changes)
1. **`frontend/src/app/routes.tsx`**:
   - Registered `/`, `/search`, `/medicine`, `/medicine/:id` while preserving all Dev 2 pharmacy and shared auth routes.
2. **`frontend/src/components/Navbar.tsx`**:
   - Added customer-specific navigation entries while preserving `PHARMACY` and `ADMIN` links and testing role switcher.
3. **`frontend/src/features/auth/LoginPage.tsx`**:
   - Customer role redirects to `/`; added "Browse medicines without signing in" link.
4. **`frontend/src/features/auth/RegisterPage.tsx`**:
   - Customer role redirects to `/`; added "Browse medicines without signing in" link.

---

### Routes Added / Handled
| Route | Component | Access | Description |
|---|---|---|---|
| `/` | `HomePage` | Public / Guest | Front door landing, medicine search bar, Dhaka map preview, 360px mobile preview card, responsible search notices |
| `/search` | `SearchResults` | Public / Guest | Live search results page with filters, sorting, catalogue card, and stock cards with distance & freshness |
| `/medicine/:id` | `MedicineDetailPage` | Public / Guest | Medicine & pharmacy availability details with quantity counter, directions, call trigger, and same-generic alternatives |

---

### API Endpoints Used / Planned
- `GET /api/medicines/search?q={query}` (Autocomplete and medicine catalogue retrieval)
- `GET /api/medicines/:id` (Catalogue medicine specifications)
- `GET /api/pharmacies/nearby?q={query}&lat={lat}&lng={lng}&radiusKm={radius}` (Live pharmacy availability and distance)

---

### Open Questions & Notes for Teammates
- **For Dev 2 (Pharmacy Operations):**
  - The quantity counter and reservation button in `MedicineDetailPage.tsx` are designed to integrate with your `ReservationQueue.tsx` in Week 7/8.
  - When customers click "Reserve for pickup", guest users are instructed to sign in, protecting the owner reservation queue from unauthenticated requests.
- **For Dev 3 (Trust & Administration):**
  - Same-generic alternatives are linked through generic active ingredients in accordance with DGDA catalogue standards.
