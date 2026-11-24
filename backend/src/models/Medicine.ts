// backend/src/models/Medicine.ts
// Merged: Jawad (customer catalogue) + main (pharmacy-ops inventory)
// Unified schema supports both customer discovery and pharmacy inventory management
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IMedicine extends Document {
  // Jawad fields
  brandName?: string;
  // main uses 'name' as primary display name
  name?: string;
  genericName: string;
  // Jawad uses 'dosageForm'; main uses 'form'
  dosageForm?: string;
  form?: string;
  strength: string;
  manufacturer?: string;
  category?: string;
  description?: string;
  prescriptionRequired?: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const MedicineSchema = new Schema<IMedicine>(
  {
    brandName: {
      type: String,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dosageForm: {
      type: String,
      trim: true,
    },
    form: {
      type: String,
      trim: true,
    },
    strength: {
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
    description: {
      type: String,
      trim: true,
    },
    prescriptionRequired: {
      type: Boolean,
      default: false,
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

// Compound text index for fuzzy/token deterministic matching (customer search)
MedicineSchema.index({ brandName: 'text', genericName: 'text', name: 'text', strength: 'text' });
MedicineSchema.index({ active: 1, form: 1 }, { name: 'idx_medicine_active_form' });

export const Medicine: Model<IMedicine> =
  mongoose.models.Medicine || mongoose.model<IMedicine>('Medicine', MedicineSchema);
