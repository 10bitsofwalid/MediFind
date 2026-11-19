// backend/src/utils/responseEnvelope.ts
import type { ApiPaginationMeta, ApiSuccessResponse } from '../types/api';
import type {
  Pharmacy,
  PharmacyApplicationResponse,
} from '../types/pharmacy';
import type {
  ServerStockUpdate,
  StockHistoryPage,
  StockHistoryRecord,
  StockHistoryResponse,
  StockInventoryRecord,
} from '../types/stock';
import { isReportStale } from './freshness';

/**
 * Wraps any data payload in the standard { data: T, page?: ... } API response envelope.
 */
export function wrapEnvelope<T>(
  data: T,
  page?: ApiPaginationMeta,
  message?: string
): ApiSuccessResponse<T> {
  const envelope: ApiSuccessResponse<T> = { data };
  if (page) envelope.page = page;
  if (message) envelope.message = message;
  return envelope;
}

/**
 * Unwraps { data: T } or returns flat T if not wrapped in an envelope.
 */
export function unwrapEnvelope<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

/**
 * Formats a PharmacyApplication document into the canonical response shape.
 */
export function formatApplicationResponse(
  app: any,
  wrapInEnvelope: boolean = true
): ApiSuccessResponse<PharmacyApplicationResponse> | PharmacyApplicationResponse {
  const formatted: PharmacyApplicationResponse = {
    applicationId: String(app._id || app.applicationId || app.id),
    pharmacyId: app.pharmacyId ? String(app.pharmacyId) : undefined,
    status: app.status,
    submittedAt: app.submittedAt instanceof Date ? app.submittedAt.toISOString() : String(app.submittedAt || new Date().toISOString()),
    message: app.message || 'Pharmacy application received.',
    data: {
      name: app.data.name,
      ownerName: app.data.ownerName,
      phone: app.data.phone,
      email: app.data.email,
      streetAddress: app.data.streetAddress,
      city: app.data.city,
      area: app.data.area,
      postalCode: app.data.postalCode,
      formattedAddress: app.data.formattedAddress,
      licenseNo: app.data.licenseNo,
      issuingAuthority: app.data.issuingAuthority,
      licenseExpiryDate: app.data.licenseExpiryDate,
      licenseType: app.data.licenseType,
      latitude: app.data.latitude,
      longitude: app.data.longitude,
      location: app.data.location,
      openingHours: app.data.openingHours,
      structuredHours: app.data.structuredHours,
      notes: app.data.notes,
    },
    verificationReason: app.verificationReason,
    decisionReason: app.decisionReason || app.verificationReason,
    nextStep: app.nextStep,
  };

  return wrapInEnvelope ? wrapEnvelope(formatted) : formatted;
}

/**
 * Formats a Pharmacy document into the canonical profile response shape.
 */
export function formatPharmacyResponse(
  pharmacy: any,
  wrapInEnvelope: boolean = true
): ApiSuccessResponse<Pharmacy> | Pharmacy {
  const formatted: Pharmacy = {
    _id: String(pharmacy._id || pharmacy.id),
    id: String(pharmacy._id || pharmacy.id),
    ownerId: pharmacy.ownerId ? String(pharmacy.ownerId) : undefined,
    name: pharmacy.name,
    ownerName: pharmacy.ownerName,
    phone: pharmacy.phone,
    email: pharmacy.email,
    address: pharmacy.address,
    streetAddress: pharmacy.streetAddress,
    city: pharmacy.city,
    area: pharmacy.area,
    postalCode: pharmacy.postalCode,
    formattedAddress: pharmacy.formattedAddress || pharmacy.address,
    licenseNo: pharmacy.licenseNo,
    issuingAuthority: pharmacy.issuingAuthority,
    licenseExpiryDate: pharmacy.licenseExpiryDate,
    licenseType: pharmacy.licenseType,
    location: pharmacy.location,
    latitude: pharmacy.latitude,
    longitude: pharmacy.longitude,
    openingHours: pharmacy.openingHours,
    structuredHours: pharmacy.structuredHours,
    status: pharmacy.status,
    verificationReason: pharmacy.verificationReason,
    decisionReason: pharmacy.decisionReason || pharmacy.verificationReason,
    nextStep: pharmacy.nextStep,
    createdAt: pharmacy.createdAt instanceof Date ? pharmacy.createdAt.toISOString() : pharmacy.createdAt,
    updatedAt: pharmacy.updatedAt instanceof Date ? pharmacy.updatedAt.toISOString() : pharmacy.updatedAt,
  };

  return wrapInEnvelope ? wrapEnvelope(formatted) : formatted;
}

/**
 * Formats a Stock document and medicine metadata into a canonical StockInventoryRecord.
 */
export function formatStockRecord(
  stock: any,
  medicine: any,
  wrapInEnvelope: boolean = true
): ApiSuccessResponse<StockInventoryRecord> | StockInventoryRecord {
  const updatedAtIso =
    stock.updatedAt instanceof Date
      ? stock.updatedAt.toISOString()
      : String(stock.updatedAt || new Date().toISOString());

  const stale = isReportStale(updatedAtIso);

  const formatted: StockInventoryRecord = {
    stockId: String(stock._id || stock.stockId || stock.id),
    pharmacyId: String(stock.pharmacyId),
    medicineId: String(stock.medicineId || medicine?._id || medicine?.id),
    medicineName: medicine?.name || stock.medicineName || '',
    genericName: medicine?.genericName || stock.genericName || '',
    strength: medicine?.strength || stock.strength || '',
    form: medicine?.form || stock.form || '',
    manufacturer: medicine?.manufacturer || stock.manufacturer,
    prescriptionRequired:
      typeof medicine?.prescriptionRequired === 'boolean'
        ? medicine.prescriptionRequired
        : stock.prescriptionRequired,
    status: stock.status,
    quantity: typeof stock.quantity === 'number' ? stock.quantity : undefined,
    price: typeof stock.price === 'number' ? stock.price : undefined,
    notes: stock.notes,
    updatedAt: updatedAtIso,
    updatedBy: stock.updatedBy ? String(stock.updatedBy) : undefined,
    updatedByName: stock.updatedByName,
    isStale: stale,
    freshness: stale ? 'stale' : 'fresh',
  };

  return wrapInEnvelope ? wrapEnvelope(formatted) : formatted;
}

/**
 * Formats a partial stock update response (returned on PATCH /reconfirm).
 */
export function formatServerStockUpdate(
  stock: any,
  wrapInEnvelope: boolean = true
): ApiSuccessResponse<ServerStockUpdate> | ServerStockUpdate {
  const updatedAtIso =
    stock.updatedAt instanceof Date
      ? stock.updatedAt.toISOString()
      : String(stock.updatedAt || new Date().toISOString());

  const stale = isReportStale(updatedAtIso);

  const formatted: ServerStockUpdate = {
    stockId: String(stock._id || stock.stockId || stock.id),
    status: stock.status,
    updatedAt: updatedAtIso,
    quantity: typeof stock.quantity === 'number' ? stock.quantity : undefined,
    isStale: stale,
    freshness: stale ? 'stale' : 'fresh',
  };

  return wrapInEnvelope ? wrapEnvelope(formatted) : formatted;
}

/**
 * Formats a list of StockHistory records.
 */
export function formatStockHistoryResponse(
  records: any[],
  page?: StockHistoryPage,
  wrapInEnvelope: boolean = true
): ApiSuccessResponse<StockHistoryRecord[]> | StockHistoryRecord[] | StockHistoryResponse {
  const formatted: StockHistoryRecord[] = records.map((entry) => ({
    historyId: String(entry._id || entry.historyId || entry.id),
    stockId: entry.stockId ? String(entry.stockId) : undefined,
    pharmacyId: String(entry.pharmacyId),
    medicineId: String(entry.medicineId),
    oldStatus: entry.oldStatus ?? null,
    newStatus: entry.newStatus,
    oldQuantity: entry.oldQuantity ?? null,
    newQuantity: entry.newQuantity ?? null,
    changedBy: entry.changedBy ? String(entry.changedBy) : null,
    changedByName: entry.changedByName ?? null,
    changedAt:
      entry.changedAt instanceof Date
        ? entry.changedAt.toISOString()
        : String(entry.changedAt || new Date().toISOString()),
  }));

  if (wrapInEnvelope) {
    const res: StockHistoryResponse = {
      data: formatted,
      page,
    };
    return res;
  }

  return formatted;
}
