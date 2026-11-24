import { Router } from 'express';
import {
  createSubscription,
  getMySubscriptions,
  cancelSubscription,
} from '../controllers/alertSubscriptionController';
import { requireAuth } from '../middleware/auth';

export const alertSubscriptionRouter = Router();

alertSubscriptionRouter.use(requireAuth);

alertSubscriptionRouter.post('/', createSubscription);
alertSubscriptionRouter.get('/me', getMySubscriptions);
alertSubscriptionRouter.patch('/:id/cancel', cancelSubscription);