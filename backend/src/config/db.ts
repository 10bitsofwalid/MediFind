// backend/src/config/db.ts
import mongoose from 'mongoose';
import { ENV } from './env';

export const connectDB = async (): Promise<typeof mongoose | null> => {
  try {
    const conn = await mongoose.connect(ENV.MONGODB_URI);
    if (ENV.NODE_ENV !== 'test') {
      console.log(`[MongoDB] Connected to database: ${conn.connection.name}`);
    }
    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    if (ENV.NODE_ENV === 'production') {
      process.exit(1);
    }
    return null;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('[MongoDB] Disconnect error:', error);
  }
};
