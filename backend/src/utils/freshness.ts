// backend/src/utils/freshness.ts
import {
  DEFAULT_STALE_THRESHOLD_HOURS,
  getEffectiveStaleThreshold,
} from '../services/systemSettingService';

export { DEFAULT_STALE_THRESHOLD_HOURS };

export interface FreshnessCalculationResult {
  isStale: boolean;
  freshness: 'fresh' | 'stale';
  thresholdHours: number;
  elapsedHours?: number;
}

/**
 * Calculates whether a stock report is stale based on the elapsed hours since its update timestamp
 * and the configured stale threshold.
 *
 * Freshness Rules & Invariants:
 * 1. Freshness is strictly derived from elapsed time since `updatedAt` and remains orthogonal to reported stock status.
 * 2. Stale reports NEVER mutate the stock status (`available`, `low`, `out`, `unverified`).
 * 3. Default threshold is 24 hours when no configured value exists.
 * 4. Supports a testable controlled/supplied reference time (UTC/consistent clock).
 */
export function calculateFreshness(
  isoString?: string | Date,
  thresholdHours?: number,
  currentTime: Date | string | number = Date.now()
): FreshnessCalculationResult {
  const threshold =
    typeof thresholdHours === 'number' && Number.isFinite(thresholdHours) && thresholdHours > 0
      ? thresholdHours
      : getEffectiveStaleThreshold();

  if (!isoString) {
    return {
      isStale: true,
      freshness: 'stale',
      thresholdHours: threshold,
    };
  }

  try {
    const updated = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (Number.isNaN(updated.getTime())) {
      return {
        isStale: true,
        freshness: 'stale',
        thresholdHours: threshold,
      };
    }

    const currentMs =
      currentTime instanceof Date
        ? currentTime.getTime()
        : typeof currentTime === 'string'
        ? new Date(currentTime).getTime()
        : currentTime;

    const diffMs = currentMs - updated.getTime();
    const elapsedHours = diffMs / (1000 * 60 * 60);

    // Stale when elapsed hours is greater than or equal to the configured threshold
    const isStale = elapsedHours >= threshold;

    return {
      isStale,
      freshness: isStale ? 'stale' : 'fresh',
      thresholdHours: threshold,
      elapsedHours: Math.max(0, elapsedHours),
    };
  } catch {
    return {
      isStale: true,
      freshness: 'stale',
      thresholdHours: threshold,
    };
  }
}

/**
 * Convenience helper returning boolean isStale, backwards-compatible with existing call sites.
 * Accepts optional controlled threshold and reference time for deterministic testing.
 */
export function isReportStale(
  isoString?: string | Date,
  thresholdHours?: number,
  currentTime: Date | string | number = Date.now()
): boolean {
  return calculateFreshness(isoString, thresholdHours, currentTime).isStale;
}
