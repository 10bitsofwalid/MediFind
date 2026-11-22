// backend/src/routes/authRoutes.ts
import { Router } from 'express';
import { register, login, logout } from '../controllers/authController';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
