// backend/src/services/systemSettingService.ts
import mongoose from 'mongoose';
import { SystemSetting } from '../models/SystemSetting';

export const DEFAULT_STALE_THRESHOLD_HOURS = 24;
export const DEFAULT_UNVERIFIED_REPORT_THRESHOLD = 3;

export interface QualityThresholds {
  staleThresholdHours: number;
  unverifiedReportThreshold: number;
}

// In-memory store for development fallback and unit tests when MongoDB is offline
const inMemorySystemSettings = new Map<string, any>();

let testStaleThresholdOverride: number | null = null;

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Returns the effective stale threshold hours synchronously, taking into account:
 * 1. Test override (if set)
 * 2. Environment variable STALE_THRESHOLD_HOURS (if set and valid)
 * 3. Default fallback of 24 hours
 */
export function getEffectiveStaleThreshold(): number {
  if (testStaleThresholdOverride !== null && Number.isFinite(testStaleThresholdOverride) && testStaleThresholdOverride > 0) {
    return testStaleThresholdOverride;
  }

  const envVal = process.env.STALE_THRESHOLD_HOURS;
  if (envVal !== undefined && envVal.trim() !== '') {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_STALE_THRESHOLD_HOURS;
}

/**
 * Sets a test override for stale threshold hours (used for focused test scenarios).
 * Pass null to clear the override.
 */
export function setTestStaleThreshold(hours: number | null): void {
  testStaleThresholdOverride = hours !== null && Number.isFinite(hours) && hours > 0 ? hours : null;
}

/**
 * Reads the configured stale threshold hours.
 * Priority: Test override -> DB/in-memory configuration -> STALE_THRESHOLD_HOURS env -> default 24h.
 */
export async function getStaleThresholdHours(): Promise<number> {
  if (testStaleThresholdOverride !== null && Number.isFinite(testStaleThresholdOverride) && testStaleThresholdOverride > 0) {
    return testStaleThresholdOverride;
  }

  if (isConnected()) {
    try {
      const doc = await SystemSetting.findOne({
        $or: [{ key: 'stale_threshold_hours' }, { key: 'quality_thresholds' }],
      }).lean();

      if (doc) {
        if (doc.key === 'stale_threshold_hours') {
          const val = Number(doc.value);
          if (Number.isFinite(val) && val > 0) return val;
        } else if (doc.key === 'quality_thresholds' && typeof doc.value === 'object' && doc.value !== null) {
          const val = Number((doc.value as any).staleThresholdHours);
          if (Number.isFinite(val) && val > 0) return val;
        }
      }
    } catch {
      // fallback to in-memory / env
    }
  }

  if (inMemorySystemSettings.has('stale_threshold_hours')) {
    const val = Number(inMemorySystemSettings.get('stale_threshold_hours'));
    if (Number.isFinite(val) && val > 0) return val;
  }

  if (inMemorySystemSettings.has('quality_thresholds')) {
    const raw = inMemorySystemSettings.get('quality_thresholds');
    if (raw && typeof raw === 'object') {
      const val = Number(raw.staleThresholdHours);
      if (Number.isFinite(val) && val > 0) return val;
    }
  }

  return getEffectiveStaleThreshold();
}

/**
 * Configures the server-side stale threshold hours.
 */
export async function setStaleThresholdHours(hours: number, updatedBy?: string): Promise<number> {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error('Stale threshold hours must be a positive number.');
  }

  const now = new Date();
  if (isConnected()) {
    await SystemSetting.findOneAndUpdate(
      { key: 'stale_threshold_hours' },
      {
        key: 'stale_threshold_hours',
        value: hours,
        description: 'Hours after last stock update before a report is considered stale.',
        updatedBy: updatedBy || null,
        updatedAt: now,
      },
      { upsert: true, new: true }
    );
  }

  inMemorySystemSettings.set('stale_threshold_hours', hours);
  return hours;
}

/**
 * Retrieves the full quality thresholds (stale hours + report threshold).
 * Coordinated with Developer 3's moderation settings.
 */
export async function getQualityThresholds(): Promise<QualityThresholds> {
  const staleThresholdHours = await getStaleThresholdHours();

  let unverifiedReportThreshold = DEFAULT_UNVERIFIED_REPORT_THRESHOLD;
  const envReports = process.env.UNVERIFIED_REPORT_THRESHOLD;
  if (envReports && !Number.isNaN(Number(envReports)) && Number(envReports) > 0) {
    unverifiedReportThreshold = Number(envReports);
  }

  if (isConnected()) {
    try {
      const doc = await SystemSetting.findOne({
        $or: [{ key: 'unverified_report_threshold' }, { key: 'quality_thresholds' }],
      }).lean();

      if (doc) {
        if (doc.key === 'unverified_report_threshold') {
          const val = Number(doc.value);
          if (Number.isFinite(val) && val > 0) unverifiedReportThreshold = val;
        } else if (doc.key === 'quality_thresholds' && typeof doc.value === 'object' && doc.value !== null) {
          const val = Number((doc.value as any).unverifiedReportThreshold);
          if (Number.isFinite(val) && val > 0) unverifiedReportThreshold = val;
        }
      }
    } catch {
      // fallback
    }
  }

  if (inMemorySystemSettings.has('unverified_report_threshold')) {
    const val = Number(inMemorySystemSettings.get('unverified_report_threshold'));
    if (Number.isFinite(val) && val > 0) unverifiedReportThreshold = val;
  }

  return {
    staleThresholdHours,
    unverifiedReportThreshold,
  };
}

/**
 * Updates quality thresholds in coordination with Developer 3.
 */
export async function setQualityThresholds(
  data: Partial<QualityThresholds>,
  updatedBy?: string
): Promise<QualityThresholds> {
  const current = await getQualityThresholds();
  const next: QualityThresholds = {
    staleThresholdHours:
      typeof data.staleThresholdHours === 'number' && data.staleThresholdHours > 0
        ? data.staleThresholdHours
        : current.staleThresholdHours,
    unverifiedReportThreshold:
      typeof data.unverifiedReportThreshold === 'number' && data.unverifiedReportThreshold > 0
        ? data.unverifiedReportThreshold
        : current.unverifiedReportThreshold,
  };

  const now = new Date();
  if (isConnected()) {
    await SystemSetting.findOneAndUpdate(
      { key: 'quality_thresholds' },
      {
        key: 'quality_thresholds',
        value: next,
        description: 'Configured stale threshold hours and unverified discrepancy report threshold.',
        updatedBy: updatedBy || null,
        updatedAt: now,
      },
      { upsert: true, new: true }
    );
  }

  inMemorySystemSettings.set('quality_thresholds', next);
  inMemorySystemSettings.set('stale_threshold_hours', next.staleThresholdHours);
  inMemorySystemSettings.set('unverified_report_threshold', next.unverifiedReportThreshold);

  return next;
}

/**
 * Resets in-memory system settings and test overrides (used for test isolation).
 */
export function resetSystemSettingsStore(): void {
  inMemorySystemSettings.clear();
  testStaleThresholdOverride = null;
}
