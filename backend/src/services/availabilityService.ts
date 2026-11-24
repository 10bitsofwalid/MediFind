// backend/src/services/availabilityService.ts
import mongoose from 'mongoose';
import { Pharmacy } from '../models/Pharmacy';
import { Stock, IStock } from '../models/Stock';
import { Medicine } from '../models/Medicine';
import { calculateDistanceKm, resolveAreaCoordinates } from '../utils/geoUtils';
import { getPharmacyOpenState } from '../utils/operatingHours';
import { ENV } from '../config/env';

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

    const medicine = await Medicine.findOne({
      _id: params.medicineId,
      active: true,
    });

    if (!medicine) {
      const err = new Error('Medicine not found or inactive in catalogue.');
      (err as any).status = 404;
      throw err;
    }

    let originLat: number;
    let originLng: number;
    let originSource: 'gps' | 'area_centroid';

    if (
      typeof params.lat === 'number' &&
      !isNaN(params.lat) &&
      typeof params.lng === 'number' &&
      !isNaN(params.lng) &&
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
    stockRecords.forEach((s) => {
      stockMap.set(s.pharmacyId.toString(), s);
    });

    const now = new Date();
    const staleThresholdMs = ENV.STALE_HOURS_THRESHOLD * 60 * 60 * 1000;

    let results: NearbyPharmacyDTO[] = verifiedPharmacies
      .map((pharmacy) => {
        const stock = stockMap.get(pharmacy._id.toString());
        const stockStatus = stock ? stock.stockStatus : 'out';
        const quantity = stock ? stock.quantity : 0;
        const updatedAt = stock ? stock.updatedAt : pharmacy.updatedAt;

        const distance = calculateDistanceKm(
          originLat,
          originLng,
          pharmacy.location.coordinates[1],
          pharmacy.location.coordinates[0]
        );

        const ageMs = now.getTime() - new Date(updatedAt).getTime();
        const isStale = ageMs >= staleThresholdMs;

        const { isOpen, hoursText } = getPharmacyOpenState(pharmacy.operatingHours, now);

        return {
          id: `result-${pharmacy._id}`,
          pharmacyId: pharmacy._id.toString(),
          pharmacyName: pharmacy.name,
          isVerified: pharmacy.verificationStatus === 'Verified',
          address: pharmacy.address,
          area: pharmacy.area,
          latitude: pharmacy.location.coordinates[1],
          longitude: pharmacy.location.coordinates[0],
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

    return {
      medicine,
      origin: { lat: originLat, lng: originLng, source: originSource },
      results,
    };
  }

  async getPharmacyStockDetail(pharmacyId: string, medicineId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(pharmacyId) || !mongoose.Types.ObjectId.isValid(medicineId)) {
      const err = new Error('Invalid ID format.');
      (err as any).status = 400;
      throw err;
    }

    const pharmacy = await Pharmacy.findOne({
      _id: pharmacyId,
      verificationStatus: 'Verified',
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

    const { isOpen, hoursText } = getPharmacyOpenState(pharmacy.operatingHours, now);

    return {
      pharmacy: {
        id: pharmacy._id,
        name: pharmacy.name,
        licenseNumber: pharmacy.licenseNumber,
        isVerified: true,
        address: pharmacy.address,
        area: pharmacy.area,
        phone: pharmacy.phone,
        latitude: pharmacy.location.coordinates[1],
        longitude: pharmacy.location.coordinates[0],
        isOpen,
        openingHoursText: hoursText,
      },
      medicine: {
        id: medicine._id,
        brandName: medicine.brandName,
        genericName: medicine.genericName,
        strength: medicine.strength,
        dosageForm: medicine.dosageForm,
      },
      stock: {
        status: stock?.stockStatus || 'out',
        quantity: stock?.quantity ?? 0,
        price: stock?.price,
        updatedAt,
        isStale,
      },
    };
  }
}

export const availabilityService = new AvailabilityService();
