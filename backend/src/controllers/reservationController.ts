import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { reservationService } from '../services/reservationService';

export const createReservation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }

    const { pharmacyId, medicineId, quantity } = req.body;
    if (!pharmacyId || !medicineId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'pharmacyId and medicineId are required.' } });
      return;
    }

    const reservation = await reservationService.createReservation({
      customerId,
      pharmacyId,
      medicineId,
      quantity,
    });

    res.status(201).json({ success: true, data: reservation });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ success: false, error: { code: err.status === 429 ? 'LIMIT_EXCEEDED' : err.status === 409 ? 'OUT_OF_STOCK' : 'BAD_REQUEST', message: err.message } });
      return;
    }
    next(err);
  }
};

export const getMyReservations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }

    const list = await reservationService.getCustomerReservations(customerId);
    res.status(200).json({ success: true, count: list.length, data: list });
  } catch (err) {
    next(err);
  }
};

export const cancelReservation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }

    const reservationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { reason } = req.body;

    const result = await reservationService.cancelReservation(customerId, reservationId, reason);
    res.status(200).json({ success: true, message: 'Reservation cancelled successfully.', data: result });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ success: false, error: { code: err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: err.message } });
      return;
    }
    next(err);
  }
};