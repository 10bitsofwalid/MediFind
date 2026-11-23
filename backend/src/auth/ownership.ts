// backend/src/auth/ownership.ts
import type { IPharmacy } from '../models/Pharmacy';
import type { IPharmacyApplication } from '../models/PharmacyApplication';
import type { VerificationStatus } from '../types/pharmacy';

export class AuthorizationError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly fields?: Record<string, string>;

  constructor(
    message: string,
    code: string = 'FORBIDDEN',
    status: number = 403,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }

  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

export interface AuthenticatedUserContext {
  userId: string;
  role: 'CUSTOMER' | 'PHARMACY' | 'ADMIN';
  email?: string;
  name?: string;
}

/**
 * Strips untrusted identity, tenant, and lifecycle fields from incoming client request payloads.
 * Prevents clients from injecting or overriding ownerId, pharmacyId, status, or verification metadata.
 */
export function sanitizeClientPayload<T extends Record<string, unknown>>(payload: T): T {
  const sanitized = { ...payload };

  const forbiddenKeys = [
    'ownerId',
    'pharmacyId',
    'status',
    'verificationStatus',
    'verificationReason',
    'decisionReason',
    'nextStep',
    'verifiedBy',
    'verifiedAt',
    'reviewedBy',
    'reviewedAt',
    'normalizedLicenseNo',
    '_id',
    'id',
    'createdAt',
    'updatedAt',
  ];

  for (const key of forbiddenKeys) {
    delete sanitized[key];
  }

  return sanitized;
}

/**
 * Asserts that the authenticated user possesses the 'PHARMACY' role required for owner operations.
 */
export function assertPharmacyRole(user: AuthenticatedUserContext | undefined | null): void {
  if (!user || !user.userId) {
    throw new AuthorizationError('Authentication required.', 'UNAUTHORIZED', 401);
  }
  if (user.role !== 'PHARMACY') {
    throw new AuthorizationError(
      'Access denied. Pharmacy owner role required for this operation.',
      'FORBIDDEN',
      403
    );
  }
}

/**
 * Asserts that the authenticated user possesses the 'ADMIN' role required for moderation operations.
 */
export function assertAdminRole(user: AuthenticatedUserContext | undefined | null): void {
  if (!user || !user.userId) {
    throw new AuthorizationError('Authentication required.', 'UNAUTHORIZED', 401);
  }
  if (user.role !== 'ADMIN') {
    throw new AuthorizationError(
      'Access denied. Administrator role required for this operation.',
      'FORBIDDEN',
      403
    );
  }
}

/**
 * Verifies that the resolved pharmacy is owned by the authenticated server user.
 * Never trusts a client-supplied pharmacyId or ownerId.
 */
export function assertPharmacyOwnership(
  pharmacy: IPharmacy | null | undefined,
  authenticatedUserId: string
): asserts pharmacy is IPharmacy {
  if (!pharmacy) {
    throw new AuthorizationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }

  const ownerIdStr = String(pharmacy.ownerId);
  const authUserIdStr = String(authenticatedUserId).trim();

  if (ownerIdStr !== authUserIdStr) {
    throw new AuthorizationError(
      'You are not authorized to view or modify this pharmacy record.',
      'PHARMACY_OWNERSHIP_DENIED',
      403
    );
  }
}

/**
 * Verifies that the pharmacy application is owned by the authenticated server user.
 */
export function assertApplicationOwnership(
  application: IPharmacyApplication | null | undefined,
  authenticatedUserId: string
): asserts application is IPharmacyApplication {
  if (!application) {
    throw new AuthorizationError(
      'No submitted pharmacy application found for this account.',
      'NOT_FOUND',
      404
    );
  }

  const ownerIdStr = String(application.ownerId);
  const authUserIdStr = String(authenticatedUserId).trim();

  if (ownerIdStr !== authUserIdStr) {
    throw new AuthorizationError(
      'You are not authorized to access or modify this application.',
      'PHARMACY_OWNERSHIP_DENIED',
      403
    );
  }
}

/**
 * Enforces the verification gatekeeping trust boundary for inventory modifications.
 * When pharmacy verification status is 'pending', 'rejected', or 'suspended', inventory writes are strictly rejected.
 */
export function assertPharmacyVerifiedForInventoryWrite(
  pharmacyStatus: VerificationStatus | string
): void {
  if (pharmacyStatus !== 'verified') {
    throw new AuthorizationError(
      `Inventory updates are disabled while pharmacy verification status is "${pharmacyStatus}".`,
      'PHARMACY_NOT_VERIFIED',
      403
    );
  }
}
