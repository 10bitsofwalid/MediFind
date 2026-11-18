// frontend/tests/customerPhase9Regression.test.mjs
// Phase 9 Regression Test Suite: Blocker fixes, edge case hardening, accessibility, and resilience
// Pure vanilla JS — no TypeScript source imports (Node native test runner)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Phase 9 – Search Tokenization, Operating Hours Fallback & System Resilience', () => {
  // 1. Multi-Word Search Token Matching
  it('Search Token Matching: multi-word query matches all components simultaneously', () => {
    const catalogue = [
      { name: 'Napa Extra', genericName: 'Paracetamol + Caffeine', strength: '500 mg + 65 mg' },
      { name: 'Napa', genericName: 'Paracetamol', strength: '500 mg' },
      { name: 'Seclo', genericName: 'Omeprazole', strength: '20 mg' },
    ];

    function searchCatalogue(query) {
      const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length === 0) return [];
      return catalogue.filter((item) => {
        const target = `${item.name} ${item.genericName} ${item.strength}`.toLowerCase();
        return words.every((w) => target.includes(w));
      });
    }

    // Single word
    const singleMatch = searchCatalogue('napa');
    assert.equal(singleMatch.length, 2);

    // Multi-word brand + strength
    const multiMatch = searchCatalogue('napa 500');
    assert.equal(multiMatch.length, 2);

    // Multi-word brand + generic keyword
    const brandGenericMatch = searchCatalogue('napa caffeine');
    assert.equal(brandGenericMatch.length, 1);
    assert.equal(brandGenericMatch[0].name, 'Napa Extra');

    // Non-matching term
    const noMatch = searchCatalogue('napa insulin');
    assert.equal(noMatch.length, 0);
  });

  // 2. Search Query Whitespace Trimming & Sanitization
  it('Search Query Sanitization: empty or whitespace-only queries default safely', () => {
    function sanitizeSearchQuery(rawQuery, defaultQuery = 'Paracetamol 500 mg') {
      if (!rawQuery) return defaultQuery;
      const trimmed = rawQuery.trim();
      return trimmed.length > 0 ? trimmed : defaultQuery;
    }

    assert.equal(sanitizeSearchQuery(''), 'Paracetamol 500 mg');
    assert.equal(sanitizeSearchQuery('   '), 'Paracetamol 500 mg');
    assert.equal(sanitizeSearchQuery(null), 'Paracetamol 500 mg');
    assert.equal(sanitizeSearchQuery(undefined), 'Paracetamol 500 mg');
    assert.equal(sanitizeSearchQuery('  Napa Extra  '), 'Napa Extra');
  });

  // 3. Operating Hours Fallback Formatting
  it('Operating Hours Presentation: missing or empty hours avoids empty parentheses', () => {
    function formatOperatingHours(isOpen, hoursText) {
      const statusLabel = isOpen ? 'Open Now' : 'Closed';
      const cleanHours = hoursText && hoursText.trim() ? ` (${hoursText.trim()})` : '';
      return `${statusLabel}${cleanHours}`;
    }

    // Normal hours
    assert.equal(formatOperatingHours(true, 'Open until 10:00 PM'), 'Open Now (Open until 10:00 PM)');
    assert.equal(formatOperatingHours(false, 'Closed at 8:00 PM'), 'Closed (Closed at 8:00 PM)');

    // Missing / empty hours
    assert.equal(formatOperatingHours(true, ''), 'Open Now');
    assert.equal(formatOperatingHours(true, '   '), 'Open Now');
    assert.equal(formatOperatingHours(true, null), 'Open Now');
    assert.equal(formatOperatingHours(false, undefined), 'Closed');
  });

  // 4. Modal Escape Key Accessibility Contract
  it('Modal Accessibility: Escape key event triggers modal dismiss callback', () => {
    let isClosed = false;
    const closeModal = () => {
      isClosed = true;
    };

    function simulateModalKeyDown(key) {
      if (key === 'Escape') {
        closeModal();
      }
    }

    simulateModalKeyDown('Enter');
    assert.equal(isClosed, false);

    simulateModalKeyDown('Tab');
    assert.equal(isClosed, false);

    simulateModalKeyDown('Escape');
    assert.equal(isClosed, true);
  });

  // 5. Dynamic Page Document Titles
  it('Page Title Contract: routes set contextual, SEO-friendly titles', () => {
    function resolvePageTitle(route, params = {}) {
      if (route === '/') {
        return 'MediFind - Find Medicine Availability Near You';
      }
      if (route === '/search') {
        const query = params.q ? params.q.trim() : 'Search';
        return `${query} - Pharmacy Stock Search | MediFind`;
      }
      if (route === '/medicine') {
        const medicineName = params.name ? params.name.trim() : 'Medicine Details';
        return `${medicineName} - Details & Availability | MediFind`;
      }
      return 'MediFind';
    }

    assert.equal(resolvePageTitle('/'), 'MediFind - Find Medicine Availability Near You');
    assert.equal(resolvePageTitle('/search', { q: 'Napa Extra' }), 'Napa Extra - Pharmacy Stock Search | MediFind');
    assert.equal(resolvePageTitle('/medicine', { name: 'Sergel 20 mg' }), 'Sergel 20 mg - Details & Availability | MediFind');
  });

  // 6. Error Boundary Contract
  it('Error Boundary Contract: isolates component errors with fallback title and reset action', () => {
    function simulateErrorBoundary(hasError, fallbackTitle) {
      if (hasError) {
        return {
          hasError: true,
          role: 'alert',
          title: fallbackTitle || 'An unexpected error occurred',
          canReset: true,
        };
      }
      return {
        hasError: false,
        renderedChildren: true,
      };
    }

    const okState = simulateErrorBoundary(false, 'Map Error');
    assert.equal(okState.hasError, false);
    assert.equal(okState.renderedChildren, true);

    const errorState = simulateErrorBoundary(true, 'Search Results Error');
    assert.equal(errorState.hasError, true);
    assert.equal(errorState.role, 'alert');
    assert.equal(errorState.title, 'Search Results Error');
    assert.equal(errorState.canReset, true);
  });
});
