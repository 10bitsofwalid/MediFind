// backend/src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name, phone, role } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, password, and name are required.',
        },
      });
      return;
    }

    const result = await authService.register({ email, password, name, phone, role });
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    if (error.status) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.status === 409 ? 'EMAIL_EXISTS' : error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
          message: error.message,
        },
      });
      return;
    }
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required.',
        },
      });
      return;
    }

    const result = await authService.login({ email, password });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    if (error.status) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.status === 403 ? 'ACCOUNT_BLOCKED' : 'INVALID_CREDENTIALS',
          message: error.message,
        },
      });
      return;
    }
    next(err);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  // Client discards JWT token
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};
