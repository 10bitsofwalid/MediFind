// backend/src/config/env.ts
import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medifind',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_development_secret_medifind_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  STALE_HOURS_THRESHOLD: process.env.STALE_HOURS_THRESHOLD
    ? parseInt(process.env.STALE_HOURS_THRESHOLD, 10)
    : 24,
  DEFAULT_SEARCH_RADIUS_KM: process.env.DEFAULT_SEARCH_RADIUS_KM
    ? parseInt(process.env.DEFAULT_SEARCH_RADIUS_KM, 10)
    : 15,
};
