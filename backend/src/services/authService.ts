// backend/src/services/authService.ts
import bcrypt from 'bcrypt';
import { User, IUser, UserRole } from '../models/User';
import { signToken } from '../utils/jwt';

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: UserRole;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: UserRole;
  };
}

export class AuthService {
  async register(data: RegisterDTO): Promise<AuthResult> {
    const emailNormalized = data.email.trim().toLowerCase();

    // Prevent public admin creation
    if (data.role === 'admin') {
      const err = new Error('Public registration for admin role is prohibited.');
      (err as unknown as { status: number }).status = 403;
      throw err;
    }

    if (!data.password || data.password.length < 6) {
      const err = new Error('Password must be at least 6 characters long.');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

    const existing = await User.findOne({ email: emailNormalized });
    if (existing) {
      const err = new Error('An account with this email address already exists.');
      (err as unknown as { status: number }).status = 409;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = new User({
      email: emailNormalized,
      passwordHash,
      name: data.name.trim(),
      phone: data.phone?.trim(),
      role: data.role || 'customer',
      status: 'active',
    });

    await user.save();

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async login(data: LoginDTO): Promise<AuthResult> {
    const emailNormalized = data.email.trim().toLowerCase();
    const user = await User.findOne({ email: emailNormalized });

    if (!user) {
      const err = new Error('Invalid email or password.');
      (err as unknown as { status: number }).status = 401;
      throw err;
    }

    if (user.status === 'blocked') {
      const err = new Error('Your account has been suspended. Please contact support.');
      (err as unknown as { status: number }).status = 403;
      throw err;
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      const err = new Error('Invalid email or password.');
      (err as unknown as { status: number }).status = 401;
      throw err;
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }
}

export const authService = new AuthService();
