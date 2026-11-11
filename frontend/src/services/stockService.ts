// src/services/stockService.ts
import { api } from './api';
import type { StockStatus } from '../types/pharmacy';
import type { Medicine, StockInventoryRecord } from '../types/medicine';
import { isMockApiEnabled } from './pharmacyService';
import { getStoredCatalogue } from './adminService';

const MOCK_STOCK_STORAGE_KEY = 'medifind_mock_stock_inventory';

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

  async updateStockStatus(
    pharmacyId: string,
    stockId: string,
    status: StockStatus,
    quantity?: number
  ): Promise<StockInventoryRecord> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const inventory = await this.getInventory(pharmacyId);
      const index = inventory.findIndex((item) => item.stockId === stockId);

      const now = new Date().toISOString();
      if (index >= 0) {
        inventory[index] = {
          ...inventory[index],
          status,
          quantity: quantity !== undefined ? quantity : inventory[index].quantity,
          updatedAt: now,
          isStale: false, // newly updated report is fresh
        };
        localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(inventory));
        return inventory[index];
      }

      throw new Error('Stock item not found in inventory.');
    }

    const res = await api.patch(`/owner/inventory/${stockId}`, { status, quantity });
    return res.data?.data || res.data;
  },

  async searchCatalogue(query: string): Promise<Medicine[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    if (isMockApiEnabled()) {
      return getStoredCatalogue().filter(
        (med) =>
          med.active &&
          (med.name.toLowerCase().includes(q) ||
            med.genericName.toLowerCase().includes(q) ||
            med.strength.toLowerCase().includes(q))
      );
    }

    try {
      const res = await api.get('/medicines/search', { params: { q } });
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
};
