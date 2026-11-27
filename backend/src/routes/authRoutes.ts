// backend/src/routes/authRoutes.ts
// Merged: Jawad (customer auth routes) + main (pharmacy-ops auth routes with /me)
import { Router } from 'express';
import {
  register,
  login,
  logout,
  meHandler,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// Customer auth routes (Jawad — used by /api/v1/auth)
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Extended routes used by pharmacy-ops server (main)
// These are aliases pointing to the same endpoints
router.get('/me', requireAuth, meHandler);

export { router as authRouter };
export default router;
