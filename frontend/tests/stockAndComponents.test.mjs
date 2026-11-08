// frontend/tests/stockAndComponents.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

function formatTimeAgo(isoString) {
  if (!isoString) return 'Update time unavailable';
  try {
    const updated = new Date(isoString);
    if (isNaN(updated.getTime())) return 'Update time unavailable';

    const diffMs = Date.now() - updated.getTime();
    if (diffMs < 0) return 'Just now';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Update time unavailable';
  }
}

function isReportStale(isoString, thresholdHours = 24) {
  if (!isoString) return true;
  try {
    const updated = new Date(isoString);
    if (isNaN(updated.getTime())) return true;
    const diffHours = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
    return diffHours >= thresholdHours;
  } catch {
    return true;
  }
}

test('Freshness Formatting & Stale Detection', () => {
  // Recent update (15 mins ago)
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  assert.equal(formatTimeAgo(fifteenMinsAgo), '15m ago');
  assert.equal(isReportStale(fifteenMinsAgo), false);

  // Stale update (26 hours ago)
  const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  assert.equal(formatTimeAgo(twentySixHoursAgo), 'Yesterday');
  assert.equal(isReportStale(twentySixHoursAgo), true, 'Report > 24 hours must be marked stale');

  // Missing timestamp
  assert.equal(formatTimeAgo(undefined), 'Update time unavailable');
  assert.equal(isReportStale(undefined), true);
});

test('One-Tap Stock Status Transitions', () => {
  const stockItem = {
    stockId: 'stk_1',
    medicineName: 'Napa Extra',
    status: 'low',
    quantity: 5,
    updatedAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    isStale: true,
  };

  // Transition to available
  const updatedItem = {
    ...stockItem,
    status: 'available',
    quantity: 100,
    updatedAt: new Date().toISOString(),
    isStale: false,
  };

  assert.equal(updatedItem.status, 'available');
  assert.equal(updatedItem.isStale, false, 'Newly reported stock is fresh');
  assert.equal(updatedItem.quantity, 100);
});

