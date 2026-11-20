// backend/src/routes/ownerRoutes.ts
import { Router, Request, Response } from 'express';
import { requireAuth, requirePharmacyRole } from '../middleware/authMiddleware';
import {
  submitPharmacyApplicationHandler,
  getPharmacyApplicationHandler,
  updatePharmacyApplicationHandler,
  deletePharmacyApplicationHandler,
} from '../controllers/pharmacyApplicationController';
import {
  getPharmacyProfileHandler,
  updatePharmacyProfileHandler,
  getOpeningHoursHandler,
  updateOpeningHoursHandler,
} from '../controllers/pharmacyController';
import {
  getOwnerInventoryHandler,
  getOwnerInventoryItemHandler,
  addOwnerInventoryItemHandler,
} from '../controllers/stockController';
import {
  syntheticStockHistory,
} from '../fixtures/syntheticFixtures';
import {
  formatStockHistoryResponse,
} from '../utils/responseEnvelope';

const router = Router();

// Enforce authentication & pharmacy owner role for all /owner routes
router.use(requireAuth, requirePharmacyRole);

// ==========================================
// Pharmacy Application Lifecycle Routes
// ==========================================

// 1. Submit Application (POST /owner/pharmacy-applications)
router.post('/pharmacy-applications', submitPharmacyApplicationHandler);

// 2. Read Application Status (GET /owner/pharmacy-application)
router.get('/pharmacy-application', getPharmacyApplicationHandler);

// 3. Correct / Resubmit Application (PATCH /owner/pharmacy-application)
router.patch('/pharmacy-application', updatePharmacyApplicationHandler);

// 4. Delete / Withdraw Application (DELETE /owner/pharmacy-applications/:applicationId or /owner/pharmacy-application)
router.delete('/pharmacy-applications/:applicationId', deletePharmacyApplicationHandler);
router.delete('/pharmacy-application', deletePharmacyApplicationHandler);

// ==========================================
// Pharmacy Profile & Opening Hours Operations
// ==========================================

// 1. Read Pharmacy Profile (GET /owner/pharmacy)
router.get('/pharmacy', getPharmacyProfileHandler);

// 2. Update Pharmacy Profile (PATCH /owner/pharmacy)
router.patch('/pharmacy', updatePharmacyProfileHandler);

// 3. Read Opening Hours (GET /owner/pharmacy/opening-hours)
router.get('/pharmacy/opening-hours', getOpeningHoursHandler);

// 4. Replace Opening Hours (PUT /owner/pharmacy/opening-hours)
router.put('/pharmacy/opening-hours', updateOpeningHoursHandler);

// ==========================================
// Pharmacy Inventory Operations
// ==========================================

// 1. List Pharmacy Inventory (GET /owner/inventory)
router.get('/inventory', getOwnerInventoryHandler);

// 2. Add Catalogue Medicine to Pharmacy Inventory (POST /owner/inventory)
router.post('/inventory', addOwnerInventoryItemHandler);

// 3. Read Stock Item History (GET /owner/inventory/:stockId/history)
router.get('/inventory/:stockId/history', (_req: Request, res: Response) => {
  res.json(formatStockHistoryResponse(syntheticStockHistory, { limit: 20, nextCursor: null }, true));
});

// 4. Read Single Stock Item (GET /owner/inventory/:stockId)
router.get('/inventory/:stockId', getOwnerInventoryItemHandler);

export default router;
