// src/services/stockReminderService.ts
export interface StockReminderPreferences {
  dailyLoginEnabled: boolean;
  customScheduleEnabled: boolean;
  times: string[]; // "HH:mm" 24-hour format
}

export interface StockReminderNotification {
  id: string;
  kind: 'daily_login' | 'custom_schedule';
  title: string;
  message: string;
  scheduledTime?: string;
  createdAt: string;
}

const PREFS_KEY_PREFIX = 'medifind_stock_reminder_prefs';
const DAILY_DATE_KEY_PREFIX = 'medifind_stock_reminder_daily_date';
const CUSTOM_FIRED_KEY_PREFIX = 'medifind_stock_reminder_custom_fired';

export const REMINDER_PREFS_UPDATED_EVENT = 'medifind:reminder-prefs-updated';
export const PHARMACY_STATUS_UPDATED_EVENT = 'medifind:pharmacy-status-updated';
export const TEST_REMINDER_EVENT = 'medifind:test-stock-reminder';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatTimeDisplay(hhmm: string): string {
  if (!TIME_PATTERN.test(hhmm)) return hhmm;
  const [hourStr, minStr] = hhmm.split(':');
  const hour24 = Number(hourStr);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minStr} ${period}`;
}

export function getReminderPreferences(userId: string): StockReminderPreferences {
  const defaults: StockReminderPreferences = {
    dailyLoginEnabled: true,
    customScheduleEnabled: true,
    times: [],
  };

  try {
    const raw = localStorage.getItem(`${PREFS_KEY_PREFIX}_${userId}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StockReminderPreferences>;
    const validTimes = Array.isArray(parsed.times)
      ? Array.from(new Set(parsed.times.filter((t) => typeof t === 'string' && TIME_PATTERN.test(t)))).sort()
      : [];

    return {
      dailyLoginEnabled: parsed.dailyLoginEnabled !== undefined ? Boolean(parsed.dailyLoginEnabled) : true,
      customScheduleEnabled:
        parsed.customScheduleEnabled !== undefined ? Boolean(parsed.customScheduleEnabled) : true,
      times: validTimes,
    };
  } catch {
    return defaults;
  }
}

export function saveReminderPreferences(
  userId: string,
  prefs: StockReminderPreferences
): StockReminderPreferences {
  const normalizedTimes = Array.from(
    new Set(prefs.times.filter((t) => TIME_PATTERN.test(t)))
  ).sort();

  const normalized: StockReminderPreferences = {
    dailyLoginEnabled: Boolean(prefs.dailyLoginEnabled),
    customScheduleEnabled: Boolean(prefs.customScheduleEnabled),
    times: normalizedTimes,
  };

  localStorage.setItem(`${PREFS_KEY_PREFIX}_${userId}`, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(REMINDER_PREFS_UPDATED_EVENT));
  return normalized;
}

export function isValidReminderTime(hhmm: string): boolean {
  return TIME_PATTERN.test(hhmm);
}

export function checkAndTriggerDueReminders(
  userId: string,
  isVerifiedPharmacy: boolean
): StockReminderNotification[] {
  if (!isVerifiedPharmacy || !userId) return [];

  const prefs = getReminderPreferences(userId);
  const today = getTodayDateString();
  const nowHHMM = getCurrentTimeHHMM();
  const triggered: StockReminderNotification[] = [];

  // 1. Daily first-login stock update reminder
  if (prefs.dailyLoginEnabled) {
    const dailyKey = `${DAILY_DATE_KEY_PREFIX}_${userId}`;
    const lastShownDate = localStorage.getItem(dailyKey);
    if (lastShownDate !== today) {
      localStorage.setItem(dailyKey, today);
      triggered.push({
        id: `daily_${today}`,
        kind: 'daily_login',
        title: 'Daily Stock Update Reminder',
        message:
          'First visit today — please review and update your pharmacy medicine availability so nearby patients get accurate stock info.',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 2. Customizable preferred-time stock update reminder
  if (prefs.customScheduleEnabled && prefs.times.length > 0 && prefs.times.includes(nowHHMM)) {
    const firedKey = `${CUSTOM_FIRED_KEY_PREFIX}_${userId}`;
    let firedTimes: string[] = [];

    try {
      const rawFired = localStorage.getItem(firedKey);
      if (rawFired) {
        const parsed = JSON.parse(rawFired) as { date?: string; times?: string[] };
        if (parsed.date === today && Array.isArray(parsed.times)) {
          firedTimes = parsed.times;
        }
      }
    } catch {
      firedTimes = [];
    }

    if (!firedTimes.includes(nowHHMM)) {
      const updatedFired = [...firedTimes, nowHHMM];
      localStorage.setItem(firedKey, JSON.stringify({ date: today, times: updatedFired }));
      triggered.push({
        id: `custom_${today}_${nowHHMM}`,
        kind: 'custom_schedule',
        scheduledTime: nowHHMM,
        title: `Scheduled Stock Reminder (${formatTimeDisplay(nowHHMM)})`,
        message:
          'Your scheduled stock check-in time has arrived. Update any medicine status, quantity, or pricing changes now.',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return triggered;
}

