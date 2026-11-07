// src/types/pharmacy.ts

export type Role = 'CUSTOMER' | 'PHARMACY' | 'ADMIN';

export type StockStatus = 'available' | 'low' | 'out' | 'unverified';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export interface LocationGeoJSON {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface DaySchedule {
  isOpen: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "22:00"
  is24Hours?: boolean;
}

export type WeeklyHours = Record<DayOfWeek, DaySchedule>;

export interface PharmacyApplicationPayload {
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  streetAddress: string;
  city: string;
  area: string;
  postalCode?: string;
  formattedAddress: string;
  licenseNo: string;
  issuingAuthority: string;
  licenseExpiryDate?: string;
  licenseType?: string;
  latitude: number;
  longitude: number;
  location: LocationGeoJSON;
  openingHours: string;
  structuredHours?: WeeklyHours;
  notes?: string;
}

export interface PharmacyApplicationResponse {
  applicationId: string;
  pharmacyId?: string;
  status: VerificationStatus;
  submittedAt: string;
  message: string;
  data: PharmacyApplicationPayload;
  verificationReason?: string;
}

export interface Pharmacy {
  _id: string;
  id?: string;
  ownerId?: string;
  name: string;
  address: string;
  phone: string;
  licenseNo?: string;
  location: LocationGeoJSON;
  openingHours: string;
  status: VerificationStatus;
  verificationReason?: string;
  distanceKm?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockItem {
  pharmacyId: string;
  medicineId: string;
  status: StockStatus;
  quantity?: number;
  updatedAt: string;
  isStale?: boolean; // Set true if updatedAt > 24 hours ago
}
