// src/services/pharmacyService.ts
import { api } from './api';
import axios from 'axios';
import type {
  PharmacyApplicationPayload,
  PharmacyApplicationResponse,
  Pharmacy,
  WeeklyHours,
  DayOfWeek,
} from '../types/pharmacy';

const MOCK_STORAGE_KEY = 'medifind_mock_pharmacy_application';

export class PharmacyServiceError extends Error {
  code?: string;
  status?: number;
  fields?: Record<string, string>;
  response?: { status: number; data: unknown };

  constructor(message: string, code?: string, status?: number, fields?: Record<string, string>) {
    super(message);
    this.name = 'PharmacyServiceError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/**
 * Validates that an object conforms to PharmacyApplicationResponse.
 * Protects against HTML strings returned by SPA fallback when APIs are offline.
 */
export function isValidApplicationResponse(data: unknown): data is PharmacyApplicationResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!('applicationId' in obj) || !('data' in obj) || !('status' in obj)) return false;
  const innerData = obj.data;
  if (typeof innerData !== 'object' || innerData === null) return false;
  return typeof (innerData as Record<string, unknown>).name === 'string';
}

/**
 * Checks if the development mock adapter should be used.
 * Defaults to true in standalone development mode so reviewers can view and test
 * the onboarding flow immediately without a backend server, while supporting live API toggling.
 */
export function isMockApiEnabled(): boolean {
  const userPreference = localStorage.getItem('medifind_dev_mock_api');
  if (userPreference === 'false') return false;
  if (userPreference === 'true') return true;
  if (import.meta.env.VITE_USE_MOCK_API === 'false') return false;
  return true;
}

export function setMockApiEnabled(enabled: boolean): void {
  localStorage.setItem('medifind_dev_mock_api', enabled ? 'true' : 'false');
}

/**
 * Creates default weekly operating hours schedule.
 */
export function createDefaultWeeklyHours(): WeeklyHours {
  const days: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  const defaultSchedule: WeeklyHours = {} as WeeklyHours;

  days.forEach((day) => {
    if (day === 'friday') {
      // Common weekend/prayer schedule in Bangladesh, or open shorter
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
  });

  return defaultSchedule;
}

/**
 * Formats structured weekly hours into a human-readable string.
 * e.g., "Mon: 08:30 - 22:30; Tue: 08:30 - 22:30; ..."
 */
export function formatWeeklyHours(hours: WeeklyHours | undefined | null): string {
  if (!hours || typeof hours !== 'object') {
    return 'No operating hours defined';
  }

  const dayNames: { key: DayOfWeek; label: string }[] = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ];

  const formattedParts: string[] = [];

  for (const { key, label } of dayNames) {
    const day = hours[key];
    if (!day || !day.isOpen) {
      formattedParts.push(`${label}: Closed`);
    } else if (day.is24Hours) {
      formattedParts.push(`${label}: 24 Hours`);
    } else {
      formattedParts.push(`${label}: ${day.openTime} - ${day.closeTime}`);
    }
  }

  return formattedParts.join('; ');
}

/**
 * Validates that the weekly operating schedule has at least one open day
 * and valid start/end times.
 */
export function validateWeeklyHours(hours: WeeklyHours | undefined | null): string {
  if (!hours || typeof hours !== 'object') {
    return 'Operating hours schedule is required.';
  }

  const days: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  let hasAtLeastOneOpenDay = false;

  for (const day of days) {
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
 * Submits pharmacy application to the backend API.
 * Endpoint: POST /owner/pharmacy-applications
 *
 * In accordance with MediFind API specifications and trust boundaries:
 * - Real API call is executed against the backend endpoint when Live API is selected.
 * - When development mock adapter is enabled, it returns server-shaped response
 *   with an authoritative 'pending' status, never 'verified'.
 */
export async function submitPharmacyApplication(
  payload: PharmacyApplicationPayload
): Promise<PharmacyApplicationResponse> {
  if (isMockApiEnabled()) {
    // Development Mock Adapter - simulates server-authoritative persistence
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Simulate server-side duplicate license check
    if (payload.licenseNo.trim().toUpperCase() === 'DUPLICATE-TEST') {
      const error = new PharmacyServiceError(
        'License number is already registered.',
        'DUPLICATE_LICENSE',
        409,
        { licenseNo: 'License number already registered.' }
      );
      error.response = {
        status: 409,
        data: {
          error: {
            code: 'DUPLICATE_LICENSE',
            message: 'A pharmacy with this license number is already registered or undergoing review.',
            fields: { licenseNo: 'License number already registered.' },
          },
        },
      };
      throw error;
    }

    const applicationResponse: PharmacyApplicationResponse = {
      applicationId: `app_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      pharmacyId: `ph_${Date.now()}`,
      status: 'pending', // Server-authoritative pending status
      submittedAt: new Date().toISOString(),
      message: 'Pharmacy application submitted successfully and is pending administrator review.',
      data: payload,
    };

    // Store in mock storage for verification tracking
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(applicationResponse));

    return applicationResponse;
  }

  // Real backend API invocation
  try {
    const response = await api.post('/owner/pharmacy-applications', payload);
    if (!isValidApplicationResponse(response.data)) {
      throw new PharmacyServiceError(
        'Backend server did not return a valid pharmacy application confirmation object.',
        'INVALID_SERVER_RESPONSE',
        502
      );
    }
    return response.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      const errorData = err.response.data.error;
      throw new PharmacyServiceError(
        errorData.message || 'Submission failed',
        errorData.code,
        err.response.status,
        errorData.fields
      );
    }
    throw err;
  }
}

/**
 * Retrieves the owner's active pharmacy application status.
 * Endpoint: GET /owner/pharmacy-application
 */
export async function getPharmacyApplication(): Promise<PharmacyApplicationResponse | null> {
  if (isMockApiEnabled()) {
    const saved = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (isValidApplicationResponse(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  try {
    const response = await api.get('/owner/pharmacy-application');
    if (isValidApplicationResponse(response.data)) {
      return response.data;
    }
    return null;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    return null;
  }
}

/**
 * Retrieves the owner's pharmacy profile.
 * Endpoint: GET /owner/pharmacy
 */
export async function getPharmacyProfile(): Promise<Pharmacy | null> {
  if (isMockApiEnabled()) {
    const app = await getPharmacyApplication();
    if (!app || !app.data) return null;

    return {
      _id: app.pharmacyId || 'ph_mock_1',
      name: app.data.name,
      address: app.data.formattedAddress || app.data.streetAddress,
      phone: app.data.phone,
      licenseNo: app.data.licenseNo,
      location: app.data.location,
      openingHours: app.data.openingHours,
      status: app.status,
      verificationReason: app.verificationReason,
      createdAt: app.submittedAt,
    };
  }

  try {
    const response = await api.get('/owner/pharmacy');
    if (response.data && typeof response.data === 'object' && '_id' in response.data) {
      return response.data;
    }
    return null;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    return null;
  }
}

/**
 * Clears mock application storage (for testing purposes).
 */
export function clearMockApplication(): void {
  localStorage.removeItem(MOCK_STORAGE_KEY);
}
