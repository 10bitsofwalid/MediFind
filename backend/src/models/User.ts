// backend/src/models/User.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import bcrypt from 'bcrypt';
import type { Role } from '../types/pharmacy';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: Role;
  status: 'active' | 'pending' | 'suspended';
  pharmacyId?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

export const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'PHARMACY', 'ADMIN'],
      default: 'CUSTOMER',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'active',
      required: true,
    },
    pharmacyId: {
      type: Schema.Types.Mixed,
      ref: 'Pharmacy',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ email: 1 }, { unique: true, name: 'idx_user_email_unique' });
UserSchema.index({ role: 1 }, { name: 'idx_user_role' });

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
