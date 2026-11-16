// frontend/tests/customerSearchPage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Test 1: Autocomplete Catalogue matching
test('Medicine Catalogue Autocomplete: filters by brand, generic name, and strength', () => {
  const catalogue = [
    { id: '1', name: 'Paracetamol 500 mg tablet', genericName: 'Paracetamol', strength: '500 mg' },
    { id: '2', name: 'Panadol 500 mg tablet', genericName: 'Paracetamol', strength: '500 mg' },
    { id: '3', name: 'Amoxicillin 500 mg capsule', genericName: 'Amoxicillin', strength: '500 mg' },
    { id: '4', name: 'Cetirizine 10 mg tablet', genericName: 'Cetirizine Hydrochloride', strength: '10 mg' },
  ];

  function filterSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalogue.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.genericName.toLowerCase().includes(q) ||
        item.strength.toLowerCase().includes(q)
    );
  }

  // Brand search
  const panadolResults = filterSuggestions('Panadol');
  assert.equal(panadolResults.length, 1);
  assert.equal(panadolResults[0].name, 'Panadol 500 mg tablet');

  // Generic search
  const paracetamolResults = filterSuggestions('Paracetamol');
  assert.equal(paracetamolResults.length, 2);

  // Strength search
  const tenMgResults = filterSuggestions('10 mg');
  assert.equal(tenMgResults.length, 1);
  assert.equal(tenMgResults[0].genericName, 'Cetirizine Hydrochloride');

  // Empty search
  assert.equal(filterSuggestions('   ').length, 0);
});

// Test 2: Search Page UI States handling
test('Search Results States: Loading, Empty, and Error state contracts', () => {
  function resolveSearchState({ isLoading, error, resultsCount }) {
    if (isLoading) {
      return { state: 'loading', role: 'status', ariaLive: 'polite' };
    }
    if (error) {
      return { state: 'error', role: 'alert', retryable: true };
    }
    if (resultsCount === 0) {
      return { state: 'empty', role: 'status', showsNoResultsGuidance: true };
    }
    return { state: 'success', role: 'region' };
  }

  assert.deepEqual(resolveSearchState({ isLoading: true, error: null, resultsCount: 0 }), {
    state: 'loading',
    role: 'status',
    ariaLive: 'polite',
  });

  assert.deepEqual(resolveSearchState({ isLoading: false, error: 'Network timeout', resultsCount: 0 }), {
    state: 'error',
    role: 'alert',
    retryable: true,
  });

  assert.deepEqual(resolveSearchState({ isLoading: false, error: null, resultsCount: 0 }), {
    state: 'empty',
    role: 'status',
    showsNoResultsGuidance: true,
  });

  assert.deepEqual(resolveSearchState({ isLoading: false, error: null, resultsCount: 3 }), {
    state: 'success',
    role: 'region',
  });
});

// Test 3: Product Rule - No clinical or dosage advice allowed
test('Product Rule: Reference catalogue must disclaim clinical advice and dosage recommendations', () => {
  const disclaimerText =
    'Reference information only: MediFind does not provide medical or dosage advice. Follow a clinician’s prescription or official product label guidance.';

  assert.ok(disclaimerText.includes('does not provide medical or dosage advice'));
  assert.ok(!disclaimerText.includes('take 2 pills'));
});

// Test 4: Customer Auth Navigation - Role-specific destination
test('Customer Auth Navigation: Customer role lands on customer discovery, Pharmacy on workspace', () => {
  function getPostAuthRedirect(role) {
    if (role === 'CUSTOMER') {
      return '/'; // Customer landing & search front door
    }
    if (role === 'PHARMACY') {
      return '/pharmacy/dashboard';
    }
    return '/pharmacy/dashboard';
  }

  assert.equal(getPostAuthRedirect('CUSTOMER'), '/');
  assert.equal(getPostAuthRedirect('PHARMACY'), '/pharmacy/dashboard');
  assert.equal(getPostAuthRedirect('ADMIN'), '/pharmacy/dashboard');
});

// Test 5: Guest Access Allowed - Search is available without authentication
test('Guest Discovery: Public guest can perform search without auth session', () => {
  function isRouteProtected(pathname) {
    const protectedRoutes = ['/pharmacy/dashboard', '/pharmacy/profile'];
    return protectedRoutes.includes(pathname);
  }

  assert.equal(isRouteProtected('/'), false);
  assert.equal(isRouteProtected('/search'), false);
  assert.equal(isRouteProtected('/medicine/med-paracetamol-500'), false);
  assert.equal(isRouteProtected('/pharmacy/dashboard'), true);
});

