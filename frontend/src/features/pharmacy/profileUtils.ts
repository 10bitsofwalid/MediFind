// src/features/pharmacy/profileUtils.ts
import type { WeeklyHours, DayOfWeek } from '../../types/pharmacy';

export type ProfileFieldKey =
  | 'name'
  | 'ownerName'
  | 'phone'
  | 'email'
  | 'streetAddress'
  | 'area'
  | 'city'
  | 'postalCode'
  | 'latitude'
  | 'longitude'
  | 'openingHours';

export interface ProfileFormValues {
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  streetAddress: string;
  area: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  weeklyHours: WeeklyHours;
}

export const PROFILE_FIELD_META: Record<
  ProfileFieldKey,
  { label: string; inputId: string }
> = {
  name: { label: 'Pharmacy Trade Name', inputId: 'field-name' },
  ownerName: { label: 'Owner / Contact Person', inputId: 'field-owner' },
  phone: { label: 'Contact Phone Number', inputId: 'field-phone' },
  email: { label: 'Official Business Email', inputId: 'field-email' },
  streetAddress: { label: 'Street Address & Building Details', inputId: 'field-street' },
  area: { label: 'Area / Locality', inputId: 'field-area' },
  city: { label: 'City / District', inputId: 'field-city' },
  postalCode: { label: 'Postal Code', inputId: 'field-postal' },
  latitude: { label: 'Latitude', inputId: 'pharmacy-latitude' },
  longitude: { label: 'Longitude', inputId: 'pharmacy-longitude' },
  openingHours: { label: 'Opening Hours & Schedule', inputId: 'hours-heading' },
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const POSTAL_CODE_REGEX = /^\d{4,6}$/;
const DAYS_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Validates weekly operating hours schedule rules.
 */
export function validateScheduleHours(hours: WeeklyHours | undefined | null): string {
  if (!hours || typeof hours !== 'object') {
    return 'Operating hours schedule is required.';
  }

  let hasAtLeastOneOpenDay = false;

  for (const day of DAYS_ORDER) {
    const schedule = hours[day];
    if (schedule && schedule.isOpen) {
      hasAtLeastOneOpenDay = true;
      if (!schedule.is24Hours) {
        if (!schedule.openTime || !schedule.closeTime) {
          return `Please specify both opening and closing times for ${day}.`;
        }
        if (schedule.openTime >= schedule.closeTime) {
          const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
          return `Closing time must be after opening time on ${capitalizedDay}.`;
        }
      }
    }
  }

  if (!hasAtLeastOneOpenDay) {
    return 'At least one operating day must be marked open for patient access.';
  }

  return '';
}

/**
 * Validates a single pharmacy profile field for blur-time or submit-time checks.
 */
export function validateProfileField(
  field: ProfileFieldKey,
  value: unknown
): string {
  if (field === 'openingHours') {
    return validateScheduleHours(value as WeeklyHours | undefined | null);
  }

  if (field === 'latitude') {
    const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    if (String(value ?? '').trim() === '' || Number.isNaN(num) || num < -90 || num > 90) {
      return 'Latitude must be between -90 and 90.';
    }
    return '';
  }

  if (field === 'longitude') {
    const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    if (String(value ?? '').trim() === '' || Number.isNaN(num) || num < -180 || num > 180) {
      return 'Longitude must be between -180 and 180.';
    }
    return '';
  }

  const str = String(value ?? '');
  const trimmed = str.trim();

  switch (field) {
    case 'name':
      if (!trimmed) return 'Pharmacy trade name is required.';
      if (trimmed.length < 3) return 'Pharmacy name must be at least 3 characters.';
      return '';
    case 'ownerName':
      if (!trimmed) return 'Owner / contact person name is required.';
      if (trimmed.length < 2) return 'Contact person name must be at least 2 characters.';
      return '';
    case 'phone': {
      if (!trimmed) return 'Contact phone number is required.';
      const digitsOnly = str.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return 'Enter a valid phone number (10 to 15 digits).';
      }
      return '';
    }
    case 'email':
      if (!trimmed) return 'Official business email is required.';
      if (!EMAIL_REGEX.test(trimmed)) {
        return 'Enter a valid email address (e.g., pharmacy@domain.com).';
      }
      return '';
    case 'streetAddress':
      if (!trimmed) return 'Street address and building details are required.';
      return '';
    case 'area':
      if (!trimmed) return 'Area / locality name is required.';
      return '';
    case 'city':
      if (!trimmed) return 'City or district is required.';
      return '';
    case 'postalCode':
      if (!trimmed) return '';
      if (!POSTAL_CODE_REGEX.test(trimmed)) {
        return 'Postal code should be a 4-6 digit number.';
      }
      return '';
    default:
      return '';
  }
}

/**
 * Validates the complete pharmacy profile form and returns a map of field errors.
 */
export function validateProfileFormValues(
  values: ProfileFormValues
): Record<string, string> {
  const errors: Record<string, string> = {};

  const checks: [ProfileFieldKey, unknown][] = [
    ['name', values.name],
    ['ownerName', values.ownerName],
    ['phone', values.phone],
    ['email', values.email],
    ['streetAddress', values.streetAddress],
    ['area', values.area],
    ['city', values.city],
    ['postalCode', values.postalCode],
    ['latitude', values.latitude],
    ['longitude', values.longitude],
    ['openingHours', values.weeklyHours],
  ];

  for (const [key, val] of checks) {
    const err = validateProfileField(key, val);
    if (err) {
      errors[key] = err;
    }
  }

  return errors;
}

/**
 * Returns ordered list of active validation errors for accessible page-level summaries.
 */
export function getOrderedProfileErrorEntries(
  fieldErrors: Record<string, string>
): { field: string; label: string; inputId?: string; message: string }[] {
  const orderedKeys = Object.keys(PROFILE_FIELD_META) as ProfileFieldKey[];
  const result: { field: string; label: string; inputId?: string; message: string }[] = [];
  const seen = new Set<string>();

  for (const key of orderedKeys) {
    const msg = fieldErrors[key];
    if (msg && msg.trim()) {
      seen.add(key);
      result.push({
        field: key,
        label: PROFILE_FIELD_META[key].label,
        inputId: PROFILE_FIELD_META[key].inputId,
        message: msg,
      });
    }
  }

  for (const [key, msg] of Object.entries(fieldErrors)) {
    if (!seen.has(key) && msg && msg.trim()) {
      result.push({
        field: key,
        label: key,
        message: msg,
      });
    }
  }

  return result;
}
