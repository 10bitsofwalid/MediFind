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

## Phase 6 Summary: Call & Route Actions, Handling Missing Phone/Coordinates, Routing Failure, and 360px Polish

### Goals Accomplished
1. **Robust Routing & Navigation Utilities (`routingUtils.ts`):**
   - Implemented `isValidCoordinate()` to ensure latitudes and longitudes are present, non-zero, and within geographical boundaries.
   - Built `getDirectionsRoute()`: generates exact GPS directions URL (`destination=lat,lng`) when coordinates exist, or falls back gracefully to a structured search query (`query=pharmacy+address+Dhaka`) when coordinates are missing, zero, or unverified.
   - Created `sanitizePhoneNumber()`: scrubs non-compliant phone strings, rejects placeholders ("N/A", "None", invalid lengths), and formats compliant `tel:` URIs.
2. **Missing Phone & Routing Failure UI in `SelectedPharmacyPanel.tsx`:**
   - Replaced broken `tel:` actions with a styled "No phone listed" badge when a pharmacy lacks a valid contact number.
   - Handled routing execution errors and displayed warning banner when exact GPS coordinates are missing, notifying the user that address search is being used instead.
   - Improved responsive layout and flex wrapping down to 360px mobile viewports.
3. **Card-Level Routing & Contact Polish in `SearchResultsList.tsx`:**
   - Added direct "Directions" link to every search result card, powered by `getDirectionsRoute()`.
   - Polished phone call button with `sanitizePhoneNumber()`, displaying fallback badge if contact number is unavailable.
   - Fully optimized card layout for narrow mobile screens (360px) to prevent button overflow.
4. **Detail Screen Call & Directions Hardening (`MedicineDetailPage.tsx` & `SearchResults.tsx`):**
   - Sanitized all direct dial calls across customer discovery views.
   - Ensured external directions open securely with `noopener,noreferrer`.
5. **Automated Testing Suite (`customerRoutingAndActions.test.mjs`):**
   - 7 unit tests verifying valid phone formatting, missing/placeholder phone rejection, Dhaka coordinate validation, (0,0) coordinate rejection, exact GPS routing URLs, and address fallback search URLs.
   - Total test count expanded to 56 tests (all 56 pass).
   - ESLint: 0 errors, 0 warnings.
   - Production build succeeds in 1.35s.

---

## Phase 7 Summary: Incorrect-Availability Report Form, Accessibility & Customer Journey Regression

### Goals Accomplished
1. **Customer Discrepancy Reporting Service (`reportService.ts`):**
   - Implemented `reportService.submitReport()` accepting structured feedback: pharmacy metadata, medicine details, discrepancy classification (`out_of_stock`, `incorrect_quantity`, `wrong_price`, `closed_unannounced`, `other`), observed stock status, explanatory notes, and optional contact email.
   - Saves submitted reports into local persistence with unique IDs (`rep_*`) and `pending_review` status.
2. **Accessible Discrepancy Reporting Modal (`ReportDiscrepancyModal.tsx`):**
   - Full ARIA compliance: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="report-modal-title"`.
   - Keyboard accessible cancel/escape and focusable controls.
   - Comprehensive error, submitting (`aria-busy`), and success feedback states.
   - Fully responsive modal with mobile 360px viewport support.
3. **Integrated Report Triggers in Search & Detail Views:**
   - Added accessible "Report" trigger to pharmacy search result cards in `SearchResultsList.tsx`.
   - Added "Report" action button beside pharmacy selection in `MedicineDetailPage.tsx`.
   - Wired modal to `SearchResults.tsx` and `MedicineDetailPage.tsx`, prefilling active pharmacy & medicine context.
4. **Automated Testing Suite (`customerDiscrepancyAndRegression.test.mjs`):**
   - 6 new automated tests verifying:
     - Successful report generation and unique ID generation
     - Validation rejection on missing `pharmacyId`
     - Validation rejection on missing `medicineName`
     - Validation rejection on invalid `issueType`
     - ARIA dialog accessibility attributes
     - Unauthenticated guest customer journey report submission
   - Total test count expanded to 62 tests (all 62 pass).
   - ESLint: 0 errors, 0 warnings.
   - Production build succeeds in 1.29s.

---

## Phase 8 Summary: Medicine Reservation Holds, Pickup Verification Code & Restock Alert Subscriptions

### Goals Accomplished
1. **Customer Medicine Reservation Service (`reservationService.ts`):**
   - Implemented `reservationService.createReservation()`: generates medicine hold requests with unique IDs (`resv_*`), initial `pending` status, 4-digit pickup code, and a standard 2-hour hold expiration window.
   - Built `cancelReservation()` and `isExpired()` helpers with event broadcasting (`medifind:reservation_created`, `medifind:reservation_updated`) enabling real-time coordination with Dev 2's pharmacy reservation queue.
2. **Accessible Customer Reservation Modal (`ReservationModal.tsx`):**
   - Full ARIA compliance: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="reservation-modal-title"`.
   - Customer authentication check: gracefully instructs guests to sign in with Customer role to place medicine holds, protecting pharmacy inventory.
   - Generates and presents a prominent 4-digit pickup code to be shown to the pharmacy counter upon arrival.
   - Captures quantity, customer pickup name, optional phone number for SMS updates, and notes for the pharmacist.
3. **Medicine Restock Alert Subscription Service (`alertService.ts`):**
   - Built `alertService.subscribeAlert()`: allows patients to subscribe for email or SMS notifications when an out-of-stock medicine is restocked by a verified pharmacy in their area.
   - Provides methods for retrieving stored alerts and cancellation.
4. **Accessible Restock Alert Modal (`StockAlertModal.tsx`):**
   - Clean, accessible modal triggered when a search query yields no results or out-of-stock state.
   - Captures target Dhaka ward/area and patient contact information.
   - Integrated with "Notify me when restocked" button in `SearchResultsList.tsx` and `SearchResults.tsx`.
5. **Detail View & Search View Integration:**
   - Connected `SelectedPharmacyPanel` hold action to trigger `ReservationModal` in `MedicineDetailPage.tsx`.
   - Displays real-time confirmation banner with generated pickup code upon successful hold submission.
   - Wired restock alert subscription modal to no-results search views.
6. **Automated Testing Suite (`customerReservation.test.mjs`):**
   - 8 unit tests verifying hold creation, 4-digit pickup code generation, 2-hour expiration calculation, minimum quantity validation, pharmacyId requirement, cancellation notes, expiration status detection, restock alert creation, contact validation, and alert cancellation.
   - Total test count expanded to 70 tests (all 70 pass).
   - ESLint: 0 errors, 0 warnings.
   - Production build succeeds in 1.26s.

---

## Phase 9 Summary: Blocker Fixes, Edge Case Hardening, Accessibility, Walkthroughs & Production Release Readiness

### Goals Accomplished
1. **Multi-Word Search Accuracy Improvement (`medicineService.ts`, `medicineCatalogueService.ts`):**
   - Transformed simple substring inclusion into comprehensive multi-word match tokenization. Every word in multi-term queries (e.g., "Napa Extra 500mg") matches against brand name, generic formulation, and dosage strength simultaneously without false negatives.
2. **Empty & Whitespace Search Query Sanitization (`HomePage.tsx`, `SearchResults.tsx`):**
   - Hardened query extraction to trim all string inputs across routes, query params, and autocomplete triggers, preventing whitespace degradation.
3. **Graceful Fallbacks for Operating Hours (`SearchResultsList.tsx`, `SelectedPharmacyPanel.tsx`, `MobileResultsPreview.tsx`):**
   - Eliminated empty parentheses `()` when operating hours metadata is omitted or undefined in API records. Added standard fallback schedule displays.
4. **Mobile Responsive Polish (360px Viewports & Collapsible Filters):**
   - Enhanced `.mobile-filter-toggle` and responsive media queries in `index.css` ensuring search filters cleanly collapse into a one-tap drawer on mobile devices (<768px).
5. **Modal Accessibility & Focus Management (`ReportDiscrepancyModal.tsx`, `ReservationModal.tsx`, `StockAlertModal.tsx`):**
   - Integrated keyboard `Escape` dismissal and outside backdrop click handling across all customer modals while strictly adhering to React hook execution order.
6. **Dynamic Page Document Titles for SEO & Wayfinding (`HomePage.tsx`, `SearchResults.tsx`, `MedicineDetailPage.tsx`):**
   - Dynamic document title updates synchronized with current search queries and medicine details across all customer routes.
7. **Fluid Loading Skeletons with Shimmer Animation (`index.css`, `SearchResultsList.tsx`, `MedicineDetailPage.tsx`):**
   - Created animated skeleton shimmer placeholder cards during asynchronous data fetching while preserving `role="status"` and `aria-live="polite"` contracts.
8. **Route-Level Fault Tolerance & Error Boundary Wrappers (`routes.tsx`):**
   - Wrapped all customer-facing routes (`/`, `/search`, `/medicine`, `/medicine/:id`) in `<ErrorBoundary>` to isolate client-side render exceptions.
9. **Comprehensive Documentation Suite (`KNOWN_LIMITATIONS.md`, `DEMO_WALKTHROUGH.md`):**
   - Authored extensive architectural edge case boundaries and step-by-step evaluator demo walkthroughs.

---

### Files Created
- `frontend/tests/customerPhase9Regression.test.mjs`: Test suite for Phase 9 search tokenization, query sanitization, operating hours fallback, modal accessibility, and ErrorBoundary contracts.
- `docs/KNOWN_LIMITATIONS.md`: Comprehensive edge cases, GPS limitations, and trust boundaries documentation.
- `docs/DEMO_WALKTHROUGH.md`: Detailed evaluator and stakeholder walkthrough guide across all customer scenarios.
- `frontend/src/features/customer/services/reservationService.ts`: Customer medicine reservation service with 2-hour hold expiration and 4-digit pickup codes.
- `frontend/src/features/customer/components/ReservationModal.tsx`: Accessible reservation dialog for placing medicine pickup holds.
- `frontend/src/features/customer/services/alertService.ts`: Stock restock notification service for patients in Dhaka.
- `frontend/src/features/customer/components/StockAlertModal.tsx`: Accessible modal for subscribing to restock notifications.
- `frontend/tests/customerReservation.test.mjs`: Test suite for Phase 8 reservation hold creation, cancellation, validation, and restock alerts.
- `frontend/src/features/customer/services/reportService.ts`: Local & API report submission service with data persistence.
- `frontend/src/features/customer/components/ReportDiscrepancyModal.tsx`: Accessible reporting dialog for customer stock discrepancies.
- `frontend/tests/customerDiscrepancyAndRegression.test.mjs`: Test suite for Phase 7 report validation, accessibility, and guest customer journey.
- `frontend/src/features/customer/utils/routingUtils.ts`: Coordinate validation, Google Maps routing generator, and phone number sanitizer.
- `frontend/tests/customerRoutingAndActions.test.mjs`: Test suite for Phase 6 routing, phone sanitization, and fallback mechanisms.
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
