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

// Synthetic Fixtures
export * from './fixtures';

// Utilities
export * from './utils/responseEnvelope';
export * from './utils/freshness';
