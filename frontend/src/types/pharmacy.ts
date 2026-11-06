// src/types/pharmacy.ts
export type Role = 'CUSTOMER' | 'PHARMACY' | 'ADMIN';

export type StockStatus = 'available' | 'low' | 'out' | 'unverified';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export interface LocationGeoJSON {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
}

export interface Pharmacy {
    _id: string;
    name: string;
    address: string;
    phone: string;
    location: LocationGeoJSON;
    openingHours: string;
    status: VerificationStatus;
    distanceKm?: number;
}

export interface StockItem {
    pharmacyId: string;
    medicineId: string;
    status: StockStatus;
    quantity?: number;
    updatedAt: string;
    isStale?: boolean; // Set true if updatedAt > 24 hours ago
}