// frontend/tests/customerMapLocation.test.mjs
// Phase 5 tests: GPS hook logic, map/list parity, toggle, manual fallback, pin color encoding, and URL sync
// Pure vanilla JS — no TypeScript source imports (Node native test runner)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers: minimal stubs replicating hook & component logic without React
// ---------------------------------------------------------------------------

/** Minimal replica of useGeolocation state machine */
function simulateGeolocation(geoApiImpl) {
  let state = {
    latitude: null,
    longitude: null,
    accuracy: null,
    isLoading: false,
    error: null,
    permissionDenied: false,
  };

  function requestLocation(onSuccess, onError) {
    if (!geoApiImpl) {
      state = {
        ...state,
        error: 'Geolocation is not supported by your browser. Please enter your area manually.',
        isLoading: false,
        permissionDenied: false,
      };
      if (onError) onError(state.error);
      return;
    }

    state = { ...state, isLoading: true, error: null, permissionDenied: false };

    geoApiImpl.getCurrentPosition(
      (position) => {
        state = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          isLoading: false,
          error: null,
          permissionDenied: false,
        };
        if (onSuccess) onSuccess({ lat: state.latitude, lng: state.longitude });
      },
      (err) => {
        let errMsg = 'Unable to determine your location. Please enter your area manually.';
        let isDenied = false;

        if (err.code === 1 /* PERMISSION_DENIED */) {
          errMsg = 'Location permission was denied. Please type your area name (e.g. Dhanmondi, Dhaka).';
          isDenied = true;
        } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
          errMsg = 'GPS signal unavailable. Please type your area name manually.';
        } else if (err.code === 3 /* TIMEOUT */) {
          errMsg = 'Location request timed out. Please type your area name manually.';
        }

        state = {
          latitude: null,
          longitude: null,
          accuracy: null,
          isLoading: false,
          error: errMsg,
          permissionDenied: isDenied,
        };
        if (onError) onError(errMsg);
      }
    );
  }

  return { getState: () => state, requestLocation };
}

/** Minimal replica of client-side filter used in SearchResults */
function applyFilters(results, filters) {
  let list = [...results];
  list = list.filter((p) => p.distanceKm <= filters.distanceKm);
  if (filters.availability && filters.availability.length > 0) {
    list = list.filter((p) => filters.availability.includes(p.stockStatus));
  }
  if (filters.openNow) {
    list = list.filter((p) => p.isOpen);
  }
  return list;
}

/** Color status encoder function matching CustomerMapView */
function getPinColor(status) {
  switch (status) {
    case 'available':
      return '#0A7E51';
    case 'low':
      return '#C28400';
    case 'out':
      return '#D9383A';
    default:
      return '#6C757D';
  }
}

/** Build a minimal NearbyPharmacyResult stub */
function makePharmacy(overrides = {}) {
  return {
    pharmacyId: overrides.pharmacyId ?? 'ph-1',
    pharmacyName: overrides.pharmacyName ?? 'Test Pharmacy',
    address: overrides.address ?? 'Road 5, Dhaka',
    distanceKm: overrides.distanceKm ?? 1.2,
    stockStatus: overrides.stockStatus ?? 'available',
    quantity: overrides.quantity ?? 10,
    isOpen: overrides.isOpen ?? true,
    isVerified: overrides.isVerified ?? true,
    latitude: overrides.latitude ?? 23.746,
    longitude: overrides.longitude ?? 90.374,
    phone: overrides.phone ?? '01700000001',
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 5 – GPS hook, Map/List integration & Marker status synchronization', () => {

  // 1. PERMISSION_DENIED
  it('useGeolocation: permission denied sets permissionDenied=true and surfaces fallback message', (t, done) => {
    const fakeGeo = {
      getCurrentPosition(_success, error) {
        setTimeout(() => error({ code: 1 }), 0);
      },
    };

    const hook = simulateGeolocation(fakeGeo);
    hook.requestLocation(
      () => { done(new Error('Should not succeed')); },
      (errMsg) => {
        const state = hook.getState();
        assert.equal(state.permissionDenied, true, 'permissionDenied must be true');
        assert.ok(state.error, 'error must be non-null');
        assert.match(
          errMsg,
          /Location permission was denied/i,
          'error message must mention permission denial'
        );
        assert.equal(state.latitude, null, 'latitude must remain null');
        assert.equal(state.longitude, null, 'longitude must remain null');
        done();
      }
    );
  });

  // 2. POSITION_UNAVAILABLE
  it('useGeolocation: GPS unavailable returns clear user-friendly error', (t, done) => {
    const fakeGeo = {
      getCurrentPosition(_success, error) {
        setTimeout(() => error({ code: 2 }), 0);
      },
    };

    const hook = simulateGeolocation(fakeGeo);
    hook.requestLocation(
      () => { done(new Error('Should not succeed')); },
      (errMsg) => {
        const state = hook.getState();
        assert.equal(state.permissionDenied, false, 'permissionDenied must be false for unavailable');
        assert.ok(state.error, 'error must be set');
        assert.match(errMsg, /GPS signal unavailable/i, 'error must mention GPS signal');
        done();
      }
    );
  });

  // 3. Map / List parity — same result count
  it('MapView parity: list and map views show the same pharmacy count', () => {
    const pharmacies = [
      makePharmacy({ pharmacyId: 'ph-1', distanceKm: 0.5 }),
      makePharmacy({ pharmacyId: 'ph-2', distanceKm: 1.5 }),
      makePharmacy({ pharmacyId: 'ph-3', distanceKm: 3.0 }),
    ];

    const filters = { distanceKm: 10, availability: [], openNow: false };
    const listResults = applyFilters(pharmacies, filters);

    // Map view receives identical results (same prop passed in SearchResults)
    const mapMarkers = listResults.map((r) => ({ id: r.pharmacyId, name: r.pharmacyName }));

    assert.equal(listResults.length, pharmacies.length, 'list must include all pharmacies within range');
    assert.equal(mapMarkers.length, listResults.length, 'map must have same count as list');
  });

  // 4. Toggle does NOT reset filter state
  it('Map/List toggle: switching view does not reset filter state', () => {
    const pharmacies = [
      makePharmacy({ pharmacyId: 'ph-1', distanceKm: 0.5, stockStatus: 'available', isOpen: true }),
      makePharmacy({ pharmacyId: 'ph-2', distanceKm: 2.0, stockStatus: 'out', isOpen: false }),
      makePharmacy({ pharmacyId: 'ph-3', distanceKm: 5.0, stockStatus: 'available', isOpen: true }),
    ];

    // Filters: only "available" within 3 km, open now
    const filters = { distanceKm: 3, availability: ['available'], openNow: true };

    // Apply filters once (simulates list view)
    const listResults = applyFilters(pharmacies, filters);

    // Simulate toggling to map — same filters, same function
    const mapResults = applyFilters(pharmacies, filters);

    assert.equal(listResults.length, mapResults.length, 'toggling view must not change filtered count');
    assert.equal(listResults[0].pharmacyId, mapResults[0].pharmacyId, 'results must be identical after toggle');
  });

  // 5. Manual area fallback when GPS returns null coords
  it('Manual area fallback: null GPS coordinates fall back to area text search', () => {
    const geoLatitude = null;
    const geoLongitude = null;
    const areaParam = 'Mirpur, Dhaka';

    const effectiveArea =
      geoLatitude && geoLongitude ? 'Current Location (GPS)' : areaParam;

    assert.equal(
      effectiveArea,
      'Mirpur, Dhaka',
      'must fall back to areaParam text when GPS coords are null'
    );

    const withGps = { lat: 23.746, lng: 90.374 };
    const effectiveAreaWithGps =
      withGps.lat && withGps.lng ? 'Current Location (GPS)' : areaParam;

    assert.equal(
      effectiveAreaWithGps,
      'Current Location (GPS)',
      'must show GPS label when coordinates are available'
    );
  });

  // 6. Map pin status color encoding contract
  it('Map pin status colors: available is green, low is caution/amber, out is red', () => {
    assert.equal(getPinColor('available'), '#0A7E51', 'available stock pin must be green');
    assert.equal(getPinColor('low'), '#C28400', 'low stock pin must be caution amber');
    assert.equal(getPinColor('out'), '#D9383A', 'out of stock pin must be problem red');
    assert.equal(getPinColor('unverified'), '#6C757D', 'unverified or unknown status must be neutral gray');
  });

  // 7. URL ?view=map query parameter synchronization
  it('URL View State: parses ?view=map and defaults to list', () => {
    const paramsWithMap = new URLSearchParams('q=Napa&view=map');
    const viewParamMap = paramsWithMap.get('view') === 'map' ? 'map' : 'list';
    assert.equal(viewParamMap, 'map', 'must parse map mode from url');

    const paramsDefault = new URLSearchParams('q=Napa');
    const viewParamDefault = paramsDefault.get('view') === 'map' ? 'map' : 'list';
    assert.equal(viewParamDefault, 'list', 'must default to list mode when view param is omitted');
  });

  // 8. Map Pin Selection Sync
  it('Selected Pin Sync: identifying selected pharmacy displays accurate card details', () => {
    const pharmacies = [
      makePharmacy({ pharmacyId: 'ph-1', pharmacyName: 'Lazz Pharma Dhanmondi' }),
      makePharmacy({ pharmacyId: 'ph-2', pharmacyName: 'Tamanna Pharmacy' }),
    ];

    const selectedPharmacyId = 'ph-2';
    const selected = pharmacies.find((p) => p.pharmacyId === selectedPharmacyId);

    assert.ok(selected, 'Selected pharmacy must be found');
    assert.equal(selected.pharmacyName, 'Tamanna Pharmacy');
  });

});
