// backend/src/controllers/availabilityController.ts
// Merged: Jawad (customer geospatial discovery) + main (pharmacy public availability)
import { Request, Response, NextFunction } from 'express';
import { availabilityService } from '../services/availabilityService';
import {
  searchNearbyAvailability,
  getPharmacyPublicAvailability,
} from '../services/availabilityService';
import { wrapEnvelope } from '../utils/responseEnvelope';

// ============================================================================
// Jawad's customer discovery handlers
// ============================================================================

export const getNearbyAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { medicineId, lat, lng, radiusKm, area, availability, openNow, sortBy } = req.query;

    if (!medicineId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'medicineId query parameter is required.' },
      });
      return;
    }

    const availabilityArr =
      typeof availability === 'string'
        ? availability.split(',').map((s) => s.trim())
        : Array.isArray(availability)
        ? (availability as string[])
        : undefined;

    const data = await availabilityService.getNearbyAvailability({
      medicineId: medicineId as string,
      lat: lat ? parseFloat(lat as string) : undefined,
      lng: lng ? parseFloat(lng as string) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm as string) : undefined,
      area: typeof area === 'string' ? area : undefined,
      availability: availabilityArr,
      openNow: openNow === 'true' || openNow === '1',
      sortBy: sortBy as 'distance' | 'freshness' | 'availability' | undefined,
    });

    res.setHeader(
      'X-Medical-Disclaimer',
      'MediFind provides medicine stock availability information only and does not offer medical advice, diagnosis, or treatment recommendations.'
    );

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({
        success: false,
        error: { code: err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: err.message },
      });
      return;
    }
    next(err);
  }
};

export const getPharmacyStockDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pharmacyId, medicineId } = req.params;

    const data = await availabilityService.getPharmacyStockDetail(
      Array.isArray(pharmacyId) ? pharmacyId[0] : pharmacyId,
      Array.isArray(medicineId) ? medicineId[0] : medicineId
    );

    res.setHeader(
      'X-Medical-Disclaimer',
      'MediFind provides medicine stock availability information only and does not offer medical advice, diagnosis, or treatment recommendations.'
    );

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({
        success: false,
        error: { code: err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: err.message },
      });
      return;
    }
    next(err);
  }
};

// ============================================================================
// main's pharmacy public availability handlers
// ============================================================================

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
      query, medicineId, lat, lng, radiusKm, availability, openNow, sortBy,
    });

    res.status(200).json({ data, medicine: data.medicine, results: data.results });
  } catch (err) {
    next(err);
  }
}

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
