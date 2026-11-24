// backend/src/routes/reservationRoutes.ts
import { Router } from 'express';
import {
  createReservation,
  getMyReservations,
  cancelReservation,
} from '../controllers/reservationController';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const reservationRouter = Router();

reservationRouter.use((req, res, next) => requireAuth(req as AuthRequest, res, next));

reservationRouter.post('/', (req, res, next) => createReservation(req as AuthRequest, res, next));
reservationRouter.get('/me', (req, res, next) => getMyReservations(req as AuthRequest, res, next));
reservationRouter.patch('/:id/cancel', (req, res, next) => cancelReservation(req as AuthRequest, res, next));
