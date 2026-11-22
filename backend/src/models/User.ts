// backend/src/models/User.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export type UserRole = 'customer' | 'pharmacy_owner' | 'admin';
export type UserStatus = 'active' | 'blocked' | 'pending';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['customer', 'pharmacy_owner', 'admin'],
      default: 'customer',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'pending'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
