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

    // Query verified pharmacies — Jawad uses 'verificationStatus: Verified',
    // main uses 'status: verified'. Query both so either convention works.
    const verifiedPharmacies = await Pharmacy.find({
      $or: [{ verificationStatus: 'Verified' }, { status: 'verified' }],
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

        const { isOpen, hoursText } = getPharmacyOpenState(pharmacy.openingHours || '', now);

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
  const medicine = params.medicineId
    ? await findMedicineById(params.medicineId)
    : null;

  if (!medicine && params.medicineId) {
    return { medicine: null, results: [] };
  }

  const allPharmacies = isConnected()
    ? await Pharmacy.find({ $or: [{ status: 'verified' }, { verificationStatus: 'Verified' }] }).lean()
    : getAllInMemoryPharmacies().filter(
        (p: any) => p.status === 'verified' || p.verificationStatus === 'Verified'
      );

  const allStocks = isConnected()
    ? await Stock.find(medicine ? { medicineId: medicine.id || medicine._id } : {}).lean()
    : getAllInMemoryStocks().filter(
        (s: any) => !medicine || String(s.medicineId) === String(medicine.id || (medicine as any)._id)
      );

  const stockByPharmacy = new Map<string, any>();
  allStocks.forEach((s: any) => stockByPharmacy.set(String(s.pharmacyId), s));

  const originLat = params.lat ?? 23.7461;
  const originLng = params.lng ?? 90.3742;
  const radiusKm = params.radiusKm ?? 15;
  const now = new Date();

  const results: NearbyPharmacyResult[] = [];

  for (const pharmacy of allPharmacies as any[]) {
    const coords = pharmacy.location?.coordinates;
    const pharmLng = coords?.[0] ?? pharmacy.longitude ?? 0;
    const pharmLat = coords?.[1] ?? pharmacy.latitude ?? 0;
    const distance = calculateDistanceKm(originLat, originLng, pharmLat, pharmLng);

    if (distance > radiusKm) continue;

    const stock = stockByPharmacy.get(String(pharmacy._id || pharmacy.id));
    const stockStatus: StockStatus = stock?.status || stock?.stockStatus || 'out';

    if (params.availability && params.availability !== 'all' && stockStatus !== params.availability) continue;

    const { isOpen, hoursText } = getPharmacyOpenState(pharmacy.openingHours || '', now);
    if (params.openNow && !isOpen) continue;

    const updatedAt = stock?.updatedAt ? new Date(stock.updatedAt) : now;
    const freshness = calculateFreshness(updatedAt, now);

    results.push({
      id: `result-${pharmacy._id || pharmacy.id}`,
      pharmacyId: String(pharmacy._id || pharmacy.id),
      pharmacyName: pharmacy.name,
      isVerified: true,
      address: pharmacy.address,
      phone: pharmacy.phone,
      latitude: pharmLat,
      longitude: pharmLng,
      distanceKm: distance,
      isOpen,
      openingHoursText: hoursText,
      stockStatus,
      status: stockStatus,
      quantity: stock?.quantity,
      updatedAt: updatedAt.toISOString(),
      isStale: freshness === 'stale',
      freshness,
      medicineId: String(medicine?.id || medicine?._id || ''),
      medicineName: (medicine as any)?.name || (medicine as any)?.brandName || '',
      genericName: (medicine as any)?.genericName || '',
      strength: (medicine as any)?.strength || '',
      form: (medicine as any)?.form || (medicine as any)?.dosageForm || '',
      isDemoData: !isConnected(),
    });
  }

  if (params.sortBy === 'freshness') {
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
