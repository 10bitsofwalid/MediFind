// backend/src/models/Medicine.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IMedicine extends Document {
  brandName: string;
  genericName: string;
  strength: string; // e.g., '500 mg'
  dosageForm: string; // e.g., 'Tablet', 'Syrup', 'Capsule'
  manufacturer?: string;
  category?: string;
  active: boolean; // Curated active-only catalogue entries
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicine>(
  {
    brandName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    strength: {
      type: String,
      required: true,
      trim: true,
    },
    dosageForm: {
      type: String,
      required: true,
      trim: true,
    },
    manufacturer: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for fuzzy/token deterministic matching
MedicineSchema.index({ brandName: 'text', genericName: 'text', strength: 'text' });

export const Medicine: Model<IMedicine> =
  mongoose.models.Medicine || mongoose.model<IMedicine>('Medicine', MedicineSchema);
