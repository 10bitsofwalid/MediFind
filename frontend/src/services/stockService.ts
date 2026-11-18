// src/services/stockService.ts
import { api } from './api';
<<<<<<< Updated upstream
import type { StockStatus } from '../types/pharmacy';
import type { Medicine, StockInventoryRecord } from '../types/medicine';
import { isMockApiEnabled } from './pharmacyService';
=======
import axios from 'axios';
import type { PharmacyApplicationResponse, StockStatus } from '../types/pharmacy';
import type {
  Medicine,
  StockHistoryRecord,
  StockHistoryResponse,
  StockInventoryRecord,
  StockInventoryQuery,
  AddInventoryMedicinePayload,
  UpdateInventoryMedicinePayload,
  ReconfirmStockPayload,
} from '../types/medicine';
import { isMockApiEnabled } from './pharmacyService';
import { getStoredCatalogue } from './adminService';
import {
  isReportStale,
  normalizeStockStatus,
  summarizeInventory,
  filterAttentionInventory,
  type AttentionFilterType,
  type InventorySummary,
} from '../features/pharmacy/inventoryUtils';
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
  });
=======
  } catch {
    return { id: null, name: null };
  }
}

function getMockHistoryStorageKey(pharmacyId: string, stockId: string): string {
  return `${MOCK_HISTORY_STORAGE_KEY}_${pharmacyId}_${stockId}`;
}

function appendMockStockHistory(
  pharmacyId: string,
  stockId: string,
  entry: Omit<StockHistoryRecord, 'historyId'>
): void {
  const key = getMockHistoryStorageKey(pharmacyId, stockId);
  let existing: StockHistoryRecord[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existing = parsed;
      }
    }
  } catch {
    existing = [];
  }

  const record: StockHistoryRecord = {
    historyId: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...entry,
  };

  localStorage.setItem(key, JSON.stringify([record, ...existing]));
}

function normalizeServerStockUpdate(raw: unknown): ServerStockUpdate {
  if (!raw || typeof raw !== 'object') {
    throw new StockServiceError(
      'Server returned an invalid stock update confirmation.',
      'INVALID_RESPONSE',
      502
    );
  }
  const obj = raw as Record<string, unknown>;
  const stockId =
    typeof obj.stockId === 'string' && obj.stockId.trim()
      ? obj.stockId.trim()
      : typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : '';

  const normalizedStatus = normalizeStockStatus(obj.status);
  if (!stockId || !normalizedStatus || !isValidIsoTimestamp(obj.updatedAt)) {
    throw new StockServiceError(
      'Server confirmation was missing required stock status or timestamp details.',
      'INVALID_RESPONSE',
      502
    );
  }

  const update: ServerStockUpdate = {
    ...(obj as Partial<StockInventoryRecord>),
    stockId,
    status: normalizedStatus,
    updatedAt: obj.updatedAt,
  };

  if ('quantity' in obj) {
    if (obj.quantity === null || obj.quantity === undefined) {
      update.quantity = undefined;
    } else if (typeof obj.quantity === 'number' && Number.isFinite(obj.quantity) && obj.quantity >= 0) {
      update.quantity = obj.quantity;
    }
  }

  if (typeof obj.isStale === 'boolean') {
    update.isStale = obj.isStale;
  } else if (obj.freshness === 'stale') {
    update.isStale = true;
    update.freshness = 'stale';
  } else if (obj.freshness === 'fresh') {
    update.isStale = false;
    update.freshness = 'fresh';
  }

  return update;
}

function normalizeServerInventoryRecord(
  raw: unknown,
  fallbackPharmacyId?: string
): StockInventoryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const stockId =
    typeof obj.stockId === 'string' && obj.stockId.trim()
      ? obj.stockId.trim()
      : typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : '';
  const status = normalizeStockStatus(obj.status);
  if (!stockId || !status) return null;

  const medicineName = typeof obj.medicineName === 'string' ? obj.medicineName : '';
  const genericName = typeof obj.genericName === 'string' ? obj.genericName : '';
  const strength = typeof obj.strength === 'string' ? obj.strength : '';
  const form = typeof obj.form === 'string' ? obj.form : '';
  const updatedAt = isValidIsoTimestamp(obj.updatedAt) ? obj.updatedAt : '';

  const record: StockInventoryRecord = {
    stockId,
    pharmacyId:
      typeof obj.pharmacyId === 'string' && obj.pharmacyId.trim()
        ? obj.pharmacyId.trim()
        : fallbackPharmacyId || '',
    medicineId: typeof obj.medicineId === 'string' ? obj.medicineId : '',
    medicineName,
    genericName,
    strength,
    form,
    manufacturer: typeof obj.manufacturer === 'string' ? obj.manufacturer : undefined,
    prescriptionRequired:
      typeof obj.prescriptionRequired === 'boolean' ? obj.prescriptionRequired : undefined,
    status,
    quantity:
      typeof obj.quantity === 'number' && Number.isFinite(obj.quantity) && obj.quantity >= 0
        ? obj.quantity
        : undefined,
    price:
      typeof obj.price === 'number' && Number.isFinite(obj.price) && obj.price >= 0
        ? obj.price
        : undefined,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
    updatedAt,
    updatedBy: typeof obj.updatedBy === 'string' ? obj.updatedBy : undefined,
    updatedByName: typeof obj.updatedByName === 'string' ? obj.updatedByName : undefined,
    reconfirmationRequired:
      typeof obj.reconfirmationRequired === 'boolean' ? obj.reconfirmationRequired : undefined,
    attentionReason:
      typeof obj.attentionReason === 'string' && obj.attentionReason.trim()
        ? obj.attentionReason.trim()
        : undefined,
    reconfirmationReason:
      typeof obj.reconfirmationReason === 'string' && obj.reconfirmationReason.trim()
        ? obj.reconfirmationReason.trim()
        : undefined,
    flaggedAt: isValidIsoTimestamp(obj.flaggedAt) ? obj.flaggedAt : undefined,
  };

  if (typeof obj.isStale === 'boolean') {
    record.isStale = obj.isStale;
  }
  if (obj.freshness === 'stale' || obj.freshness === 'fresh') {
    record.freshness = obj.freshness;
    if (record.isStale === undefined) {
      record.isStale = obj.freshness === 'stale';
    }
  }

  return record;
}

function normalizeHistoryEntry(
  raw: unknown,
  fallbackPharmacyId: string,
  fallbackStockId: string
): StockHistoryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const historyId =
    typeof obj.historyId === 'string' && obj.historyId.trim()
      ? obj.historyId.trim()
      : typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : typeof obj._id === 'string' && obj._id.trim()
      ? obj._id.trim()
      : '';

  const newStatus = normalizeStockStatus(obj.newStatus);
  const changedAt = isValidIsoTimestamp(obj.changedAt)
    ? obj.changedAt
    : isValidIsoTimestamp(obj.updatedAt)
    ? obj.updatedAt
    : isValidIsoTimestamp(obj.createdAt)
    ? obj.createdAt
    : '';

  if (!historyId || !newStatus || !changedAt) return null;

  const oldStatus =
    obj.oldStatus === null || obj.oldStatus === undefined || obj.oldStatus === ''
      ? null
      : normalizeStockStatus(obj.oldStatus);

  let changedBy: string | null = null;
  let changedByName: string | null =
    typeof obj.changedByName === 'string' && obj.changedByName.trim()
      ? obj.changedByName.trim()
      : typeof obj.actorName === 'string' && obj.actorName.trim()
      ? obj.actorName.trim()
      : null;

  if (typeof obj.changedBy === 'string' && obj.changedBy.trim()) {
    changedBy = obj.changedBy.trim();
  } else if (obj.changedBy && typeof obj.changedBy === 'object') {
    const actor = obj.changedBy as Record<string, unknown>;
    if (typeof actor.userId === 'string' && actor.userId.trim()) changedBy = actor.userId.trim();
    else if (typeof actor.id === 'string' && actor.id.trim()) changedBy = actor.id.trim();
    if (!changedByName && typeof actor.name === 'string' && actor.name.trim()) {
      changedByName = actor.name.trim();
    }
  }

  return {
    historyId,
    stockId: typeof obj.stockId === 'string' ? obj.stockId : fallbackStockId,
    pharmacyId: typeof obj.pharmacyId === 'string' ? obj.pharmacyId : fallbackPharmacyId,
    medicineId: typeof obj.medicineId === 'string' ? obj.medicineId : '',
    oldStatus,
    newStatus,
    oldQuantity:
      typeof obj.oldQuantity === 'number' && Number.isFinite(obj.oldQuantity)
        ? obj.oldQuantity
        : obj.oldQuantity === null
        ? null
        : undefined,
    newQuantity:
      typeof obj.newQuantity === 'number' && Number.isFinite(obj.newQuantity)
        ? obj.newQuantity
        : obj.newQuantity === null
        ? null
        : undefined,
    changedBy,
    changedByName,
    changedAt,
  };
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    quantity?: number
  ): Promise<StockInventoryRecord> {
=======
    quantity?: number | null
  ): Promise<ServerStockUpdate> {
    const patch: UpdateInventoryMedicinePayload = { status };
    if (quantity !== undefined) {
      patch.quantity = quantity;
    }
    return this.updateInventoryItem(pharmacyId, stockId, patch);
  },

  async reconfirmStockItem(
    pharmacyId: string,
    stockId: string,
    payload: ReconfirmStockPayload
  ): Promise<ServerStockUpdate> {
    if (!payload.status || (payload.status !== 'available' && payload.status !== 'low' && payload.status !== 'out')) {
      throw new StockServiceError(
        'Please select a verified physical stock status: Available, Low, or Out of Stock.',
        'INVALID_STATUS',
        422,
        { status: 'Status must be Available, Low, or Out of Stock.' }
      );
    }

    validateNumericBounds(payload.quantity, undefined);

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      assertMockPharmacyAccess(pharmacyId, true);
      const inventory = await this.getInventory(pharmacyId);
      const index = inventory.findIndex((item) => item.stockId === stockId);
      if (index < 0) {
        throw new StockServiceError('Stock item not found in this pharmacy inventory.', 'NOT_FOUND', 404);
      }

      const existing = inventory[index];
      if (existing.pharmacyId !== pharmacyId) {
        throw new StockServiceError(
          'You are not authorized to modify another pharmacy’s inventory item.',
          'PHARMACY_OWNERSHIP_DENIED',
          403
        );
      }

      const now = new Date().toISOString();
      const actor = getMockCurrentActor();
      const resolvedQuantity =
        payload.quantity !== undefined
          ? payload.quantity === null
            ? undefined
            : payload.quantity
          : existing.quantity;

      const updatedRecord: StockInventoryRecord = {
        ...existing,
        status: payload.status,
        quantity: resolvedQuantity,
        notes: payload.notes !== undefined ? payload.notes.trim() || undefined : existing.notes,
        updatedAt: now,
        updatedBy: actor.id || existing.updatedBy,
        updatedByName: actor.name || existing.updatedByName,
        isStale: false,
        freshness: 'fresh',
        reconfirmationRequired: false,
        attentionReason: undefined,
        reconfirmationReason: undefined,
      };

      inventory[index] = updatedRecord;
      localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(inventory));

      appendMockStockHistory(pharmacyId, stockId, {
        stockId,
        pharmacyId,
        medicineId: existing.medicineId,
        oldStatus: existing.status,
        newStatus: updatedRecord.status,
        oldQuantity: existing.quantity ?? null,
        newQuantity: updatedRecord.quantity ?? null,
        changedBy: actor.id,
        changedByName: actor.name,
        changedAt: now,
      });

      return {
        ...updatedRecord,
        stockId,
        status: updatedRecord.status,
        updatedAt: now,
        isStale: false,
        freshness: 'fresh',
      };
    }

    try {
      const res = await api.post(`/owner/inventory/${stockId}/reconfirm`, {
        status: payload.status,
        quantity: payload.quantity,
        notes: payload.notes,
      });
      const updated = res.data?.data ?? res.data;
      return normalizeServerStockUpdate(updated);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        try {
          const patchRes = await api.patch(`/owner/inventory/${stockId}`, {
            status: payload.status,
            quantity: payload.quantity,
            notes: payload.notes,
          });
          const patchUpdated = patchRes.data?.data ?? patchRes.data;
          return normalizeServerStockUpdate(patchUpdated);
        } catch (patchErr: unknown) {
          throw mapAxiosStockError(patchErr, 'Failed to reconfirm stock record.');
        }
      }
      throw mapAxiosStockError(err, 'Failed to reconfirm stock record.');
    }
  },

  async getOwnerSummary(pharmacyId: string): Promise<InventorySummary> {
    if (isMockApiEnabled()) {
      const items = await this.getInventory(pharmacyId);
      return summarizeInventory(items);
    }

    try {
      const res = await api.get('/owner/summary');
      const data = res.data?.data ?? res.data;
      if (data && typeof data === 'object' && typeof data.total === 'number') {
        return {
          total: data.total ?? 0,
          available: data.available ?? 0,
          low: data.low ?? 0,
          out: data.out ?? 0,
          unverified: data.unverified ?? 0,
          stale: data.stale ?? 0,
          needsAttention: data.needsAttention ?? 0,
          freshAvailable: data.freshAvailable ?? Math.max(0, (data.available ?? 0) - (data.stale ?? 0)),
          reconfirmationRequired: data.reconfirmationRequired ?? data.unverified ?? 0,
        };
      }
      const items = await this.getInventory(pharmacyId);
      return summarizeInventory(items);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 501)) {
        const items = await this.getInventory(pharmacyId);
        return summarizeInventory(items);
      }
      throw mapAxiosStockError(err, 'Failed to load owner dashboard summary.');
    }
  },

  async getQualityAttentionItems(
    pharmacyId: string,
    filterType: AttentionFilterType = 'all'
  ): Promise<StockInventoryRecord[]> {
    const items = await this.getInventory(pharmacyId);
    return filterAttentionInventory(items, filterType);
  },

  async seedDemoInventory(pharmacyId: string): Promise<StockInventoryRecord[]> {
    if (!isMockApiEnabled()) {
      throw new StockServiceError('Demo seeding is only supported in development mock mode.', 'MOCK_ONLY', 400);
    }
    assertMockPharmacyAccess(pharmacyId, true);

    const now = Date.now();
    const demoItems: StockInventoryRecord[] = [
      {
        stockId: `stk_demo_1_${pharmacyId}`,
        pharmacyId,
        medicineId: 'med_demo_1',
        medicineName: 'Napa Extra',
        genericName: 'Paracetamol + Caffeine',
        strength: '500 mg + 65 mg',
        form: 'Tablet',
        manufacturer: 'Beximco Pharmaceuticals Ltd.',
        prescriptionRequired: false,
        status: 'available',
        quantity: 120,
        price: 3.5,
        updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
        isStale: false,
        freshness: 'fresh',
      },
      {
        stockId: `stk_demo_2_${pharmacyId}`,
        pharmacyId,
        medicineId: 'med_demo_2',
        medicineName: 'Seclo',
        genericName: 'Omeprazole',
        strength: '20 mg',
        form: 'Capsule',
        manufacturer: 'Square Pharmaceuticals Ltd.',
        prescriptionRequired: false,
        status: 'low',
        quantity: 6,
        price: 7.0,
        updatedAt: new Date(now - 28 * 60 * 60 * 1000).toISOString(),
        isStale: true,
        freshness: 'stale',
        attentionReason: 'Availability report is stale (last updated 28h ago). Reconfirm stock to ensure patient accuracy.',
      },
      {
        stockId: `stk_demo_3_${pharmacyId}`,
        pharmacyId,
        medicineId: 'med_demo_3',
        medicineName: 'Amoxil',
        genericName: 'Amoxicillin',
        strength: '500 mg',
        form: 'Capsule',
        manufacturer: 'GlaxoSmithKline Bangladesh',
        prescriptionRequired: true,
        status: 'out',
        quantity: 0,
        price: 12.0,
        updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        isStale: false,
        freshness: 'fresh',
      },
      {
        stockId: `stk_demo_4_${pharmacyId}`,
        pharmacyId,
        medicineId: 'med_demo_4',
        medicineName: 'Monas 10',
        genericName: 'Montelukast',
        strength: '10 mg',
        form: 'Tablet',
        manufacturer: 'Acme Laboratories Ltd.',
        prescriptionRequired: true,
        status: 'unverified',
        quantity: 25,
        price: 16.0,
        updatedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        isStale: true,
        freshness: 'stale',
        attentionReason: 'Customer report: Patient reported stockout on shelf. Please inspect stock and reconfirm.',
      },
      {
        stockId: `stk_demo_5_${pharmacyId}`,
        pharmacyId,
        medicineId: 'med_demo_5',
        medicineName: 'Ciprocin',
        genericName: 'Ciprofloxacin',
        strength: '500 mg',
        form: 'Tablet',
        manufacturer: 'Square Pharmaceuticals Ltd.',
        prescriptionRequired: true,
        status: 'available',
        quantity: 45,
        price: 15.0,
        updatedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
        isStale: false,
        freshness: 'fresh',
        reconfirmationRequired: true,
        reconfirmationReason: 'Verification audit: DGDA batch inspection notice requires physical shelf count confirmation.',
      },
    ];

    localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(demoItems));
    return demoItems;
  },

  async getStockHistory(
    pharmacyId: string,
    stockId: string,
    options?: { limit?: number; cursor?: string | null }
  ): Promise<StockHistoryResponse> {
>>>>>>> Stashed changes
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

