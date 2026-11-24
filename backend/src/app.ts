// backend/src/app.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './config/env';

import { authRouter } from './routes/authRoutes';
import { userRouter } from './routes/userRoutes';
import { medicineRouter } from './routes/medicineRoutes';
import { availabilityRouter } from './routes/availabilityRoutes';
import { reservationRouter } from './routes/reservationRoutes';
import { alertSubscriptionRouter } from './routes/alertSubscriptionRoutes';

export const app: Application = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: ENV.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/medicines', medicineRouter);
app.use('/api/v1/availability', availabilityRouter);
app.use('/api/v1/reservations', reservationRouter);
app.use('/api/v1/subscriptions', alertSubscriptionRouter);

// Liveness & Readiness endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MediFind Customer & Identity API',
  });
});

app.get('/ready', (_req: Request, res: Response) => {
  res.status(200).json({
    ready: true,
    env: ENV.NODE_ENV,
    uptime: process.uptime(),
  });
});

// Standard 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested resource does not exist.',
    },
  });
});

// Global error envelope handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]:', err.message);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: ENV.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    },
  });
});
