// backend/src/models/Pharmacy.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export type PharmacyVerificationStatus = 'Pending' | 'Verified' | 'Rejected' | 'Suspended';

export interface IOperatingHours {
  openTime: string; // e.g. "08:00"
  closeTime: string; // e.g. "22:00"
  closed?: boolean;
}

export interface IPharmacy extends Document {
  name: string;
  licenseNumber: string;
  ownerId: mongoose.Types.ObjectId;
  address: string;
  area: string; // e.g. 'Dhanmondi'
  phone: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude] for GeoJSON
  };
  verificationStatus: PharmacyVerificationStatus;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  operatingHours: Record<string, IOperatingHours>; // monday -> { openTime, closeTime }
  createdAt: Date;
  updatedAt: Date;
}

const PharmacySchema = new Schema<IPharmacy>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    area: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected', 'Suspended'],
      default: 'Pending',
      index: true,
      required: true,
    },
    verifiedAt: Date,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    operatingHours: {
      type: Map,
      of: new Schema(
        {
          openTime: { type: String, default: '08:00' },
          closeTime: { type: String, default: '22:00' },
          closed: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial 2dsphere index for radius discovery queries
PharmacySchema.index({ location: '2dsphere' });

export const Pharmacy: Model<IPharmacy> =
  mongoose.models.Pharmacy || mongoose.model<IPharmacy>('Pharmacy', PharmacySchema);
