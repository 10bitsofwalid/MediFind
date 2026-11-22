// backend/src/controllers/adminController.ts
import { Request, Response, NextFunction } from 'express';
import {
  getQualityThresholds,
  setQualityThresholds,
} from '../services/systemSettingService';
import { wrapEnvelope } from '../utils/responseEnvelope';

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
