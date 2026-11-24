import { Router } from 'express';
import { createReservation, getMyReservations, cancelReservation } from '../controllers/reservationController';
import { requireAuth } from '../middleware/auth';

export const reservationRouter = Router();

reservationRouter.use(requireAuth);

reservationRouter.post('/', createReservation);
reservationRouter.get('/me', getMyReservations);
reservationRouter.patch('/:id/cancel', cancelReservation);