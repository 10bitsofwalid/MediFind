// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getProfile, updateProfile, changePassword } from '../controllers/userController';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const userRouter = Router();

// Protect all /users endpoints with mandatory JWT
userRouter.use((req, res, next) => requireAuth(req as AuthRequest, res, next));

userRouter.get('/me', (req, res, next) => getProfile(req as AuthRequest, res, next));
userRouter.patch('/me', (req, res, next) => updateProfile(req as AuthRequest, res, next));
userRouter.post('/change-password', (req, res, next) => changePassword(req as AuthRequest, res, next));
