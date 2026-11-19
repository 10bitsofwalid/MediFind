// backend/src/controllers/pharmacyController.ts
import { Request, Response, NextFunction } from 'express';
import {
  getPharmacyProfile,
  updatePharmacyProfile,
  getOpeningHours,
  updateOpeningHours,
} from '../services/pharmacyService';
import { formatPharmacyResponse, wrapEnvelope } from '../utils/responseEnvelope';

/**
 * Handles GET /owner/pharmacy
 * Reads the authenticated owner's pharmacy profile and verification status.
 */
export async function getPharmacyProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const pharmacy = await getPharmacyProfile(ownerId);
    res.status(200).json(formatPharmacyResponse(pharmacy, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PATCH /owner/pharmacy
 * Updates only owner-editable fields of the authenticated owner's pharmacy.
 * Preserves compatibility if structuredHours is passed directly in payload.
 */
export async function updatePharmacyProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const updatedPharmacy = await updatePharmacyProfile(ownerId, req.body);
    res.status(200).json(formatPharmacyResponse(updatedPharmacy, true));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /owner/pharmacy/opening-hours
 * Reads the structured weekly operating hours schedule for the owner's pharmacy.
 */
export async function getOpeningHoursHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const schedule = await getOpeningHours(ownerId);
    res.status(200).json(wrapEnvelope(schedule));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PUT /owner/pharmacy/opening-hours
 * Replaces the complete 7-day structured opening hours schedule.
 */
export async function updateOpeningHoursHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const result = await updateOpeningHours(ownerId, req.body);
    res.status(200).json(wrapEnvelope(result));
  } catch (err) {
    next(err);
  }
}
