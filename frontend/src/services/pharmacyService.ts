// src/services/pharmacyService.ts
import { api } from './api';
import axios from 'axios';
import type {
  PharmacyApplicationPayload,
  PharmacyApplicationResponse,
  Pharmacy,
  PharmacyProfileUpdatePayload,
  WeeklyHours,
  DayOfWeek,
  VerificationStatus,
} from '../types/pharmacy';

const DEFAULT_MOCK_STORAGE_KEY = 'medifind_mock_pharmacy_application';

/**
 * Derives a user-scoped mock storage key so different logged-in sessions
 * maintain their own independent application and verification states.
 */
export function getMockStorageKey(): string {
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed && typeof parsed.id === 'string' && parsed.id.trim()) {
        return `medifind_mock_pharmacy_application_${parsed.id.trim()}`;
      }
    }
  } catch {
    // Fallback if parsing fails
  }
  return DEFAULT_MOCK_STORAGE_KEY;
}

/**
 * Retrieves the stored mock application, checking user-scoped key first,
 * with fallback to the legacy global key for seamless data continuity.
 */
function getStoredMockApplication(): string | null {
  const userKey = getMockStorageKey();
  const userData = localStorage.getItem(userKey);
  if (userData) return userData;
  if (userKey !== DEFAULT_MOCK_STORAGE_KEY) {
    return localStorage.getItem(DEFAULT_MOCK_STORAGE_KEY);
  }
  return null;
}

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
    localStorage.setItem(getMockStorageKey(), JSON.stringify(applicationResponse));

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
    const saved = getStoredMockApplication();
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

    const formatted = app.data.formattedAddress || `${app.data.streetAddress}, ${app.data.area}, ${app.data.city}`;

    return {
      _id: app.pharmacyId || 'ph_mock_1',
      id: app.pharmacyId || 'ph_mock_1',
      name: app.data.name,
      ownerName: app.data.ownerName,
      phone: app.data.phone,
      email: app.data.email,
      address: formatted,
      streetAddress: app.data.streetAddress,
      city: app.data.city,
      area: app.data.area,
      postalCode: app.data.postalCode,
      formattedAddress: formatted,
      licenseNo: app.data.licenseNo,
      issuingAuthority: app.data.issuingAuthority,
      licenseExpiryDate: app.data.licenseExpiryDate,
      licenseType: app.data.licenseType,
      location: app.data.location || {
        type: 'Point',
        coordinates: [app.data.longitude, app.data.latitude],
      },
      latitude: app.data.latitude,
      longitude: app.data.longitude,
      openingHours: app.data.openingHours,
      structuredHours: app.data.structuredHours,
      status: app.status,
      verificationReason: app.verificationReason || app.decisionReason,
      decisionReason: app.decisionReason || app.verificationReason,
      nextStep: app.nextStep,
      createdAt: app.submittedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await api.get('/owner/pharmacy');
    const profile = response.data?.data || response.data;
    if (profile && typeof profile === 'object' && ('_id' in profile || 'id' in profile)) {
      return profile;
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
 * Updates the owner's pharmacy profile fields.
 * Endpoint: PATCH /owner/pharmacy
 *
 * Validates updated fields and persists changes to the backend API or mock storage.
 * Does not report success until the server or service adapter confirms the update.
 */
export async function updatePharmacyProfile(
  payload: PharmacyProfileUpdatePayload
): Promise<Pharmacy> {
  // Client-side field validation before submission
  const fieldErrors: Record<string, string> = {};

  if (payload.name !== undefined) {
    if (!payload.name.trim()) fieldErrors.name = 'Pharmacy trade name is required.';
    else if (payload.name.trim().length < 3) fieldErrors.name = 'Pharmacy name must be at least 3 characters.';
  }

  if (payload.ownerName !== undefined) {
    if (!payload.ownerName.trim()) fieldErrors.ownerName = 'Owner / contact person name is required.';
    else if (payload.ownerName.trim().length < 2) fieldErrors.ownerName = 'Owner name must be at least 2 characters.';
  }

  if (payload.phone !== undefined) {
    if (!payload.phone.trim()) {
      fieldErrors.phone = 'Contact phone number is required.';
    } else {
      const digitsOnly = payload.phone.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        fieldErrors.phone = 'Enter a valid contact phone number (10-15 digits).';
      }
    }
  }

  if (payload.email !== undefined) {
    if (!payload.email.trim()) {
      fieldErrors.email = 'Official business email is required.';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(payload.email.trim())) {
        fieldErrors.email = 'Enter a valid email address (e.g., pharmacy@domain.com).';
      }
    }
  }

  if (payload.streetAddress !== undefined && !payload.streetAddress.trim()) {
    fieldErrors.streetAddress = 'Street address is required.';
  }

  if (payload.city !== undefined && !payload.city.trim()) {
    fieldErrors.city = 'City or district is required.';
  }

  if (payload.area !== undefined && !payload.area.trim()) {
    fieldErrors.area = 'Area / locality name is required.';
  }

  if (payload.postalCode !== undefined && payload.postalCode.trim()) {
    if (!/^\d{4,6}$/.test(payload.postalCode.trim())) {
      fieldErrors.postalCode = 'Postal code should be a 4-6 digit number.';
    }
  }

  if (payload.latitude !== undefined) {
    if (isNaN(payload.latitude) || payload.latitude < -90 || payload.latitude > 90) {
      fieldErrors.latitude = 'Latitude must be between -90 and 90.';
    }
  }

  if (payload.longitude !== undefined) {
    if (isNaN(payload.longitude) || payload.longitude < -180 || payload.longitude > 180) {
      fieldErrors.longitude = 'Longitude must be between -180 and 180.';
    }
  }

  if (payload.structuredHours !== undefined) {
    const hoursErr = validateWeeklyHours(payload.structuredHours);
    if (hoursErr) {
      fieldErrors.openingHours = hoursErr;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new PharmacyServiceError(
      'Please correct the highlighted fields before saving.',
      'VALIDATION_ERROR',
      422,
      fieldErrors
    );
  }

  if (isMockApiEnabled()) {
    // Development Mock Adapter: simulates server latency & authoritative persistence
    await new Promise((resolve) => setTimeout(resolve, 600));

    const savedRaw = getStoredMockApplication();
    if (!savedRaw) {
      throw new PharmacyServiceError(
        'No pharmacy application found. Please submit an application first.',
        'NOT_FOUND',
        404
      );
    }

    let app: PharmacyApplicationResponse;
    try {
      app = JSON.parse(savedRaw);
    } catch {
      throw new PharmacyServiceError(
        'Stored pharmacy application data is invalid. Please resubmit your application.',
        'INVALID_STORAGE',
        400
      );
    }

    // Merge updated payload fields into application data
    const updatedData: PharmacyApplicationPayload = {
      ...app.data,
      name: payload.name !== undefined ? payload.name.trim() : app.data.name,
      ownerName: payload.ownerName !== undefined ? payload.ownerName.trim() : app.data.ownerName,
      phone: payload.phone !== undefined ? payload.phone.trim() : app.data.phone,
      email: payload.email !== undefined ? payload.email.trim().toLowerCase() : app.data.email,
      streetAddress: payload.streetAddress !== undefined ? payload.streetAddress.trim() : app.data.streetAddress,
      city: payload.city !== undefined ? payload.city.trim() : app.data.city,
      area: payload.area !== undefined ? payload.area.trim() : app.data.area,
      postalCode: payload.postalCode !== undefined ? payload.postalCode.trim() : app.data.postalCode,
      formattedAddress:
        payload.formattedAddress ||
        `${payload.streetAddress || app.data.streetAddress}, ${payload.area || app.data.area}, ${
          payload.city || app.data.city
        }${payload.postalCode ? ' - ' + payload.postalCode : ''}`,
      latitude: payload.latitude !== undefined ? payload.latitude : app.data.latitude,
      longitude: payload.longitude !== undefined ? payload.longitude : app.data.longitude,
      location:
        payload.location ||
        (payload.latitude !== undefined && payload.longitude !== undefined
          ? { type: 'Point', coordinates: [payload.longitude, payload.latitude] }
          : app.data.location),
      openingHours:
        payload.openingHours ||
        (payload.structuredHours ? formatWeeklyHours(payload.structuredHours) : app.data.openingHours),
      structuredHours: payload.structuredHours || app.data.structuredHours,
    };

    app.data = updatedData;
    localStorage.setItem(getMockStorageKey(), JSON.stringify(app));

    const updatedProfile: Pharmacy = {
      _id: app.pharmacyId || 'ph_mock_1',
      id: app.pharmacyId || 'ph_mock_1',
      name: updatedData.name,
      ownerName: updatedData.ownerName,
      phone: updatedData.phone,
      email: updatedData.email,
      address: updatedData.formattedAddress,
      streetAddress: updatedData.streetAddress,
      city: updatedData.city,
      area: updatedData.area,
      postalCode: updatedData.postalCode,
      formattedAddress: updatedData.formattedAddress,
      licenseNo: updatedData.licenseNo,
      issuingAuthority: updatedData.issuingAuthority,
      licenseExpiryDate: updatedData.licenseExpiryDate,
      licenseType: updatedData.licenseType,
      location: updatedData.location,
      latitude: updatedData.latitude,
      longitude: updatedData.longitude,
      openingHours: updatedData.openingHours,
      structuredHours: updatedData.structuredHours,
      status: app.status,
      verificationReason: app.verificationReason || app.decisionReason,
      decisionReason: app.decisionReason || app.verificationReason,
      nextStep: app.nextStep,
      createdAt: app.submittedAt,
      updatedAt: new Date().toISOString(),
    };

    return updatedProfile;
  }

  // Real backend API invocation
  try {
    const response = await api.patch('/owner/pharmacy', payload);
    const updated = response.data?.data || response.data;
    if (!updated || typeof updated !== 'object') {
      throw new PharmacyServiceError('Server returned invalid profile update response.', 'INVALID_RESPONSE', 502);
    }
    return updated;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      const errorData = err.response.data.error;
      throw new PharmacyServiceError(
        errorData.message || 'Failed to update pharmacy profile.',
        errorData.code,
        err.response.status,
        errorData.fields
      );
    }
    throw err;
  }
}

/**
 * Updates opening hours schedule on the server.
 * Endpoint: PUT /owner/pharmacy/opening-hours
 */
export async function updateOpeningHours(
  hours: WeeklyHours
): Promise<{ openingHours: string; structuredHours: WeeklyHours }> {
  const err = validateWeeklyHours(hours);
  if (err) {
    throw new PharmacyServiceError(err, 'VALIDATION_ERROR', 422, { openingHours: err });
  }

  const formatted = formatWeeklyHours(hours);

  if (isMockApiEnabled()) {
    await updatePharmacyProfile({
      structuredHours: hours,
      openingHours: formatted,
    });
    return { openingHours: formatted, structuredHours: hours };
  }

  try {
    const res = await api.put('/owner/pharmacy/opening-hours', {
      structuredHours: hours,
      openingHours: formatted,
    });
    return res.data?.data || res.data || { openingHours: formatted, structuredHours: hours };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      const errorData = err.response.data.error;
      throw new PharmacyServiceError(
        errorData.message || 'Failed to update operating hours schedule.',
        errorData.code,
        err.response.status,
        errorData.fields
      );
    }
    throw err;
  }
}

/**
 * Changes mock verification status in development mode to test
 * Pending, Verified, Rejected, and Suspended UI flows for a submitted application.
 */
export function setMockVerificationStatus(
  status: VerificationStatus,
  decisionReason?: string,
  nextStep?: string
): PharmacyApplicationResponse | null {
  const saved = getStoredMockApplication();
  if (!saved) return null;

  let app: PharmacyApplicationResponse;
  try {
    app = JSON.parse(saved);
  } catch {
    return null;
  }

  app.status = status;
  app.verificationReason = decisionReason;
  app.decisionReason = decisionReason;
  app.nextStep = nextStep;

  localStorage.setItem(getMockStorageKey(), JSON.stringify(app));
  window.dispatchEvent(new CustomEvent('medifind:pharmacy-status-updated'));
  return app;
}

/**
 * Deletes the owner's submitted pharmacy application if it has not been approved.
 * Endpoint: DELETE /owner/pharmacy-application
 */
export async function deletePharmacyApplication(applicationId?: string): Promise<void> {
  if (isMockApiEnabled()) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const savedRaw = getStoredMockApplication();
    if (!savedRaw) {
      throw new PharmacyServiceError(
        'No submitted pharmacy application found to delete.',
        'NOT_FOUND',
        404
      );
    }

    let app: PharmacyApplicationResponse;
    try {
      app = JSON.parse(savedRaw);
    } catch {
      clearMockApplication();
      return;
    }

    if (app.status === 'verified') {
      throw new PharmacyServiceError(
        'Approved pharmacy applications cannot be deleted.',
        'FORBIDDEN_APPROVED',
        403
      );
    }

    if (app.status === 'suspended') {
      throw new PharmacyServiceError(
        'Suspended pharmacy records cannot be deleted. Contact MediFind Compliance for assistance.',
        'FORBIDDEN_SUSPENDED',
        403
      );
    }

    const userKey = getMockStorageKey();
    localStorage.removeItem(userKey);
    const legacyRaw = localStorage.getItem(DEFAULT_MOCK_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacyParsed = JSON.parse(legacyRaw) as PharmacyApplicationResponse;
        if (!applicationId || legacyParsed.applicationId === app.applicationId) {
          localStorage.removeItem(DEFAULT_MOCK_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(DEFAULT_MOCK_STORAGE_KEY);
      }
    }
    return;
  }

  try {
    const endpoint = applicationId
      ? `/owner/pharmacy-applications/${applicationId}`
      : '/owner/pharmacy-application';
    await api.delete(endpoint);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      const errorData = err.response.data.error;
      throw new PharmacyServiceError(
        errorData.message || 'Failed to delete pharmacy application.',
        errorData.code,
        err.response.status,
        errorData.fields
      );
    }
    throw err;
  }
}

/**
 * Clears mock application storage (for testing purposes).
 */
export function clearMockApplication(): void {
  localStorage.removeItem(getMockStorageKey());
  localStorage.removeItem(DEFAULT_MOCK_STORAGE_KEY);
}
