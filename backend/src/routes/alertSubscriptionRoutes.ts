// backend/src/routes/alertSubscriptionRoutes.ts
import { Router } from 'express';
import {
  createSubscription,
  getMySubscriptions,
  cancelSubscription,
} from '../controllers/alertSubscriptionController';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const alertSubscriptionRouter = Router();

alertSubscriptionRouter.use((req, res, next) => requireAuth(req as AuthRequest, res, next));

alertSubscriptionRouter.post('/', (req, res, next) => createSubscription(req as AuthRequest, res, next));
alertSubscriptionRouter.get('/me', (req, res, next) => getMySubscriptions(req as AuthRequest, res, next));
alertSubscriptionRouter.patch('/:id/cancel', (req, res, next) => cancelSubscription(req as AuthRequest, res, next));
