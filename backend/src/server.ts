// backend/src/server.ts
// Merged: main (pharmacy-ops full server) + Jawad (customer API startup)
// This file is the MAIN SERVER used for production/development.
// Jawad's customer routes are mounted via app.ts; main's pharmacy-ops routes remain.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { isValidationError } from './validation/validationError';
import { AuthorizationError } from './auth/ownership';
import { ApplicationError } from './utils/errors';
import ownerRouter from './routes/ownerRoutes';
import { authRouter } from './routes/authRoutes';
import { requireAuth } from './middleware/authMiddleware';
import { meHandler } from './controllers/authController';
import { getMedicinesHandler } from './controllers/stockController';
import {
  searchNearbyPharmaciesHandler,
  getPharmacyAvailabilityHandler,
  getNearbyAvailability,
  getPharmacyStockDetail,
} from './controllers/availabilityController';
import {
  getQualityThresholdsHandler,
  updateQualityThresholdsHandler,
  listPharmacyApplicationsHandler,
  approvePharmacyApplicationHandler,
  rejectPharmacyApplicationHandler,
  suspendPharmacyHandler,
  reactivatePharmacyHandler,
} from './controllers/adminController';
import { Pharmacy } from './models/Pharmacy';
import { PharmacyApplication } from './models/PharmacyApplication';
import { Stock } from './models/Stock';
import { StockHistory } from './models/StockHistory';
import { Medicine } from './models/Medicine';

// Customer API app (Jawad) — mounted under /api/v1
import { app as customerApp } from './app';

// Load environment variables
dotenv.config();

export function validateEnvironment(): {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  jwtSecret: string;
  corsOrigins: string[];
} {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '5000', 10);
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medifind';
  const jwtSecret = process.env.JWT_SECRET || 'medifind_jwt_secret_dev_key_2026';

  if ((nodeEnv === 'production' || nodeEnv === 'staging') && jwtSecret === 'medifind_jwt_secret_dev_key_2026') {
    throw new Error(
      `[Security Fatal] Insecure default JWT_SECRET detected in ${nodeEnv} environment. Set a strong random secret.`
    );
  }

  const defaultCors = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ];
  const envCors = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const corsOrigins = envCors.length > 0 ? envCors : defaultCors;

  return { port, nodeEnv, mongoUri, jwtSecret, corsOrigins };
}

const envConfig = validateEnvironment();
const app = express();
const PORT = envConfig.port;
const MONGODB_URI = envConfig.mongoUri;

// Core Security & Request Parsing Middleware
app.use(helmet());
app.use(cors({ origin: envConfig.corsOrigins, credentials: true }));
app.use(express.json());

// Privacy-Preserving Structured Request Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const rawReqId = req.headers['x-request-id'];
  const requestId = Array.isArray(rawReqId)
    ? rawReqId[0]
    : rawReqId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      const statusGroup = Math.floor(res.statusCode / 100);
      const level = statusGroup === 5 ? 'ERROR' : statusGroup === 4 ? 'WARN' : 'INFO';
      console.log(`[HTTP ${level}] ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms (id: ${requestId})`);
    }
  });

  next();
});

// Health Check Endpoints
function getHealthPayload() {
  const isDbConnected = mongoose.connection.readyState === 1;
  return {
    status: isDbConnected ? 'ok' : 'degraded',
    mode: isDbConnected ? 'mongodb' : 'synthetic_development_fallback',
    database: isDbConnected ? 'connected' : 'disconnected',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'MediFind Backend (Unified)',
  };
}

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'MediFind Backend API (Unified)',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      customerAPI: '/api/v1',
      pharmacy: '/api/owner/pharmacy',
      inventory: '/api/owner/inventory',
      application: '/api/owner/pharmacy-application',
      medicines: '/api/medicines',
      adminVerification: '/api/admin/pharmacy-applications',
    },
  });
});

app.get('/health', (_req: Request, res: Response) => res.json(getHealthPayload()));
app.get('/api/health', (_req: Request, res: Response) => res.json(getHealthPayload()));

// =========================================================================
// Jawad's Customer API (mounted under /api/v1)
// =========================================================================
app.use('/api/v1', customerApp);

// =========================================================================
// main's Pharmacy-Ops Routes
// =========================================================================

// Curated Catalogue Search
app.get('/medicines', getMedicinesHandler);
app.get('/api/medicines', getMedicinesHandler);

// Customer Proximity & Availability Discovery
app.get('/pharmacies/nearby', searchNearbyPharmaciesHandler);
app.get('/api/pharmacies/nearby', searchNearbyPharmaciesHandler);
app.get('/availability/search', searchNearbyPharmaciesHandler);
app.get('/api/availability/search', searchNearbyPharmaciesHandler);
app.get('/pharmacies/:pharmacyId/availability', getPharmacyAvailabilityHandler);
app.get('/api/pharmacies/:pharmacyId/availability', getPharmacyAvailabilityHandler);

// Admin Configuration Endpoints
app.get('/admin/settings/quality-thresholds', getQualityThresholdsHandler);
app.get('/api/admin/settings/quality-thresholds', getQualityThresholdsHandler);
app.patch('/admin/settings/quality-thresholds', updateQualityThresholdsHandler);
app.patch('/api/admin/settings/quality-thresholds', updateQualityThresholdsHandler);

// Admin Pharmacy Verification Queue
app.get('/admin/pharmacy-applications', listPharmacyApplicationsHandler);
app.get('/api/admin/pharmacy-applications', listPharmacyApplicationsHandler);
app.post('/admin/pharmacy-applications/:applicationId/approve', approvePharmacyApplicationHandler);
app.post('/api/admin/pharmacy-applications/:applicationId/approve', approvePharmacyApplicationHandler);
app.post('/admin/pharmacy-applications/:applicationId/reject', rejectPharmacyApplicationHandler);
app.post('/api/admin/pharmacy-applications/:applicationId/reject', rejectPharmacyApplicationHandler);
app.post('/admin/pharmacies/:pharmacyId/suspend', suspendPharmacyHandler);
app.post('/api/admin/pharmacies/:pharmacyId/suspend', suspendPharmacyHandler);
app.post('/admin/pharmacies/:pharmacyId/reactivate', reactivatePharmacyHandler);
app.post('/api/admin/pharmacies/:pharmacyId/reactivate', reactivatePharmacyHandler);

// Authentication & User Identity
app.use('/auth', authRouter);
app.use('/api/auth', authRouter);
app.get('/me', requireAuth, meHandler);
app.get('/api/me', requireAuth, meHandler);

// Pharmacy Owner Operations Namespace
app.use('/api/owner', ownerRouter);
app.use('/owner', ownerRouter);

// Standard 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.path} was not found on this server.`,
    },
  });
});

// Global Error Handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Malformed JSON payload in request body.' } });
    return;
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'A duplicate record already exists in the system.' } });
    return;
  }

  if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'MongoNetworkError') {
    res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database temporarily unavailable. Please try again shortly.' } });
    return;
  }

  if (isValidationError(err)) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: err.message, fields: err.fields } });
    return;
  }

  if (err instanceof AuthorizationError) {
    res.status(403).json({ error: { code: 'AUTHORIZATION_ERROR', message: err.message } });
    return;
  }

  if (err instanceof ApplicationError) {
    res.status(err.status || 400).json({ error: { code: err.code || 'APPLICATION_ERROR', message: err.message } });
    return;
  }

  if (err && typeof err === 'object' && 'code' in err && 'status' in err) {
    const e = err as { status?: number; code?: string; message?: string; fields?: Record<string, string> };
    res.status(e.status || 500).json({
      error: { code: e.code || 'SERVER_ERROR', message: e.message || 'An error occurred.', ...(e.fields ? { fields: e.fields } : {}) },
    });
    return;
  }

  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err instanceof Error
      ? err.message
      : 'An unexpected internal server error occurred.';

  res.status(500).json({ error: { code: 'SERVER_ERROR', message } });
});

export async function syncDatabaseIndexes(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Pharmacy.init(),
      PharmacyApplication.init(),
      Stock.init(),
      StockHistory.init(),
      Medicine.init(),
    ]);
    console.log('[Database] Mongoose schema indexes verified and synchronized safely.');
  }
}

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    console.log(`[Database] Connected to MongoDB at ${MONGODB_URI}`);
    await syncDatabaseIndexes();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Database] MongoDB offline: ${errorMsg}`);
    console.warn('[Database] Server running with synthetic fixtures in development fallback mode.');
  }

  app.listen(PORT, () => {
    console.log(`[Server] MediFind Unified Backend listening on http://localhost:${PORT}`);
    console.log(`[Server] Customer API: http://localhost:${PORT}/api/v1`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  });
}

const isRunningTestsOrScript =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test') || arg.includes('walkthrough') || arg.includes('seed'));

if (!isRunningTestsOrScript) {
  startServer();
}

export default app;
