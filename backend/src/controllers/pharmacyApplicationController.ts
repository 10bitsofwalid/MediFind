// backend/src/controllers/pharmacyApplicationController.ts
import { Request, Response, NextFunction } from 'express';
import {
  submitApplication,
  findApplicationByOwner,
  updateApplication,
  deleteApplication,
} from '../services/pharmacyApplicationService';
import { formatApplicationResponse, wrapEnvelope } from '../utils/responseEnvelope';

/**
 * Handles POST /owner/pharmacy-applications
 * Submits a new pharmacy application under server-enforced 'pending' status.
 */
export async function submitPharmacyApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const app = await submitApplication(ownerId, req.body);
    res.status(201).json(formatApplicationResponse(app, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /owner/pharmacy-application
 * Reads the current application and verification status for the authenticated owner.
 * Returns 404 if no application exists for this account (handled as unsubmitted by frontend).
 */
export async function getPharmacyApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const app = await findApplicationByOwner(ownerId);

    if (!app) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'No submitted pharmacy application found for this account.',
        },
      });
      return;
    }

    res.status(200).json(formatApplicationResponse(app, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PATCH /owner/pharmacy-application
 * Corrects and resubmits an existing editable or rejected application.
 */
export async function updatePharmacyApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const app = await updateApplication(ownerId, req.body);
    res.status(200).json(formatApplicationResponse(app, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles DELETE /owner/pharmacy-applications/:applicationId and DELETE /owner/pharmacy-application
 * Deletes or withdraws an unapproved pharmacy application.
 */
export async function deletePharmacyApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const rawAppId = req.params.applicationId;
    const applicationId = Array.isArray(rawAppId) ? rawAppId[0] : rawAppId;
    const result = await deleteApplication(ownerId, applicationId);
    res.status(200).json(wrapEnvelope(result));
  } catch (err) {
    next(err);
  }
}
