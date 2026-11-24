// backend/src/controllers/availabilityController.ts
import { Request, Response, NextFunction } from 'express';
import { availabilityService } from '../services/availabilityService';

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
        error: {
          code: 'VALIDATION_ERROR',
          message: 'medicineId query parameter is required.',
        },
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

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
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
    const pharmacyIdStr = Array.isArray(pharmacyId) ? pharmacyId[0] : pharmacyId;
    const medicineIdStr = Array.isArray(medicineId) ? medicineId[0] : medicineId;

    const data = await availabilityService.getPharmacyStockDetail(
      pharmacyIdStr,
      medicineIdStr
    );

    res.setHeader(
      'X-Medical-Disclaimer',
      'MediFind provides medicine stock availability information only and does not offer medical advice, diagnosis, or treatment recommendations.'
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};
