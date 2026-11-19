// backend/src/validation/commonValidators.ts
import type { DayOfWeek, LocationGeoJSON, WeeklyHours } from '../types/pharmacy';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const POSTAL_CODE_REGEX = /^\d{4,6}$/;
export const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Normalizes a licence number by trimming, collapsing spaces, and converting to uppercase.
 */
export function normalizeLicenseNo(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Validates phone number format and length (10 to 15 digits).
 */
export function validatePhone(phone: unknown, fieldName: string = 'phone'): string | null {
  if (typeof phone !== 'string' || !phone.trim()) {
    return 'Contact phone number is required.';
  }
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return 'Enter a valid phone number (10 to 15 digits).';
  }
  return null;
}

/**
 * Validates official email address format.
 */
export function validateEmail(email: unknown, fieldName: string = 'email'): string | null {
  if (typeof email !== 'string' || !email.trim()) {
    return 'Official business email is required.';
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return 'Enter a valid email address (e.g., pharmacy@domain.com).';
  }
  return null;
}

/**
 * Validates optional postal code format (4 to 6 digits).
 */
export function validatePostalCode(postalCode: unknown, fieldName: string = 'postalCode'): string | null {
  if (postalCode === undefined || postalCode === null || postalCode === '') {
    return null;
  }
  if (typeof postalCode !== 'string' && typeof postalCode !== 'number') {
    return 'Postal code should be a 4-6 digit number.';
  }
  const str = String(postalCode).trim();
  if (str === '') return null;
  if (!POSTAL_CODE_REGEX.test(str)) {
    return 'Postal code should be a 4-6 digit number.';
  }
  return null;
}

/**
 * Validates GeoJSON Point shape, coordinate order [longitude, latitude], and coordinate bounds.
 */
export function validateLocation(
  location: unknown,
  latitude?: unknown,
  longitude?: unknown
): Record<string, string> {
  const errors: Record<string, string> = {};

  let latNum: number | undefined;
  let lngNum: number | undefined;

  const hasLat = latitude !== undefined && latitude !== null;
  const hasLng = longitude !== undefined && longitude !== null;

  // Validate explicit latitude if supplied
  if (hasLat) {
    if (latitude === '') {
      errors.latitude = 'Latitude must be between -90 and 90.';
    } else {
      const parsedLat = typeof latitude === 'number' ? latitude : Number(latitude);
      if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        errors.latitude = 'Latitude must be between -90 and 90.';
      } else {
        latNum = parsedLat;
      }
    }
  }

  // Validate explicit longitude if supplied
  if (hasLng) {
    if (longitude === '') {
      errors.longitude = 'Longitude must be between -180 and 180.';
    } else {
      const parsedLng = typeof longitude === 'number' ? longitude : Number(longitude);
      if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        errors.longitude = 'Longitude must be between -180 and 180.';
      } else {
        lngNum = parsedLng;
      }
    }
  }

  // Reject incomplete explicit coordinate pair when no GeoJSON location object is provided
  if (location === undefined || location === null) {
    if (hasLat && !hasLng) {
      errors.longitude = 'Longitude is required when latitude is provided.';
    } else if (hasLng && !hasLat) {
      errors.latitude = 'Latitude is required when longitude is provided.';
    }
  }

  // Validate GeoJSON location object if supplied
  if (location !== undefined && location !== null) {
    if (typeof location !== 'object') {
      errors.location = 'Location must be a GeoJSON Point object with type "Point" and coordinates [longitude, latitude].';
      return errors;
    }

    const locObj = location as Record<string, unknown>;
    if (locObj.type !== 'Point') {
      errors.location = 'GeoJSON location type must be "Point".';
    }

    if (!Array.isArray(locObj.coordinates) || locObj.coordinates.length !== 2) {
      errors.location = 'GeoJSON coordinates must be an array of [longitude, latitude].';
    } else {
      const [lng, lat] = locObj.coordinates;
      if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        errors['location.coordinates.0'] = 'Longitude must be between -180 and 180.';
        if (!errors.longitude) errors.longitude = 'Longitude must be between -180 and 180.';
      }
      if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        errors['location.coordinates.1'] = 'Latitude must be between -90 and 90.';
        if (!errors.latitude) errors.latitude = 'Latitude must be between -90 and 90.';
      }

      // Check parity with explicit lat/lng if both were provided
      if (latNum !== undefined && typeof lat === 'number' && Math.abs(latNum - lat) > 0.0001) {
        errors.latitude = 'Explicit latitude does not match location GeoJSON coordinate.';
      }
      if (lngNum !== undefined && typeof lng === 'number' && Math.abs(lngNum - lng) > 0.0001) {
        errors.longitude = 'Explicit longitude does not match location GeoJSON coordinate.';
      }
    }
  }

  return errors;
}

/**
 * Validates weekly operating hours schedule for all seven days, including closed days and 24h schedules.
 */
export function validateWeeklyHoursSchedule(
  hours: unknown,
  prefix: string = 'openingHours'
): Record<string, string> {
  const errors: Record<string, string> = {};

  const setScheduleError = (fieldSuffix: string, message: string) => {
    const primaryKey = fieldSuffix ? `${prefix}.${fieldSuffix}` : prefix;
    errors[primaryKey] = message;

    if (prefix === 'openingHours') {
      const altKey = fieldSuffix ? `structuredHours.${fieldSuffix}` : 'structuredHours';
      errors[altKey] = message;
    } else if (prefix === 'structuredHours') {
      const altKey = fieldSuffix ? `openingHours.${fieldSuffix}` : 'openingHours';
      errors[altKey] = message;
    }
  };

  if (!hours || typeof hours !== 'object') {
    setScheduleError('', 'Operating hours schedule is required.');
    return errors;
  }

  const hoursObj = hours as Record<string, unknown>;
  let hasAtLeastOneOpenDay = false;

  for (const day of DAYS_OF_WEEK) {
    const daySchedule = hoursObj[day];
    if (!daySchedule || typeof daySchedule !== 'object') {
      setScheduleError(day, `Schedule for ${day} is missing.`);
      continue;
    }

    const sched = daySchedule as Record<string, unknown>;
    const isOpen = Boolean(sched.isOpen);

    if (isOpen) {
      hasAtLeastOneOpenDay = true;
      const is24Hours = Boolean(sched.is24Hours);

      if (!is24Hours) {
        const openTime = typeof sched.openTime === 'string' ? sched.openTime.trim() : '';
        const closeTime = typeof sched.closeTime === 'string' ? sched.closeTime.trim() : '';
        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

        if (!openTime) {
          setScheduleError(`${day}.openTime`, `Please specify opening time for ${dayLabel}.`);
        } else if (!TIME_FORMAT_REGEX.test(openTime)) {
          setScheduleError(`${day}.openTime`, `Opening time for ${dayLabel} must be in 24-hour HH:mm format.`);
        }

        if (!closeTime) {
          setScheduleError(`${day}.closeTime`, `Please specify closing time for ${dayLabel}.`);
        } else if (!TIME_FORMAT_REGEX.test(closeTime)) {
          setScheduleError(`${day}.closeTime`, `Closing time for ${dayLabel} must be in 24-hour HH:mm format.`);
        }

        if (openTime && closeTime && TIME_FORMAT_REGEX.test(openTime) && TIME_FORMAT_REGEX.test(closeTime)) {
          if (closeTime <= openTime) {
            setScheduleError(`${day}.closeTime`, `Closing time must be later than opening time on ${dayLabel}.`);
          }
        }
      }
    }
  }

  if (!hasAtLeastOneOpenDay && Object.keys(errors).length === 0) {
    setScheduleError('', 'At least one operating day must be marked open for patient access.');
  }

  return errors;
}

/**
 * Formats structured weekly hours into a human-readable string summary.
 */
export function formatWeeklyHours(hours: WeeklyHours | undefined | null): string {
  if (!hours || typeof hours !== 'object') {
    return 'No operating hours defined';
  }

  const dayLabels: { key: DayOfWeek; label: string }[] = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ];

  const parts: string[] = [];
  for (const { key, label } of dayLabels) {
    const day = hours[key];
    if (!day || !day.isOpen) {
      parts.push(`${label}: Closed`);
    } else if (day.is24Hours) {
      parts.push(`${label}: 24 Hours`);
    } else {
      parts.push(`${label}: ${day.openTime} - ${day.closeTime}`);
    }
  }

  return parts.join('; ');
}

/**
 * Creates default 7-day operating hours schedule (Dhaka business hours).
 */
export function createDefaultWeeklyHours(): WeeklyHours {
  const defaultSchedule: WeeklyHours = {} as WeeklyHours;

  for (const day of DAYS_OF_WEEK) {
    if (day === 'friday') {
      defaultSchedule[day] = {
        isOpen: true,
        openTime: '14:00',
        closeTime: '22:00',
        is24Hours: false,
      };
    } else {
      defaultSchedule[day] = {
        isOpen: true,
        openTime: '08:30',
        closeTime: '22:30',
        is24Hours: false,
      };
    }
  }

  return defaultSchedule;
}
