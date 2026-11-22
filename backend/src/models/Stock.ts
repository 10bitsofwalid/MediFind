// backend/src/models/Stock.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export type StockStatus = 'available' | 'low' | 'out';

export interface IStock extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  stockStatus: StockStatus;
  quantity?: number;
  price?: number;
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const StockSchema = new Schema<IStock>(
  {
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    stockStatus: {
      type: String,
      enum: ['available', 'low', 'out'],
      default: 'available',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      min: 0,
    },
    price: {
      type: Number,
      min: 0,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique key ensures only one current stock row per pharmacy + medicine
StockSchema.index({ pharmacyId: 1, medicineId: 1 }, { unique: true });

export const Stock: Model<IStock> =
  mongoose.models.Stock || mongoose.model<IStock>('Stock', StockSchema);
