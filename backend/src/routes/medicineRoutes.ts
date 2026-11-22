// backend/src/routes/medicineRoutes.ts
import { Router } from 'express';
import { searchMedicines, getMedicineDetails } from '../controllers/medicineController';

export const medicineRouter = Router();

// Public medicine catalogue search and detail routes
medicineRouter.get('/', searchMedicines);
medicineRouter.get('/:id', getMedicineDetails);
