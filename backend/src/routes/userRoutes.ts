// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getProfile, updateProfile, changePassword } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

export const userRouter = Router();

// Protect all /users endpoints with mandatory JWT
userRouter.use(requireAuth);

userRouter.get('/me', getProfile);
userRouter.patch('/me', updateProfile);
userRouter.post('/change-password', changePassword);
