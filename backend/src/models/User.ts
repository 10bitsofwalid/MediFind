// backend/src/models/User.ts
// Merged: Jawad (customer) + main (pharmacy-ops)
// Unified schema supports all three roles: CUSTOMER, PHARMACY, ADMIN
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import bcrypt from 'bcrypt';

export type UserRole = 'customer' | 'pharmacy_owner' | 'admin' | 'CUSTOMER' | 'PHARMACY' | 'ADMIN';
export type UserStatus = 'active' | 'blocked' | 'pending' | 'suspended';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  passwordHash?: string;
  role: UserRole;
  status: UserStatus;
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
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
    },
    passwordHash: {
      type: String,
      required: function (this: any) {
        return !this.password;
      },
    },
    role: {
      type: String,
      enum: ['customer', 'pharmacy_owner', 'admin', 'CUSTOMER', 'PHARMACY', 'ADMIN'],
      default: 'customer',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'pending', 'suspended'],
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
  const hash = this.password || this.passwordHash;
  if (!hash) return false;
  return bcrypt.compare(candidate, hash);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
