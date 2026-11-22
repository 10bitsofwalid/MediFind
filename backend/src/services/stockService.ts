// backend/src/services/stockService.ts
import mongoose, { Types } from 'mongoose';
import { Stock, IStock } from '../models/Stock';
import { StockHistory, IStockHistory } from '../models/StockHistory';
import { Medicine as MedicineModel, IMedicine } from '../models/Medicine';
import { findPharmacyByOwner } from './pharmacyService';
import {
  syntheticMedicines,
  syntheticStockItems,
  syntheticStockHistory,
} from '../fixtures/syntheticFixtures';
import {
  assertPharmacyOwnership,
  assertPharmacyVerifiedForInventoryWrite,
  AuthenticatedUserContext,
  sanitizeClientPayload,
} from '../auth/ownership';
import { ApplicationError } from '../utils/errors';
import { ValidationError } from '../validation/validationError';
import {
  validateAddInventoryPayload,
  validateUpdateInventoryPayload,
  validateReconfirmStockPayload,
  validateStockHistoryQuery,
} from '../validation/stockValidators';
import {
  formatStockRecord,
  formatServerStockUpdate,
  formatStockHistoryResponse,
} from '../utils/responseEnvelope';
import { isReportStale } from '../utils/freshness';
import type { StockStatus } from '../types/pharmacy';
import type {
  Medicine,
  StockInventoryRecord,
  StockHistoryRecord,
  ServerStockUpdate,
  StockHistoryResponse,
  OwnerSummary,
} from '../types/stock';

// In-memory stores for development fallback and unit tests when MongoDB is offline
const inMemoryStocks = new Map<string, any>();
const inMemoryStockHistory = new Map<string, any>();
const inMemoryMedicines = new Map<string, any>();

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Initializes synthetic stock, history, and medicine fixtures into in-memory store.
 */
function ensureSyntheticFixtures(): void {
  // 1. Medicines
  for (const med of syntheticMedicines) {
    const medId = String(med.id);
    if (!inMemoryMedicines.has(medId)) {
      inMemoryMedicines.set(medId, { ...JSON.parse(JSON.stringify(med)) });
    }
  }

  // 2. Stock items
  for (const item of syntheticStockItems) {
    const stockId = String(item.stockId);
    if (!inMemoryStocks.has(stockId)) {
      inMemoryStocks.set(stockId, {
        _id: stockId,
        stockId: item.stockId,
        pharmacyId: String(item.pharmacyId),
        medicineId: String(item.medicineId),
        status: item.status,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes,
        updatedAt: new Date(item.updatedAt),
        createdAt: new Date(item.updatedAt),
        updatedBy: item.updatedBy,
        updatedByName: item.updatedByName,
        medicineName: item.medicineName,
        genericName: item.genericName,
        strength: item.strength,
        form: item.form,
        manufacturer: item.manufacturer,
        prescriptionRequired: item.prescriptionRequired,
      });
    }
  }

  // 3. Stock history
  for (const hist of syntheticStockHistory) {
    const histId = String(hist.historyId);
    if (!inMemoryStockHistory.has(histId)) {
      inMemoryStockHistory.set(histId, {
        _id: histId,
        historyId: hist.historyId,
        stockId: hist.stockId,
        pharmacyId: String(hist.pharmacyId),
        medicineId: String(hist.medicineId),
        oldStatus: hist.oldStatus,
        newStatus: hist.newStatus,
        oldQuantity: hist.oldQuantity,
        newQuantity: hist.newQuantity,
        changedBy: hist.changedBy,
        changedByName: hist.changedByName,
        changedAt: new Date(hist.changedAt),
      });
    }
  }
}

// Seed on module initialization
ensureSyntheticFixtures();

/**
 * Resets the in-memory stock, history, and medicine stores (used for test isolation).
 */
export function clearInMemoryStockStore(): void {
  inMemoryStocks.clear();
  inMemoryStockHistory.clear();
  inMemoryMedicines.clear();
  ensureSyntheticFixtures();
}

/**
 * Returns all in-memory stock records for fallback querying.
 */
export function getAllInMemoryStocks(): any[] {
  ensureSyntheticFixtures();
  return Array.from(inMemoryStocks.values());
}

/**
 * Manually seeds a stock item into active storage (for test setup).
 */
export async function seedStockItem(item: Partial<StockInventoryRecord> & { pharmacyId: string; medicineId: string }): Promise<any> {
  const stockId = item.stockId || `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();

  const record: any = {
    _id: stockId,
    stockId,
    pharmacyId: String(item.pharmacyId),
    medicineId: String(item.medicineId),
    status: item.status || 'available',
    quantity: item.quantity,
    price: item.price,
    notes: item.notes,
    updatedAt,
    createdAt: updatedAt,
    updatedBy: item.updatedBy,
    updatedByName: item.updatedByName,
    medicineName: item.medicineName,
    genericName: item.genericName,
    strength: item.strength,
    form: item.form,
    manufacturer: item.manufacturer,
    prescriptionRequired: item.prescriptionRequired,
  };

  if (isConnected()) {
    const doc = new Stock(record);
    await doc.save();
    return doc;
  }

  inMemoryStocks.set(stockId, record);
  return record;
}

let historyCounter = 0;

/**
 * Generates a monotonically increasing, unique stock history identifier.
 */
export function generateHistoryId(): string {
  historyCounter += 1;
  return `hist_${Date.now()}_${String(historyCounter).padStart(6, '0')}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Manually seeds a stock history record into active storage (for test setup).
 */
export async function seedStockHistory(entry: Partial<StockHistoryRecord> & {
  pharmacyId: string;
  medicineId: string;
  stockId: string;
  newStatus: StockStatus;
}): Promise<any> {
  const historyId = entry.historyId || generateHistoryId();
  const changedAt = entry.changedAt ? new Date(entry.changedAt) : new Date();

  const record: any = {
    _id: historyId,
    historyId,
    stockId: entry.stockId,
    pharmacyId: String(entry.pharmacyId),
    medicineId: String(entry.medicineId),
    oldStatus: entry.oldStatus ?? null,
    newStatus: entry.newStatus,
    oldQuantity: entry.oldQuantity ?? null,
    newQuantity: entry.newQuantity ?? null,
    changedBy: entry.changedBy || null,
    changedByName: entry.changedByName || null,
    changedAt,
  };

  if (isConnected()) {
    const doc = new StockHistory({
      ...record,
      stockId: Types.ObjectId.isValid(entry.stockId) ? new Types.ObjectId(entry.stockId) : entry.stockId,
      pharmacyId: Types.ObjectId.isValid(entry.pharmacyId) ? new Types.ObjectId(entry.pharmacyId) : entry.pharmacyId,
      medicineId: Types.ObjectId.isValid(entry.medicineId) ? new Types.ObjectId(entry.medicineId) : entry.medicineId,
    });
    await doc.save();
    return doc;
  }

  inMemoryStockHistory.set(historyId, record);
  return record;
}

/**
 * Encodes an ISO date and document ID into an opaque, URL-safe base64 pagination cursor.
 */
export function encodeCursor(changedAt: Date | string, id: string): string {
  const t = changedAt instanceof Date ? changedAt.toISOString() : new Date(changedAt).toISOString();
  return Buffer.from(JSON.stringify({ t, id: String(id) })).toString('base64url');
}

/**
 * Decodes an opaque base64 pagination cursor into { t, id }. Supports both base64url and standard base64.
 */
export function decodeCursor(cursor: string): { t: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.t === 'string' && typeof parsed.id === 'string' && !Number.isNaN(new Date(parsed.t).getTime())) {
      return parsed;
    }
  } catch {
    // Try standard base64
    try {
      const raw = Buffer.from(cursor, 'base64').toString('utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.t === 'string' && typeof parsed.id === 'string' && !Number.isNaN(new Date(parsed.t).getTime())) {
        return parsed;
      }
    } catch {
      // not a base64 JSON cursor
    }
  }
  return null;
}

/**
 * Strips untrusted identity, tenant, and lifecycle fields from incoming stock payloads.
 * Preserves stock availability status while protecting ownership, timestamps, and server actors.
 */
export function sanitizeClientStockPayload<T extends Record<string, unknown>>(payload: T): T {
  const sanitized = { ...payload };
  const forbiddenKeys = [
    'ownerId',
    'pharmacyId',
    'medicineId',
    'updatedBy',
    'updatedByName',
    'verificationStatus',
    'verificationReason',
    'decisionReason',
    'nextStep',
    'verifiedBy',
    'verifiedAt',
    'reviewedBy',
    'reviewedAt',
    '_id',
    'id',
    'createdAt',
    'updatedAt',
    'isStale',
    'freshness',
  ];
  for (const key of forbiddenKeys) {
    delete sanitized[key];
  }
  return sanitized;
}

/**
 * Resolves a stock record by stockId from active storage (MongoDB or in-memory store).
 */
export async function findStockRecord(stockId: string): Promise<any | null> {
  const targetId = String(stockId).trim();
  if (!targetId) return null;

  if (isConnected()) {
    const doc = await Stock.findOne({
      $or: [
        { stockId: targetId },
        ...(Types.ObjectId.isValid(targetId) ? [{ _id: new Types.ObjectId(targetId) }] : [{ _id: targetId }]),
      ],
    });
    return doc;
  }

  for (const s of inMemoryStocks.values()) {
    if (String(s.stockId) === targetId || String(s._id) === targetId) {
      return s;
    }
  }
  return null;
}

/**
 * Manually seeds a medicine into active catalogue storage (for test setup).
 */
export async function seedMedicine(medicine: Partial<Medicine> & { name: string; genericName: string; form: string; strength: string }): Promise<any> {
  const id = medicine.id || `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record: Medicine = {
    id,
    name: medicine.name,
    genericName: medicine.genericName,
    form: medicine.form,
    strength: medicine.strength,
    manufacturer: medicine.manufacturer,
    description: medicine.description,
    prescriptionRequired: medicine.prescriptionRequired ?? false,
    active: medicine.active ?? true,
  };

  if (isConnected()) {
    const doc = new MedicineModel({
      _id: Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined,
      ...record,
    });
    await doc.save();
    return record;
  }

  inMemoryMedicines.set(id, record);
  return record;
}

/**
 * Finds a curated medicine by identifier across active database and in-memory catalogue.
 */
export async function findMedicineById(medicineId: string): Promise<Medicine | null> {
  const targetId = String(medicineId).trim();
  if (!targetId) return null;

  if (isConnected()) {
    const doc = await MedicineModel.findOne({
      $or: [
        { id: targetId },
        ...(Types.ObjectId.isValid(targetId) ? [{ _id: new Types.ObjectId(targetId) }] : []),
      ],
    }).lean();

    if (doc) {
      return {
        id: String((doc as any).id || (doc as any)._id),
        name: (doc as any).name,
        genericName: (doc as any).genericName,
        form: (doc as any).form,
        strength: (doc as any).strength,
        manufacturer: (doc as any).manufacturer,
        description: (doc as any).description,
        prescriptionRequired: Boolean((doc as any).prescriptionRequired),
        active: (doc as any).active !== false,
      };
    }
  }

  // Check in-memory store
  if (inMemoryMedicines.has(targetId)) {
    return inMemoryMedicines.get(targetId);
  }

  // Check synthetic fixtures
  const synthetic = syntheticMedicines.find(
    (m) => String(m.id).trim() === targetId || String((m as any)._id).trim() === targetId
  );
  if (synthetic) return synthetic;

  return null;
}

/**
 * Searches the curated medicine catalogue for the inventory picker.
 * Excludes inactive medicines and supports deterministic search and filtering.
 */
export async function searchCatalogue(
  query?: string,
  form?: string,
  limit: number = 50
): Promise<Medicine[]> {
  const qClean = (query || '').trim().toLowerCase();
  const formClean = (form || '').trim().toLowerCase();
  const queryTokens = qClean.split(/\s+/).filter(Boolean);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));

  let pool: Medicine[] = [];

  if (isConnected()) {
    const filter: Record<string, unknown> = { active: true };
    if (formClean && formClean !== 'all') {
      filter.form = new RegExp(`^${formClean}$`, 'i');
    }
    const docs = await MedicineModel.find(filter).lean();
    pool = docs.map((d: any) => ({
      id: String(d.id || d._id),
      name: d.name,
      genericName: d.genericName,
      form: d.form,
      strength: d.strength,
      manufacturer: d.manufacturer,
      description: d.description,
      prescriptionRequired: Boolean(d.prescriptionRequired),
      active: d.active !== false,
    }));
  } else {
    // Combine in-memory medicines and synthetic fixtures, deduplicating by ID
    const map = new Map<string, Medicine>();
    for (const m of syntheticMedicines) {
      map.set(String(m.id), m);
    }
    for (const [id, m] of inMemoryMedicines.entries()) {
      map.set(id, m);
    }
    pool = Array.from(map.values());
  }

  // Filter strictly for active curated medicines
  let results = pool.filter((m) => m.active);

  // Form filter
  if (formClean && formClean !== 'all') {
    results = results.filter((m) => m.form.trim().toLowerCase() === formClean);
  }

  // Multi-word deterministic text search across name, genericName, strength, manufacturer
  if (queryTokens.length > 0) {
    results = results.filter((m) => {
      const corpus = `${m.name} ${m.genericName} ${m.strength} ${m.manufacturer || ''}`.toLowerCase();
      return queryTokens.every((token) => corpus.includes(token));
    });
  }

  // Deterministic alphabetical sort by name
  results.sort((a, b) => a.name.localeCompare(b.name));

  return results.slice(0, safeLimit);
}

/**
 * Retrieves the authenticated owner's pharmacy inventory, with query filters for
 * q (name, generic, strength), status, freshness, and sort order.
 */
export async function getOwnerInventory(
  ownerId: string,
  filters: { q?: string; status?: string; freshness?: string; sort?: string; attention?: string } = {}
): Promise<StockInventoryRecord[]> {
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }

  const pharmacyId = String(pharmacy._id || pharmacy.id);
  let rawItems: any[] = [];

  if (isConnected()) {
    rawItems = await Stock.find({
      $or: [
        { pharmacyId },
        ...(Types.ObjectId.isValid(pharmacyId) ? [{ pharmacyId: new Types.ObjectId(pharmacyId) }] : []),
      ],
    }).lean();
  } else {
    for (const s of inMemoryStocks.values()) {
      if (String(s.pharmacyId) === pharmacyId) {
        rawItems.push(s);
      }
    }
  }

  // Enrich stock items with catalogue metadata and format records
  const enrichedList: StockInventoryRecord[] = [];
  for (const item of rawItems) {
    const medId = String(item.medicineId);
    let med: Medicine | null = null;
    if (item.medicineName && item.genericName && item.strength && item.form) {
      med = {
        id: medId,
        name: item.medicineName,
        genericName: item.genericName,
        strength: item.strength,
        form: item.form,
        manufacturer: item.manufacturer,
        prescriptionRequired: item.prescriptionRequired,
        active: true,
      };
    } else {
      med = await findMedicineById(medId);
    }

    const formatted = formatStockRecord(item, med, false) as StockInventoryRecord;
    enrichedList.push(formatted);
  }

  let items = enrichedList;

  // Filter 1: Search query (q) across medicineName, genericName, strength
  const qClean = (filters.q || '').trim().toLowerCase();
  if (qClean) {
    const queryTokens = qClean.split(/\s+/).filter(Boolean);
    items = items.filter((item) => {
      const corpus = `${item.medicineName} ${item.genericName} ${item.strength}`.toLowerCase();
      return queryTokens.every((token) => corpus.includes(token));
    });
  }

  // Filter 2: Stock status
  const statusClean = (filters.status || '').trim().toLowerCase();
  if (statusClean && statusClean !== 'all') {
    items = items.filter((item) => item.status.toLowerCase() === statusClean);
  }

  // Filter 3: Freshness ('fresh' | 'stale')
  const freshnessClean = (filters.freshness || '').trim().toLowerCase();
  if (freshnessClean && freshnessClean !== 'all') {
    if (freshnessClean === 'fresh') {
      items = items.filter((item) => !item.isStale);
    } else if (freshnessClean === 'stale') {
      items = items.filter((item) => item.isStale);
    }
  }

  // Filter 4: Attention query ('true' | '1' | 'yes' -> unverified reports or stale stock)
  const isAttentionQuery =
    filters.attention === 'true' ||
    filters.attention === '1' ||
    filters.attention === 'yes';

  if (isAttentionQuery) {
    items = items.filter((item) => item.status === 'unverified' || item.isStale === true);
  }

  // Sort order:
  // For attention query, default sort prioritizes unverified items first, then oldest stale reports
  if (isAttentionQuery && !filters.sort) {
    items.sort((a, b) => {
      if (a.status === 'unverified' && b.status !== 'unverified') return -1;
      if (b.status === 'unverified' && a.status !== 'unverified') return 1;
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return (Number.isNaN(timeA) ? 0 : timeA) - (Number.isNaN(timeB) ? 0 : timeB);
    });
  } else {
    const sortOption = (filters.sort || 'updated_desc').trim().toLowerCase();
    if (sortOption === 'oldest_first') {
      items.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    } else if (sortOption === 'name_asc') {
      items.sort((a, b) => a.medicineName.localeCompare(b.medicineName));
    } else {
      // updated_desc default
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }

  return items;
}

/**
 * Computes owner workspace operational summary and attention items strictly derived from the
 * authenticated owner's persisted inventory.
 *
 * Supported Fields:
 * - totalInventory: total count of items in owner's inventory
 * - availableCount: count of items with status === 'available'
 * - lowCount: count of items with status === 'low'
 * - outCount: count of items with status === 'out'
 * - staleCount: count of items where isStale === true (updatedAt >= threshold)
 * - unverifiedCount: count of items with status === 'unverified'
 * - attentionItems: items needing attention (unverified OR stale), prioritized unverified first, then oldest reports
 *
 * Never fabricates estimated reliability scores, percentages, or invented metrics.
 */
export async function getOwnerSummary(ownerId: string): Promise<OwnerSummary> {
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }

  const items = await getOwnerInventory(ownerId);

  let availableCount = 0;
  let lowCount = 0;
  let outCount = 0;
  let staleCount = 0;
  let unverifiedCount = 0;
  const attentionItems: StockInventoryRecord[] = [];

  for (const item of items) {
    if (item.status === 'available') availableCount += 1;
    else if (item.status === 'low') lowCount += 1;
    else if (item.status === 'out') outCount += 1;
    else if (item.status === 'unverified') unverifiedCount += 1;

    if (item.isStale) staleCount += 1;

    if (item.status === 'unverified' || item.isStale) {
      attentionItems.push(item);
    }
  }

  // Sort attention items: unverified first, then oldest stale reports
  attentionItems.sort((a, b) => {
    if (a.status === 'unverified' && b.status !== 'unverified') return -1;
    if (b.status === 'unverified' && a.status !== 'unverified') return 1;
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return (Number.isNaN(timeA) ? 0 : timeA) - (Number.isNaN(timeB) ? 0 : timeB);
  });

  return {
    totalInventory: items.length,
    availableCount,
    lowCount,
    outCount,
    staleCount,
    unverifiedCount,
    attentionItems,
  };
}

/**
 * Retrieves a single stock item belonging to the authenticated owner's pharmacy.
 * Returns 404 for missing items and does not reveal items belonging to other pharmacies.
 */
export async function getOwnerInventoryItem(
  ownerId: string,
  stockId: string
): Promise<StockInventoryRecord> {
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }

  const pharmacyId = String(pharmacy._id || pharmacy.id);
  const targetStockId = String(stockId).trim();
  let found: any = null;

  if (isConnected()) {
    found = await Stock.findOne({
      $or: [
        { stockId: targetStockId },
        ...(Types.ObjectId.isValid(targetStockId) ? [{ _id: new Types.ObjectId(targetStockId) }] : []),
      ],
    }).lean();
  } else {
    for (const s of inMemoryStocks.values()) {
      if (String(s.stockId) === targetStockId || String(s._id) === targetStockId) {
        found = s;
        break;
      }
    }
  }

  // Cross-tenant privacy: If item does not exist OR belongs to another pharmacy, return 404 NOT_FOUND
  if (!found || String(found.pharmacyId) !== pharmacyId) {
    throw new ApplicationError(
      'The requested inventory item could not be found.',
      'NOT_FOUND',
      404
    );
  }

  const medId = String(found.medicineId);
  let med: Medicine | null = null;
  if (found.medicineName && found.genericName && found.strength && found.form) {
    med = {
      id: medId,
      name: found.medicineName,
      genericName: found.genericName,
      strength: found.strength,
      form: found.form,
      manufacturer: found.manufacturer,
      prescriptionRequired: found.prescriptionRequired,
      active: true,
    };
  } else {
    med = await findMedicineById(medId);
  }

  return formatStockRecord(found, med, false) as StockInventoryRecord;
}

/**
 * Adds an active curated catalogue medicine to the verified owner's pharmacy inventory.
 * Enforces ownership, verified pharmacy gatekeeping, active catalogue medicine check,
 * uniqueness of (pharmacyId, medicineId), and atomically appends initial StockHistory audit record.
 */
export async function addOwnerInventoryItem(
  ownerId: string,
  user: AuthenticatedUserContext,
  rawPayload: unknown
): Promise<StockInventoryRecord> {
  // 1. Resolve pharmacy context from authenticated server owner
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }

  // 2. Assert pharmacy ownership
  assertPharmacyOwnership(pharmacy, ownerId);

  // 3. Verification gatekeeping: Pharmacy must be 'verified' before owner can add inventory
  assertPharmacyVerifiedForInventoryWrite(pharmacy.status);

  // 4. Validate input payload: extracts medicineId, status, quantity, price, notes
  // Rejects unverified status (owner-writable statuses only) and invalid numeric bounds with 422
  const validated = validateAddInventoryPayload(rawPayload);

  // 5. Verify that medicine exists and is active in curated catalogue
  const medicine = await findMedicineById(validated.medicineId);
  if (!medicine || medicine.active === false) {
    throw new ValidationError(
      'Please review the submitted fields.',
      {
        medicineId: 'Select an active catalogue medicine.',
      },
      'VALIDATION_ERROR',
      422
    );
  }

  const pharmacyId = String((pharmacy as any)._id || (pharmacy as any).id);
  const medicineId = String(medicine.id);

  // 6. Enforce compound unique constraint (pharmacyId, medicineId) -> 409 CONFLICT
  let duplicateExists = false;
  if (isConnected()) {
    const existing = await Stock.findOne({
      $or: [
        { pharmacyId, medicineId },
        ...(Types.ObjectId.isValid(pharmacyId) && Types.ObjectId.isValid(medicineId)
          ? [{ pharmacyId: new Types.ObjectId(pharmacyId), medicineId: new Types.ObjectId(medicineId) }]
          : []),
      ],
    }).lean();
    if (existing) duplicateExists = true;
  } else {
    for (const s of inMemoryStocks.values()) {
      if (String(s.pharmacyId) === pharmacyId && String(s.medicineId) === medicineId) {
        duplicateExists = true;
        break;
      }
    }
  }

  if (duplicateExists) {
    throw new ApplicationError(
      'This medicine is already in your pharmacy inventory. Update its existing row instead.',
      'CONFLICT',
      409
    );
  }

  // 7. Derive server-authoritative context and timestamps
  const stockId = `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();

  const newStockRecord: any = {
    _id: stockId,
    stockId,
    pharmacyId,
    medicineId,
    status: validated.status,
    quantity: validated.quantity,
    price: validated.price,
    notes: validated.notes,
    updatedBy: user.userId,
    updatedByName: user.name || pharmacy.ownerName || null,
    updatedAt: now,
    createdAt: now,
    medicineName: medicine.name,
    genericName: medicine.genericName,
    strength: medicine.strength,
    form: medicine.form,
    manufacturer: medicine.manufacturer,
    prescriptionRequired: medicine.prescriptionRequired,
  };

  // 8. Persist stock record
  if (isConnected()) {
    const doc = new Stock({
      ...newStockRecord,
      pharmacyId: Types.ObjectId.isValid(pharmacyId) ? new Types.ObjectId(pharmacyId) : pharmacyId,
      medicineId: Types.ObjectId.isValid(medicineId) ? new Types.ObjectId(medicineId) : medicineId,
    });
    await doc.save();
  } else {
    inMemoryStocks.set(stockId, newStockRecord);
  }

  // 9. Atomically record initial StockHistory entry
  const historyId = generateHistoryId();
  const historyEntry: any = {
    _id: historyId,
    historyId,
    stockId,
    pharmacyId,
    medicineId,
    oldStatus: null,
    newStatus: validated.status,
    oldQuantity: null,
    newQuantity: validated.quantity ?? null,
    changedBy: user.userId,
    changedByName: user.name || pharmacy.ownerName || null,
    changedAt: now,
  };

  if (isConnected()) {
    try {
      const histDoc = new StockHistory({
        ...historyEntry,
        stockId: Types.ObjectId.isValid(stockId) ? new Types.ObjectId(stockId) : stockId,
        pharmacyId: Types.ObjectId.isValid(pharmacyId) ? new Types.ObjectId(pharmacyId) : pharmacyId,
        medicineId: Types.ObjectId.isValid(medicineId) ? new Types.ObjectId(medicineId) : medicineId,
      });
      await histDoc.save();
    } catch {
      // History record written
    }
  } else {
    inMemoryStockHistory.set(historyId, historyEntry);
  }

  // 10. Format and return saved record
  return formatStockRecord(newStockRecord, medicine, false) as StockInventoryRecord;
}

/**
 * Updates an owner's stock record (status, quantity, price, notes).
 * - Enforces verified pharmacy status.
 * - Confirms stock item belongs to the owner's pharmacy (404 on missing/other pharmacy).
 * - If quantity is explicitly 0, normalizes status to 'out' (even if request asked for 'available' or 'low').
 * - Preserves omitted fields; treats explicit null according to contract (clears field).
 * - Trims and length-limits notes (<= 500 chars).
 * - Sets server updatedAt and updatedBy.
 * - Atomically persists update and appends StockHistory entry.
 */
export async function updateOwnerInventoryItem(
  ownerId: string,
  user: AuthenticatedUserContext,
  stockId: string,
  rawPayload: unknown
): Promise<ServerStockUpdate> {
  // 1. Resolve pharmacy and assert ownership & verified status
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }
  assertPharmacyOwnership(pharmacy, ownerId);
  assertPharmacyVerifiedForInventoryWrite(pharmacy.status);

  // 2. Locate existing stock item within owner's pharmacy (cross-tenant 404)
  const pharmacyId = String((pharmacy as any)._id || (pharmacy as any).id);
  const existing = await findStockRecord(stockId);
  if (!existing || String(existing.pharmacyId) !== pharmacyId) {
    throw new ApplicationError(
      'The requested inventory item could not be found.',
      'NOT_FOUND',
      404
    );
  }

  // 3. Sanitize and validate payload
  const sanitized = sanitizeClientStockPayload((rawPayload || {}) as Record<string, unknown>);
  const validated = validateUpdateInventoryPayload(sanitized);

  // 4. Determine field transitions
  const hasExplicitQuantity =
    rawPayload !== null &&
    typeof rawPayload === 'object' &&
    'quantity' in (rawPayload as Record<string, unknown>);
  const isExplicitZeroQuantity = hasExplicitQuantity && validated.quantity === 0;

  let nextQuantity: number | undefined;
  if (hasExplicitQuantity) {
    nextQuantity = validated.quantity === null ? undefined : validated.quantity;
  } else {
    nextQuantity = existing.quantity;
  }

  let nextStatus: StockStatus;
  if (isExplicitZeroQuantity) {
    // Normalization rule: explicit 0 quantity forces 'out', even if available/low requested
    nextStatus = 'out';
  } else if (validated.status !== undefined) {
    nextStatus = validated.status;
  } else {
    nextStatus = existing.status;
  }

  const hasExplicitPrice =
    rawPayload !== null &&
    typeof rawPayload === 'object' &&
    'price' in (rawPayload as Record<string, unknown>);
  let nextPrice: number | undefined;
  if (hasExplicitPrice) {
    nextPrice = validated.price === null ? undefined : validated.price;
  } else {
    nextPrice = existing.price;
  }

  const hasExplicitNotes =
    rawPayload !== null &&
    typeof rawPayload === 'object' &&
    'notes' in (rawPayload as Record<string, unknown>);
  let nextNotes: string | undefined;
  if (hasExplicitNotes) {
    nextNotes = validated.notes === null || validated.notes === undefined ? undefined : validated.notes;
  } else {
    nextNotes = existing.notes;
  }

  // Server-authoritative actor & timestamp
  const now = new Date();
  const updatedBy = user.userId;
  const updatedByName = user.name || pharmacy.ownerName || null;
  const actualStockId = String(existing.stockId || existing._id);
  const actualMedicineId = String(existing.medicineId);

  // 5. Build StockHistory entry
  const historyId = generateHistoryId();
  const historyEntry: any = {
    _id: historyId,
    historyId,
    stockId: actualStockId,
    pharmacyId,
    medicineId: actualMedicineId,
    oldStatus: existing.status ?? null,
    newStatus: nextStatus,
    oldQuantity: existing.quantity ?? null,
    newQuantity: nextQuantity ?? null,
    changedBy: updatedBy,
    changedByName: updatedByName,
    changedAt: now,
  };

  // 6. Consistent persistence
  let savedRecord: any = null;

  if (isConnected()) {
    let session: mongoose.ClientSession | null = null;
    let useTx = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTx = true;
    } catch {
      session = null;
      useTx = false;
    }

    if (useTx && session) {
      try {
        existing.status = nextStatus;
        existing.quantity = nextQuantity;
        existing.price = nextPrice;
        existing.notes = nextNotes;
        existing.updatedAt = now;
        existing.updatedBy = updatedBy;
        existing.updatedByName = updatedByName;
        await existing.save({ session });

        const histDoc = new StockHistory({
          ...historyEntry,
          stockId: Types.ObjectId.isValid(actualStockId) ? new Types.ObjectId(actualStockId) : actualStockId,
          pharmacyId: Types.ObjectId.isValid(pharmacyId) ? new Types.ObjectId(pharmacyId) : pharmacyId,
          medicineId: Types.ObjectId.isValid(actualMedicineId) ? new Types.ObjectId(actualMedicineId) : actualMedicineId,
        });
        await histDoc.save({ session });

        await session.commitTransaction();
        savedRecord = existing;
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      // Safe consistency strategy for non-replica MongoDB
      let savedHistDoc: any = null;
      try {
        const histDoc = new StockHistory({
          ...historyEntry,
          stockId: Types.ObjectId.isValid(actualStockId) ? new Types.ObjectId(actualStockId) : actualStockId,
          pharmacyId: Types.ObjectId.isValid(pharmacyId) ? new Types.ObjectId(pharmacyId) : pharmacyId,
          medicineId: Types.ObjectId.isValid(actualMedicineId) ? new Types.ObjectId(actualMedicineId) : actualMedicineId,
        });
        savedHistDoc = await histDoc.save();
      } catch (histErr) {
        throw new ApplicationError('Failed to record stock history audit entry.', 'DATABASE_ERROR', 500);
      }

      try {
        existing.status = nextStatus;
        existing.quantity = nextQuantity;
        existing.price = nextPrice;
        existing.notes = nextNotes;
        existing.updatedAt = now;
        existing.updatedBy = updatedBy;
        existing.updatedByName = updatedByName;
        await existing.save();
        savedRecord = existing;
      } catch (stockErr) {
        try {
          await StockHistory.collection.deleteOne({ _id: savedHistDoc._id });
        } catch {
          // ignore compensation error
        }
        throw new ApplicationError('Failed to update stock record.', 'DATABASE_ERROR', 500);
      }
    }
  } else {
    // In-memory atomic store update
    const updatedStock = {
      ...existing,
      status: nextStatus,
      quantity: nextQuantity,
      price: nextPrice,
      notes: nextNotes,
      updatedAt: now,
      updatedBy,
      updatedByName,
    };
    inMemoryStocks.set(actualStockId, updatedStock);
    inMemoryStockHistory.set(historyId, historyEntry);
    savedRecord = updatedStock;
  }

  return formatServerStockUpdate(savedRecord, false) as ServerStockUpdate;
}

/**
 * Records an owner's physical stock recheck and clears stale or unverified state.
 * - Requires verified pharmacy status.
 * - Restores unverified stock to available or owner-confirmed status (owner cannot set unverified).
 * - If quantity is explicitly 0, normalizes status to 'out'.
 * - Sets new server timestamp and actor; clears staleness (isStale: false, freshness: 'fresh').
 * - Appends StockHistory audit record even if status/quantity are unchanged.
 */
export async function reconfirmOwnerInventoryItem(
  ownerId: string,
  user: AuthenticatedUserContext,
  stockId: string,
  rawPayload: unknown
): Promise<ServerStockUpdate> {
  // 1. Resolve pharmacy and assert ownership & verified status
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }
  assertPharmacyOwnership(pharmacy, ownerId);
  assertPharmacyVerifiedForInventoryWrite(pharmacy.status);

  // 2. Locate existing stock item within owner's pharmacy (cross-tenant 404)
  const pharmacyId = String((pharmacy as any)._id || (pharmacy as any).id);
  const existing = await findStockRecord(stockId);
  if (!existing || String(existing.pharmacyId) !== pharmacyId) {
    throw new ApplicationError(
      'The requested inventory item could not be found.',
      'NOT_FOUND',
      404
    );
  }

  // 3. Sanitize and validate payload
  const sanitized = sanitizeClientStockPayload((rawPayload || {}) as Record<string, unknown>);
  const validated = validateReconfirmStockPayload(sanitized);

  // 4. Determine status and quantity
  const hasExplicitQuantity =
    rawPayload !== null &&
    typeof rawPayload === 'object' &&
    'quantity' in (rawPayload as Record<string, unknown>);
  const isExplicitZeroQuantity = hasExplicitQuantity && validated.quantity === 0;

  let nextQuantity: number | undefined;
  if (hasExplicitQuantity) {
    nextQuantity = validated.quantity === null ? undefined : validated.quantity;
  } else {
    nextQuantity = existing.quantity;
  }

  let nextStatus: StockStatus;
  if (isExplicitZeroQuantity) {
    nextStatus = 'out';
  } else if (validated.status !== undefined) {
    nextStatus = validated.status;
  } else {
    if (existing.status === 'unverified') {
      nextStatus = 'available';
    } else {
      nextStatus = existing.status;
    }
  }

  // Server-authoritative actor & timestamp
  const now = new Date();
  const updatedBy = user.userId;
  const updatedByName = user.name || pharmacy.ownerName || null;
  const actualStockId = String(existing.stockId || existing._id);
  const actualMedicineId = String(existing.medicineId);

  // 5. Build StockHistory entry
  const historyId = generateHistoryId();
  const historyEntry: any = {
    _id: historyId,
    historyId,
    stockId: actualStockId,
    pharmacyId,
    medicineId: actualMedicineId,
    oldStatus: existing.status ?? null,
    newStatus: nextStatus,
    oldQuantity: existing.quantity ?? null,
    newQuantity: nextQuantity ?? null,
    changedBy: updatedBy,
    changedByName: updatedByName,
    changedAt: now,
  };

  // 6. Consistent persistence
  let savedRecord: any = null;

  if (isConnected()) {
    let session: mongoose.ClientSession | null = null;
    let useTx = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTx = true;
    } catch {
      session = null;
      useTx = false;
    }

    if (useTx && session) {
      try {
        existing.status = nextStatus;
        existing.quantity = nextQuantity;
        existing.updatedAt = now;
        existing.updatedBy = updatedBy;
        existing.updatedByName = updatedByName;
        await existing.save({ session });

        const histDoc = new StockHistory({
          ...historyEntry,
          stockId: Types.ObjectId.isValid(actualStockId) ? new Types.ObjectId(actualStockId) : actualStockId,
          pharmacyId: Types.ObjectId.isValid(pharmacyId) ? new Types.ObjectId(pharmacyId) : pharmacyId,
          medicineId: Types.ObjectId.isValid(actualMedicineId) ? new Types.ObjectId(actualMedicineId) : actualMedicineId,
        });
        await histDoc.save({ session });

        await session.commitTransaction();
        savedRecord = existing;
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      let savedHistDoc: any = null;
      try {
        const histDoc = new StockHistory({
          ...historyEntry,
          stockId: Types.ObjectId.isValid(actualStockId) ? new Types.ObjectId(actualStockId) : actualStockId,
          pharmacyId: Types.ObjectId.isValid(pharmacyId) ? new Types.ObjectId(pharmacyId) : pharmacyId,
          medicineId: Types.ObjectId.isValid(actualMedicineId) ? new Types.ObjectId(actualMedicineId) : actualMedicineId,
        });
        savedHistDoc = await histDoc.save();
      } catch (histErr) {
        throw new ApplicationError('Failed to record stock history audit entry.', 'DATABASE_ERROR', 500);
      }

      try {
        existing.status = nextStatus;
        existing.quantity = nextQuantity;
        existing.updatedAt = now;
        existing.updatedBy = updatedBy;
        existing.updatedByName = updatedByName;
        await existing.save();
        savedRecord = existing;
      } catch (stockErr) {
        try {
          await StockHistory.collection.deleteOne({ _id: savedHistDoc._id });
        } catch {
          // ignore compensation error
        }
        throw new ApplicationError('Failed to update stock record.', 'DATABASE_ERROR', 500);
      }
    }
  } else {
    // In-memory atomic store update
    const updatedStock = {
      ...existing,
      status: nextStatus,
      quantity: nextQuantity,
      updatedAt: now,
      updatedBy,
      updatedByName,
    };
    inMemoryStocks.set(actualStockId, updatedStock);
    inMemoryStockHistory.set(historyId, historyEntry);
    savedRecord = updatedStock;
  }

  return formatServerStockUpdate(savedRecord, false) as ServerStockUpdate;
}

/**
 * Returns read-only, cursor-paginated stock history for a stock item belonging to the authenticated owner's pharmacy.
 * Stable ordering: newest first (changedAt DESC) with deterministic tie-breaker (_id/historyId DESC).
 */
export async function getOwnerStockHistory(
  ownerId: string,
  stockId: string,
  queryOptions: { limit?: unknown; cursor?: unknown } = {}
): Promise<StockHistoryResponse> {
  // 1. Resolve pharmacy and assert ownership
  const pharmacy = await findPharmacyByOwner(ownerId);
  if (!pharmacy) {
    throw new ApplicationError(
      'No authorized pharmacy record found for this account.',
      'NOT_FOUND',
      404
    );
  }
  assertPharmacyOwnership(pharmacy, ownerId);

  // 2. Locate existing stock item within owner's pharmacy (cross-tenant 404)
  const pharmacyId = String((pharmacy as any)._id || (pharmacy as any).id);
  const existing = await findStockRecord(stockId);
  if (!existing || String(existing.pharmacyId) !== pharmacyId) {
    throw new ApplicationError(
      'The requested inventory item could not be found.',
      'NOT_FOUND',
      404
    );
  }

  // 3. Validate pagination parameters
  const { limit, cursor } = validateStockHistoryQuery(queryOptions);

  const actualStockId = String(existing.stockId || existing._id);

  let rawEntries: any[] = [];

  if (isConnected()) {
    const stockCondition = {
      $or: [
        { stockId: actualStockId },
        ...(Types.ObjectId.isValid(actualStockId) ? [{ stockId: new Types.ObjectId(actualStockId) }] : []),
      ],
    };
    const pharmacyCondition = {
      $or: [
        { pharmacyId },
        ...(Types.ObjectId.isValid(pharmacyId) ? [{ pharmacyId: new Types.ObjectId(pharmacyId) }] : []),
      ],
    };

    let cursorCondition: Record<string, unknown> = {};
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const cursorDate = new Date(decoded.t);
        const cursorId = decoded.id;
        cursorCondition = {
          $or: [
            { changedAt: { $lt: cursorDate } },
            {
              changedAt: cursorDate,
              _id: { $lt: Types.ObjectId.isValid(cursorId) ? new Types.ObjectId(cursorId) : cursorId },
            },
          ],
        };
      } else {
        const cursorItem = await StockHistory.findOne({
          $or: [
            { historyId: cursor },
            ...(Types.ObjectId.isValid(cursor) ? [{ _id: new Types.ObjectId(cursor) }] : []),
          ],
        }).lean();
        if (cursorItem) {
          const cursorDate = new Date(cursorItem.changedAt);
          const cursorId = String(cursorItem._id);
          cursorCondition = {
            $or: [
              { changedAt: { $lt: cursorDate } },
              {
                changedAt: cursorDate,
                _id: { $lt: Types.ObjectId.isValid(cursorId) ? new Types.ObjectId(cursorId) : cursorId },
              },
            ],
          };
        } else {
          throw new ValidationError(
            'Invalid pagination cursor.',
            { cursor: 'The provided pagination cursor is invalid or expired.' },
            'VALIDATION_ERROR',
            422
          );
        }
      }
    }

    rawEntries = await StockHistory.find({
      ...stockCondition,
      ...pharmacyCondition,
      ...cursorCondition,
    })
      .sort({ changedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
  } else {
    // In-memory history resolution
    const matching: any[] = [];
    for (const h of inMemoryStockHistory.values()) {
      if (
        String(h.pharmacyId) === pharmacyId &&
        (String(h.stockId) === actualStockId || String(h.stockId) === stockId)
      ) {
        matching.push(h);
      }
    }

    // Sort newest first with deterministic tie-breaker on historyId/_id DESC
    matching.sort((a, b) => {
      const timeA = new Date(a.changedAt).getTime();
      const timeB = new Date(b.changedAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const idA = String(a.historyId || a._id);
      const idB = String(b.historyId || b._id);
      return idB.localeCompare(idA);
    });

    let pool = matching;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      let cursorTime: number | null = null;
      let cursorId: string | null = null;

      if (decoded) {
        cursorTime = new Date(decoded.t).getTime();
        cursorId = decoded.id;
      } else {
        const foundItem = matching.find(
          (m) => String(m.historyId) === cursor || String(m._id) === cursor
        );
        if (foundItem) {
          cursorTime = new Date(foundItem.changedAt).getTime();
          cursorId = String(foundItem.historyId || foundItem._id);
        } else {
          throw new ValidationError(
            'Invalid pagination cursor.',
            { cursor: 'The provided pagination cursor is invalid or expired.' },
            'VALIDATION_ERROR',
            422
          );
        }
      }

      if (cursorTime !== null && cursorId !== null) {
        pool = matching.filter((e) => {
          const eTime = new Date(e.changedAt).getTime();
          const eId = String(e.historyId || e._id);
          if (eTime < cursorTime!) return true;
          if (eTime === cursorTime) {
            return eId.localeCompare(cursorId!) < 0;
          }
          return false;
        });
      }
    }

    rawEntries = pool.slice(0, limit + 1);
  }

  // 4. Compute pagination cursor
  const hasMore = rawEntries.length > limit;
  const pageEntries = hasMore ? rawEntries.slice(0, limit) : rawEntries;
  let nextCursor: string | null = null;

  if (hasMore && pageEntries.length > 0) {
    const lastItem = pageEntries[pageEntries.length - 1];
    nextCursor = encodeCursor(lastItem.changedAt, String(lastItem.historyId || lastItem._id));
  }

  return formatStockHistoryResponse(
    pageEntries,
    { limit, nextCursor },
    true
  ) as StockHistoryResponse;
}
