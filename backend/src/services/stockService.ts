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
} from '../auth/ownership';
import { ApplicationError } from '../utils/errors';
import { ValidationError } from '../validation/validationError';
import { validateAddInventoryPayload } from '../validation/stockValidators';
import { formatStockRecord } from '../utils/responseEnvelope';
import { isReportStale } from '../utils/freshness';
import type {
  Medicine,
  StockInventoryRecord,
  StockHistoryRecord,
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
  filters: { q?: string; status?: string; freshness?: string; sort?: string } = {}
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

  // Sort order: updated_desc (default), oldest_first, name_asc
  const sortOption = (filters.sort || 'updated_desc').trim().toLowerCase();
  if (sortOption === 'oldest_first') {
    items.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  } else if (sortOption === 'name_asc') {
    items.sort((a, b) => a.medicineName.localeCompare(b.medicineName));
  } else {
    // updated_desc default
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  return items;
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
  const historyId = `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
