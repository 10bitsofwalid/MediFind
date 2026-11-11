// frontend/src/features/customer/types.ts
import type { StockStatus } from '../../types/pharmacy';

export type AvailabilityFilter = 'all' | 'available' | 'low' | 'out';
export type SortOption = 'distance' | 'freshness' | 'availability';

export interface CustomerSearchParams {
  query: string; // Brand, generic name, or strength
  area?: string; // Manual area string fallback, e.g. "Dhanmondi, Dhaka"
  latitude?: number;
  longitude?: number;
  distanceKm?: number; // e.g. 5, 10, 25
  availability?: AvailabilityFilter;
  openNow?: boolean;
  sortBy?: SortOption;
}

export interface NearbyPharmacyResult {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  isVerified: boolean; // Must NEVER present unverified pharmacy as verified
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  isOpen: boolean;
  openingHoursText: string;
  stockStatus: StockStatus;
  quantity?: number;
  updatedAt: string; // ISO 8601 timestamp
  isStale: boolean;
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  form: string;
}

export interface MedicineSuggestion {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  form: string;
  prescriptionRequired?: boolean;
}

