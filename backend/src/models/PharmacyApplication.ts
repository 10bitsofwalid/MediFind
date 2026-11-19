// backend/src/models/PharmacyApplication.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import type {
  LocationGeoJSON,
  PharmacyApplicationPayload,
  VerificationStatus,
  WeeklyHours,
} from '../types/pharmacy';
import { normalizeLicenseNo } from '../validation/commonValidators';

export interface IPharmacyApplicationData {
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

export interface IPharmacyApplication extends Document {
  ownerId: Types.ObjectId | string;
  pharmacyId?: Types.ObjectId | string | null;
  status: VerificationStatus;
  submittedAt: Date;
  message: string;
  data: IPharmacyApplicationData;
  normalizedLicenseNo: string;
  verificationReason?: string;
  decisionReason?: string;
  nextStep?: string;
  reviewedBy?: Types.ObjectId | string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PharmacyApplicationDataSchema = new Schema<IPharmacyApplicationData>(
  {
    name: { type: String, required: true, trim: true, minlength: 3 },
    ownerName: { type: String, required: true, trim: true, minlength: 2 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    streetAddress: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true },
    formattedAddress: { type: String, required: true, trim: true },
    licenseNo: { type: String, required: true, trim: true },
    issuingAuthority: { type: String, required: true, trim: true },
    licenseExpiryDate: { type: String, trim: true },
    licenseType: { type: String, trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
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
    openingHours: { type: String, required: true, trim: true },
    structuredHours: { type: Schema.Types.Mixed },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

export const PharmacyApplicationSchema = new Schema<IPharmacyApplication>(
  {
    ownerId: {
      type: Schema.Types.Mixed,
      ref: 'User',
      required: true,
    },
    pharmacyId: {
      type: Schema.Types.Mixed,
      ref: 'Pharmacy',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'suspended'],
      default: 'pending',
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    message: {
      type: String,
      default: 'Pharmacy application submitted successfully and is pending administrator review.',
      trim: true,
    },
    data: {
      type: PharmacyApplicationDataSchema,
      required: true,
    },
    normalizedLicenseNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: function (this: any) {
        return normalizeLicenseNo(this.data?.licenseNo);
      },
      set: (v: string) => normalizeLicenseNo(v),
    },
    verificationReason: { type: String, trim: true },
    decisionReason: { type: String, trim: true },
    nextStep: { type: String, trim: true },
    reviewedBy: {
      type: Schema.Types.Mixed,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook: normalize licence number and ensure GeoJSON coordinate consistency
PharmacyApplicationSchema.pre('validate', function () {
  if (this.data) {
    if (this.data.licenseNo && !this.normalizedLicenseNo) {
      this.normalizedLicenseNo = normalizeLicenseNo(this.data.licenseNo);
    }
    if (this.data.latitude !== undefined && this.data.longitude !== undefined) {
      if (!this.data.location || !this.data.location.coordinates || this.data.location.coordinates.length < 2) {
        this.data.location = {
          type: 'Point',
          coordinates: [this.data.longitude, this.data.latitude],
        };
      }
    }
  }
});

/**
 * Database Indexes & Documentation:
 * 1. normalizedLicenseNo: Unique sparse index preventing duplicate concurrent or approved applications with the same DGDA license.
 * 2. ownerId: Facilitates fast retrieval of the authenticated user's application.
 * 3. (status, submittedAt): Optimizes administrative review queue sorting chronologically.
 */
PharmacyApplicationSchema.index(
  { normalizedLicenseNo: 1 },
  { unique: true, sparse: true, name: 'idx_application_normalized_license' }
);
PharmacyApplicationSchema.index({ ownerId: 1 }, { name: 'idx_application_owner_id' });
PharmacyApplicationSchema.index({ status: 1, submittedAt: 1 }, { name: 'idx_application_queue_sort' });

export const PharmacyApplication: Model<IPharmacyApplication> =
  mongoose.models.PharmacyApplication ||
  mongoose.model<IPharmacyApplication>('PharmacyApplication', PharmacyApplicationSchema);
