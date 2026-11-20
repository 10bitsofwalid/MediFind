// backend/src/models/Medicine.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import type { Medicine as MedicineType } from '../types/stock';

export interface IMedicine extends Document {
  name: string;
  genericName: string;
  form: string;
  strength: string;
  manufacturer?: string;
  description?: string;
  prescriptionRequired?: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const MedicineSchema = new Schema<IMedicine>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
    },
    form: {
      type: String,
      required: true,
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
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

MedicineSchema.index({ name: 'text', genericName: 'text', strength: 'text' });
MedicineSchema.index({ active: 1, form: 1 }, { name: 'idx_medicine_active_form' });

export const Medicine: Model<IMedicine> =
  mongoose.models.Medicine || mongoose.model<IMedicine>('Medicine', MedicineSchema);
