// src/services/stockService.ts
import { api } from './api';
import type { StockStatus } from '../types/pharmacy';
import type { Medicine, StockInventoryRecord } from '../types/medicine';
import { isMockApiEnabled } from './pharmacyService';

const MOCK_STOCK_STORAGE_KEY = 'medifind_mock_stock_inventory';

export const SAMPLE_CATALOGUE: Medicine[] = [
  {
    id: 'med_001',
    name: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    form: 'Tablet',
    strength: '500mg + 65mg',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    prescriptionRequired: false,
    active: true,
  },
  {
    id: 'med_002',
    name: 'Ace Plus',
    genericName: 'Paracetamol + Caffeine',
    form: 'Tablet',
    strength: '500mg + 65mg',
    manufacturer: 'Square Pharmaceuticals Ltd.',
    prescriptionRequired: false,
    active: true,
  },
  {
    id: 'med_003',
    name: 'Seclo 20',
    genericName: 'Omeprazole',
    form: 'Capsule',
    strength: '20mg',
    manufacturer: 'Square Pharmaceuticals Ltd.',
    prescriptionRequired: false,
    active: true,
  },
  {
    id: 'med_004',
    name: 'Azithrocin 500',
    genericName: 'Azithromycin',
    form: 'Tablet',
    strength: '500mg',
    manufacturer: 'Aristopharma Ltd.',
    prescriptionRequired: true,
    active: true,
  },
  {
    id: 'med_005',
    name: 'Compath 50',
    genericName: 'Losartan Potassium',
    form: 'Tablet',
    strength: '50mg',
    manufacturer: 'Incepta Pharmaceuticals Ltd.',
    prescriptionRequired: true,
    active: true,
  },
  {
    id: 'med_006',
    name: 'Gluconor 500',
    genericName: 'Metformin Hydrochloride',
    form: 'Tablet',
    strength: '500mg',
    manufacturer: 'Square Pharmaceuticals Ltd.',
    prescriptionRequired: true,
    active: true,
  },
];

function createInitialInventory(pharmacyId: string): StockInventoryRecord[] {
  return SAMPLE_CATALOGUE.map((med, index) => {
    const statuses: StockStatus[] = ['available', 'available', 'low', 'out', 'available', 'low'];
    const quantities = [120, 80, 12, 0, 45, 18];
    const hoursAgo = [1, 3, 26, 4, 18, 48]; // some fresh, some stale (>24h)

    return {
      stockId: `stk_${pharmacyId}_${med.id}`,
      pharmacyId,
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      strength: med.strength,
      form: med.form,
      status: statuses[index % statuses.length],
      quantity: quantities[index % quantities.length],
      updatedAt: new Date(Date.now() - hoursAgo[index % hoursAgo.length] * 3600000).toISOString(),
      isStale: hoursAgo[index % hoursAgo.length] >= 24,
    };
  });
}

export const stockService = {
  async getInventory(pharmacyId: string): Promise<StockInventoryRecord[]> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const raw = localStorage.getItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          // fallback to seed
        }
      }
      const initial = createInitialInventory(pharmacyId);
      localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(initial));
      return initial;
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
      await new Promise((resolve) => setTimeout(resolve, 400));
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
    if (!q) return SAMPLE_CATALOGUE;
    return SAMPLE_CATALOGUE.filter(
      (med) =>
        med.name.toLowerCase().includes(q) ||
        med.genericName.toLowerCase().includes(q) ||
        med.strength.toLowerCase().includes(q)
    );
  },
};

