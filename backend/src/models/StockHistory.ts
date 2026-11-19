// backend/src/models/StockHistory.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import type { StockStatus } from '../types/pharmacy';

export interface IStockHistory extends Document {
  stockId?: Types.ObjectId | null;
  pharmacyId: Types.ObjectId;
  medicineId: Types.ObjectId;
  oldStatus: StockStatus | null;
  newStatus: StockStatus;
  oldQuantity?: number | null;
  newQuantity?: number | null;
  changedBy?: Types.ObjectId | null;
  changedByName?: string | null;
  changedAt: Date;
}

export const StockHistorySchema = new Schema<IStockHistory>(
  {
    stockId: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      default: null,
    },
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
    },
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    oldStatus: {
      type: String,
      enum: ['available', 'low', 'out', 'unverified', null],
      default: null,
    },
    newStatus: {
      type: String,
      enum: ['available', 'low', 'out', 'unverified'],
      required: true,
    },
    oldQuantity: {
      type: Number,
      default: null,
    },
    newQuantity: {
      type: Number,
      default: null,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    changedByName: {
      type: String,
      default: null,
      trim: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/**
 * Append-Only Immutability Guardrails:
 * StockHistory represents regulatory audit evidence of stock changes.
 * Under application integrity rules, existing records can NEVER be modified or deleted.
 */

// 1. Prevent modification of existing documents on save()
StockHistorySchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('StockHistory is an append-only audit trail and cannot be modified.');
  }
});

// 2. Prevent update queries
const updateOperations = ['updateOne', 'updateMany', 'findOneAndUpdate', 'findByIdAndUpdate', 'replaceOne'];
for (const op of updateOperations) {
  StockHistorySchema.pre(op as any, function () {
    throw new Error(`StockHistory is an append-only audit trail and cannot be modified via ${op}.`);
  });
}

// 3. Prevent delete queries
const deleteOperations = ['deleteOne', 'deleteMany', 'findOneAndDelete', 'findByIdAndDelete'];
for (const op of deleteOperations) {
  StockHistorySchema.pre(op as any, function () {
    throw new Error(`StockHistory is an append-only audit trail and cannot be deleted via ${op}.`);
  });
}

/**
 * Database Indexes & Documentation:
 * 1. (pharmacyId, medicineId, changedAt DESC): Compound index powering the read-only Stock History modal,
 *    enabling efficient retrieval of the audit log for a specific medicine sorted newest-first.
 * 2. (stockId, changedAt DESC): Enables fast history retrieval by direct stockId reference.
 * 3. changedBy: Index enabling user activity audits (e.g. tracking updates by a specific owner or staff user).
 */
StockHistorySchema.index(
  { pharmacyId: 1, medicineId: 1, changedAt: -1 },
  { name: 'idx_stock_history_pharmacy_medicine_time' }
);
StockHistorySchema.index({ stockId: 1, changedAt: -1 }, { name: 'idx_stock_history_stock_time' });
StockHistorySchema.index({ changedBy: 1 }, { name: 'idx_stock_history_changed_by' });

export const StockHistory: Model<IStockHistory> =
  mongoose.models.StockHistory || mongoose.model<IStockHistory>('StockHistory', StockHistorySchema);
