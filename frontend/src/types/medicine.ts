// src/types/medicine.ts
import type { StockStatus } from './pharmacy';

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
  manufacturer?: string;
  prescriptionRequired?: boolean;
  status: StockStatus;
  quantity?: number;
  price?: number;
  notes?: string;
  updatedAt: string;
  isStale?: boolean;
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
