// backend/src/models/Stock.ts
// Merged: Jawad (customer availability) + main (pharmacy-ops inventory)
// Unified schema supports both customer discovery and pharmacy owner stock management
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type StockStatus = 'available' | 'low' | 'out' | 'unverified';

export interface IStock extends Document {
  stockId?: string;
  pharmacyId: Types.ObjectId | string;
  medicineId: Types.ObjectId | string;
  // Jawad uses stockStatus; main uses status — both supported
  stockStatus?: StockStatus;
  status?: StockStatus;
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
    stockId: {
      type: String,
      trim: true,
    },
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
    // Unified status field — both customer and pharmacy-ops use this
    status: {
      type: String,
      enum: ['available', 'low', 'out', 'unverified'],
      default: 'available',
      required: true,
    },
    // Alias for Jawad's customer availability service
    stockStatus: {
      type: String,
      enum: ['available', 'low', 'out', 'unverified'],
    },
    quantity: {
      type: Number,
      min: [0, 'Quantity must be a whole number of 0 or greater.'],
      validate: {
        validator: (v: number | null | undefined) =>
          v === undefined || v === null || Number.isInteger(v),
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

// Pre-save hook: sync stockStatus <-> status and refresh updatedAt
StockSchema.pre('save', function () {
  this.updatedAt = new Date();
  // keep both aliases in sync
  if (this.status && !this.stockStatus) this.stockStatus = this.status;
  if (this.stockStatus && !this.status) this.status = this.stockStatus;
});

StockSchema.index(
  { pharmacyId: 1, medicineId: 1 },
  { unique: true, name: 'idx_stock_pharmacy_medicine_unique' }
);
StockSchema.index({ pharmacyId: 1, status: 1 }, { name: 'idx_stock_pharmacy_status' });
StockSchema.index({ pharmacyId: 1, updatedAt: -1 }, { name: 'idx_stock_pharmacy_updated_desc' });
StockSchema.index({ medicineId: 1, status: 1 }, { name: 'idx_stock_medicine_discovery' });

export const Stock: Model<IStock> =
  mongoose.models.Stock || mongoose.model<IStock>('Stock', StockSchema);
