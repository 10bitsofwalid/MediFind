// backend/src/utils/freshness.ts

export const DEFAULT_STALE_THRESHOLD_HOURS = 24;

/**
 * Calculates whether a stock report is stale based on the elapsed hours since its update timestamp.
 * Freshness is strictly derived from elapsed time and remains orthogonal to availability status.
 */
export function isReportStale(
  isoString?: string | Date,
  thresholdHours: number = DEFAULT_STALE_THRESHOLD_HOURS
): boolean {
  if (!isoString) return true;
  try {
    const updated = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (Number.isNaN(updated.getTime())) return true;
    const diffHours = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
    return diffHours >= thresholdHours;
  } catch {
    return true;
  }
}
