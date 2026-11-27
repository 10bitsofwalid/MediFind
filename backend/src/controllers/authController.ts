// backend/src/controllers/authController.ts
// Merged: main (pharmacy-ops handlers) + Jawad (customer auth handlers)
// Exports all named exports needed by both server.ts (main) and app.ts (Jawad)

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { User } from '../models/User';
import { authService } from '../services/authService';

const inMemoryUsers = new Map<string, any>();

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

const JWT_SECRET = process.env.JWT_SECRET || 'medifind_jwt_secret_dev_key_2026';

function resolveRole(roleRaw: unknown): 'CUSTOMER' | 'PHARMACY' | 'ADMIN' {
  if (typeof roleRaw !== 'string') return 'PHARMACY';
  const cleaned = roleRaw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (cleaned === 'CUSTOMER' || cleaned === 'PATIENT') return 'CUSTOMER';
  if (cleaned === 'ADMIN' || cleaned === 'ADMINISTRATOR') return 'ADMIN';
  return 'PHARMACY';
}

// ============================================================================
// main's pharmacy-ops handlers (registerHandler, loginHandler, etc.)
// ============================================================================

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password, phone, role } = req.body || {};

    const fields: Record<string, string> = {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      fields.name = 'Full name is required.';
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      fields.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fields.email = 'Enter a valid email address.';
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      fields.password = 'Password must be at least 6 characters.';
    }

    if (Object.keys(fields).length > 0) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: Object.values(fields)[0], fields },
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const resolvedRole = resolveRole(role);

    if (resolvedRole === 'ADMIN') {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: 'Administrator accounts cannot be created via public registration.',
        },
      });
      return;
    }

    let existingUser: any = null;
    if (isConnected()) {
      existingUser = await User.findOne({ email: cleanEmail }).lean();
    } else {
      existingUser = inMemoryUsers.get(cleanEmail);
    }

    if (existingUser) {
      res.status(409).json({
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An account with this email address already exists.',
          fields: { email: 'An account with this email address already exists.' },
        },
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();

    const userObj = {
      _id: userId,
      id: userId,
      name: cleanName,
      email: cleanEmail,
      phone: phone ? String(phone).trim() : undefined,
      password: hashedPassword,
      role: resolvedRole,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    if (isConnected()) {
      const { _id, ...restUser } = userObj;
      const doc = new User({
        ...(Types.ObjectId.isValid(userId) ? { _id: new Types.ObjectId(userId) } : {}),
        ...restUser,
      });
      const saved = await doc.save();
      userId = saved._id.toString();
    } else {
      inMemoryUsers.set(cleanEmail, userObj);
    }

    const token = jwt.sign(
      { userId, id: userId, role: resolvedRole, email: cleanEmail, name: cleanName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      id: userId, name: cleanName, email: cleanEmail,
      phone: userObj.phone, role: resolvedRole, status: 'active',
    };

    res.status(201).json({ token, user: safeUser, data: { token, user: safeUser } });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email address or password.' },
      });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();

    let user: any = null;
    if (isConnected()) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = inMemoryUsers.get(cleanEmail);
    }

    if (!user) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email address or password.' },
      });
      return;
    }

    const passwordHash = user.password || user.passwordHash;
    const passwordMatch = passwordHash ? await bcrypt.compare(String(password), passwordHash) : false;
    if (!passwordMatch) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email address or password.' },
      });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'This account has been suspended. Please contact MediFind Compliance.',
        },
      });
      return;
    }

    const userId = String(user.id || user._id);
    const token = jwt.sign(
      { userId, id: userId, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      id: userId, name: user.name, email: user.email, phone: user.phone,
      role: user.role, status: user.status || 'active',
      pharmacyId: user.pharmacyId ? String(user.pharmacyId) : undefined,
    };

    res.status(200).json({ token, user: safeUser, data: { token, user: safeUser } });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.status(200).json({ data: { message: 'Signed out successfully.' } });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    let user: any = null;

    if (isConnected()) {
      if (Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).lean();
      }
    } else {
      for (const u of inMemoryUsers.values()) {
        if (String(u.id || u._id) === userId) { user = u; break; }
      }
    }

    const safeUser = {
      id: userId,
      name: user?.name || req.user?.name || 'Owner User',
      email: user?.email || req.user?.email || 'owner@medifind.example',
      phone: user?.phone,
      role: req.user!.role,
      status: user?.status || 'active',
      pharmacyId: user?.pharmacyId ? String(user.pharmacyId) : undefined,
    };

    res.status(200).json({ user: safeUser, data: { user: safeUser } });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Jawad's customer auth handlers (register, login, logout)
// These delegate to authService which uses passwordHash convention
// ============================================================================

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name, phone, role } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, password, and name are required.' },
      });
      return;
    }

    const result = await authService.register({ email, password, name, phone, role });
    res.status(201).json({ success: true, data: result });
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
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      });
      return;
    }

    const result = await authService.login({ email, password });
    res.status(200).json({ success: true, data: result });
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
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};
