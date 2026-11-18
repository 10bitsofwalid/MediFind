# MediFind - Known Limitations & Architecture Boundaries

This document defines the known limitations, edge cases, trust boundaries, and platform trade-offs for Developer 1's **Customer Discovery Track** (Phases 1-9) in MediFind.

---

## 1. Geolocation & Spatial Discovery

| Aspect | Current Behavior / Limitation | Production Target & Workaround |
| :--- | :--- | :--- |
| **Browser GPS Accuracy** | Relies on W3C `navigator.geolocation.getCurrentPosition`. Desktop browsers estimate position via ISP IP routing, which may yield inaccurate coordinates. | Mobile browsers provide GPS/GLONASS precision (~5-15m). When GPS fails or is denied, customer is prompted with the **Manual Area Fallback** selector (e.g. Dhanmondi, Gulshan, Mirpur, Uttara). |
| **Permission Denials** | If user blocks location access (`PERMISSION_DENIED`), GPS state updates to `permissionDenied: true`. | UI automatically renders an amber fallback banner with one-click area quick-picks instead of halting the customer journey. |
| **Haversine Distance vs Road Network** | Distance calculations use the spherical Haversine formula (`geoUtils.ts`). It computes "as-the-crow-flies" distance rather than driving/walking route distance. | Suitable for fast client-side sorting across dozens of pharmacies without paying third-party routing API rate limits. Directions link passes exact coordinates to Google Maps / Leaflet for turn-by-turn routing. |

---

## 2. Map Rendering & External Tile Providers

| Aspect | Current Behavior / Limitation | Production Target & Workaround |
| :--- | :--- | :--- |
| **Leaflet & OpenStreetMap Tiles** | Map renders using OpenStreetMap standard tile servers (`tile.openstreetmap.org`). | OSM public tile servers enforce HTTP User-Agent policies and have standard rate-limits. In offline environments or high-latency networks, tiles render slowly; all pharmacy list data remains fully interactive regardless of map tile availability. |
| **Zero/Placeholder Coordinates** | Some legacy pharmacy records may contain missing coordinates (`0, 0` or `null`). | Handled gracefully via `routingUtils.ts`: directions fall back to URL-encoded address text searches, preventing navigation to Null Island (`0°N, 0°E`). |

---

## 3. Medicine Catalogue & Bangladesh DGDA Data

| Aspect | Current Behavior / Limitation | Production Target & Workaround |
| :--- | :--- | :--- |
| **Catalogue Coverage** | Seeded with top DGDA-aligned essential medicines in Bangladesh (Paracetamol, Napa Extra, Ceevit, Sergel, Seclo, Pantobex, Fexo, Azithromycin, etc.). | Master catalogue contains 30+ commonly searched reference medications with exact brand names, generics, strengths, dosage forms, and manufacturer info. Full DGDA registry (~25,000 SKUs) requires backend database pagination and full-text search indexing. |
| **Clinical Advice Disclaimer** | Master medicine catalogue provides identification and stock discovery only. | Prominently disclaims: *"MediFind does not provide clinical or prescription advice. Consult a registered physician before taking any medication."* |

---

## 4. Pharmacy Stock Verification & Trust Boundaries

| Aspect | Current Behavior / Limitation | Production Target & Workaround |
| :--- | :--- | :--- |
| **Stock Status Freshness** | Stock is categorized as `available`, `low`, or `out`. Records older than 24 hours are marked **Stale**. | Stale reports display an amber warning with elapsed time (e.g., *"Updated 2 days ago — Call ahead to confirm"*). Prevents customer disappointment. |
| **Unverified Pharmacies** | Only pharmacies with DGDA-verified drug license numbers display the green **Verified Pharmacy** badge. | Unverified/pending pharmacies are explicitly displayed with a neutral badge and cannot claim verified status. |

---

## 5. Reservation Holds & Pickup Flow

| Aspect | Current Behavior / Limitation | Production Target & Workaround |
| :--- | :--- | :--- |
| **Hold Lifecycle** | Reservations generate a 4-digit numeric pickup code with a 2-hour client-side expiry window. | In the prototype, reservations are stored in local/memory state. In full production with Dev 2's backend, reservations are pushed to the pharmacy's real-time WebSocket queue (`ReservationQueue.tsx`). |
| **Hold Guarantees** | Holds represent an intent-to-pickup request, not a paid transaction. | Customers are instructed to present their 4-digit code within 2 hours. Pharmacies retain the right to release holds if unclaimed. |

---

## 6. Discrepancy Reporting & Crowdsourcing

| Aspect | Current Behavior / Limitation | Production Target & Workaround |
| :--- | :--- | :--- |
| **Submission Pipeline** | Customers (including guest users without auth) can submit discrepancy reports (`out_of_stock`, `incorrect_price`, `wrong_location`, `pharmacy_closed`). | Validations ensure non-empty medicine names and valid pharmacy IDs. Reports are logged client-side with audit timestamps; in production, these feed into the pharmacy trust score recalculation worker. |

---

## 7. Device & Platform Interactions

| Aspect | Current Behavior / Limitation | Production Target & Workaround |
| :--- | :--- | :--- |
| **Call Pharmacy (`tel:`)** | Triggered via `tel:+880...` standard URI protocol. | On smartphones, triggers the native dialer. On desktop browsers without telephony handlers, users see the sanitized phone number clearly formatted on screen to dial manually. |
| **Viewport Responsiveness** | Built mobile-first, supporting viewports down to 360px wide (e.g. entry-level Android devices common in Bangladesh). | Responsive layout shifts from tabbed/bottom-sheet view on mobile to side-by-side split map/list on desktop (>768px). |
