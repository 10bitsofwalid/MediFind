// backend/src/controllers/adminController.ts
import { Request, Response, NextFunction } from 'express';
import {
  getQualityThresholds,
  setQualityThresholds,
} from '../services/systemSettingService';
import {
  findAllApplications,
  adminSetApplicationStatus,
} from '../services/pharmacyApplicationService';
import { seedPharmacy } from '../services/pharmacyService';
import { wrapEnvelope, formatApplicationResponse } from '../utils/responseEnvelope';
import { ApplicationError } from '../utils/errors';

/**
 * Handles GET /admin/settings/quality-thresholds
 * Reads configured stale threshold hours and unverified discrepancy report threshold.
 */
export async function getQualityThresholdsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const thresholds = await getQualityThresholds();
    res.status(200).json(wrapEnvelope(thresholds));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PATCH /admin/settings/quality-thresholds
 * Updates configured stale threshold hours and unverified report threshold in coordination with Developer 3.
 */
export async function updateQualityThresholdsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updated = await setQualityThresholds(req.body, req.user?.userId);
    res.status(200).json(wrapEnvelope(updated));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /admin/pharmacy-applications
 * Lists all submitted pharmacy applications for administrator verification queue.
 */
export async function listPharmacyApplicationsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apps = await findAllApplications();
    const formatted = apps.map((app) => formatApplicationResponse(app, false));
    res.status(200).json({ data: formatted });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /admin/pharmacy-applications/:applicationId/approve
 * Approves a pharmacy application, transitioning it to 'verified' status and
 * registering the verified pharmacy listing for discovery.
 */
export async function approvePharmacyApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.applicationId;
    const applicationId = Array.isArray(rawId) ? rawId[0] : rawId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;

    const nextStep = 'Pharmacy listing is verified and eligible for public medicine availability reporting.';
    const updatedApp = await adminSetApplicationStatus(
      String(applicationId),
      'verified',
      reason || 'Licence and premise details verified by platform administrator.',
      nextStep
    );

    // Synchronize to verified pharmacy collection/memory for public availability discovery
    if (updatedApp && updatedApp.data) {
      await seedPharmacy({
        _id: updatedApp.pharmacyId ? String(updatedApp.pharmacyId) : String(updatedApp._id),
        ownerId: String(updatedApp.ownerId),
        name: updatedApp.data.name,
        ownerName: updatedApp.data.ownerName,
        phone: updatedApp.data.phone,
        email: updatedApp.data.email,
        streetAddress: updatedApp.data.streetAddress,
        city: updatedApp.data.city,
        area: updatedApp.data.area,
        postalCode: updatedApp.data.postalCode,
        formattedAddress: updatedApp.data.formattedAddress,
        licenseNo: updatedApp.data.licenseNo,
        issuingAuthority: updatedApp.data.issuingAuthority,
        licenseExpiryDate: updatedApp.data.licenseExpiryDate,
        licenseType: updatedApp.data.licenseType,
        latitude: updatedApp.data.latitude,
        longitude: updatedApp.data.longitude,
        location: updatedApp.data.location,
        openingHours: updatedApp.data.openingHours,
        structuredHours: updatedApp.data.structuredHours,
        status: 'verified',
        verificationReason: reason || 'Licence and premise details verified by platform administrator.',
        decisionReason: reason || 'Licence and premise details verified by platform administrator.',
      });
    }

    res.status(200).json(formatApplicationResponse(updatedApp, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /admin/pharmacy-applications/:applicationId/reject
 * Rejects a pharmacy application with a mandatory decision reason.
 */
export async function rejectPharmacyApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.applicationId;
    const applicationId = Array.isArray(rawId) ? rawId[0] : rawId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!reason) {
      throw new ApplicationError(
        'Please provide a clear reason before marking an application as rejected.',
        'VALIDATION_ERROR',
        422,
        { reason: 'Decision reason is required when rejecting an application.' }
      );
    }

    const nextStep = 'Update the flagged license or business details and resubmit your onboarding application.';
    const updatedApp = await adminSetApplicationStatus(
      String(applicationId),
      'rejected',
      reason,
      nextStep
    );

    res.status(200).json(formatApplicationResponse(updatedApp, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /admin/pharmacies/:pharmacyId/suspend
 * Suspends a verified pharmacy listing pending investigation.
 */
export async function suspendPharmacyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.pharmacyId;
    const pharmacyId = Array.isArray(rawId) ? rawId[0] : rawId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!reason) {
      throw new ApplicationError(
        'Please provide a clear reason before suspending a pharmacy.',
        'VALIDATION_ERROR',
        422,
        { reason: 'Suspension reason is required.' }
      );
    }

    const nextStep = 'Contact MediFind Compliance with your Drug License number to initiate a compliance review.';
    const updated = await adminSetApplicationStatus(
      String(pharmacyId),
      'suspended',
      reason,
      nextStep
    );

    res.status(200).json(formatApplicationResponse(updated, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /admin/pharmacies/:pharmacyId/reactivate
 * Reinstates a suspended pharmacy listing.
 */
export async function reactivatePharmacyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.pharmacyId;
    const pharmacyId = Array.isArray(rawId) ? rawId[0] : rawId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Reinstated by administrator.';

    const updated = await adminSetApplicationStatus(
      String(pharmacyId),
      'verified',
      reason,
      'Pharmacy listing has been reinstated.'
    );

    res.status(200).json(formatApplicationResponse(updated, true));
  } catch (err) {
    next(err);
  }
}
