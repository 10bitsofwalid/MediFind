// backend/src/models/Reservation.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export type ReservationStatus = 'active' | 'collected' | 'cancelled' | 'expired';

export interface IReservation extends Document {
  customerId: mongoose.Types.ObjectId;
  pharmacyId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  pickupCode: string; // 4-digit code
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date; // e.g. createdAt + 2 hours
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
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
    pickupCode: {
      type: String,
      required: true,
      length: 4,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    status: {
      type: String,
      enum: ['active', 'collected', 'cancelled', 'expired'],
      default: 'active',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation || mongoose.model<IReservation>('Reservation', ReservationSchema);
