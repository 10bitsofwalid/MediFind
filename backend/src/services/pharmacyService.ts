// backend/src/services/pharmacyService.ts
import mongoose, { Types } from 'mongoose';
import { Pharmacy, IPharmacy } from '../models/Pharmacy';
import {
  PharmacyApplication,
  IPharmacyApplication,
} from '../models/PharmacyApplication';
import {
  findApplicationByOwner,
  findApplicationById,
} from './pharmacyApplicationService';
import {
  syntheticVerifiedPharmacy,
  syntheticSuspendedPharmacy,
} from '../fixtures/syntheticFixtures';
import {
  createDefaultWeeklyHours,
  formatWeeklyHours,
  normalizeLicenseNo,
  validateWeeklyHoursSchedule,
} from '../validation/commonValidators';
import { validatePharmacyProfileUpdatePayload } from '../validation/pharmacyValidators';
import { sanitizeClientPayload, AuthorizationError } from '../auth/ownership';
import { ApplicationError } from '../utils/errors';
import { ValidationError } from '../validation/validationError';
import {
  getIdempotentResponse,
  recordIdempotentResponse,
} from '../utils/idempotency';
import { formatPharmacyResponse } from '../utils/responseEnvelope';
import type {
  LocationGeoJSON,
  Pharmacy as PharmacyType,
  VerificationStatus,
  WeeklyHours,
} from '../types/pharmacy';

// In-memory store for development fallback and unit tests when MongoDB is offline
const inMemoryPharmacies = new Map<string, any>();

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

function matchOwnerId(storedOwnerId: unknown, targetOwnerId: string): boolean {
  if (!storedOwnerId) return false;
  return String(storedOwnerId).trim() === String(targetOwnerId).trim();
}

/**
 * Initializes default synthetic fixtures into the in-memory store if not present.
 */
function ensureSyntheticFixtures(): void {
  const verifiedId = String(syntheticVerifiedPharmacy._id);
  if (!inMemoryPharmacies.has(verifiedId)) {
    inMemoryPharmacies.set(verifiedId, {
      ...JSON.parse(JSON.stringify(syntheticVerifiedPharmacy)),
    });
  }

  const suspendedId = String(syntheticSuspendedPharmacy._id);
  if (!inMemoryPharmacies.has(suspendedId)) {
    inMemoryPharmacies.set(suspendedId, {
      ...JSON.parse(JSON.stringify(syntheticSuspendedPharmacy)),
    });
  }
}

// Seed on module initialization
ensureSyntheticFixtures();

/**
 * Resets the in-memory pharmacy store (used for test isolation).
 */
export function clearInMemoryPharmacyStore(): void {
  inMemoryPharmacies.clear();
  ensureSyntheticFixtures();
}

/**
 * Manually seeds a pharmacy record into the active storage (database or in-memory fallback).
 */
export async function seedPharmacy(
  data: Partial<PharmacyType> & { ownerId: string; name: string }
): Promise<any> {
  const normalizedLicense = normalizeLicenseNo(data.licenseNo || 'DGDA-SEED-001');
  const structuredHours = data.structuredHours || createDefaultWeeklyHours();
  const openingHours = data.openingHours || formatWeeklyHours(structuredHours);

  const lat = data.latitude !== undefined ? data.latitude : 23.7465;
  const lng = data.longitude !== undefined ? data.longitude : 90.376;
  const location: LocationGeoJSON =
    data.location && Array.isArray(data.location.coordinates)
      ? data.location
      : { type: 'Point', coordinates: [lng, lat] };

  const record: any = {
    _id: data._id || data.id || new mongoose.Types.ObjectId().toString(),
    id: data._id || data.id || new mongoose.Types.ObjectId().toString(),
    ownerId: data.ownerId,
    name: data.name,
    ownerName: data.ownerName || 'Contact Person',
    phone: data.phone || '+8801712345678',
    email: data.email || 'pharmacy@example.com',
    address: data.address || data.formattedAddress || 'Dhaka, Bangladesh',
    streetAddress: data.streetAddress || 'Road 1',
    city: data.city || 'Dhaka',
    area: data.area || 'Dhanmondi',
    postalCode: data.postalCode || '1209',
    formattedAddress: data.formattedAddress || data.address || 'Road 1, Dhanmondi, Dhaka - 1209',
    licenseNo: data.licenseNo || 'DGDA-SEED-001',
    normalizedLicenseNo: normalizedLicense,
    issuingAuthority: data.issuingAuthority || 'DGDA',
    licenseExpiryDate: data.licenseExpiryDate || '2028-12-31',
    licenseType: data.licenseType || 'Retail Drug Licence (Form 24)',
    location,
    latitude: lat,
    longitude: lng,
    openingHours,
    structuredHours,
    status: data.status || 'verified',
    verificationReason: data.verificationReason,
    decisionReason: data.decisionReason || data.verificationReason,
    nextStep: data.nextStep,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  };

  if (isConnected()) {
    const doc = new Pharmacy(record);
    await doc.save();
    return doc;
  }

  inMemoryPharmacies.set(String(record._id), record);
  return record;
}

/**
 * Resolves a pharmacy profile by pharmacy ID.
 */
export async function findPharmacyById(pharmacyId: string): Promise<any | null> {
  const targetId = String(pharmacyId).trim();
  if (!targetId) return null;

  if (isConnected()) {
    const doc = await Pharmacy.findOne({
      $or: [
        { _id: Types.ObjectId.isValid(targetId) ? new Types.ObjectId(targetId) : targetId },
        { id: targetId },
      ],
    }).lean();
    if (doc) return doc;
  }

  ensureSyntheticFixtures();
  for (const p of inMemoryPharmacies.values()) {
    if (String(p._id) === targetId || String(p.id) === targetId) {
      return p;
    }
  }

  return null;
}

/**
 * Returns all in-memory pharmacies for fallback querying.
 */
export function getAllInMemoryPharmacies(): any[] {
  ensureSyntheticFixtures();
  return Array.from(inMemoryPharmacies.values());
}

/**
 * Resolves the pharmacy profile belonging to the authenticated owner.
 * If no Pharmacy record exists, seamlessly resolves an active PharmacyApplication
 * without presenting pending records as verified.
 */
export async function findPharmacyByOwner(ownerId: string): Promise<any | null> {
  const normalizedOwner = String(ownerId).trim();

  // 1. Check Pharmacy collection when MongoDB is connected
  if (isConnected()) {
    const pharmacy = await Pharmacy.findOne({
      $or: [
        { ownerId: normalizedOwner },
        ...(Types.ObjectId.isValid(normalizedOwner)
          ? [{ ownerId: new Types.ObjectId(normalizedOwner) }]
          : []),
      ],
    });
    if (pharmacy) return pharmacy;
  }

  // 2. Check in-memory store
  for (const ph of inMemoryPharmacies.values()) {
    if (matchOwnerId(ph.ownerId, normalizedOwner)) {
      return ph;
    }
  }

  // 3. Check for an active PharmacyApplication for this owner
  const app = await findApplicationByOwner(normalizedOwner);
  if (app && app.data) {
    const formatted =
      app.data.formattedAddress ||
      `${app.data.streetAddress}, ${app.data.area}, ${app.data.city}`;

    const appProfile: any = {
      _id: String(app.pharmacyId || app._id),
      id: String(app.pharmacyId || app._id),
      applicationId: String(app._id),
      ownerId: String(app.ownerId),
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
      structuredHours: app.data.structuredHours || createDefaultWeeklyHours(),
      status: app.status,
      verificationReason: app.verificationReason || app.decisionReason,
      decisionReason: app.decisionReason || app.verificationReason,
      nextStep: app.nextStep,
      createdAt: app.submittedAt || (app as any).createdAt || new Date(),
      updatedAt: (app as any).updatedAt || app.submittedAt || new Date(),
      _fromApplication: true,
      _applicationId: String(app._id),
    };

    return appProfile;
  }

  // 4. Check synthetic fixtures by matching ownerId
  if (matchOwnerId(syntheticVerifiedPharmacy.ownerId, normalizedOwner)) {
    return inMemoryPharmacies.get(String(syntheticVerifiedPharmacy._id)) || syntheticVerifiedPharmacy;
  }

  if (matchOwnerId(syntheticSuspendedPharmacy.ownerId, normalizedOwner)) {
    return inMemoryPharmacies.get(String(syntheticSuspendedPharmacy._id)) || syntheticSuspendedPharmacy;
  }

  return null;
}

/**
 * Reads the authenticated owner's pharmacy profile.
 * Throws 404 NOT_FOUND if no pharmacy or application exists.
 */
export async function getPharmacyProfile(ownerId: string): Promise<any> {
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }
  return pharmacy;
}

/**
 * Updates only owner-editable profile fields.
 * Rejects modifications to protected regulatory licence fields, internal IDs, and verification states.
 */
export async function updatePharmacyProfile(
  ownerId: string,
  rawPayload: unknown,
  options?: { expectedUpdatedAt?: string; idempotencyKey?: string }
): Promise<any> {
  const idempotencyKey = options?.idempotencyKey;
  if (idempotencyKey) {
    const cached = getIdempotentResponse(ownerId, idempotencyKey);
    if (cached) {
      return cached.body?.data || cached.body;
    }
  }

  // 1. Sanitize: Strip untrusted client identity & status fields
  const sanitized = sanitizeClientPayload((rawPayload || {}) as Record<string, unknown>);

  // 2. Validate: Validate all allowed fields; rejects protected regulatory licence fields with 422
  const validated = validatePharmacyProfileUpdatePayload(sanitized);

  // 3. Find existing pharmacy or application context
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account to update.',
      'NOT_FOUND',
      404
    );
  }

  // Concurrency check: If client supplied concurrency token (If-Match or expectedUpdatedAt/updatedAt), verify match
  const rawToken = options?.expectedUpdatedAt || (rawPayload as any)?.expectedUpdatedAt || (rawPayload as any)?.updatedAt;
  if (rawToken && typeof rawToken === 'string' && rawToken.trim()) {
    const cleanToken = rawToken.trim().replace(/^["']|["']$/g, '');
    const serverTime = pharmacy.updatedAt ? new Date(pharmacy.updatedAt).getTime() : 0;
    const clientTime = new Date(cleanToken).getTime();
    if (!Number.isNaN(serverTime) && !Number.isNaN(clientTime) && serverTime !== clientTime) {
      throw new ApplicationError(
        'This pharmacy record was updated elsewhere or conflicts with existing data. Refresh and try again.',
        'CONFLICT',
        409,
        { updatedAt: 'Stale state conflict.' }
      );
    }
  }

  // 4. Verification state gatekeeping:
  // - Suspended accounts are restricted from modifying profile
  if (pharmacy.status === 'suspended') {
    throw new AuthorizationError(
      'Suspended pharmacy records cannot be modified. Please contact MediFind Compliance.',
      'FORBIDDEN_SUSPENDED',
      403
    );
  }

  // - Rejected applications must use the application correction workflow (/owner/pharmacy-application)
  if (pharmacy.status === 'rejected') {
    throw new AuthorizationError(
      'Rejected pharmacy applications cannot be modified through the profile endpoint. Please use the application correction workflow to resubmit.',
      'FORBIDDEN_REJECTED',
      403
    );
  }

  // 5. Apply permitted field updates
  if (validated.name !== undefined) pharmacy.name = validated.name;
  if (validated.ownerName !== undefined) pharmacy.ownerName = validated.ownerName;
  if (validated.phone !== undefined) pharmacy.phone = validated.phone;
  if (validated.email !== undefined) pharmacy.email = validated.email;
  if (validated.streetAddress !== undefined) pharmacy.streetAddress = validated.streetAddress;
  if (validated.city !== undefined) pharmacy.city = validated.city;
  if (validated.area !== undefined) pharmacy.area = validated.area;
  if (validated.postalCode !== undefined) pharmacy.postalCode = validated.postalCode;

  // Formatted address synchronization
  if (validated.formattedAddress !== undefined) {
    pharmacy.formattedAddress = validated.formattedAddress;
    pharmacy.address = validated.formattedAddress;
  } else if (validated.address !== undefined) {
    pharmacy.formattedAddress = validated.address;
    pharmacy.address = validated.address;
  } else if (
    validated.streetAddress !== undefined ||
    validated.area !== undefined ||
    validated.city !== undefined ||
    validated.postalCode !== undefined
  ) {
    const s = pharmacy.streetAddress || '';
    const a = pharmacy.area || '';
    const c = pharmacy.city || '';
    const p = pharmacy.postalCode ? ' - ' + pharmacy.postalCode : '';
    const generated = [s, a, c].filter(Boolean).join(', ') + p;
    pharmacy.formattedAddress = generated;
    pharmacy.address = generated;
  }

  // Location & Coordinates synchronization: [longitude, latitude] GeoJSON order
  if (validated.latitude !== undefined && validated.longitude !== undefined) {
    pharmacy.latitude = validated.latitude;
    pharmacy.longitude = validated.longitude;
    pharmacy.location = {
      type: 'Point',
      coordinates: [validated.longitude, validated.latitude],
    };
  } else if (
    validated.location &&
    Array.isArray(validated.location.coordinates) &&
    validated.location.coordinates.length >= 2
  ) {
    pharmacy.location = validated.location;
    pharmacy.longitude = validated.location.coordinates[0];
    pharmacy.latitude = validated.location.coordinates[1];
  }

  // Structured Hours & Summary Formatter: Treat structuredHours as canonical
  if (validated.structuredHours !== undefined) {
    pharmacy.structuredHours = validated.structuredHours;
    pharmacy.openingHours = formatWeeklyHours(validated.structuredHours);
  } else if (validated.openingHours !== undefined) {
    pharmacy.openingHours = validated.openingHours;
  }

  pharmacy.updatedAt = new Date();

  // 6. Persist to storage
  if (isConnected() && typeof pharmacy.save === 'function') {
    await pharmacy.save();
  } else {
    inMemoryPharmacies.set(String(pharmacy._id), pharmacy);
  }

  // 7. Synchronize with PharmacyApplication if one exists for this owner, preventing drift
  try {
    const app = await findApplicationByOwner(ownerId);
    if (app && app.data) {
      if (validated.name !== undefined) app.data.name = validated.name;
      if (validated.ownerName !== undefined) app.data.ownerName = validated.ownerName;
      if (validated.phone !== undefined) app.data.phone = validated.phone;
      if (validated.email !== undefined) app.data.email = validated.email;
      if (validated.streetAddress !== undefined) app.data.streetAddress = validated.streetAddress;
      if (validated.city !== undefined) app.data.city = validated.city;
      if (validated.area !== undefined) app.data.area = validated.area;
      if (validated.postalCode !== undefined) app.data.postalCode = validated.postalCode;
      if (pharmacy.formattedAddress) app.data.formattedAddress = pharmacy.formattedAddress;
      if (pharmacy.latitude !== undefined) app.data.latitude = pharmacy.latitude;
      if (pharmacy.longitude !== undefined) app.data.longitude = pharmacy.longitude;
      if (pharmacy.location) app.data.location = pharmacy.location;
      if (pharmacy.openingHours) app.data.openingHours = pharmacy.openingHours;
      if (pharmacy.structuredHours) app.data.structuredHours = pharmacy.structuredHours;

      if (isConnected() && typeof app.save === 'function') {
        await app.save();
      }
    }
  } catch {
    // Non-blocking sync
  }

  if (idempotencyKey) {
    recordIdempotentResponse(ownerId, idempotencyKey, 200, formatPharmacyResponse(pharmacy, true));
  }

  return pharmacy;
}

/**
 * Reads the structured weekly operating schedule for the authenticated owner's pharmacy.
 */
export async function getOpeningHours(
  ownerId: string
): Promise<{ structuredHours: WeeklyHours; openingHours: string }> {
  const pharmacy = await getPharmacyProfile(ownerId);
  const structuredHours: WeeklyHours =
    pharmacy.structuredHours || createDefaultWeeklyHours();
  const openingHours: string =
    pharmacy.openingHours || formatWeeklyHours(structuredHours);

  return { structuredHours, openingHours };
}

/**
 * Replaces the complete 7-day structured opening hours schedule.
 * Enforces valid HH:mm times, open < close, 24h schedule, and at least one open day.
 * Derives and updates the canonical openingHours summary string.
 */
export async function updateOpeningHours(
  ownerId: string,
  rawBody: unknown
): Promise<{ structuredHours: WeeklyHours; openingHours: string }> {
  // Extract schedule payload supporting both { structuredHours: ... } and direct WeeklyHours
  let structuredHours: unknown = undefined;

  if (rawBody && typeof rawBody === 'object') {
    const obj = rawBody as Record<string, unknown>;
    if (obj.structuredHours && typeof obj.structuredHours === 'object') {
      structuredHours = obj.structuredHours;
    } else if ('monday' in obj) {
      structuredHours = obj;
    }
  }

  if (!structuredHours || typeof structuredHours !== 'object') {
    throw new ValidationError('Operating hours schedule is required.', {
      structuredHours: 'Operating hours schedule is required.',
      openingHours: 'Operating hours schedule is required.',
    });
  }

  // Validate schedule rules
  const errors = validateWeeklyHoursSchedule(structuredHours, 'structuredHours');
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Please review the highlighted fields.', errors);
  }

  // Verify pharmacy existence and check state
  const pharmacy = await getPharmacyProfile(ownerId);

  if (pharmacy.status === 'suspended') {
    throw new AuthorizationError(
      'Suspended pharmacy accounts cannot update opening hours. Please contact MediFind Compliance.',
      'FORBIDDEN_SUSPENDED',
      403
    );
  }

  if (pharmacy.status === 'rejected') {
    throw new AuthorizationError(
      'Rejected pharmacy applications cannot update opening hours. Please use the application correction workflow to resubmit.',
      'FORBIDDEN_REJECTED',
      403
    );
  }

  const typedHours = structuredHours as WeeklyHours;
  const derivedOpeningHours = formatWeeklyHours(typedHours);

  // Update canonical schedule on the pharmacy record
  pharmacy.structuredHours = typedHours;
  pharmacy.openingHours = derivedOpeningHours;
  pharmacy.updatedAt = new Date();

  if (isConnected() && typeof pharmacy.save === 'function') {
    await pharmacy.save();
  } else {
    inMemoryPharmacies.set(String(pharmacy._id), pharmacy);
  }

  // Synchronize with application if present
  try {
    const app = await findApplicationByOwner(ownerId);
    if (app && app.data) {
      app.data.structuredHours = typedHours;
      app.data.openingHours = derivedOpeningHours;
      if (isConnected() && typeof app.save === 'function') {
        await app.save();
      }
    }
  } catch {
    // Non-blocking sync
  }

  return {
    structuredHours: typedHours,
    openingHours: derivedOpeningHours,
  };
}
