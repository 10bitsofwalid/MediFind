import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { alertSubscriptionService } from '../services/alertSubscriptionService';

export const createSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }

    const { medicineId, contactMethod, contactValue, searchArea } = req.body;
    if (!medicineId || !contactMethod || !contactValue || !searchArea) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'medicineId, contactMethod, contactValue and searchArea are required.' },
      });
      return;
    }

    const sub = await alertSubscriptionService.createSubscription({
      customerId,
      medicineId,
      contactMethod,
      contactValue,
      searchArea,
    });

    res.status(201).json({ success: true, data: sub });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({
        success: false,
        error: { code: err.status === 409 ? 'DUPLICATE_SUBSCRIPTION' : 'BAD_REQUEST', message: err.message },
      });
      return;
    }
    next(err);
  }
};

export const getMySubscriptions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }

    const list = await alertSubscriptionService.getCustomerSubscriptions(customerId);
    res.status(200).json({ success: true, count: list.length, data: list });
  } catch (err) {
    next(err);
  }
};

export const cancelSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }

    const subscriptionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const sub = await alertSubscriptionService.cancelSubscription(customerId, subscriptionId);
    res.status(200).json({ success: true, message: 'Alert subscription cancelled.', data: sub });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
      return;
    }
    next(err);
  }
};