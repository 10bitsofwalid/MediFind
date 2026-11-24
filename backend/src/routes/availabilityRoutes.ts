// backend/src/routes/availabilityRoutes.ts
import { Router } from 'express';
import {
  getNearbyAvailability,
  getPharmacyStockDetail,
} from '../controllers/availabilityController';

export const availabilityRouter = Router();

// GET /api/v1/availability?medicineId=...&lat=...&lng=...&radiusKm=...
availabilityRouter.get('/', getNearbyAvailability);

// GET /api/v1/availability/pharmacies/:pharmacyId/medicines/:medicineId/stock
availabilityRouter.get(
  '/pharmacies/:pharmacyId/medicines/:medicineId/stock',
  getPharmacyStockDetail
);
