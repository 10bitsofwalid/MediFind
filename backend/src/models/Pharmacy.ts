// backend/src/models/Pharmacy.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import type {
  LocationGeoJSON,
  VerificationStatus,
  WeeklyHours,
} from '../types/pharmacy';
import { normalizeLicenseNo } from '../validation/commonValidators';

export interface IPharmacy extends Document {
  ownerId: Types.ObjectId | string;
  name: string;
  ownerName?: string;
  phone: string;
  email?: string;
  address: string;
  streetAddress?: string;
  city?: string;
  area?: string;
  postalCode?: string;
  formattedAddress?: string;
  licenseNo: string;
  normalizedLicenseNo: string;
  issuingAuthority?: string;
  licenseExpiryDate?: string;
  licenseType?: string;
  location: LocationGeoJSON;
  latitude?: number;
  longitude?: number;
  openingHours: string;
  structuredHours?: WeeklyHours;
  status: VerificationStatus;
  verificationReason?: string;
  decisionReason?: string;
  nextStep?: string;
  verifiedBy?: Types.ObjectId | string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const PharmacySchema = new Schema<IPharmacy>(
  {
    ownerId: {
      type: Schema.Types.Mixed,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
    },
    ownerName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    streetAddress: { type: String, trim: true },
    city: { type: String, trim: true },
    area: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    formattedAddress: { type: String, trim: true },
    licenseNo: {
      type: String,
      required: true,
      trim: true,
      set: function (this: any, val: string) {
        if (val) {
          this.normalizedLicenseNo = normalizeLicenseNo(val);
        }
        return val;
      },
    },
    normalizedLicenseNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: function (this: any) {
        return normalizeLicenseNo(this.licenseNo);
      },
      set: (v: string) => normalizeLicenseNo(v),
    },
    issuingAuthority: { type: String, trim: true },
    licenseExpiryDate: { type: String, trim: true },
    licenseType: { type: String, trim: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coords: number[]) => Array.isArray(coords) && coords.length === 2,
          message: 'Location coordinates must be [longitude, latitude]',
        },
      },
    },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    openingHours: { type: String, required: true, trim: true },
    structuredHours: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'suspended'],
      default: 'pending',
      required: true,
    },
    verificationReason: { type: String, trim: true },
    decisionReason: { type: String, trim: true },
    nextStep: { type: String, trim: true },
    verifiedBy: {
      type: Schema.Types.Mixed,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook: normalize licence number and synchronize coordinates
PharmacySchema.pre('validate', function () {
  if (this.licenseNo && !this.normalizedLicenseNo) {
    this.normalizedLicenseNo = normalizeLicenseNo(this.licenseNo);
  }

  if (this.location && Array.isArray(this.location.coordinates) && this.location.coordinates.length >= 2) {
    if (this.longitude === undefined) this.longitude = this.location.coordinates[0];
    if (this.latitude === undefined) this.latitude = this.location.coordinates[1];
  } else if (this.latitude !== undefined && this.longitude !== undefined) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  }

  if (!this.formattedAddress && this.address) {
    this.formattedAddress = this.address;
  }
});

/**
 * Database Indexes & Documentation:
 * 1. location ('2dsphere'): Geospatial index enabling efficient proximity searches ($near, $geoNear, $geoWithin)
 *    for customer discovery within radius (e.g. 5 km radius from user's GPS/preset location).
 * 2. normalizedLicenseNo (unique): Enforces global DGDA drug licence number uniqueness across all pharmacies.
 * 3. ownerId (unique): Enforces 1:1 owner-to-pharmacy cardinality constraint (SRS BR-02), preventing multi-pharmacy
 *    ownership until multi-tenancy is approved for Phase 2.
 * 4. status: Optimizes availability queries to ensure customer discovery queries filter strictly for 'verified' pharmacies.
 */
PharmacySchema.index({ location: '2dsphere' }, { name: 'idx_pharmacy_location_2dsphere' });
PharmacySchema.index(
  { normalizedLicenseNo: 1 },
  { unique: true, name: 'idx_pharmacy_normalized_license_unique' }
);
PharmacySchema.index({ ownerId: 1 }, { unique: true, name: 'idx_pharmacy_owner_id_unique' });
PharmacySchema.index({ status: 1 }, { name: 'idx_pharmacy_status' });

export const Pharmacy: Model<IPharmacy> =
  mongoose.models.Pharmacy || mongoose.model<IPharmacy>('Pharmacy', PharmacySchema);
