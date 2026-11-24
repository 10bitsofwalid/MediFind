// backend/src/models/Pharmacy.ts
// Merged: main (pharmacy-ops) + Jawad (customer geospatial discovery)
// Unified schema supports both pharmacy owner management and customer discovery
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
  // main uses lowercase 'status'; Jawad uses 'verificationStatus' — both supported
  status: VerificationStatus;
  verificationStatus?: string;
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
    // Primary status field (lowercase — pharmacy-ops convention)
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'suspended'],
      default: 'pending',
      required: true,
    },
    // Alias for Jawad's customer discovery service (title-case convention)
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected', 'Suspended'],
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

// Pre-validate: sync aliases and normalize fields
PharmacySchema.pre('validate', function () {
  if (this.licenseNo && !this.normalizedLicenseNo) {
    this.normalizedLicenseNo = normalizeLicenseNo(this.licenseNo);
  }

  // Sync location coordinates <-> lat/lng
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

  // Sync verificationStatus (Jawad title-case) <-> status (main lowercase)
  if (this.status && !this.verificationStatus) {
    const map: Record<string, string> = {
      pending: 'Pending', verified: 'Verified', rejected: 'Rejected', suspended: 'Suspended',
    };
    this.verificationStatus = map[this.status] || this.status;
  }
  if (this.verificationStatus && !this.status) {
    this.status = this.verificationStatus.toLowerCase() as VerificationStatus;
  }
});

PharmacySchema.index({ location: '2dsphere' }, { name: 'idx_pharmacy_location_2dsphere' });
PharmacySchema.index(
  { normalizedLicenseNo: 1 },
  { unique: true, name: 'idx_pharmacy_normalized_license_unique' }
);
PharmacySchema.index({ ownerId: 1 }, { unique: true, name: 'idx_pharmacy_owner_id_unique' });
PharmacySchema.index({ status: 1 }, { name: 'idx_pharmacy_status' });

export const Pharmacy: Model<IPharmacy> =
  mongoose.models.Pharmacy || mongoose.model<IPharmacy>('Pharmacy', PharmacySchema);
