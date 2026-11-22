// backend/src/controllers/availabilityController.ts
import { Request, Response, NextFunction } from 'express';
import {
  searchNearbyAvailability,
  getPharmacyPublicAvailability,
} from '../services/availabilityService';
import { wrapEnvelope } from '../utils/responseEnvelope';

/**
 * Handles GET /pharmacies/nearby and GET /availability/search
 * Public customer-facing search for nearby verified pharmacies stocking a medicine.
 *
 * Guarantees:
 * - Exposes both reported stock status (available, low, out, unverified) and freshness (fresh/stale) separately.
 * - Suppresses pending/unverified pharmacies from discovery.
 */
export async function searchNearbyPharmaciesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const medicineId = typeof req.query.medicineId === 'string' ? req.query.medicineId : undefined;
    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lng = req.query.lng ? Number(req.query.lng) : undefined;
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
    const availability = typeof req.query.availability === 'string' ? req.query.availability : undefined;
    const openNow = req.query.openNow === 'true';
    const sortBy = typeof req.query.sortBy === 'string' ? (req.query.sortBy as any) : undefined;

    const data = await searchNearbyAvailability({
      query,
      medicineId,
      lat,
      lng,
      radiusKm,
      availability,
      openNow,
      sortBy,
    });

    // Provide both { data: { medicine, results } } and top-level results for dual client compatibility
    res.status(200).json({
      data,
      medicine: data.medicine,
      results: data.results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /pharmacies/:pharmacyId/availability
 * Returns public stock availability for a specific verified pharmacy.
 */
export async function getPharmacyAvailabilityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pharmacyId = Array.isArray(req.params.pharmacyId)
      ? req.params.pharmacyId[0]
      : req.params.pharmacyId;
    const results = await getPharmacyPublicAvailability(String(pharmacyId));
    res.status(200).json(wrapEnvelope(results));
  } catch (err) {
    next(err);
  }
}
