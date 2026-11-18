// src/types/medicine.ts

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  form: string;
  strength: string;
  manufacturer?: string;
  description?: string;
  prescriptionRequired?: boolean;
  active: boolean;
}

export interface StockInventoryRecord {
  stockId: string;
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  form: string;
  status: 'available' | 'low' | 'out' | 'unverified';
  quantity?: number;
  updatedAt: string;
  isStale?: boolean;
<<<<<<< Updated upstream
}

=======
  freshness?: 'fresh' | 'stale';
  reconfirmationRequired?: boolean;
  attentionReason?: string;
  reconfirmationReason?: string;
  flaggedAt?: string;
}

export interface StockHistoryRecord {
  historyId: string;
  stockId?: string;
  pharmacyId: string;
  medicineId: string;
  oldStatus: StockStatus | null;
  newStatus: StockStatus;
  oldQuantity?: number | null;
  newQuantity?: number | null;
  changedBy?: string | null;
  changedByName?: string | null;
  changedAt: string;
}

export interface StockHistoryPage {
  limit: number;
  nextCursor: string | null;
}

export interface StockHistoryResponse {
  data: StockHistoryRecord[];
  page?: StockHistoryPage;
}

export interface AddInventoryMedicinePayload {
  medicineId?: string;
  medicineName: string;
  genericName: string;
  strength: string;
  form: string;
  manufacturer?: string;
  prescriptionRequired?: boolean;
  status: StockStatus;
  quantity?: number;
  price?: number;
  notes?: string;
}

export interface UpdateInventoryMedicinePayload {
  medicineName?: string;
  genericName?: string;
  strength?: string;
  form?: string;
  manufacturer?: string;
  prescriptionRequired?: boolean;
  status?: StockStatus;
  quantity?: number | null;
  price?: number | null;
  notes?: string;
}

export type InventoryStatusFilter = 'all' | StockStatus;
export type InventoryFreshnessFilter = 'all' | 'fresh' | 'stale';
export type InventorySortOption = 'updated_desc' | 'oldest_first' | 'name_asc';

export interface StockInventoryQuery {
  q?: string;
  status?: StockStatus;
  freshness?: 'fresh' | 'stale';
  sort?: InventorySortOption;
}

export interface ReconfirmStockPayload {
  status: StockStatus;
  quantity?: number | null;
  notes?: string;
}

export interface OwnerDashboardSummary {
  totalListings: number;
  availableCount: number;
  freshAvailableCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  staleCount: number;
  unverifiedCount: number;
  reconfirmationCount: number;
  attentionCount: number;
}
>>>>>>> Stashed changes
