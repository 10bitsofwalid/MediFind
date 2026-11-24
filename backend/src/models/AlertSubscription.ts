// backend/src/models/AlertSubscription.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAlertSubscription extends Document {
  customerId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  medicineName: string;
  contactMethod: 'email' | 'phone';
  contactValue: string;
  searchArea: string;
  active: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSubscriptionSchema = new Schema<IAlertSubscription>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    contactMethod: {
      type: String,
      enum: ['email', 'phone'],
      required: true,
    },
    contactValue: {
      type: String,
      required: true,
      trim: true,
    },
    searchArea: {
      type: String,
      required: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    notifiedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate active alerts per user + medicine
AlertSubscriptionSchema.index(
  { customerId: 1, medicineId: 1, active: 1 },
  { unique: false }
);

export const AlertSubscription: Model<IAlertSubscription> =
  mongoose.models.AlertSubscription ||
  mongoose.model<IAlertSubscription>('AlertSubscription', AlertSubscriptionSchema);
