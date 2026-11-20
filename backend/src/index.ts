// backend/src/index.ts

// Domain DTO and Payload Types
export type {
  Role,
  VerificationStatus,
  StockStatus,
  LocationGeoJSON,
  DayOfWeek,
  DaySchedule,
  WeeklyHours,
  PharmacyApplicationPayload,
  PharmacyApplicationResponse,
  Pharmacy as PharmacyProfile,
  Pharmacy as PharmacyDTO,
  PharmacyProfileUpdatePayload,
  Medicine,
  StockInventoryRecord,
  StockHistoryRecord,
  StockHistoryPage,
  StockHistoryResponse,
  AddInventoryMedicinePayload,
  UpdateInventoryMedicinePayload,
  ServerStockUpdate,
  ReconfirmStockPayload,
  OwnerSummary,
  ApiErrorBody,
  ApiErrorResponse,
  ApiPaginationMeta,
  ApiSuccessResponse,
} from './types';

// Mongoose Models and Schemas
export {
  PharmacyApplication,
  PharmacyApplicationSchema,
  IPharmacyApplication,
  IPharmacyApplicationData,
} from './models/PharmacyApplication';

export {
  Pharmacy,
  Pharmacy as PharmacyModel,
  PharmacySchema,
  IPharmacy,
} from './models/Pharmacy';

export {
  Medicine as MedicineModel,
  MedicineSchema,
  IMedicine,
} from './models/Medicine';

export {
  Stock,
  StockSchema,
  IStock,
} from './models/Stock';

export {
  StockHistory,
  StockHistorySchema,
  IStockHistory,
} from './models/StockHistory';

// Validation
export * from './validation';

// Auth and Ownership
export * from './auth/ownership';
export * from './middleware/authMiddleware';

// Pharmacy Application Service & Routes
export * from './services/pharmacyApplicationService';
export * from './controllers/pharmacyApplicationController';
export * from './services/pharmacyService';
export * from './controllers/pharmacyController';
export * from './services/stockService';
export * from './controllers/stockController';
export { default as ownerRoutes } from './routes/ownerRoutes';

// Synthetic Fixtures
export * from './fixtures';

// Utilities
export * from './utils/responseEnvelope';
export * from './utils/freshness';
export * from './utils/errors';
