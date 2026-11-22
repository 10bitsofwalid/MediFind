// backend/src/types/stock.ts
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
  updatedBy?: string;
  updatedByName?: string;
  isStale?: boolean;
  freshness?: 'fresh' | 'stale';
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
  medicineId: string;
  medicineName?: string;
  genericName?: string;
  strength?: string;
  form?: string;
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
  notes?: string | null;
}

export interface ServerStockUpdate {
  stockId: string;
  status: StockStatus;
  updatedAt: string;
  quantity?: number;
  price?: number;
  notes?: string;
  isStale?: boolean;
  freshness?: 'fresh' | 'stale';
}

export interface ReconfirmStockPayload {
  status?: 'available' | 'low' | 'out';
  quantity?: number | null;
}

export interface OwnerSummary {
  totalInventory?: number;
  availableCount?: number;
  lowCount?: number;
  outCount?: number;
  staleCount?: number;
  unverifiedCount?: number;
  attentionItems?: StockInventoryRecord[];
}
