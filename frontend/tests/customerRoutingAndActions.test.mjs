// frontend/tests/customerRoutingAndActions.test.mjs
// Phase 6 tests: Call and routing actions, missing phone/coordinates handling, and routing failure fallbacks
// Pure vanilla JS — no TypeScript source imports (Node native test runner)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers: replicas of Phase 6 routingUtils logic without React/DOM
// ---------------------------------------------------------------------------

function isValidCoordinate(lat, lng) {
  if (lat == null || lng == null) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function getDirectionsRoute(options) {
  const { latitude, longitude, address, pharmacyName } = options;

  if (isValidCoordinate(latitude, longitude)) {
    return {
      url: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      mode: 'coordinates',
      hasExactCoordinates: true,
      label: `Directions to ${pharmacyName} (via GPS coordinates)`,
    };
  }

  const fallbackQuery = encodeURIComponent(
    [pharmacyName, address, 'Dhaka, Bangladesh'].filter(Boolean).join(', ')
  );

  return {
    url: `https://www.google.com/maps/search/?api=1&query=${fallbackQuery}`,
    mode: 'search_query',
    hasExactCoordinates: false,
    label: `Search location for ${pharmacyName} on Google Maps (address fallback)`,
  };
}

function sanitizePhoneNumber(phone) {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed || trimmed === 'N/A' || trimmed === 'None') return null;
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  return cleaned.length >= 6 ? cleaned : null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 6 – Call & Route Actions, Missing Metadata Fallback, and Error Handling', () => {

  // 1. Phone sanitization: valid Bangladeshi numbers
  it('Phone sanitization: formats and accepts valid mobile & landline numbers', () => {
    assert.equal(sanitizePhoneNumber('01712345678'), '01712345678');
    assert.equal(sanitizePhoneNumber('+8801712345678'), '+8801712345678');
    assert.equal(sanitizePhoneNumber(' 018-1234-5678 '), '01812345678');
    assert.equal(sanitizePhoneNumber('02-9876543'), '029876543');
  });

  // 2. Missing or invalid phone handling
  it('Missing phone handling: null, empty string, or invalid text returns null', () => {
    assert.equal(sanitizePhoneNumber(null), null);
    assert.equal(sanitizePhoneNumber(undefined), null);
    assert.equal(sanitizePhoneNumber(''), null);
    assert.equal(sanitizePhoneNumber('   '), null);
    assert.equal(sanitizePhoneNumber('N/A'), null);
    assert.equal(sanitizePhoneNumber('None'), null);
    assert.equal(sanitizePhoneNumber('123'), null, 'Numbers shorter than 6 digits must be rejected');
  });

  // 3. Coordinate validation: valid coords in Dhaka
  it('Coordinate validation: accepts valid non-zero latitude and longitude', () => {
    assert.equal(isValidCoordinate(23.7461, 90.3742), true, 'Dhanmondi coords must be valid');
    assert.equal(isValidCoordinate(23.7925, 90.4078), true, 'Gulshan coords must be valid');
  });

  // 4. Coordinate validation: rejects missing, zero, or NaN coordinates
  it('Coordinate validation: rejects zero, missing, null, or out-of-range coordinates', () => {
    assert.equal(isValidCoordinate(0, 0), false, '(0,0) must be rejected as invalid');
    assert.equal(isValidCoordinate(null, 90.3742), false, 'null latitude must be rejected');
    assert.equal(isValidCoordinate(23.7461, null), false, 'null longitude must be rejected');
    assert.equal(isValidCoordinate(undefined, undefined), false, 'undefined must be rejected');
    assert.equal(isValidCoordinate(NaN, 90.3742), false, 'NaN must be rejected');
    assert.equal(isValidCoordinate(95.0, 90.0), false, 'Latitude > 90 must be rejected');
  });

  // 5. GPS Directions: exact coordinates URL
  it('Directions Route: creates exact GPS navigation URL when coordinates are present', () => {
    const route = getDirectionsRoute({
      latitude: 23.7461,
      longitude: 90.3742,
      pharmacyName: 'Lazz Pharma Dhanmondi',
      address: 'Road 5, Dhanmondi',
    });

    assert.equal(route.mode, 'coordinates');
    assert.equal(route.hasExactCoordinates, true);
    assert.equal(route.url, 'https://www.google.com/maps/dir/?api=1&destination=23.7461,90.3742');
  });

  // 6. Graceful Fallback: missing coordinates fall back to text query URL
  it('Directions Route: falls back to address query search when coordinates are missing or zero', () => {
    const route = getDirectionsRoute({
      latitude: null,
      longitude: null,
      pharmacyName: 'Care Pharmacy Mirpur',
      address: 'Mirpur 10 Circle',
    });

    assert.equal(route.mode, 'search_query');
    assert.equal(route.hasExactCoordinates, false);
    assert.ok(route.url.includes('google.com/maps/search/?api=1&query='));
    assert.ok(route.url.includes(encodeURIComponent('Care Pharmacy Mirpur')));
  });

  // 7. Graceful Fallback: (0, 0) placeholder coordinates trigger address search
  it('Directions Route: placeholder (0, 0) coordinates trigger address search fallback', () => {
    const route = getDirectionsRoute({
      latitude: 0,
      longitude: 0,
      pharmacyName: 'Model Pharmacy',
      address: 'Shahbagh',
    });

    assert.equal(route.mode, 'search_query');
    assert.equal(route.hasExactCoordinates, false);
    assert.ok(route.url.includes('google.com/maps/search/'));
  });

});
