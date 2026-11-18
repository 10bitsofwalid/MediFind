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
import { PHARMACY_STATUS_UPDATED_EVENT } from './stockReminderService';

const DEFAULT_MOCK_STORAGE_KEY = 'medifind_mock_pharmacy_application';

/**
 * Derives a user-scoped mock storage key so different logged-in sessions
 * maintain their own independent application and verification states.
 */
function getMockStorageKey(): string {
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

  constructor(message: string, code?: string, status?: number, fields?: Record<string, string>) {
    super(message);
    this.name = 'PharmacyServiceError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function mapAxiosPharmacyError(err: unknown, fallbackMessage: string): PharmacyServiceError {
  if (err instanceof PharmacyServiceError) return err;

  if (axios.isAxiosError(err)) {
    const httpStatus = err.response?.status;
    const responseData = err.response?.data as Record<string, unknown> | undefined;
    const errorPayload =
      responseData?.error && typeof responseData.error === 'object'
        ? (responseData.error as Record<string, unknown>)
        : undefined;
    const serverMessage =
      typeof errorPayload?.message === 'string' && errorPayload.message.trim()
        ? errorPayload.message.trim()
        : typeof responseData?.message === 'string' && responseData.message.trim()
        ? responseData.message.trim()
        : undefined;
    const code = typeof errorPayload?.code === 'string' ? errorPayload.code : undefined;
    const fields =
      errorPayload?.fields && typeof errorPayload.fields === 'object'
        ? (errorPayload.fields as Record<string, string>)
        : undefined;

    if (!err.response) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return new PharmacyServiceError(
          'The request timed out while waiting for the MediFind server. Your input was preserved — please try again.',
          'TIMEOUT',
          0
        );
      }
      return new PharmacyServiceError(
        'Could not reach the MediFind server. Check your connection and try again.',
        'NETWORK_ERROR',
        0
      );
    }
    if (httpStatus === 401) {
      return new PharmacyServiceError(
        serverMessage || 'Your session has expired. Please sign in again.',
        code || 'UNAUTHORIZED',
        401,
        fields
      );
    }
    if (httpStatus === 403) {
      return new PharmacyServiceError(
        serverMessage ||
          'You do not have permission to view or modify this pharmacy record.',
        code || 'FORBIDDEN',
        403,
        fields
      );
    }
    if (httpStatus === 404) {
      return new PharmacyServiceError(
        serverMessage || 'The requested pharmacy record could not be found.',
        code || 'NOT_FOUND',
        404,
        fields
      );
    }
    if (httpStatus === 409) {
      return new PharmacyServiceError(
        serverMessage ||
          'This pharmacy record was updated elsewhere or conflicts with existing data. Refresh and try again.',
        code || 'CONFLICT',
        409,
        fields
      );
    }
    if (httpStatus === 400 || httpStatus === 422) {
      return new PharmacyServiceError(
        serverMessage || 'Please review the highlighted fields and try again.',
        code || 'VALIDATION_ERROR',
        httpStatus,
        fields
      );
    }
    if (httpStatus === 429) {
      return new PharmacyServiceError(
        serverMessage || 'Too many requests in a short period. Please wait a moment and try again.',
        code || 'RATE_LIMITED',
        429,
        fields
      );
    }

    return new PharmacyServiceError(
      serverMessage || fallbackMessage,
      code || 'SERVER_ERROR',
      httpStatus,
      fields
    );
  }

  if (err instanceof Error) {
    return new PharmacyServiceError(err.message);
  }

  return new PharmacyServiceError(fallbackMessage);
}

/**
 * Normalizes canonical pharmacy verification status values across casing variants
 * (e.g. "PENDING", "Pending", "pending"). Returns null for unrecognized values.
 */
export function normalizeVerificationStatus(raw: unknown): VerificationStatus | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase();
  if (
    cleaned === 'pending' ||
    cleaned === 'verified' ||
    cleaned === 'rejected' ||
    cleaned === 'suspended'
  ) {
    return cleaned;
  }
  return null;
}

function extractCoordinates(obj: Record<string, unknown>): {
  latitude?: number;
  longitude?: number;
  location?: { type: 'Point'; coordinates: [number, number] };
} {
  let lat = typeof obj.latitude === 'number' && Number.isFinite(obj.latitude) ? obj.latitude : undefined;
  let lng = typeof obj.longitude === 'number' && Number.isFinite(obj.longitude) ? obj.longitude : undefined;

  const rawLoc = obj.location;
  if (rawLoc && typeof rawLoc === 'object') {
    const locObj = rawLoc as Record<string, unknown>;
    if (
      Array.isArray(locObj.coordinates) &&
      locObj.coordinates.length >= 2 &&
      typeof locObj.coordinates[0] === 'number' &&
      typeof locObj.coordinates[1] === 'number'
    ) {
      if (lng === undefined) lng = locObj.coordinates[0];
      if (lat === undefined) lat = locObj.coordinates[1];
    }
  }

  const location =
    lat !== undefined && lng !== undefined
      ? { type: 'Point' as const, coordinates: [lng, lat] as [number, number] }
      : undefined;

  return { latitude: lat, longitude: lng, location };
}

function isValidWeeklyHoursObject(raw: unknown): raw is WeeklyHours {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  const days: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  return days.some((d) => obj[d] && typeof obj[d] === 'object');
}

/**
 * Normalizes a server response for GET /owner/pharmacy-application or
 * POST /owner/pharmacy-applications, supporting both { data: ... } envelopes
 * and flat or nested application payloads without fabricating fields.
 */
export function normalizeApplicationResponse(
  raw: unknown,
  fallbackPayload?: PharmacyApplicationPayload
): PharmacyApplicationResponse | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const root = raw as Record<string, unknown>;

  // Unwrap API.md §9 envelope { data: { ... } } when outer object does not itself hold applicationId + status
  const unwrapped =
    !('applicationId' in root) &&
    !('status' in root) &&
    root.data &&
    typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const status = normalizeVerificationStatus(unwrapped.status ?? unwrapped.verificationStatus);
  if (!status) return null;

  const applicationId =
    typeof unwrapped.applicationId === 'string' && unwrapped.applicationId.trim()
      ? unwrapped.applicationId.trim()
      : typeof unwrapped.id === 'string' && unwrapped.id.trim()
      ? unwrapped.id.trim()
      : typeof unwrapped._id === 'string' && unwrapped._id.trim()
      ? unwrapped._id.trim()
      : '';

  const pharmacyId =
    typeof unwrapped.pharmacyId === 'string' && unwrapped.pharmacyId.trim()
      ? unwrapped.pharmacyId.trim()
      : typeof unwrapped.id === 'string' && unwrapped.id.trim()
      ? unwrapped.id.trim()
      : typeof unwrapped._id === 'string' && unwrapped._id.trim()
      ? unwrapped._id.trim()
      : undefined;

  const nestedData =
    unwrapped.data && typeof unwrapped.data === 'object'
      ? (unwrapped.data as Record<string, unknown>)
      : unwrapped;

  const name =
    typeof nestedData.name === 'string' && nestedData.name.trim()
      ? nestedData.name.trim()
      : fallbackPayload?.name || '';

  if (!applicationId && !pharmacyId) return null;
  if (!name) return null;

  const coords = extractCoordinates(nestedData);
  const latitude = coords.latitude ?? fallbackPayload?.latitude ?? 0;
  const longitude = coords.longitude ?? fallbackPayload?.longitude ?? 0;
  const location = coords.location ??
    fallbackPayload?.location ?? { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] };

  const structuredHours = isValidWeeklyHoursObject(nestedData.structuredHours)
    ? nestedData.structuredHours
    : isValidWeeklyHoursObject(nestedData.weeklyHours)
    ? nestedData.weeklyHours
    : fallbackPayload?.structuredHours;

  const openingHours =
    typeof nestedData.openingHours === 'string' && nestedData.openingHours.trim()
      ? nestedData.openingHours.trim()
      : structuredHours
      ? formatWeeklyHours(structuredHours)
      : fallbackPayload?.openingHours || '';

  const streetAddress =
    typeof nestedData.streetAddress === 'string'
      ? nestedData.streetAddress
      : fallbackPayload?.streetAddress || '';
  const area =
    typeof nestedData.area === 'string' ? nestedData.area : fallbackPayload?.area || '';
  const city =
    typeof nestedData.city === 'string' ? nestedData.city : fallbackPayload?.city || '';
  const postalCode =
    typeof nestedData.postalCode === 'string'
      ? nestedData.postalCode
      : fallbackPayload?.postalCode;
  const formattedAddress =
    typeof nestedData.formattedAddress === 'string' && nestedData.formattedAddress.trim()
      ? nestedData.formattedAddress.trim()
      : typeof nestedData.address === 'string' && nestedData.address.trim()
      ? nestedData.address.trim()
      : fallbackPayload?.formattedAddress ||
        [streetAddress, area, city].filter(Boolean).join(', ');

  const normalizedData: PharmacyApplicationPayload = {
    name,
    ownerName:
      typeof nestedData.ownerName === 'string'
        ? nestedData.ownerName
        : fallbackPayload?.ownerName || '',
    phone:
      typeof nestedData.phone === 'string' ? nestedData.phone : fallbackPayload?.phone || '',
    email:
      typeof nestedData.email === 'string' ? nestedData.email : fallbackPayload?.email || '',
    streetAddress,
    city,
    area,
    postalCode,
    formattedAddress,
    licenseNo:
      typeof nestedData.licenseNo === 'string'
        ? nestedData.licenseNo
        : fallbackPayload?.licenseNo || '',
    issuingAuthority:
      typeof nestedData.issuingAuthority === 'string'
        ? nestedData.issuingAuthority
        : fallbackPayload?.issuingAuthority || '',
    licenseExpiryDate:
      typeof nestedData.licenseExpiryDate === 'string'
        ? nestedData.licenseExpiryDate
        : fallbackPayload?.licenseExpiryDate,
    licenseType:
      typeof nestedData.licenseType === 'string'
        ? nestedData.licenseType
        : fallbackPayload?.licenseType,
    latitude,
    longitude,
    location,
    openingHours,
    structuredHours,
    notes:
      typeof nestedData.notes === 'string' ? nestedData.notes : fallbackPayload?.notes,
  };

  const submittedAt =
    typeof unwrapped.submittedAt === 'string' && unwrapped.submittedAt.trim()
      ? unwrapped.submittedAt
      : typeof unwrapped.createdAt === 'string' && unwrapped.createdAt.trim()
      ? unwrapped.createdAt
      : new Date().toISOString();

  const verificationReason =
    typeof unwrapped.verificationReason === 'string' && unwrapped.verificationReason.trim()
      ? unwrapped.verificationReason.trim()
      : typeof unwrapped.rejectionReason === 'string' && unwrapped.rejectionReason.trim()
      ? unwrapped.rejectionReason.trim()
      : typeof unwrapped.suspensionReason === 'string' && unwrapped.suspensionReason.trim()
      ? unwrapped.suspensionReason.trim()
      : undefined;

  const decisionReason =
    typeof unwrapped.decisionReason === 'string' && unwrapped.decisionReason.trim()
      ? unwrapped.decisionReason.trim()
      : verificationReason;

  const nextStep =
    typeof unwrapped.nextStep === 'string' && unwrapped.nextStep.trim()
      ? unwrapped.nextStep.trim()
      : undefined;

  return {
    applicationId: applicationId || pharmacyId || '',
    pharmacyId,
    status,
    submittedAt,
    message:
      typeof unwrapped.message === 'string' && unwrapped.message.trim()
        ? unwrapped.message.trim()
        : 'Pharmacy application received.',
    data: normalizedData,
    verificationReason,
    decisionReason,
    nextStep,
  };
}

/**
 * Normalizes a server response for GET /owner/pharmacy or PATCH /owner/pharmacy.
 */
export function normalizePharmacyRecord(
  raw: unknown,
  existing?: Pharmacy | null
): Pharmacy | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const obj =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  const id =
    typeof obj._id === 'string' && obj._id.trim()
      ? obj._id.trim()
      : typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : typeof obj.pharmacyId === 'string' && obj.pharmacyId.trim()
      ? obj.pharmacyId.trim()
      : existing?._id || existing?.id || '';

  if (!id) return null;

  const status =
    normalizeVerificationStatus(obj.status ?? obj.verificationStatus) ||
    existing?.status ||
    null;

  if (!status) return null;

  const coords = extractCoordinates(obj);
  const latitude = coords.latitude ?? existing?.latitude;
  const longitude = coords.longitude ?? existing?.longitude;
  const location =
    coords.location ??
    existing?.location ??
    (latitude !== undefined && longitude !== undefined
      ? { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] }
      : { type: 'Point' as const, coordinates: [0, 0] as [number, number] });

  const structuredHours = isValidWeeklyHoursObject(obj.structuredHours)
    ? obj.structuredHours
    : isValidWeeklyHoursObject(obj.weeklyHours)
    ? obj.weeklyHours
    : existing?.structuredHours;

  const openingHours =
    typeof obj.openingHours === 'string' && obj.openingHours.trim()
      ? obj.openingHours.trim()
      : structuredHours
      ? formatWeeklyHours(structuredHours)
      : existing?.openingHours || '';

  const formattedAddress =
    typeof obj.formattedAddress === 'string' && obj.formattedAddress.trim()
      ? obj.formattedAddress.trim()
      : typeof obj.address === 'string' && obj.address.trim()
      ? obj.address.trim()
      : existing?.formattedAddress || existing?.address || '';

  const verificationReason =
    typeof obj.verificationReason === 'string' && obj.verificationReason.trim()
      ? obj.verificationReason.trim()
      : typeof obj.decisionReason === 'string' && obj.decisionReason.trim()
      ? obj.decisionReason.trim()
      : typeof obj.rejectionReason === 'string' && obj.rejectionReason.trim()
      ? obj.rejectionReason.trim()
      : typeof obj.suspensionReason === 'string' && obj.suspensionReason.trim()
      ? obj.suspensionReason.trim()
      : existing?.verificationReason;

  return {
    _id: id,
    id,
    ownerId: typeof obj.ownerId === 'string' ? obj.ownerId : existing?.ownerId,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : existing?.name || '',
    ownerName:
      typeof obj.ownerName === 'string' ? obj.ownerName : existing?.ownerName,
    phone: typeof obj.phone === 'string' ? obj.phone : existing?.phone || '',
    email: typeof obj.email === 'string' ? obj.email : existing?.email,
    address: typeof obj.address === 'string' && obj.address.trim() ? obj.address.trim() : formattedAddress,
    streetAddress:
      typeof obj.streetAddress === 'string' ? obj.streetAddress : existing?.streetAddress,
    city: typeof obj.city === 'string' ? obj.city : existing?.city,
    area: typeof obj.area === 'string' ? obj.area : existing?.area,
    postalCode: typeof obj.postalCode === 'string' ? obj.postalCode : existing?.postalCode,
    formattedAddress,
    licenseNo: typeof obj.licenseNo === 'string' ? obj.licenseNo : existing?.licenseNo,
    issuingAuthority:
      typeof obj.issuingAuthority === 'string' ? obj.issuingAuthority : existing?.issuingAuthority,
    licenseExpiryDate:
      typeof obj.licenseExpiryDate === 'string'
        ? obj.licenseExpiryDate
        : existing?.licenseExpiryDate,
    licenseType: typeof obj.licenseType === 'string' ? obj.licenseType : existing?.licenseType,
    location,
    latitude,
    longitude,
    openingHours,
    structuredHours,
    status,
    verificationReason,
    decisionReason:
      typeof obj.decisionReason === 'string' && obj.decisionReason.trim()
        ? obj.decisionReason.trim()
        : verificationReason,
    nextStep:
      typeof obj.nextStep === 'string' && obj.nextStep.trim()
        ? obj.nextStep.trim()
        : existing?.nextStep,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : existing?.createdAt,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : existing?.updatedAt,
  };
}

/**
 * Checks if the development mock adapter should be used.
 * Defaults to true in standalone development mode so reviewers can view and test
 * the onboarding flow immediately without a backend server, while supporting live API toggling.
 */
export function isMockApiEnabled(): boolean {
  if (typeof localStorage !== 'undefined') {
    const userPreference = localStorage.getItem('medifind_dev_mock_api');
    if (userPreference === 'false') return false;
    if (userPreference === 'true') return true;
  }
  if (import.meta.env?.VITE_USE_MOCK_API === 'false') return false;
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
      throw new PharmacyServiceError(
        'License number is already registered.',
        'DUPLICATE_LICENSE',
        409,
        { licenseNo: 'License number already registered.' }
      );
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
    const normalized = normalizeApplicationResponse(response.data, payload);
    if (!normalized) {
      throw new PharmacyServiceError(
        'Backend server did not return a valid pharmacy application confirmation object.',
        'INVALID_SERVER_RESPONSE',
        502
      );
    }
    return normalized;
  } catch (err: unknown) {
    throw mapAxiosPharmacyError(err, 'Failed to submit pharmacy application. Please try again.');
  }
}

/**
 * Corrects and resubmits an editable/rejected pharmacy application.
 * Endpoint: PATCH /owner/pharmacy-application (falls back to POST if PATCH is not implemented)
 */
export async function updatePharmacyApplication(
  payload: PharmacyApplicationPayload
): Promise<PharmacyApplicationResponse> {
  if (isMockApiEnabled()) {
    return submitPharmacyApplication(payload);
  }

  try {
    const response = await api.patch('/owner/pharmacy-application', payload);
    const normalized = normalizeApplicationResponse(response.data, payload);
    if (!normalized) {
      throw new PharmacyServiceError(
        'Backend server did not return a valid pharmacy application update confirmation.',
        'INVALID_SERVER_RESPONSE',
        502
      );
    }
    return normalized;
  } catch (err: unknown) {
    if (
      axios.isAxiosError(err) &&
      (err.response?.status === 404 || err.response?.status === 405 || err.response?.status === 501)
    ) {
      return submitPharmacyApplication(payload);
    }
    throw mapAxiosPharmacyError(err, 'Failed to resubmit pharmacy application. Please try again.');
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
      return normalizeApplicationResponse(parsed);
    } catch {
      return null;
    }
  }

  try {
    const response = await api.get('/owner/pharmacy-application');
    return normalizeApplicationResponse(response.data);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw mapAxiosPharmacyError(err, 'Could not load pharmacy application status from server.');
  }
}

/**
 * Reads the pharmacy's weekly opening hours schedule when exposed separately.
 * Endpoint: GET /owner/pharmacy/opening-hours
 */
export async function getOpeningHours(): Promise<WeeklyHours | null> {
  if (isMockApiEnabled()) {
    const app = await getPharmacyApplication();
    return app?.data?.structuredHours || null;
  }

  try {
    const response = await api.get('/owner/pharmacy/opening-hours');
    const raw = response.data?.data ?? response.data;
    if (isValidWeeklyHoursObject(raw)) {
      return raw;
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (isValidWeeklyHoursObject(obj.structuredHours)) return obj.structuredHours;
      if (isValidWeeklyHoursObject(obj.weeklyHours)) return obj.weeklyHours;
      if (isValidWeeklyHoursObject(obj.hours)) return obj.hours;
    }
    return null;
  } catch (err: unknown) {
    if (
      axios.isAxiosError(err) &&
      (err.response?.status === 404 || err.response?.status === 405 || err.response?.status === 501)
    ) {
      return null;
    }
    throw mapAxiosPharmacyError(err, 'Could not load opening hours schedule from server.');
  }
}

/**
 * Replaces the complete weekly opening hours schedule.
 * Endpoint: PUT /owner/pharmacy/opening-hours
 */
export async function updateOpeningHours(
  hours: WeeklyHours
): Promise<{ structuredHours: WeeklyHours; openingHours: string }> {
  const hoursErr = validateWeeklyHours(hours);
  if (hoursErr) {
    throw new PharmacyServiceError(hoursErr, 'VALIDATION_ERROR', 422, {
      openingHours: hoursErr,
    });
  }

  const formatted = formatWeeklyHours(hours);

  if (isMockApiEnabled()) {
    await updatePharmacyProfile({ structuredHours: hours, openingHours: formatted });
    return { structuredHours: hours, openingHours: formatted };
  }

  try {
    const response = await api.put('/owner/pharmacy/opening-hours', {
      structuredHours: hours,
      openingHours: formatted,
    });
    const raw = response.data?.data ?? response.data;
    if (isValidWeeklyHoursObject(raw)) {
      return { structuredHours: raw, openingHours: formatWeeklyHours(raw) };
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const resolvedStructured = isValidWeeklyHoursObject(obj.structuredHours)
        ? obj.structuredHours
        : isValidWeeklyHoursObject(obj.weeklyHours)
        ? obj.weeklyHours
        : hours;
      const resolvedOpening =
        typeof obj.openingHours === 'string' && obj.openingHours.trim()
          ? obj.openingHours.trim()
          : formatWeeklyHours(resolvedStructured);
      return { structuredHours: resolvedStructured, openingHours: resolvedOpening };
    }
    return { structuredHours: hours, openingHours: formatted };
  } catch (err: unknown) {
    throw mapAxiosPharmacyError(err, 'Failed to update opening hours schedule. Please try again.');
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
    const normalized = normalizePharmacyRecord(response.data);
    if (!normalized) return null;

    if (!normalized.structuredHours) {
      try {
        const separateHours = await getOpeningHours();
        if (separateHours) {
          normalized.structuredHours = separateHours;
          if (!normalized.openingHours) {
            normalized.openingHours = formatWeeklyHours(separateHours);
          }
        }
      } catch {
        // Non-blocking: profile still loads even if separate hours endpoint is unavailable
      }
    }

    return normalized;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw mapAxiosPharmacyError(err, 'Could not load pharmacy profile from server.');
  }
}

/**
 * Updates the owner's pharmacy profile fields.
 * Endpoints: PATCH /owner/pharmacy and (when structuredHours is supplied) PUT /owner/pharmacy/opening-hours
 *
 * Validates updated fields and persists changes to the backend API or mock storage.
 * Does not report success until the server or service adapter confirms the update.
 */
export async function updatePharmacyProfile(
  payload: PharmacyProfileUpdatePayload,
  existingProfile?: Pharmacy | null
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
    const updated = normalizePharmacyRecord(response.data, existingProfile);
    if (!updated) {
      throw new PharmacyServiceError('Server returned invalid profile update response.', 'INVALID_RESPONSE', 502);
    }

    if (payload.structuredHours) {
      try {
        const hoursResult = await updateOpeningHours(payload.structuredHours);
        updated.structuredHours = hoursResult.structuredHours;
        updated.openingHours = hoursResult.openingHours;
      } catch (hoursErr: unknown) {
        const status = hoursErr instanceof PharmacyServiceError ? hoursErr.status : undefined;
        // Ignore 404/405/501 when backend persists opening hours directly on PATCH /owner/pharmacy
        if (status !== 404 && status !== 405 && status !== 501) {
          throw hoursErr;
        }
      }
    }

    return updated;
  } catch (err: unknown) {
    throw mapAxiosPharmacyError(err, 'Failed to update pharmacy profile. Please try again.');
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
  window.dispatchEvent(new CustomEvent(PHARMACY_STATUS_UPDATED_EVENT));
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
    throw mapAxiosPharmacyError(err, 'Failed to delete pharmacy application. Please try again.');
  }
}

/**
 * Clears mock application storage (for testing purposes).
 */
function clearMockApplication(): void {
  localStorage.removeItem(getMockStorageKey());
  localStorage.removeItem(DEFAULT_MOCK_STORAGE_KEY);
}
