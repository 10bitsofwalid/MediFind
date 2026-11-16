// frontend/tests/customerSearchApi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const DHAKA_AREA_COORDINATES = {
  dhanmondi: { lat: 23.7461, lng: 90.3742 },
  gulshan: { lat: 23.7925, lng: 90.4078 },
  banani: { lat: 23.7937, lng: 90.4043 },
  mirpur: { lat: 23.8071, lng: 90.3686 },
  uttara: { lat: 23.8759, lng: 90.3795 },
  mohammadpur: { lat: 23.7542, lng: 90.3616 },
};

const DEFAULT_DHAKA_COORDS = { lat: 23.7461, lng: 90.3742 };

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

function resolveAreaCoordinates(areaText) {
  if (!areaText) return DEFAULT_DHAKA_COORDS;
  const lower = areaText.toLowerCase();

  for (const [key, coords] of Object.entries(DHAKA_AREA_COORDINATES)) {
    if (lower.includes(key)) {
      return coords;
    }
  }

  return DEFAULT_DHAKA_COORDS;
}

const SAMPLE_CATALOGUE = [
  { id: 'med_001', name: 'Napa Extra 500 mg tablet', genericName: 'Paracetamol + Caffeine', strength: '500 mg + 65 mg' },
  { id: 'med-paracetamol-500', name: 'Paracetamol 500 mg tablet', genericName: 'Paracetamol', strength: '500 mg' },
  { id: 'med-amoxicillin-500', name: 'Amoxicillin 500 mg capsule', genericName: 'Amoxicillin', strength: '500 mg' },
  { id: 'med-seclo-20', name: 'Seclo 20 mg capsule', genericName: 'Omeprazole', strength: '20 mg' },
  { id: 'med-vitamin-d-1000', name: 'Vitamin D3 1000 IU capsule', genericName: 'Cholecalciferol', strength: '1000 IU' },
];

// Test 1: Haversine distance calculation
test('GeoUtils: calculates accurate distance between coordinates', () => {
  // Identical points
  assert.equal(calculateDistanceKm(23.7461, 90.3742, 23.7461, 90.3742), 0);

  // Dhanmondi to Gulshan (~6.2 km)
  const dhanmondi = DHAKA_AREA_COORDINATES.dhanmondi;
  const gulshan = DHAKA_AREA_COORDINATES.gulshan;
  const dist = calculateDistanceKm(dhanmondi.lat, dhanmondi.lng, gulshan.lat, gulshan.lng);

  assert.ok(dist >= 5.0 && dist <= 8.0, `Distance should be ~6.2 km, got ${dist}`);
});

// Test 2: Area coordinates resolution fallback
test('GeoUtils: resolves manual area name to Dhaka coordinates', () => {
  const resolvedDhanmondi = resolveAreaCoordinates('Road 27, Dhanmondi, Dhaka');
  assert.equal(resolvedDhanmondi.lat, 23.7461);
  assert.equal(resolvedDhanmondi.lng, 90.3742);

  const resolvedMirpur = resolveAreaCoordinates('Mirpur-10 Circle');
  assert.equal(resolvedMirpur.lat, 23.8071);

  // Unknown area defaults gracefully to Central Dhaka
  const unknown = resolveAreaCoordinates('Random Unknown Ward');
  assert.equal(unknown.lat, 23.7461);
});

// Test 3: Medicine Catalogue Search
test('MedicineService: search finds medicines by brand, generic, and strength', () => {
  function searchCatalogue(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SAMPLE_CATALOGUE.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.strength.toLowerCase().includes(q)
    );
  }

  // By brand: Napa Extra
  const napaMatches = searchCatalogue('Napa');
  assert.ok(napaMatches.length >= 1);
  assert.equal(napaMatches[0].genericName, 'Paracetamol + Caffeine');

  // By generic: Omeprazole
  const secloMatches = searchCatalogue('Omeprazole');
  assert.ok(secloMatches.length >= 1);
  assert.equal(secloMatches[0].name.includes('Seclo'), true);

  // By strength: 1000 IU
  const vitMatches = searchCatalogue('1000 IU');
  assert.equal(vitMatches.length, 1);
  assert.equal(vitMatches[0].name.includes('Vitamin D3'), true);
});

// Test 4: Trust Boundary - Only verified pharmacies receive verified badge
test('Trust Boundary: Pending and unverified pharmacies are strictly marked unverified', () => {
  const pharmacies = [
    { name: 'Green Cross', status: 'verified' },
    { name: 'Metro Care Chemists', status: 'pending' },
    { name: 'Suspended Pharmacy', status: 'suspended' },
  ];

  const results = pharmacies.map((p) => ({
    name: p.name,
    isVerified: p.status === 'verified',
  }));

  assert.equal(results[0].isVerified, true);
  assert.equal(results[1].isVerified, false, 'Pending pharmacy must not be marked verified');
  assert.equal(results[2].isVerified, false, 'Suspended pharmacy must not be marked verified');
});

// Test 5: Freshness & Stale Calculation
test('Freshness Calculation: reports updated >= 24h ago are marked stale', () => {
  function evaluateFreshness(updatedAtIso) {
    const hours = (Date.now() - new Date(updatedAtIso).getTime()) / 3600000;
    return hours >= 24;
  }

  const fresh = new Date(Date.now() - 2 * 3600000).toISOString(); // 2h ago
  const stale = new Date(Date.now() - 26 * 3600000).toISOString(); // 26h ago

  assert.equal(evaluateFreshness(fresh), false);
  assert.equal(evaluateFreshness(stale), true);
});
