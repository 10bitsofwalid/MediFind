// backend/src/models/SystemSetting.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISystemSetting extends Document {
  key: string;
  value: any;
  description?: string;
  updatedBy?: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export const SystemSettingSchema = new Schema<ISystemSetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    updatedBy: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

SystemSettingSchema.index({ key: 1 }, { unique: true, name: 'idx_system_setting_key' });

export const SystemSetting: Model<ISystemSetting> =
  mongoose.models.SystemSetting ||
  mongoose.model<ISystemSetting>('SystemSetting', SystemSettingSchema);
