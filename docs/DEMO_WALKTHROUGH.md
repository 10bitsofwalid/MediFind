# MediFind - Customer Discovery Track Demo Walkthrough

This guide provides a comprehensive step-by-step walkthrough for evaluating and demonstrating the **Customer/Patient Discovery Track** (Developer 1, Phases 1-9) in MediFind.

---

## Prerequisites & Launching the App

1. Ensure Node.js (v18+) is installed.
2. In the repository root, start the frontend development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:5173`.

---

## Demo Scenarios

### Scenario 1: Quick Search & DGDA Medicine Autocomplete

1. Navigate to the Home page (`/`).
2. Notice the prominent **MediFind** hero search bar with placeholder *"Search medicine (brand, generic, e.g., Napa, Paracetamol, Seclo)..."*.
3. Type `napa` in the search box.
4. **Observe:** The instant autocomplete dropdown appears with suggestions (e.g., *Napa 500mg Tablet*, *Napa Extra 500mg+65mg Tablet*).
5. Notice the DGDA generic name (`Paracetamol`) and dosage form badges for each suggestion.
6. Click on **Napa Extra 500mg+65mg** or press `Enter` to search.

---

### Scenario 2: Search Results, Map & List Views

1. You are directed to `/search?q=Napa+Extra`.
2. Notice the two presentation views:
   - **List View:** Displays pharmacy cards sorted by proximity, showing availability badges (*Available*, *Low Stock*, *Out of Stock*), price in BDT, and freshness timestamps (*Updated 2h ago*).
   - **Map View:** Toggle the view using the **Map** button in the filter bar or on mobile view toggle.
3. On the map:
   - Green markers indicate in-stock pharmacies.
   - Amber markers indicate low stock.
   - Red markers indicate out of stock.
4. Click any pharmacy marker on the map to open the **Selected Pharmacy Detail Panel**.

---

### Scenario 3: GPS Permission Denial & Manual Area Fallback

1. If your browser prompts for Location permission:
   - **Grant:** Distance is automatically calculated using your real-time latitude/longitude.
   - **Deny / Block:** An amber banner immediately appears informing you that location access was denied.
2. Under the banner, select any Dhaka neighborhood quick-pick: **Dhanmondi**, **Gulshan**, **Mirpur**, or **Uttara**.
3. **Observe:** Distances dynamically recompute relative to the selected area centroid without breaking the user flow.

---

### Scenario 4: Medicine Detail & Regulatory Transparency

1. Click on any pharmacy result card or click **View Details** to navigate to `/medicine/:id`.
2. Notice the comprehensive detail breakdown:
   - **Medicine Header:** Brand name, generic composition, manufacturer (e.g. *Beximco Pharmaceuticals*, *Square Pharmaceuticals*).
   - **Clinical Advice Disclaimer:** A prominent banner clarifying that MediFind provides stock discovery only and does not substitute for clinical advice.
   - **Pharmacy Status:** Real-time stock status, opening hours, verified drug license badge.
   - **Freshness Warning:** If stock was updated >24 hours ago, an amber notice urges the customer to call ahead.

---

### Scenario 5: Phone Call & Directions Route Actions

1. In the pharmacy detail card or search results:
   - Click **Call Pharmacy**: Initiates a `tel:` action on mobile or surfaces the sanitized, callable phone number.
   - Click **Get Directions**: Launches Google Maps navigation using exact latitude/longitude coordinates (with address search fallback if coordinates are missing).

---

### Scenario 6: Discrepancy Reporting (Crowdsourced Stock Audit)

1. On the medicine detail page, click **Report Incorrect Information**.
2. A modal dialog opens with accessibility attributes (`role="dialog"`, `aria-modal="true"`).
3. Select an issue type:
   - *Out of Stock (was marked Available)*
   - *Price Discrepancy*
   - *Pharmacy Closed*
   - *Incorrect Location*
4. Type optional notes (e.g., *"Visited at 4 PM, Napa Extra was sold out"*).
5. Click **Submit Report**.
6. **Observe:** Instant green confirmation toast thanking the customer for keeping the community data accurate.

---

### Scenario 7: Medicine Reservation Hold

1. On an in-stock medicine detail page, click **Reserve for Pickup**.
2. (If not logged in, you will be prompted to sign in with your customer account).
3. Select the desired quantity (e.g., 2 packs).
4. Click **Confirm Reservation**.
5. **Observe:** A modal presents a unique **4-digit pickup code** (e.g., `#4829`) and a **2-hour hold countdown**.
6. The customer is instructed to show this code at the pharmacy counter.

---

### Scenario 8: Restock Notification Alert

1. For a medicine that is marked *Out of Stock*, click **Notify Me When Restocked**.
2. Enter your contact mobile number or email.
3. Click **Subscribe to Alert**.
4. **Observe:** Instant confirmation that an alert subscription has been created and will trigger when the pharmacy updates stock.

---

## Verification & Quality Assurance Commands

To verify full system integrity, run the following in `frontend/`:

```bash
# 1. Run all 76 unit and integration tests across 5 suites
npm test

# 2. Verify zero ESLint warnings and errors
npm run lint

# 3. Verify zero TypeScript errors and production bundle build
npm run build
```
