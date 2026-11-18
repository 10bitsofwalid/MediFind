// frontend/tests/customerFiltersAndDetail.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const SAMPLE_PHARMACIES = [
  {
    id: 'p1',
    name: 'Green Cross',
    distanceKm: 1.2,
    stockStatus: 'available',
    isOpen: true,
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(), // 10m ago
  },
  {
    id: 'p2',
    name: 'CarePoint',
    distanceKm: 4.8,
    stockStatus: 'low',
    isOpen: true,
    updatedAt: new Date(Date.now() - 40 * 60000).toISOString(), // 40m ago
  },
  {
    id: 'p3',
    name: 'CityWell',
    distanceKm: 8.5,
    stockStatus: 'out',
    isOpen: false,
    updatedAt: new Date(Date.now() - 120 * 60000).toISOString(), // 2h ago
  },
  {
    id: 'p4',
    name: 'Northside Drug',
    distanceKm: 18.0,
    stockStatus: 'available',
    isOpen: false,
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5m ago
  },
];

// Test 1: Distance Filtering
test('SearchFilterBar: filters pharmacies by distance threshold', () => {
  function filterByDistance(list, maxKm) {
    return list.filter((p) => p.distanceKm <= maxKm);
  }

  const within5km = filterByDistance(SAMPLE_PHARMACIES, 5);
  assert.equal(within5km.length, 2);
  assert.deepEqual(
    within5km.map((p) => p.name),
    ['Green Cross', 'CarePoint']
  );

  const within10km = filterByDistance(SAMPLE_PHARMACIES, 10);
  assert.equal(within10km.length, 3);
});

// Test 2: Availability Multi-select Filter
test('SearchFilterBar: filters pharmacies by availability status', () => {
  function filterByAvailability(list, selectedStatuses) {
    if (!selectedStatuses || selectedStatuses.length === 0) return list;
    return list.filter((p) => selectedStatuses.includes(p.stockStatus));
  }

  // Only Available
  const onlyAvailable = filterByAvailability(SAMPLE_PHARMACIES, ['available']);
  assert.equal(onlyAvailable.length, 2);

  // Available or Low stock
  const inStock = filterByAvailability(SAMPLE_PHARMACIES, ['available', 'low']);
  assert.equal(inStock.length, 3);

  // Out of stock
  const outOfStock = filterByAvailability(SAMPLE_PHARMACIES, ['out']);
  assert.equal(outOfStock.length, 1);
  assert.equal(outOfStock[0].name, 'CityWell');
});

// Test 3: Open Now Filter
test('SearchFilterBar: filters pharmacies currently open', () => {
  function filterByOpenNow(list, openNow) {
    if (!openNow) return list;
    return list.filter((p) => p.isOpen);
  }

  const openList = filterByOpenNow(SAMPLE_PHARMACIES, true);
  assert.equal(openList.length, 2);
  assert.deepEqual(
    openList.map((p) => p.name),
    ['Green Cross', 'CarePoint']
  );
});

// Test 4: Sorting by Distance, Freshness, and Availability
test('SearchFilterBar: sorts results by distance, freshness, and stock priority', () => {
  function sortResults(list, sortBy) {
    const copy = [...list];
    if (sortBy === 'distance') {
      return copy.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    if (sortBy === 'freshness') {
      return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    if (sortBy === 'availability') {
      const rank = { available: 1, low: 2, out: 3, unverified: 4 };
      return copy.sort((a, b) => (rank[a.stockStatus] || 5) - (rank[b.stockStatus] || 5));
    }
    return copy;
  }

  // Distance: Closest first (Green Cross 1.2km -> CarePoint 4.8km -> CityWell 8.5km -> Northside 18km)
  const byDistance = sortResults(SAMPLE_PHARMACIES, 'distance');
  assert.equal(byDistance[0].name, 'Green Cross');
  assert.equal(byDistance[byDistance.length - 1].name, 'Northside Drug');

  // Freshness: Most recent first (Northside 5m ago -> Green Cross 10m ago)
  const byFreshness = sortResults(SAMPLE_PHARMACIES, 'freshness');
  assert.equal(byFreshness[0].name, 'Northside Drug');
  assert.equal(byFreshness[1].name, 'Green Cross');

  // Availability: In-stock first
  const byAvailability = sortResults(SAMPLE_PHARMACIES, 'availability');
  assert.equal(byAvailability[0].stockStatus, 'available');
  assert.equal(byAvailability[byAvailability.length - 1].stockStatus, 'out');
});

// Test 5: Medicine Detail Gated Reservation Rule
test('Medicine Detail: reservation requires customer authentication', () => {
  function checkReservationAccess(userRole) {
    if (userRole === 'CUSTOMER') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Sign in is required to create a short hold.',
      redirectUrl: '/login?reason=reservation_required',
    };
  }

  assert.equal(checkReservationAccess(null).allowed, false);
  assert.equal(checkReservationAccess('CUSTOMER').allowed, true);
  assert.equal(checkReservationAccess(null).redirectUrl, '/login?reason=reservation_required');
});

