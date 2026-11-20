// backend/src/models/Stock.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import type { StockStatus } from '../types/pharmacy';

export interface IStock extends Document {
  pharmacyId: Types.ObjectId | string;
  medicineId: Types.ObjectId | string;
  status: StockStatus;
  quantity?: number;
  price?: number;
  notes?: string;
  updatedBy?: Types.ObjectId | string | null;
  updatedByName?: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export const StockSchema = new Schema<IStock>(
  {
    pharmacyId: {
      type: Schema.Types.Mixed,
      ref: 'Pharmacy',
      required: true,
    },
    medicineId: {
      type: Schema.Types.Mixed,
      ref: 'Medicine',
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'low', 'out', 'unverified'],
      default: 'available',
      required: true,
    },
    quantity: {
      type: Number,
      min: [0, 'Quantity must be a whole number of 0 or greater.'],
      validate: {
        validator: (v: number | null | undefined) => v === undefined || v === null || Number.isInteger(v),
        message: 'Quantity must be a whole number of 0 or greater.',
      },
    },
    price: {
      type: Number,
      min: [0, 'Price must be 0 or greater.'],
    },
    notes: {
      type: String,
      trim: true,
    },
    updatedBy: {
      type: Schema.Types.Mixed,
      ref: 'User',
      default: null,
    },
    updatedByName: {
      type: String,
      default: null,
      trim: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: ensure updatedAt is refreshed on modification
StockSchema.pre('save', function () {
  this.updatedAt = new Date();
});

/**
 * Database Indexes & Documentation:
 * 1. (pharmacyId, medicineId) [UNIQUE]: Compound unique index preventing duplicate inventory records
 *    for the same catalogue medicine at a single pharmacy. Ensures that each medicine is listed at most once.
 * 2. (pharmacyId, status): Accelerates inventory filtering by status (Available, Low Stock, Out of Stock, Unverified).
 * 3. (pharmacyId, updatedAt): Supports default inventory sorting (newest reports first) and freshness evaluation.
 * 4. (medicineId, status): Supports inverse lookup across all pharmacies stocking a specific medicine for customer search.
 */
StockSchema.index(
  { pharmacyId: 1, medicineId: 1 },
  { unique: true, name: 'idx_stock_pharmacy_medicine_unique' }
);
StockSchema.index({ pharmacyId: 1, status: 1 }, { name: 'idx_stock_pharmacy_status' });
StockSchema.index({ pharmacyId: 1, updatedAt: -1 }, { name: 'idx_stock_pharmacy_updated_desc' });
StockSchema.index({ medicineId: 1, status: 1 }, { name: 'idx_stock_medicine_discovery' });

export const Stock: Model<IStock> =
  mongoose.models.Stock || mongoose.model<IStock>('Stock', StockSchema);
