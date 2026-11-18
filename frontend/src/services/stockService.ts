// src/services/stockService.ts
import { api } from './api';
import axios from 'axios';
import type { PharmacyApplicationResponse, StockStatus } from '../types/pharmacy';
import type {
  Medicine,
  OwnerSummary,
  ReconfirmStockPayload,
  StockHistoryRecord,
  StockHistoryResponse,
  StockInventoryRecord,
  StockInventoryQuery,
  AddInventoryMedicinePayload,
  UpdateInventoryMedicinePayload,
} from '../types/medicine';
import { isMockApiEnabled } from './pharmacyService';
import { getStoredCatalogue } from './adminService';
import {
  isReportStale,
  normalizeStockStatus,
} from '../features/pharmacy/inventoryUtils';

const MOCK_STOCK_STORAGE_KEY = 'medifind_mock_stock_inventory';
const MOCK_HISTORY_STORAGE_KEY = 'medifind_mock_stock_history';
const DEFAULT_MOCK_APP_KEY = 'medifind_mock_pharmacy_application';

export type ServerStockUpdate = Partial<StockInventoryRecord> & {
  stockId: string;
  status: StockStatus;
  updatedAt: string;
};

export class StockServiceError extends Error {
  code?: string;
  status?: number;
  fields?: Record<string, string>;

  constructor(
    message: string,
    code?: string,
    status?: number,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'StockServiceError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function mapAxiosStockError(err: unknown, fallbackMessage: string): StockServiceError {
  if (err instanceof StockServiceError) return err;

  if (axios.isAxiosError(err)) {
    const httpStatus = err.response?.status;
    const responseData = err.response?.data as Record<string, unknown> | undefined;
    const errorPayload =
      responseData?.error && typeof responseData.error === 'object'
        ? (responseData.error as Record<string, unknown>)
        : undefined;
    const serverMessage =
      typeof errorPayload?.message === 'string' && errorPayload.message.trim()
        ? errorPayload.message.trim()
        : typeof responseData?.message === 'string' && responseData.message.trim()
        ? responseData.message.trim()
        : undefined;
    const code = typeof errorPayload?.code === 'string' ? errorPayload.code : undefined;
    const fields =
      errorPayload?.fields && typeof errorPayload.fields === 'object'
        ? (errorPayload.fields as Record<string, string>)
        : undefined;

    if (!err.response) {
      if (err.code === 'ERR_CANCELED') {
        return new StockServiceError('Request was cancelled.', 'CANCELED', 0);
      }
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return new StockServiceError(
          'The request timed out while waiting for the MediFind server. Your input was preserved — please try again.',
          'TIMEOUT',
          0
        );
      }
      return new StockServiceError(
        'Could not reach the MediFind server. Check your connection and try again.',
        'NETWORK_ERROR',
        0
      );
    }

    if (httpStatus === 401) {
      return new StockServiceError(
        serverMessage || 'Your session has expired. Please sign in again.',
        code || 'UNAUTHORIZED',
        401,
        fields
      );
    }
    if (httpStatus === 403) {
      return new StockServiceError(
        serverMessage ||
          'You do not have permission to access or update this pharmacy inventory. Verify your pharmacy status or account permissions.',
        code || 'FORBIDDEN',
        403,
        fields
      );
    }
    if (httpStatus === 404) {
      return new StockServiceError(
        serverMessage || 'The requested inventory item or pharmacy could not be found.',
        code || 'NOT_FOUND',
        404,
        fields
      );
    }
    if (httpStatus === 409) {
      return new StockServiceError(
        serverMessage ||
          'This item conflicts with an existing record or was updated elsewhere. Refresh and try again.',
        code || 'CONFLICT',
        409,
        fields
      );
    }
    if (httpStatus === 400 || httpStatus === 422) {
      return new StockServiceError(
        serverMessage || 'Please review the highlighted fields and try again.',
        code || 'VALIDATION_ERROR',
        httpStatus,
        fields
      );
    }
    if (httpStatus === 429) {
      return new StockServiceError(
        serverMessage || 'Too many requests in a short period. Please wait a moment and try again.',
        code || 'RATE_LIMITED',
        429,
        fields
      );
    }

    return new StockServiceError(
      serverMessage || fallbackMessage,
      code || 'SERVER_ERROR',
      httpStatus,
      fields
    );
  }

  if (err instanceof Error) {
    return new StockServiceError(err.message);
  }

  return new StockServiceError(fallbackMessage);
}

function getMockOwnerApplication(): PharmacyApplicationResponse | null {
  try {
    let storageKey = DEFAULT_MOCK_APP_KEY;
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser && typeof parsedUser.id === 'string' && parsedUser.id.trim()) {
        storageKey = `${DEFAULT_MOCK_APP_KEY}_${parsedUser.id.trim()}`;
      }
    }
    const rawApp =
      localStorage.getItem(storageKey) ||
      (storageKey !== DEFAULT_MOCK_APP_KEY ? localStorage.getItem(DEFAULT_MOCK_APP_KEY) : null);
    if (!rawApp) return null;
    const parsedApp = JSON.parse(rawApp) as PharmacyApplicationResponse;
    return parsedApp && typeof parsedApp === 'object' ? parsedApp : null;
  } catch {
    return null;
  }
}

/**
 * Mirrors backend ownership and verification authorization boundaries in local mock mode.
 */
function assertMockPharmacyAccess(pharmacyId: string, requireVerifiedForWrite: boolean): void {
  if (!pharmacyId || !pharmacyId.trim()) {
    throw new StockServiceError(
      'No authorized pharmacy context found for this account.',
      'PHARMACY_CONTEXT_MISSING',
      403
    );
  }

  const app = getMockOwnerApplication();
  if (!app) {
    return;
  }

  if (app.pharmacyId && app.pharmacyId !== pharmacyId) {
    throw new StockServiceError(
      'You are not authorized to access or modify another pharmacy’s inventory.',
      'PHARMACY_OWNERSHIP_DENIED',
      403
    );
  }

  if (requireVerifiedForWrite && app.status !== 'verified') {
    throw new StockServiceError(
      `Inventory updates are disabled while pharmacy verification status is "${app.status}".`,
      'PHARMACY_NOT_VERIFIED',
      403
    );
  }
}

function validateNumericBounds(quantity?: number | null, price?: number | null): void {
  const fields: Record<string, string> = {};

  if (quantity !== undefined && quantity !== null) {
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
      fields.quantity = 'Quantity must be a whole number of 0 or greater.';
    }
  }

  if (price !== undefined && price !== null) {
    if (!Number.isFinite(price) || price < 0) {
      fields.price = 'Price must be 0 or greater.';
    }
  }

  if (Object.keys(fields).length > 0) {
    const firstMessage = Object.values(fields)[0];
    throw new StockServiceError(firstMessage, 'VALIDATION_ERROR', 422, fields);
  }
}

function validateOwnerWritableStatus(status?: StockStatus): void {
  if (status === undefined) return;
  if (status !== 'available' && status !== 'low' && status !== 'out') {
    throw new StockServiceError(
      'Status must be Available, Low, or Out of Stock.',
      'INVALID_STATUS',
      422,
      { status: 'Select Available, Low, or Out of Stock.' }
    );
  }
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function getMockCurrentActor(): { id: string | null; name: string | null } {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return { id: null, name: null };
    const parsed = JSON.parse(rawUser) as { id?: unknown; name?: unknown };
    return {
      id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : null,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null,
    };
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
      : typeof obj._id === 'string' && obj._id.trim()
      ? obj._id.trim()
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
  fallbackPharmacyId?: string,
  fallbackCatalogue?: Partial<AddInventoryMedicinePayload>
): StockInventoryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const stockId =
    typeof obj.stockId === 'string' && obj.stockId.trim()
      ? obj.stockId.trim()
      : typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : typeof obj._id === 'string' && obj._id.trim()
      ? obj._id.trim()
      : '';
  const status = normalizeStockStatus(obj.status);
  if (!stockId || !status) return null;

  const nestedMed =
    obj.medicine && typeof obj.medicine === 'object'
      ? (obj.medicine as Record<string, unknown>)
      : undefined;

  const medicineId =
    typeof obj.medicineId === 'string' && obj.medicineId.trim()
      ? obj.medicineId.trim()
      : typeof nestedMed?.id === 'string' && nestedMed.id.trim()
      ? nestedMed.id.trim()
      : typeof nestedMed?._id === 'string' && nestedMed._id.trim()
      ? nestedMed._id.trim()
      : fallbackCatalogue?.medicineId || '';

  const medicineName =
    typeof obj.medicineName === 'string' && obj.medicineName.trim()
      ? obj.medicineName.trim()
      : typeof nestedMed?.name === 'string' && nestedMed.name.trim()
      ? nestedMed.name.trim()
      : typeof nestedMed?.brandName === 'string' && nestedMed.brandName.trim()
      ? nestedMed.brandName.trim()
      : fallbackCatalogue?.medicineName?.trim() || '';

  const genericName =
    typeof obj.genericName === 'string' && obj.genericName.trim()
      ? obj.genericName.trim()
      : typeof nestedMed?.genericName === 'string' && nestedMed.genericName.trim()
      ? nestedMed.genericName.trim()
      : fallbackCatalogue?.genericName?.trim() || '';

  const strength =
    typeof obj.strength === 'string' && obj.strength.trim()
      ? obj.strength.trim()
      : typeof nestedMed?.strength === 'string' && nestedMed.strength.trim()
      ? nestedMed.strength.trim()
      : fallbackCatalogue?.strength?.trim() || '';

  const form =
    typeof obj.form === 'string' && obj.form.trim()
      ? obj.form.trim()
      : typeof nestedMed?.form === 'string' && nestedMed.form.trim()
      ? nestedMed.form.trim()
      : fallbackCatalogue?.form?.trim() || '';

  const manufacturer =
    typeof obj.manufacturer === 'string' && obj.manufacturer.trim()
      ? obj.manufacturer.trim()
      : typeof nestedMed?.manufacturer === 'string' && nestedMed.manufacturer.trim()
      ? nestedMed.manufacturer.trim()
      : fallbackCatalogue?.manufacturer?.trim() || undefined;

  const prescriptionRequired =
    typeof obj.prescriptionRequired === 'boolean'
      ? obj.prescriptionRequired
      : typeof nestedMed?.prescriptionRequired === 'boolean'
      ? nestedMed.prescriptionRequired
      : fallbackCatalogue?.prescriptionRequired;

  const updatedAt = isValidIsoTimestamp(obj.updatedAt) ? obj.updatedAt : '';

  const record: StockInventoryRecord = {
    stockId,
    pharmacyId:
      typeof obj.pharmacyId === 'string' && obj.pharmacyId.trim()
        ? obj.pharmacyId.trim()
        : fallbackPharmacyId || '',
    medicineId,
    medicineName,
    genericName,
    strength,
    form,
    manufacturer,
    prescriptionRequired,
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

  const newStatus = normalizeStockStatus(obj.newStatus ?? obj.toStatus ?? obj.status);
  const changedAt = isValidIsoTimestamp(obj.changedAt)
    ? obj.changedAt
    : isValidIsoTimestamp(obj.timestamp)
    ? obj.timestamp
    : isValidIsoTimestamp(obj.updatedAt)
    ? obj.updatedAt
    : isValidIsoTimestamp(obj.createdAt)
    ? obj.createdAt
    : '';

  if (!historyId || !newStatus || !changedAt) return null;

  const rawOldStatus = obj.oldStatus ?? obj.previousStatus ?? obj.fromStatus;
  const oldStatus =
    rawOldStatus === null || rawOldStatus === undefined || rawOldStatus === ''
      ? null
      : normalizeStockStatus(rawOldStatus);

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
}

export const stockService = {
  async getInventory(
    pharmacyId: string,
    query?: StockInventoryQuery
  ): Promise<StockInventoryRecord[]> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      assertMockPharmacyAccess(pharmacyId, false);
      const raw = localStorage.getItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((item) => normalizeServerInventoryRecord(item, pharmacyId))
          .filter(
            (item): item is StockInventoryRecord =>
              item !== null && item.pharmacyId === pharmacyId
          )
          .map((item) => ({
            ...item,
            isStale: item.isStale === true ? true : isReportStale(item.updatedAt),
          }));
      } catch {
        throw new StockServiceError(
          'Stored mock inventory data is unreadable.',
          'INVALID_STORAGE',
          500
        );
      }
    }

    try {
      const params: Record<string, string> = {};
      if (query?.q?.trim()) params.q = query.q.trim();
      if (query?.status) params.status = query.status;
      if (query?.freshness) params.freshness = query.freshness;
      if (query?.sort) params.sort = query.sort;

      const res = await api.get('/owner/inventory', {
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      const data = res.data?.data ?? res.data;
      if (!Array.isArray(data)) {
        throw new StockServiceError(
          'Server returned an unexpected inventory format.',
          'INVALID_RESPONSE',
          502
        );
      }
      return data
        .map((item) => normalizeServerInventoryRecord(item, pharmacyId))
        .filter((item): item is StockInventoryRecord => Boolean(item));
    } catch (err: unknown) {
      throw mapAxiosStockError(err, 'Failed to load pharmacy inventory.');
    }
  },

  async getInventoryItem(pharmacyId: string, stockId: string): Promise<StockInventoryRecord> {
    if (isMockApiEnabled()) {
      const items = await this.getInventory(pharmacyId);
      const found = items.find((item) => item.stockId === stockId);
      if (!found) {
        throw new StockServiceError('Stock item not found in this pharmacy inventory.', 'NOT_FOUND', 404);
      }
      return found;
    }

    try {
      const res = await api.get(`/owner/inventory/${stockId}`);
      const raw = res.data?.data ?? res.data;
      const normalized = normalizeServerInventoryRecord(raw, pharmacyId);
      if (!normalized) {
        throw new StockServiceError(
          'Server returned an unexpected stock item format.',
          'INVALID_RESPONSE',
          502
        );
      }
      return normalized;
    } catch (err: unknown) {
      throw mapAxiosStockError(err, 'Failed to load stock item.');
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
      throw new StockServiceError(
        'Medicine name, generic name, strength, and dosage form are required.',
        'VALIDATION_ERROR',
        422
      );
    }

    validateOwnerWritableStatus(payload.status);
    validateNumericBounds(payload.quantity, payload.price);

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      assertMockPharmacyAccess(pharmacyId, true);
      const inventory = await this.getInventory(pharmacyId);

      const isDuplicate = inventory.some(
        (item) =>
          (payload.medicineId && item.medicineId === payload.medicineId) ||
          (item.medicineName.trim().toLowerCase() === medicineName.toLowerCase() &&
            item.strength.trim().toLowerCase() === strength.toLowerCase() &&
            item.form.trim().toLowerCase() === form.toLowerCase())
      );

      if (isDuplicate) {
        throw new StockServiceError(
          'This medicine is already in your pharmacy inventory. Update its existing row instead.',
          'DUPLICATE_INVENTORY_ITEM',
          409
        );
      }

      const now = new Date().toISOString();
      const actor = getMockCurrentActor();
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
        updatedBy: actor.id || undefined,
        updatedByName: actor.name || undefined,
      };

      const updated = [newRecord, ...inventory];
      localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(updated));
      appendMockStockHistory(pharmacyId, newRecord.stockId, {
        stockId: newRecord.stockId,
        pharmacyId,
        medicineId: newRecord.medicineId,
        oldStatus: null,
        newStatus: newRecord.status,
        oldQuantity: null,
        newQuantity: newRecord.quantity ?? null,
        changedBy: actor.id,
        changedByName: actor.name,
        changedAt: now,
      });
      return { ...newRecord, isStale: false };
    }

    if (!payload.medicineId || !payload.medicineId.trim()) {
      throw new StockServiceError(
        'Select an active medicine from the catalogue before adding it to inventory.',
        'MEDICINE_ID_REQUIRED',
        422,
        { medicineId: 'A curated catalogue medicine is required.' }
      );
    }

    try {
      const requestBody: Record<string, unknown> = {
        medicineId: payload.medicineId,
        status: payload.status,
      };
      if (payload.quantity !== undefined) requestBody.quantity = payload.quantity;
      if (payload.price !== undefined) requestBody.price = payload.price;
      if (payload.notes?.trim()) requestBody.notes = payload.notes.trim();

      const res = await api.post('/owner/inventory', requestBody);
      const rawCreated = res.data?.data ?? res.data;
      const normalized = normalizeServerInventoryRecord(rawCreated, pharmacyId, payload);
      if (!normalized || !normalized.updatedAt) {
        throw new StockServiceError(
          'Server returned an invalid confirmation when adding inventory.',
          'INVALID_RESPONSE',
          502
        );
      }
      return normalized;
    } catch (err: unknown) {
      throw mapAxiosStockError(err, 'Failed to add medicine to inventory.');
    }
  },

  async updateInventoryItem(
    pharmacyId: string,
    stockId: string,
    payload: UpdateInventoryMedicinePayload
  ): Promise<ServerStockUpdate> {
    if (payload.medicineName !== undefined && !payload.medicineName.trim()) {
      throw new StockServiceError('Medicine name cannot be empty.', 'VALIDATION_ERROR', 422, {
        medicineName: 'Medicine name cannot be empty.',
      });
    }
    if (payload.genericName !== undefined && !payload.genericName.trim()) {
      throw new StockServiceError('Generic name cannot be empty.', 'VALIDATION_ERROR', 422, {
        genericName: 'Generic name cannot be empty.',
      });
    }
    if (payload.strength !== undefined && !payload.strength.trim()) {
      throw new StockServiceError('Strength cannot be empty.', 'VALIDATION_ERROR', 422, {
        strength: 'Strength cannot be empty.',
      });
    }
    if (payload.form !== undefined && !payload.form.trim()) {
      throw new StockServiceError('Dosage form cannot be empty.', 'VALIDATION_ERROR', 422, {
        form: 'Dosage form cannot be empty.',
      });
    }

    validateOwnerWritableStatus(payload.status);
    validateNumericBounds(payload.quantity, payload.price);

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

      const nextQuantity =
        'quantity' in payload
          ? payload.quantity === null
            ? undefined
            : payload.quantity
          : existing.quantity;

      const nextPrice =
        'price' in payload
          ? payload.price === null
            ? undefined
            : payload.price
          : existing.price;

      const now = new Date().toISOString();
      const actor = getMockCurrentActor();
      const nextStatus = payload.status !== undefined ? payload.status : existing.status;

      const storedRecord: StockInventoryRecord = {
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
        status: nextStatus,
        quantity: nextQuantity,
        price: nextPrice,
        notes: payload.notes !== undefined ? payload.notes.trim() || undefined : existing.notes,
        updatedAt: now,
        updatedBy: actor.id || existing.updatedBy,
        updatedByName: actor.name || existing.updatedByName,
      };
      delete storedRecord.isStale;
      delete storedRecord.freshness;

      inventory[index] = storedRecord;
      localStorage.setItem(`${MOCK_STOCK_STORAGE_KEY}_${pharmacyId}`, JSON.stringify(inventory));
      appendMockStockHistory(pharmacyId, stockId, {
        stockId,
        pharmacyId,
        medicineId: existing.medicineId,
        oldStatus: existing.status,
        newStatus: storedRecord.status,
        oldQuantity: existing.quantity ?? null,
        newQuantity: storedRecord.quantity ?? null,
        changedBy: actor.id,
        changedByName: actor.name,
        changedAt: now,
      });
      return { ...storedRecord, isStale: false };
    }

    try {
      const res = await api.patch(`/owner/inventory/${stockId}`, payload);
      const updated = res.data?.data ?? res.data;
      return normalizeServerStockUpdate(updated);
    } catch (err: unknown) {
      throw mapAxiosStockError(err, 'Failed to update stock record.');
    }
  },

  async updateStockStatus(
    pharmacyId: string,
    stockId: string,
    status: StockStatus,
    quantity?: number | null
  ): Promise<ServerStockUpdate> {
    const patch: UpdateInventoryMedicinePayload = { status };
    if (quantity !== undefined) {
      patch.quantity = quantity;
    }
    return this.updateInventoryItem(pharmacyId, stockId, patch);
  },

  /**
   * Reconfirms availability after a physical stock check.
   * Endpoint: POST /owner/inventory/{stockId}/reconfirm
   * Falls back to PATCH /owner/inventory/{stockId} ONLY when /reconfirm returns 404/405/501
   * and a valid writable status is supplied.
   */
  async reconfirmStockItem(
    pharmacyId: string,
    stockId: string,
    payload?: ReconfirmStockPayload
  ): Promise<ServerStockUpdate> {
    if (payload?.status !== undefined) {
      validateOwnerWritableStatus(payload.status);
    }
    if (payload?.quantity !== undefined) {
      validateNumericBounds(payload.quantity, undefined);
    }

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      assertMockPharmacyAccess(pharmacyId, true);
      const inventory = await this.getInventory(pharmacyId);
      const index = inventory.findIndex((item) => item.stockId === stockId);
      if (index < 0) {
        throw new StockServiceError('Stock item not found in this pharmacy inventory.', 'NOT_FOUND', 404);
      }
      const existing = inventory[index];
      const nextStatus: StockStatus =
        payload?.status ??
        (existing.status === 'available' || existing.status === 'low' || existing.status === 'out'
          ? existing.status
          : 'available');
      const nextQuantity =
        payload && 'quantity' in payload
          ? payload.quantity === null
            ? undefined
            : payload.quantity
          : existing.quantity;

      const now = new Date().toISOString();
      const actor = getMockCurrentActor();
      const updatedRecord: StockInventoryRecord = {
        ...existing,
        status: nextStatus,
        quantity: nextQuantity,
        updatedAt: now,
        updatedBy: actor.id || existing.updatedBy,
        updatedByName: actor.name || existing.updatedByName,
      };
      delete updatedRecord.isStale;
      delete updatedRecord.freshness;

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
      return { ...updatedRecord, isStale: false, freshness: 'fresh' };
    }

    try {
      const body: Record<string, unknown> = {};
      if (payload?.status !== undefined) body.status = payload.status;
      if (payload && 'quantity' in payload) body.quantity = payload.quantity;

      const res = await api.post(`/owner/inventory/${stockId}/reconfirm`, body);
      const updated = res.data?.data ?? res.data;
      return normalizeServerStockUpdate(updated);
    } catch (err: unknown) {
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 404 || err.response?.status === 405 || err.response?.status === 501) &&
        payload?.status
      ) {
        return this.updateStockStatus(pharmacyId, stockId, payload.status, payload.quantity);
      }
      throw mapAxiosStockError(err, 'Failed to reconfirm stock availability.');
    }
  },

  /**
   * Reads optional owner operational summary / attention items if exposed by backend.
   * Endpoint: GET /owner/summary (returns null on 404/501 without fabricating counts)
   */
  async getOwnerSummary(pharmacyId: string): Promise<OwnerSummary | null> {
    if (isMockApiEnabled()) {
      return null;
    }

    try {
      const res = await api.get('/owner/summary');
      const raw = res.data?.data ?? res.data;
      if (!raw || typeof raw !== 'object') return null;
      const obj = raw as Record<string, unknown>;

      const rawAttention = Array.isArray(obj.attentionItems)
        ? obj.attentionItems
        : Array.isArray(obj.staleItems)
        ? obj.staleItems
        : undefined;

      const attentionItems = rawAttention
        ? rawAttention
            .map((entry) => normalizeServerInventoryRecord(entry, pharmacyId))
            .filter((entry): entry is StockInventoryRecord => Boolean(entry))
        : undefined;

      return {
        totalInventory: typeof obj.totalInventory === 'number' ? obj.totalInventory : undefined,
        availableCount: typeof obj.availableCount === 'number' ? obj.availableCount : undefined,
        lowCount: typeof obj.lowCount === 'number' ? obj.lowCount : undefined,
        outCount: typeof obj.outCount === 'number' ? obj.outCount : undefined,
        staleCount: typeof obj.staleCount === 'number' ? obj.staleCount : undefined,
        unverifiedCount: typeof obj.unverifiedCount === 'number' ? obj.unverifiedCount : undefined,
        attentionItems,
      };
    } catch (err: unknown) {
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 404 || err.response?.status === 405 || err.response?.status === 501)
      ) {
        return null;
      }
      throw mapAxiosStockError(err, 'Failed to load owner workspace summary.');
    }
  },

  async getStockHistory(
    pharmacyId: string,
    stockId: string,
    options?: { limit?: number; cursor?: string | null }
  ): Promise<StockHistoryResponse> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      assertMockPharmacyAccess(pharmacyId, false);
      const raw = localStorage.getItem(getMockHistoryStorageKey(pharmacyId, stockId));
      if (!raw) {
        return { data: [], page: { limit: options?.limit ?? 20, nextCursor: null } };
      }
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          return { data: [], page: { limit: options?.limit ?? 20, nextCursor: null } };
        }
        const normalized = parsed
          .map((entry) => normalizeHistoryEntry(entry, pharmacyId, stockId))
          .filter((entry): entry is StockHistoryRecord => Boolean(entry));
        return {
          data: normalized,
          page: { limit: options?.limit ?? 20, nextCursor: null },
        };
      } catch {
        throw new StockServiceError(
          'Stored mock stock history is unreadable.',
          'INVALID_STORAGE',
          500
        );
      }
    }

    try {
      const params: Record<string, string | number> = {};
      if (options?.limit) params.limit = options.limit;
      if (options?.cursor) params.cursor = options.cursor;

      const res = await api.get(`/owner/inventory/${stockId}/history`, {
        params: Object.keys(params).length > 0 ? params : undefined,
      });

      const rawList = Array.isArray(res.data) ? res.data : res.data?.data;
      if (!Array.isArray(rawList)) {
        throw new StockServiceError(
          'Server returned an unexpected stock history format.',
          'INVALID_RESPONSE',
          502
        );
      }

      const normalized = rawList
        .map((entry) => normalizeHistoryEntry(entry, pharmacyId, stockId))
        .filter((entry): entry is StockHistoryRecord => Boolean(entry));

      const pageRaw = res.data?.page;
      const page =
        pageRaw && typeof pageRaw === 'object'
          ? {
              limit:
                typeof pageRaw.limit === 'number'
                  ? pageRaw.limit
                  : options?.limit ?? normalized.length,
              nextCursor:
                typeof pageRaw.nextCursor === 'string' && pageRaw.nextCursor.trim()
                  ? pageRaw.nextCursor
                  : null,
            }
          : undefined;

      return { data: normalized, page };
    } catch (err: unknown) {
      throw mapAxiosStockError(err, 'Failed to load stock update history.');
    }
  },

  async searchCatalogue(
    query: string,
    formFilter?: string,
    signal?: AbortSignal
  ): Promise<Medicine[]> {
    const q = query.trim().toLowerCase();
    const formNorm = formFilter?.trim().toLowerCase() || '';

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const active = getStoredCatalogue().filter((med) => med.active);
      return active.filter((med) => {
        if (formNorm && med.form.trim().toLowerCase() !== formNorm) {
          return false;
        }
        if (!q) return true;
        return (
          med.name.toLowerCase().includes(q) ||
          med.genericName.toLowerCase().includes(q) ||
          med.strength.toLowerCase().includes(q) ||
          (med.manufacturer ? med.manufacturer.toLowerCase().includes(q) : false)
        );
      });
    }

    try {
      const params: Record<string, string> = {};
      if (q) params.q = query.trim();
      if (formFilter?.trim()) params.form = formFilter.trim();

      const res = await api.get('/medicines', {
        params: Object.keys(params).length > 0 ? params : undefined,
        signal,
      });
      const data = res.data?.data ?? res.data;
      if (!Array.isArray(data)) {
        throw new StockServiceError(
          'Server returned an unexpected medicine catalogue format.',
          'INVALID_RESPONSE',
          502
        );
      }

      const normalized: Medicine[] = [];
      for (const rawMed of data) {
        if (!rawMed || typeof rawMed !== 'object') continue;
        const obj = rawMed as Record<string, unknown>;
        if (obj.active === false || obj.isActive === false) continue;

        const id =
          typeof obj.id === 'string' && obj.id.trim()
            ? obj.id.trim()
            : typeof obj._id === 'string' && obj._id.trim()
            ? obj._id.trim()
            : typeof obj.medicineId === 'string' && obj.medicineId.trim()
            ? obj.medicineId.trim()
            : '';
        const name =
          typeof obj.name === 'string' && obj.name.trim()
            ? obj.name.trim()
            : typeof obj.brandName === 'string' && obj.brandName.trim()
            ? obj.brandName.trim()
            : '';
        const genericName =
          typeof obj.genericName === 'string' && obj.genericName.trim()
            ? obj.genericName.trim()
            : '';
        const strength =
          typeof obj.strength === 'string' && obj.strength.trim() ? obj.strength.trim() : '';
        const form =
          typeof obj.form === 'string' && obj.form.trim()
            ? obj.form.trim()
            : typeof obj.dosageForm === 'string' && obj.dosageForm.trim()
            ? obj.dosageForm.trim()
            : '';

        if (!id || !name) continue;
        normalized.push({
          id,
          name,
          genericName,
          form,
          strength,
          manufacturer:
            typeof obj.manufacturer === 'string' && obj.manufacturer.trim()
              ? obj.manufacturer.trim()
              : undefined,
          description:
            typeof obj.description === 'string' && obj.description.trim()
              ? obj.description.trim()
              : undefined,
          prescriptionRequired:
            typeof obj.prescriptionRequired === 'boolean' ? obj.prescriptionRequired : undefined,
          active: true,
        });
      }

      return normalized;
    } catch (err: unknown) {
      throw mapAxiosStockError(err, 'Failed to search medicine catalogue.');
    }
  },
};
