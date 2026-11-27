// backend/src/services/availabilityService.ts
// Merged: Jawad (customer geospatial discovery) + main (pharmacy public availability)
// Exports both AvailabilityService class (Jawad) and standalone functions (main)
import mongoose, { Types } from 'mongoose';
import { Pharmacy, IPharmacy } from '../models/Pharmacy';
import { Stock, IStock } from '../models/Stock';
import { Medicine } from '../models/Medicine';
import { calculateDistanceKm, resolveAreaCoordinates } from '../utils/geoUtils';
import { getPharmacyOpenState } from '../utils/operatingHours';
import { ENV } from '../config/env';
import { findMedicineById, searchCatalogue, getAllInMemoryStocks } from './stockService';
import { getAllInMemoryPharmacies, findPharmacyById } from './pharmacyService';
import { calculateFreshness } from '../utils/freshness';
import { ApplicationError } from '../utils/errors';
import type { StockStatus } from '../types/pharmacy';
import type { Medicine as MedicineType } from '../types/stock';

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// ============================================================================
// Jawad's customer discovery types & AvailabilityService class
// ============================================================================

export interface NearbyAvailabilityParams {
  medicineId: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  area?: string;
  availability?: string[];
  openNow?: boolean;
  sortBy?: 'distance' | 'freshness' | 'availability';
}

export interface NearbyPharmacyDTO {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  isVerified: boolean;
  address: string;
  area: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  stockStatus: 'available' | 'low' | 'out';
  quantity?: number;
  price?: number;
  updatedAt: Date;
  isStale: boolean;
  isOpen: boolean;
  openingHoursText: string;
  phone: string;
  isDemoData?: boolean;
}

export class AvailabilityService {
  async getNearbyAvailability(
    params: NearbyAvailabilityParams
  ): Promise<{
    medicine: any;
    origin: { lat: number; lng: number; source: 'gps' | 'area_centroid' };
    results: NearbyPharmacyDTO[];
  }> {
    if (!mongoose.Types.ObjectId.isValid(params.medicineId)) {
      const err = new Error('Invalid medicine ID format.');
      (err as any).status = 400;
      throw err;
    }

    const medicine = await Medicine.findOne({ _id: params.medicineId, active: true });

    if (!medicine) {
      const err = new Error('Medicine not found or inactive in catalogue.');
      (err as any).status = 404;
      throw err;
    }

    let originLat: number;
    let originLng: number;
    let originSource: 'gps' | 'area_centroid';

    if (
      typeof params.lat === 'number' && !isNaN(params.lat) &&
      typeof params.lng === 'number' && !isNaN(params.lng) &&
      (params.lat !== 0 || params.lng !== 0)
    ) {
      originLat = params.lat;
      originLng = params.lng;
      originSource = 'gps';
    } else {
      const resolved = resolveAreaCoordinates(params.area);
      originLat = resolved.lat;
      originLng = resolved.lng;
      originSource = 'area_centroid';
    }

    const searchRadiusKm = params.radiusKm || ENV.DEFAULT_SEARCH_RADIUS_KM;

    const verifiedPharmacies = await Pharmacy.find({
      verificationStatus: 'Verified',
      location: {
        $geoWithin: {
          $centerSphere: [[originLng, originLat], searchRadiusKm / 6371],
        },
      },
    });

    if (verifiedPharmacies.length === 0) {
      return {
        medicine,
        origin: { lat: originLat, lng: originLng, source: originSource },
        results: [],
      };
    }

    const pharmacyIds = verifiedPharmacies.map((p) => p._id);
    const stockRecords = await Stock.find({
      medicineId: medicine._id,
      pharmacyId: { $in: pharmacyIds },
    });

    const stockMap = new Map<string, IStock>();
    stockRecords.forEach((s) => { stockMap.set(s.pharmacyId.toString(), s); });

    const now = new Date();
    const staleThresholdMs = ENV.STALE_HOURS_THRESHOLD * 60 * 60 * 1000;

    let results: NearbyPharmacyDTO[] = verifiedPharmacies
      .map((pharmacy) => {
        const stock = stockMap.get(pharmacy._id.toString());
        const rawStatus = stock ? (stock.stockStatus || stock.status) : 'out';
        const stockStatus = (rawStatus === 'unverified' ? 'out' : rawStatus) as 'available' | 'low' | 'out';
        const quantity = stock ? stock.quantity : 0;
        const updatedAt = stock ? stock.updatedAt : pharmacy.updatedAt;

        const coords = pharmacy.location?.coordinates;
        const pharmLng = coords?.[0] ?? pharmacy.longitude ?? 0;
        const pharmLat = coords?.[1] ?? pharmacy.latitude ?? 0;

        const distance = calculateDistanceKm(originLat, originLng, pharmLat, pharmLng);
        const ageMs = now.getTime() - new Date(updatedAt).getTime();
        const isStale = ageMs >= staleThresholdMs;

    const { isOpen, hoursText } = getPharmacyOpenState(pharmacy.openingHours as any || '', now);

        return {
          id: `result-${pharmacy._id}`,
          pharmacyId: pharmacy._id.toString(),
          pharmacyName: pharmacy.name,
          isVerified: true,
          address: pharmacy.address,
          area: pharmacy.area || '',
          latitude: pharmLat,
          longitude: pharmLng,
          distanceKm: distance,
          stockStatus,
          quantity,
          price: stock?.price,
          updatedAt,
          isStale,
          isOpen,
          openingHoursText: hoursText,
          phone: pharmacy.phone,
          isDemoData: true,
        };
      })
      .filter((item) => item.distanceKm <= searchRadiusKm);

    if (params.availability && params.availability.length > 0) {
      results = results.filter((item) => params.availability!.includes(item.stockStatus));
    }

    if (params.openNow) {
      results = results.filter((item) => item.isOpen);
    }

    if (params.sortBy === 'freshness') {
      results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (params.sortBy === 'availability') {
      const rank: Record<string, number> = { available: 1, low: 2, out: 3 };
      results.sort((a, b) => (rank[a.stockStatus] || 4) - (rank[b.stockStatus] || 4));
    } else {
      results.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return { medicine, origin: { lat: originLat, lng: originLng, source: originSource }, results };
  }

  async getPharmacyStockDetail(pharmacyId: string, medicineId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(pharmacyId) || !mongoose.Types.ObjectId.isValid(medicineId)) {
      const err = new Error('Invalid ID format.');
      (err as any).status = 400;
      throw err;
    }

    const pharmacy = await Pharmacy.findOne({
      _id: pharmacyId,
      $or: [{ verificationStatus: 'Verified' }, { status: 'verified' }],
    });

    if (!pharmacy) {
      const err = new Error('Verified pharmacy not found.');
      (err as any).status = 404;
      throw err;
    }

    const medicine = await Medicine.findOne({ _id: medicineId, active: true });
    if (!medicine) {
      const err = new Error('Medicine not found in active catalogue.');
      (err as any).status = 404;
      throw err;
    }

    const stock = await Stock.findOne({ pharmacyId: pharmacy._id, medicineId: medicine._id });
    const now = new Date();
    const staleThresholdMs = ENV.STALE_HOURS_THRESHOLD * 60 * 60 * 1000;
    const updatedAt = stock?.updatedAt || pharmacy.updatedAt;
    const isStale = now.getTime() - new Date(updatedAt).getTime() >= staleThresholdMs;

    const { isOpen, hoursText } = getPharmacyOpenState(pharmacy.openingHours || '', now);

    const coords = pharmacy.location?.coordinates;
    const pharmLng = coords?.[0] ?? pharmacy.longitude ?? 0;
    const pharmLat = coords?.[1] ?? pharmacy.latitude ?? 0;

    return {
      pharmacy: {
        id: pharmacy._id,
        name: pharmacy.name,
        isVerified: true,
        address: pharmacy.address,
        area: pharmacy.area || '',
        phone: pharmacy.phone,
        latitude: pharmLat,
        longitude: pharmLng,
        isOpen,
        openingHoursText: hoursText,
      },
      medicine: {
        id: medicine._id,
        brandName: medicine.brandName || medicine.name,
        genericName: medicine.genericName,
        strength: medicine.strength,
        dosageForm: medicine.dosageForm || medicine.form,
      },
      stock: {
        status: stock?.stockStatus || stock?.status || 'out',
        quantity: stock?.quantity ?? 0,
        price: stock?.price,
        updatedAt,
        isStale,
      },
    };
  }
}

export const availabilityService = new AvailabilityService();

// ============================================================================
// main's standalone functions (used by searchNearbyPharmaciesHandler)
// ============================================================================

export interface CustomerAvailabilitySearchParams {
  query?: string;
  medicineId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  availability?: string;
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
  medicine: MedicineType | null;
  results: NearbyPharmacyResult[];
}

export async function searchNearbyAvailability(
  params: CustomerAvailabilitySearchParams
): Promise<AvailabilitySearchResponse> {
  const queryTrimmed = (params.query || '').trim();
  const medicineIdParam = (params.medicineId || '').trim();

  // 1. Resolve medicine from catalogue
  let medicine: MedicineType | null = null;
  if (medicineIdParam) {
    medicine = await findMedicineById(medicineIdParam);
  }
  if (!medicine && queryTrimmed) {
    const candidates = await searchCatalogue(queryTrimmed, undefined, 5);
    if (candidates.length > 0) {
      medicine = candidates[0];
    }
  }

  if (!medicine && medicineIdParam) {
    return { medicine: null, results: [] };
  }

  const allPharmacies = isConnected()
    ? await Pharmacy.find({ $or: [{ status: 'verified' }, { verificationStatus: 'Verified' }] }).lean()
    : getAllInMemoryPharmacies().filter(
        (p: any) => p.status === 'verified' || p.verificationStatus === 'Verified'
      );

  const pharmacyMap = new Map<string, any>();
  for (const p of allPharmacies as any[]) {
    pharmacyMap.set(String(p._id || p.id), p);
  }

  let allStocks: any[] = [];
  if (isConnected()) {
    const stockQuery: Record<string, unknown> = {};
    if (medicine) {
      const medId = medicine.id || (medicine as any)._id;
      stockQuery.$or = [
        { medicineId: medId },
        ...(Types.ObjectId.isValid(String(medId)) ? [{ medicineId: new Types.ObjectId(String(medId)) }] : []),
      ];
    }
    allStocks = await Stock.find(stockQuery).lean();
  } else {
    allStocks = getAllInMemoryStocks();
    if (medicine) {
      const medId = String(medicine.id || (medicine as any)._id);
      allStocks = allStocks.filter((s: any) => String(s.medicineId) === medId);
    }
  }

  const customerLat = typeof params.lat === 'number' && Number.isFinite(params.lat) ? params.lat : undefined;
  const customerLng = typeof params.lng === 'number' && Number.isFinite(params.lng) ? params.lng : undefined;
  const radiusKm = typeof params.radiusKm === 'number' && params.radiusKm > 0 ? params.radiusKm : 15;
  const now = new Date();

  const results: NearbyPharmacyResult[] = [];

  for (const stock of allStocks) {
    const pharmaId = String(stock.pharmacyId);
    const pharmacy = pharmacyMap.get(pharmaId);
    if (!pharmacy) continue;

    const stockStatus: StockStatus = stock.status || stock.stockStatus || 'out';
    if (params.availability && params.availability !== 'all' && stockStatus !== params.availability) continue;

    const coords = pharmacy.location?.coordinates;
    const pharmLng = coords?.[0] ?? pharmacy.longitude ?? 0;
    const pharmLat = coords?.[1] ?? pharmacy.latitude ?? 0;

    let distance = 0;
    if (customerLat !== undefined && customerLng !== undefined) {
      distance = calculateDistanceKm(customerLat, customerLng, pharmLat, pharmLng);
      if (distance > radiusKm) continue;
    }

    const { isOpen, hoursText } = getPharmacyOpenState(pharmacy.openingHours || '', now);
    if (params.openNow && !isOpen) continue;

    let med = medicine;
    if (!med || String(med.id || (med as any)._id) !== String(stock.medicineId)) {
      med = await findMedicineById(String(stock.medicineId));
    }

    const updatedAtIso =
      stock.updatedAt instanceof Date
        ? stock.updatedAt.toISOString()
        : String(stock.updatedAt || now.toISOString());
    const freshResult = calculateFreshness(updatedAtIso);

    results.push({
      id: String(stock._id || stock.stockId || stock.id),
      pharmacyId: pharmaId,
      pharmacyName: pharmacy.name,
      isVerified: true,
      address: pharmacy.formattedAddress || pharmacy.address || '',
      phone: pharmacy.phone,
      latitude: pharmLat,
      longitude: pharmLng,
      distanceKm: distance,
      isOpen,
      openingHoursText: hoursText || pharmacy.openingHours || 'Schedule on file',
      stockStatus,
      status: stockStatus,
      quantity: typeof stock.quantity === 'number' ? stock.quantity : undefined,
      updatedAt: updatedAtIso,
      isStale: freshResult.isStale,
      freshness: freshResult.freshness,
      medicineId: String(stock.medicineId),
      medicineName: med?.name || (med as any)?.brandName || stock.medicineName || 'Medicine',
      genericName: med?.genericName || stock.genericName || '',
      strength: med?.strength || stock.strength || '',
      form: med?.form || (med as any)?.dosageForm || stock.form || '',
      isDemoData: !isConnected(),
    });
  }

  if (params.sortBy === 'freshness') {
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } else if (params.sortBy === 'availability') {
    const priority: Record<StockStatus, number> = {
      available: 0,
      low: 1,
      out: 2,
      unverified: 3,
    };
    results.sort((a, b) => (priority[a.stockStatus] ?? 9) - (priority[b.stockStatus] ?? 9));
  } else {
    results.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return { medicine: medicine as any, results };
}

export async function getPharmacyPublicAvailability(pharmacyId: string): Promise<any[]> {
  const stocks = isConnected()
    ? await Stock.find({ pharmacyId }).lean()
    : getAllInMemoryStocks().filter((s: any) => String(s.pharmacyId) === pharmacyId);

  return stocks.map((s: any) => ({
    medicineId: String(s.medicineId),
    status: s.status || s.stockStatus || 'out',
    quantity: s.quantity,
    updatedAt: s.updatedAt,
  }));
}
