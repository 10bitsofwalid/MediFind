// backend/src/services/pharmacyApplicationService.ts
import mongoose, { Types } from 'mongoose';
import {
  PharmacyApplication,
  IPharmacyApplication,
} from '../models/PharmacyApplication';
import { Pharmacy, IPharmacy } from '../models/Pharmacy';
import type {
  PharmacyApplicationPayload,
  VerificationStatus,
} from '../types/pharmacy';
import { normalizeLicenseNo } from '../validation/commonValidators';
import { validatePharmacyApplicationPayload } from '../validation/pharmacyValidators';
import { sanitizeClientPayload } from '../auth/ownership';
import { ApplicationError } from '../utils/errors';
import {
  getIdempotentResponse,
  recordIdempotentResponse,
} from '../utils/idempotency';
import { formatApplicationResponse } from '../utils/responseEnvelope';

// In-memory store for development fallback when MongoDB is not connected
const inMemoryApplications = new Map<string, IPharmacyApplication>();

/**
 * Checks if MongoDB is currently connected.
 */
function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Normalizes an ownerId string or ObjectId for matching.
 */
function matchOwnerId(storedOwnerId: unknown, targetOwnerId: string): boolean {
  if (!storedOwnerId) return false;
  const storedStr = String(storedOwnerId).trim();
  const targetStr = String(targetOwnerId).trim();
  return storedStr === targetStr;
}

/**
 * Finds the pharmacy application owned by the specified authenticated owner.
 */
export async function findApplicationByOwner(
  ownerId: string
): Promise<IPharmacyApplication | null> {
  const normalizedOwner = String(ownerId).trim();

  if (isConnected()) {
    const app = await PharmacyApplication.findOne({
      $or: [
        { ownerId: normalizedOwner },
        ...(Types.ObjectId.isValid(normalizedOwner)
          ? [{ ownerId: new Types.ObjectId(normalizedOwner) }]
          : []),
      ],
    });
    return app;
  }

  for (const app of inMemoryApplications.values()) {
    if (matchOwnerId(app.ownerId, normalizedOwner)) {
      return app;
    }
  }
  return null;
}

/**
 * Finds a pharmacy application by its unique ID.
 */
export async function findApplicationById(
  applicationId: string
): Promise<IPharmacyApplication | null> {
  const trimmedId = String(applicationId).trim();

  if (isConnected()) {
    if (Types.ObjectId.isValid(trimmedId)) {
      const app = await PharmacyApplication.findById(trimmedId);
      if (app) return app;
    }
    const app = await PharmacyApplication.findOne({ _id: trimmedId }).catch(() => null);
    return app;
  }

  for (const app of inMemoryApplications.values()) {
    if (String(app._id) === trimmedId) {
      return app;
    }
  }
  return null;
}

/**
 * Checks whether a drug licence number is already registered across any application or pharmacy.
 * Optionally excludes a specific application ID (for updates).
 */
export async function findDuplicateLicense(
  licenseNo: string,
  excludeAppId?: string
): Promise<{ ownerId: unknown; licenseNo: string } | null> {
  const normalized = normalizeLicenseNo(licenseNo);
  const excludeStr = excludeAppId ? String(excludeAppId).trim() : null;

  if (isConnected()) {
    // 1. Check PharmacyApplication collection
    const appQuery: Record<string, unknown> = { normalizedLicenseNo: normalized };
    if (excludeStr && Types.ObjectId.isValid(excludeStr)) {
      appQuery._id = { $ne: new Types.ObjectId(excludeStr) };
    }
    const existingApp = await PharmacyApplication.findOne(appQuery);
    if (existingApp) {
      return { ownerId: existingApp.ownerId, licenseNo: normalized };
    }

    // 2. Check Pharmacy collection (approved/verified pharmacies)
    const existingPharmacy = await Pharmacy.findOne({ normalizedLicenseNo: normalized });
    if (existingPharmacy) {
      return { ownerId: existingPharmacy.ownerId, licenseNo: normalized };
    }

    return null;
  }

  // In-memory fallback
  for (const app of inMemoryApplications.values()) {
    if (excludeStr && String(app._id) === excludeStr) {
      continue;
    }
    const appLicense = normalizeLicenseNo(app.normalizedLicenseNo || app.data?.licenseNo);
    if (appLicense === normalized) {
      return { ownerId: app.ownerId, licenseNo: normalized };
    }
  }
  return null;
}

/**
 * Submits a new pharmacy application for the authenticated owner.
 *
 * Business Rules Enforced:
 * 1. Derives ownerId exclusively from server context; ignores client-supplied ownerId.
 * 2. Enforces initial status strictly as 'pending'; rejects client-supplied status.
 * 3. Enforces 'one active application per owner' policy.
 * 4. Normalizes licence number and rejects duplicates with HTTP 409 DUPLICATE_LICENSE.
 * 5. If owner has an existing 'rejected' application, corrects/resubmits it without duplicate creation.
 */
export async function submitApplication(
  ownerId: string,
  rawPayload: unknown,
  options?: { idempotencyKey?: string }
): Promise<IPharmacyApplication> {
  const idempotencyKey = options?.idempotencyKey;
  if (idempotencyKey) {
    const cached = getIdempotentResponse(ownerId, idempotencyKey);
    if (cached) {
      return cached.body?.data || cached.body;
    }
  }

  // 1. Sanitize: Strip untrusted client identity & status fields
  const sanitized = sanitizeClientPayload((rawPayload || {}) as Record<string, unknown>);

  // 2. Validate: Validate all fields (name, phone, address, coordinates, hours, license)
  const validated = validatePharmacyApplicationPayload(sanitized);
  const normalizedLicense = normalizeLicenseNo(validated.licenseNo);

  // 3. Duplicate Licence Check: Reject if registered to another account
  const existingWithLicense = await findDuplicateLicense(normalizedLicense);
  if (existingWithLicense && !matchOwnerId(existingWithLicense.ownerId, ownerId)) {
    throw new ApplicationError(
      'This licence number is already registered.',
      'DUPLICATE_LICENSE',
      409,
      { licenseNo: 'Licence number already registered.' }
    );
  }

  // 4. One Active Application Policy Check
  const existingApp = await findApplicationByOwner(ownerId);
  if (existingApp) {
    if (existingApp.status === 'verified') {
      throw new ApplicationError(
        'You already have a verified pharmacy. Multiple active pharmacies are not supported.',
        'ALREADY_VERIFIED',
        409
      );
    }

    if (existingApp.status === 'suspended') {
      throw new ApplicationError(
        'Suspended pharmacy accounts cannot submit new applications. Please contact MediFind Compliance.',
        'FORBIDDEN_SUSPENDED',
        403
      );
    }

    if (existingApp.status === 'pending') {
      // If this is an idempotent re-submission of the same application (e.g. timeout retry)
      if (idempotencyKey || existingApp.normalizedLicenseNo === normalizedLicense) {
        if (idempotencyKey) {
          recordIdempotentResponse(ownerId, idempotencyKey, 200, formatApplicationResponse(existingApp, true));
        }
        return existingApp;
      }

      throw new ApplicationError(
        'You already have a pharmacy application pending administrator review. You can withdraw or update your pending application.',
        'ACTIVE_APPLICATION_EXISTS',
        409
      );
    }

    if (existingApp.status === 'rejected') {
      // Correction/resubmission updates the existing rejected application without creating a duplicate
      existingApp.data = validated as any;
      existingApp.normalizedLicenseNo = normalizedLicense;
      existingApp.status = 'pending';
      existingApp.submittedAt = new Date();
      existingApp.message =
        'Pharmacy application resubmitted successfully and is pending administrator review.';
      existingApp.verificationReason = undefined;
      existingApp.decisionReason = undefined;
      existingApp.nextStep = undefined;

      await existingApp.validate();
      if (isConnected()) {
        await existingApp.save();
      } else {
        inMemoryApplications.set(String(existingApp._id), existingApp);
      }

      if (idempotencyKey) {
        recordIdempotentResponse(ownerId, idempotencyKey, 200, formatApplicationResponse(existingApp, true));
      }
      return existingApp;
    }
  }

  // 5. Create new application with server-controlled 'pending' status
  const newApp = new PharmacyApplication({
    ownerId,
    status: 'pending',
    submittedAt: new Date(),
    message: 'Pharmacy application submitted successfully and is pending administrator review.',
    data: validated,
    normalizedLicenseNo: normalizedLicense,
  });

  await newApp.validate();
  if (isConnected()) {
    await newApp.save();
  } else {
    inMemoryApplications.set(String(newApp._id), newApp);
  }

  if (idempotencyKey) {
    recordIdempotentResponse(ownerId, idempotencyKey, 201, formatApplicationResponse(newApp, true));
  }

  return newApp;
}

/**
 * Updates or corrects an existing pharmacy application for the authenticated owner.
 * Permitted only when the application is 'pending' or 'rejected'.
 */
export async function updateApplication(
  ownerId: string,
  rawPayload: unknown
): Promise<IPharmacyApplication> {
  const existingApp = await findApplicationByOwner(ownerId);
  if (!existingApp) {
    throw new ApplicationError(
      'No submitted pharmacy application found to update.',
      'NOT_FOUND',
      404
    );
  }

  // Lifecycle check: Forbidden once approved or suspended
  if (existingApp.status === 'verified') {
    throw new ApplicationError(
      'Approved pharmacy applications cannot be modified through the application endpoint. Use the profile management workspace.',
      'FORBIDDEN_APPROVED',
      403
    );
  }

  if (existingApp.status === 'suspended') {
    throw new ApplicationError(
      'Suspended pharmacy records cannot be modified. Contact MediFind Compliance.',
      'FORBIDDEN_SUSPENDED',
      403
    );
  }

  // Sanitize client payload
  const sanitized = sanitizeClientPayload((rawPayload || {}) as Record<string, unknown>);

  // Merge with existing application data to allow both full payloads and partial field updates
  const merged = {
    ...JSON.parse(JSON.stringify(existingApp.data || {})),
    ...sanitized,
  };

  const validated = validatePharmacyApplicationPayload(merged);
  const normalizedLicense = normalizeLicenseNo(validated.licenseNo);

  // Check licence uniqueness excluding this application
  const existingWithLicense = await findDuplicateLicense(
    normalizedLicense,
    String(existingApp._id)
  );
  if (existingWithLicense && !matchOwnerId(existingWithLicense.ownerId, ownerId)) {
    throw new ApplicationError(
      'This licence number is already registered.',
      'DUPLICATE_LICENSE',
      409,
      { licenseNo: 'Licence number already registered.' }
    );
  }

  // Update existing application fields and reset to pending review
  existingApp.data = validated as any;
  existingApp.normalizedLicenseNo = normalizedLicense;
  existingApp.status = 'pending';
  existingApp.submittedAt = new Date();
  existingApp.message =
    'Pharmacy application resubmitted successfully and is pending administrator review.';
  existingApp.verificationReason = undefined;
  existingApp.decisionReason = undefined;
  existingApp.nextStep = undefined;

  await existingApp.validate();
  if (isConnected()) {
    await existingApp.save();
  } else {
    inMemoryApplications.set(String(existingApp._id), existingApp);
  }

  return existingApp;
}

/**
 * Deletes or withdraws an unapproved pharmacy application.
 * Permitted ONLY for unapproved applications ('pending' or 'rejected').
 * Strictly rejected for 'verified' (403 FORBIDDEN_APPROVED) or 'suspended' (403 FORBIDDEN_SUSPENDED).
 */
export async function deleteApplication(
  ownerId: string,
  applicationId?: string
): Promise<{ message: string }> {
  let app: IPharmacyApplication | null = null;

  if (applicationId) {
    app = await findApplicationById(applicationId);
    if (!app) {
      throw new ApplicationError(
        'No submitted pharmacy application found with the specified ID.',
        'NOT_FOUND',
        404
      );
    }

    // Cross-tenant security: Ensure the caller owns this application
    if (!matchOwnerId(app.ownerId, ownerId)) {
      throw new ApplicationError(
        'You are not authorized to delete this pharmacy application.',
        'PHARMACY_OWNERSHIP_DENIED',
        403
      );
    }
  } else {
    app = await findApplicationByOwner(ownerId);
    if (!app) {
      throw new ApplicationError(
        'No submitted pharmacy application found for this account.',
        'NOT_FOUND',
        404
      );
    }
  }

  // Lifecycle check: Deletion of approved or suspended records is strictly forbidden
  if (app.status === 'verified') {
    throw new ApplicationError(
      'Approved pharmacy applications cannot be deleted.',
      'FORBIDDEN_APPROVED',
      403
    );
  }

  if (app.status === 'suspended') {
    throw new ApplicationError(
      'Suspended pharmacy records cannot be deleted. Contact MediFind Compliance for assistance.',
      'FORBIDDEN_SUSPENDED',
      403
    );
  }

  // Delete from database or in-memory fallback
  if (isConnected()) {
    await PharmacyApplication.findByIdAndDelete(app._id);
  } else {
    inMemoryApplications.delete(String(app._id));
  }

  return { message: 'Pharmacy application deleted successfully.' };
}

/**
 * Administrative review decision helper (Developer 3 / Test Simulator).
 * Transitions application verification status and records decision metadata.
 */
export async function adminSetApplicationStatus(
  applicationId: string,
  status: VerificationStatus,
  decisionReason?: string,
  nextStep?: string
): Promise<IPharmacyApplication> {
  const app = await findApplicationById(applicationId);
  if (!app) {
    throw new ApplicationError('Pharmacy application not found.', 'NOT_FOUND', 404);
  }

  app.status = status;
  if (decisionReason) {
    app.decisionReason = decisionReason;
    app.verificationReason = decisionReason;
  }
  if (nextStep) {
    app.nextStep = nextStep;
  }
  app.reviewedAt = new Date();

  if (isConnected()) {
    await app.save();
  } else {
    inMemoryApplications.set(String(app._id), app);
  }

  return app;
}

/**
 * Reads all pharmacy applications for administrator review.
 */
export async function findAllApplications(): Promise<any[]> {
  if (isConnected()) {
    return await PharmacyApplication.find().sort({ submittedAt: -1 }).lean();
  }
  return Array.from(inMemoryApplications.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

/**
 * Resets in-memory storage (used for test isolation).
 */
export function clearInMemoryStore(): void {
  inMemoryApplications.clear();
}
