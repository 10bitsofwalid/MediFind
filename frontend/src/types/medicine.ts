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
}

