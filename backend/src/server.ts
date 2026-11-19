// backend/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { isValidationError } from './validation/validationError';
import { AuthorizationError } from './auth/ownership';
import {
  syntheticPendingApplication,
  syntheticVerifiedPharmacy,
  syntheticStockItems,
  syntheticStockHistory,
  syntheticMedicines,
} from './fixtures/syntheticFixtures';
import {
  formatApplicationResponse,
  formatPharmacyResponse,
  formatStockRecord,
  formatStockHistoryResponse,
  wrapEnvelope,
} from './utils/responseEnvelope';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medifind';

// Core Security & Request Parsing Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(express.json());

// Root & System Health Check
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'MediFind Backend API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      pharmacy: '/api/owner/pharmacy',
      inventory: '/api/owner/inventory',
      application: '/api/owner/pharmacy-application',
      medicines: '/api/medicines',
    },
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Curated Catalogue Search Endpoint (GET /api/medicines)
app.get('/api/medicines', (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const form = typeof req.query.form === 'string' ? req.query.form.trim().toLowerCase() : '';

  let results = syntheticMedicines.filter((m) => m.active);

  if (query) {
    results = results.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.genericName.toLowerCase().includes(query) ||
        m.strength.toLowerCase().includes(query)
    );
  }

  if (form) {
    results = results.filter((m) => m.form.toLowerCase() === form);
  }

  res.json(wrapEnvelope(results));
});

// Pharmacy Application Status (GET /api/owner/pharmacy-application)
app.get('/api/owner/pharmacy-application', (_req: Request, res: Response) => {
  res.json(formatApplicationResponse(syntheticPendingApplication, true));
});

// Pharmacy Profile (GET /api/owner/pharmacy)
app.get('/api/owner/pharmacy', (_req: Request, res: Response) => {
  res.json(formatPharmacyResponse(syntheticVerifiedPharmacy, true));
});

// Inventory List (GET /api/owner/inventory)
app.get('/api/owner/inventory', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';

  let items = syntheticStockItems;

  if (q) {
    items = items.filter(
      (item) =>
        item.medicineName.toLowerCase().includes(q) ||
        item.genericName.toLowerCase().includes(q)
    );
  }

  if (status && status !== 'all') {
    items = items.filter((item) => item.status === status);
  }

  res.json(wrapEnvelope(items));
});

// Stock Item History (GET /api/owner/inventory/:stockId/history)
app.get('/api/owner/inventory/:stockId/history', (_req: Request, res: Response) => {
  res.json(formatStockHistoryResponse(syntheticStockHistory, { limit: 20, nextCursor: null }, true));
});

// Standard 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.path} was not found on this server.`,
    },
  });
});

// Global Normalized Error Handler (Field-level 422 & Auth envelopes)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isValidationError(err)) {
    res.status(err.status || 422).json(err.toJSON());
    return;
  }

  if (err instanceof AuthorizationError) {
    res.status(err.status || 403).json(err.toJSON());
    return;
  }

  const message = err instanceof Error ? err.message : 'An unexpected internal server error occurred.';
  res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message,
    },
  });
});

// Database Connection & Server Startup
async function startServer() {
  try {
    // Attempt MongoDB connection if configured
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[Database] Connected to MongoDB at ${MONGODB_URI}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Database] MongoDB offline: ${errorMsg}`);
    console.warn('[Database] Server running with synthetic fixtures in development fallback mode.');
  }

  app.listen(PORT, () => {
    console.log(`[Server] MediFind Backend listening on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[Server] Pharmacy Profile: http://localhost:${PORT}/api/owner/pharmacy`);
  });
}

// Start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
