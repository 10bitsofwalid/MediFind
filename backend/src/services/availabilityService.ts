// backend/src/services/availabilityService.ts
import mongoose, { Types } from 'mongoose';
import { Pharmacy, IPharmacy } from '../models/Pharmacy';
import { Stock, IStock } from '../models/Stock';
import { findMedicineById, searchCatalogue, getAllInMemoryStocks } from './stockService';
import { getAllInMemoryPharmacies, findPharmacyById } from './pharmacyService';
import { calculateFreshness } from '../utils/freshness';
import { ApplicationError } from '../utils/errors';
import type { StockStatus } from '../types/pharmacy';
import type { Medicine } from '../types/stock';

export interface CustomerAvailabilitySearchParams {
  query?: string;
  medicineId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  availability?: string; // 'all' | 'available' | 'low' | 'out' | 'unverified'
  openNow?: boolean;
  sortBy?: 'distance' | 'freshness' | 'availability';
}

export interface NearbyPharmacyResult {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  isVerified: boolean;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  isOpen: boolean;
  openingHoursText: string;
  stockStatus: StockStatus;
  status: StockStatus;
  quantity?: number;
  updatedAt: string;
  isStale: boolean;
  freshness: 'fresh' | 'stale';
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  form: string;
  isDemoData?: boolean;
}

export interface AvailabilitySearchResponse {
  medicine: Medicine | null;
  results: NearbyPharmacyResult[];
}

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Calculates Great-Circle distance between two coordinates in kilometers (Haversine formula).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return 0;
  }
  if (lat1 === 0 && lon1 === 0) return 0;
  if (lat2 === 0 && lon2 === 0) return 0;

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Database-backed search for nearby verified pharmacies reporting stock availability for a medicine.
 *
 * Core Guarantees:
 * 1. Strictly filters for verified pharmacies (`status: 'verified'`). Never presents unverified/pending pharmacies.
 * 2. Exposes BOTH the reported stock status (`stockStatus`) and the freshness calculation (`isStale`, `freshness`) separately.
 * 3. Freshness does NOT alter the reported stock status.
 */
export async function searchNearbyAvailability(
  params: CustomerAvailabilitySearchParams
): Promise<AvailabilitySearchResponse> {
  const queryTrimmed = (params.query || '').trim();
  const medicineIdParam = (params.medicineId || '').trim();

  // 1. Resolve medicine from catalogue
  let targetMedicine: Medicine | null = null;
  if (medicineIdParam) {
    targetMedicine = await findMedicineById(medicineIdParam);
  }
  if (!targetMedicine && queryTrimmed) {
    const candidates = await searchCatalogue(queryTrimmed, undefined, 5);
    if (candidates.length > 0) {
      targetMedicine = candidates[0];
    }
  }

  // 2. Fetch all verified pharmacies
  let verifiedPharmacies: any[] = [];
  if (isConnected()) {
    verifiedPharmacies = await Pharmacy.find({ status: 'verified' }).lean();
  } else {
    verifiedPharmacies = getAllInMemoryPharmacies().filter((p) => p.status === 'verified');
  }

  // Index pharmacies by ID for fast lookup
  const pharmacyMap = new Map<string, any>();
  for (const p of verifiedPharmacies) {
    pharmacyMap.set(String(p._id || p.id), p);
  }

  // 3. Fetch stock records
  let allStocks: any[] = [];
  if (isConnected()) {
    const stockQuery: Record<string, unknown> = {};
    if (targetMedicine) {
      const medId = targetMedicine.id;
      stockQuery.$or = [
        { medicineId: medId },
        ...(Types.ObjectId.isValid(medId) ? [{ medicineId: new Types.ObjectId(medId) }] : []),
      ];
    }
    allStocks = await Stock.find(stockQuery).lean();
  } else {
    allStocks = getAllInMemoryStocks();
    if (targetMedicine) {
      const medId = String(targetMedicine.id);
      allStocks = allStocks.filter((s) => String(s.medicineId) === medId);
    }
  }

  // 4. Resolve customer coordinates and radius
  const customerLat = typeof params.lat === 'number' && Number.isFinite(params.lat) ? params.lat : undefined;
  const customerLng = typeof params.lng === 'number' && Number.isFinite(params.lng) ? params.lng : undefined;
  const radiusKm = typeof params.radiusKm === 'number' && params.radiusKm > 0 ? params.radiusKm : 15;

  const results: NearbyPharmacyResult[] = [];

  for (const stock of allStocks) {
    const pharmaId = String(stock.pharmacyId);
    const pharmacy = pharmacyMap.get(pharmaId);

    // Trust boundary: Must belong to a verified pharmacy
    if (!pharmacy || pharmacy.status !== 'verified') {
      continue;
    }

    // Availability status filter
    const stockStatus = stock.status as StockStatus;
    const availFilter = (params.availability || 'all').trim().toLowerCase();
    if (availFilter && availFilter !== 'all' && stockStatus !== availFilter) {
      continue;
    }

    const pharmaLat =
      pharmacy.latitude ||
      (Array.isArray(pharmacy.location?.coordinates) ? pharmacy.location.coordinates[1] : 0);
    const pharmaLng =
      pharmacy.longitude ||
      (Array.isArray(pharmacy.location?.coordinates) ? pharmacy.location.coordinates[0] : 0);

    let distanceKm = 0;
    if (customerLat !== undefined && customerLng !== undefined) {
      distanceKm = calculateDistanceKm(customerLat, customerLng, pharmaLat, pharmaLng);
      if (distanceKm > radiusKm) {
        continue;
      }
    }

    // Resolve medicine metadata
    let med = targetMedicine;
    if (!med || String(med.id) !== String(stock.medicineId)) {
      med = await findMedicineById(String(stock.medicineId));
    }

    const updatedAtIso =
      stock.updatedAt instanceof Date
        ? stock.updatedAt.toISOString()
        : String(stock.updatedAt || new Date().toISOString());

    // Compute freshness separately from reported stock status
    const freshResult = calculateFreshness(updatedAtIso);

    results.push({
      id: String(stock._id || stock.stockId || stock.id),
      pharmacyId: pharmaId,
      pharmacyName: pharmacy.name,
      isVerified: true,
      address: pharmacy.formattedAddress || pharmacy.address || '',
      phone: pharmacy.phone,
      latitude: pharmaLat,
      longitude: pharmaLng,
      distanceKm,
      isOpen: true,
      openingHoursText: pharmacy.openingHours || 'Schedule on file',
      stockStatus,
      status: stockStatus,
      quantity: typeof stock.quantity === 'number' ? stock.quantity : undefined,
      updatedAt: updatedAtIso,
      isStale: freshResult.isStale,
      freshness: freshResult.freshness,
      medicineId: String(stock.medicineId),
      medicineName: med?.name || stock.medicineName || 'Medicine',
      genericName: med?.genericName || stock.genericName || '',
      strength: med?.strength || stock.strength || '',
      form: med?.form || stock.form || '',
    });
  }

  // Sort results
  const sortBy = params.sortBy || 'distance';
  if (sortBy === 'freshness') {
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } else if (sortBy === 'availability') {
    const priority: Record<StockStatus, number> = {
      available: 0,
      low: 1,
      out: 2,
      unverified: 3,
    };
    results.sort((a, b) => (priority[a.stockStatus] ?? 9) - (priority[b.stockStatus] ?? 9));
  } else {
    // distance default
    results.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return {
    medicine: targetMedicine,
    results,
  };
}

/**
 * Reads public availability for a specific verified pharmacy.
 * Exposes both reported stock status and freshness separately for each stocked medicine.
 */
export async function getPharmacyPublicAvailability(pharmacyId: string): Promise<NearbyPharmacyResult[]> {
  const pharmacy = await findPharmacyById(pharmacyId);
  if (!pharmacy || pharmacy.status !== 'verified') {
    throw new ApplicationError(
      'Pharmacy not found or not currently publicly listed.',
      'NOT_FOUND',
      404
    );
  }

  const pid = String(pharmacy._id || pharmacy.id);
  let stocks: any[] = [];
  if (isConnected()) {
    stocks = await Stock.find({
      $or: [
        { pharmacyId: pid },
        ...(Types.ObjectId.isValid(pid) ? [{ pharmacyId: new Types.ObjectId(pid) }] : []),
      ],
    }).lean();
  } else {
    stocks = getAllInMemoryStocks().filter((s) => String(s.pharmacyId) === pid);
  }

  const results: NearbyPharmacyResult[] = [];
  const pharmaLat = pharmacy.latitude || pharmacy.location?.coordinates?.[1] || 0;
  const pharmaLng = pharmacy.longitude || pharmacy.location?.coordinates?.[0] || 0;

  for (const stock of stocks) {
    const med = await findMedicineById(String(stock.medicineId));
    const updatedAtIso =
      stock.updatedAt instanceof Date
        ? stock.updatedAt.toISOString()
        : String(stock.updatedAt || new Date().toISOString());

    const freshResult = calculateFreshness(updatedAtIso);

    results.push({
      id: String(stock._id || stock.stockId || stock.id),
      pharmacyId: pid,
      pharmacyName: pharmacy.name,
      isVerified: true,
      address: pharmacy.formattedAddress || pharmacy.address || '',
      phone: pharmacy.phone,
      latitude: pharmaLat,
      longitude: pharmaLng,
      distanceKm: 0,
      isOpen: true,
      openingHoursText: pharmacy.openingHours || 'Schedule on file',
      stockStatus: stock.status,
      status: stock.status,
      quantity: typeof stock.quantity === 'number' ? stock.quantity : undefined,
      updatedAt: updatedAtIso,
      isStale: freshResult.isStale,
      freshness: freshResult.freshness,
      medicineId: String(stock.medicineId),
      medicineName: med?.name || stock.medicineName || 'Medicine',
      genericName: med?.genericName || stock.genericName || '',
      strength: med?.strength || stock.strength || '',
      form: med?.form || stock.form || '',
    });
  }

  return results;
}
