// src/services/stockService.ts
import { api } from './api';
import axios from 'axios';
import type { StockStatus } from '../types/pharmacy';
import type {
  Medicine,
  StockInventoryRecord,
  AddInventoryMedicinePayload,
  UpdateInventoryMedicinePayload,
} from '../types/medicine';
import { isMockApiEnabled } from './pharmacyService';
import { getStoredCatalogue } from './adminService';

const MOCK_STOCK_STORAGE_KEY = 'medifind_mock_stock_inventory';

function validateNumericBounds(quantity?: number, price?: number): void {
  if (quantity !== undefined && (Number.isNaN(quantity) || quantity < 0)) {
    throw new Error('Quantity must be 0 or greater.');
  }
  if (price !== undefined && (Number.isNaN(price) || price < 0)) {
    throw new Error('Price must be 0 or greater.');
  }
}

export const stockService = {
  async getInventory(pharmacyId: string): Promise<StockInventoryRecord[]> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const raw = localStorage.getItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    }

    try {
      const res = await api.get('/owner/inventory');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  },

  async addInventoryItem(
    pharmacyId: string,
    payload: AddInventoryMedicinePayload
  ): Promise<StockInventoryRecord> {
    const medicineName = payload.medicineName.trim();
    const genericName = payload.genericName.trim();
    const strength = payload.strength.trim();
    const form = payload.form.trim();

    if (!medicineName || !genericName || !strength || !form) {
      throw new Error('Medicine name, generic name, strength, and dosage form are required.');
    }

    validateNumericBounds(payload.quantity, payload.price);

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const inventory = await this.getInventory(pharmacyId);

      const isDuplicate = inventory.some(
        (item) =>
          (payload.medicineId && item.medicineId === payload.medicineId) ||
          (item.medicineName.trim().toLowerCase() === medicineName.toLowerCase() &&
            item.strength.trim().toLowerCase() === strength.toLowerCase() &&
            item.form.trim().toLowerCase() === form.toLowerCase())
      );

      if (isDuplicate) {
        throw new Error(
          'This medicine is already in your pharmacy inventory. Use Edit Info to update it.'
        );
      }

      const now = new Date().toISOString();
      const newRecord: StockInventoryRecord = {
        stockId: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        pharmacyId,
        medicineId:
          payload.medicineId || `med_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        medicineName,
        genericName,
        strength,
        form,
        manufacturer: payload.manufacturer?.trim() || undefined,
        prescriptionRequired: Boolean(payload.prescriptionRequired),
        status: payload.status,
        quantity: payload.quantity,
        price: payload.price,
        notes: payload.notes?.trim() || undefined,
        updatedAt: now,
        isStale: false,
      };

      const updated = [newRecord, ...inventory];
      localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(updated));
      return newRecord;
    }

    try {
      const res = await api.post('/owner/inventory', {
        ...payload,
        medicineName,
        genericName,
        strength,
        form,
      });
      return res.data?.data || res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        throw new Error(err.response.data.error.message, { cause: err });
      }
      throw new Error('Failed to add medicine to inventory.', { cause: err });
    }
  },

  async updateInventoryItem(
    pharmacyId: string,
    stockId: string,
    payload: UpdateInventoryMedicinePayload
  ): Promise<StockInventoryRecord> {
    if (payload.medicineName !== undefined && !payload.medicineName.trim()) {
      throw new Error('Medicine name cannot be empty.');
    }
    if (payload.genericName !== undefined && !payload.genericName.trim()) {
      throw new Error('Generic name cannot be empty.');
    }
    if (payload.strength !== undefined && !payload.strength.trim()) {
      throw new Error('Strength cannot be empty.');
    }
    if (payload.form !== undefined && !payload.form.trim()) {
      throw new Error('Dosage form cannot be empty.');
    }

    validateNumericBounds(payload.quantity, payload.price);

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const inventory = await this.getInventory(pharmacyId);
      const index = inventory.findIndex((item) => item.stockId === stockId);
      if (index < 0) {
        throw new Error('Stock item not found in inventory.');
      }

      const existing = inventory[index];
      const updatedRecord: StockInventoryRecord = {
        ...existing,
        medicineName:
          payload.medicineName !== undefined ? payload.medicineName.trim() : existing.medicineName,
        genericName:
          payload.genericName !== undefined ? payload.genericName.trim() : existing.genericName,
        strength: payload.strength !== undefined ? payload.strength.trim() : existing.strength,
        form: payload.form !== undefined ? payload.form.trim() : existing.form,
        manufacturer:
          payload.manufacturer !== undefined
            ? payload.manufacturer.trim() || undefined
            : existing.manufacturer,
        prescriptionRequired:
          payload.prescriptionRequired !== undefined
            ? payload.prescriptionRequired
            : existing.prescriptionRequired,
        status: payload.status !== undefined ? payload.status : existing.status,
        quantity: 'quantity' in payload ? payload.quantity : existing.quantity,
        price: 'price' in payload ? payload.price : existing.price,
        notes: payload.notes !== undefined ? payload.notes.trim() || undefined : existing.notes,
        updatedAt: new Date().toISOString(),
        isStale: false,
      };

      inventory[index] = updatedRecord;
      localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(inventory));
      return updatedRecord;
    }

    try {
      const res = await api.patch(`/owner/inventory/${stockId}`, payload);
      return res.data?.data || res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        throw new Error(err.response.data.error.message, { cause: err });
      }
      throw new Error('Failed to update medicine information.', { cause: err });
    }
  },

  async updateStockStatus(
    pharmacyId: string,
    stockId: string,
    status: StockStatus,
    quantity?: number
  ): Promise<StockInventoryRecord> {
    const patch: UpdateInventoryMedicinePayload = { status };
    if (quantity !== undefined) {
      patch.quantity = quantity;
    }
    return this.updateInventoryItem(pharmacyId, stockId, patch);
  },

  async searchCatalogue(query: string): Promise<Medicine[]> {
    const q = query.trim().toLowerCase();

    if (isMockApiEnabled()) {
      const active = getStoredCatalogue().filter((med) => med.active);
      if (!q) return active;
      return active.filter(
        (med) =>
          med.name.toLowerCase().includes(q) ||
          med.genericName.toLowerCase().includes(q) ||
          med.strength.toLowerCase().includes(q)
      );
    }

    try {
      const res = await api.get('/medicines/search', { params: q ? { q } : undefined });
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
};
