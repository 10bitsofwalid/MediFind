// src/services/authService.ts
import { api } from './api';
import axios from 'axios';
import type { Role } from '../types/pharmacy';
import type { User, LoginCredentials, RegisterPayload } from '../types/auth';
import { isMockApiEnabled } from './pharmacyService';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const MOCK_USERS_KEY = 'medifind_mock_users';

interface StoredMockUser extends User {
  password: string;
}

export class AuthServiceError extends Error {
  code?: string;
  status?: number;
  fields?: Record<string, string>;

  constructor(
    message: string,
    code?: string,
    status?: number,
    fields?: Record<string, string>,
    cause?: unknown
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'AuthServiceError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function normalizeUserRole(raw: unknown): Role | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (cleaned === 'PHARMACY' || cleaned === 'PHARMACY_OWNER' || cleaned === 'OWNER') {
    return 'PHARMACY';
  }
  if (cleaned === 'CUSTOMER' || cleaned === 'PATIENT') {
    return 'CUSTOMER';
  }
  if (cleaned === 'ADMIN' || cleaned === 'ADMINISTRATOR') {
    return 'ADMIN';
  }
  return null;
}

function normalizeAccountStatus(raw: unknown): User['status'] {
  if (typeof raw !== 'string') return 'active';
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === 'suspended' || cleaned === 'disabled') return 'suspended';
  if (cleaned === 'pending') return 'pending';
  return 'active';
}

function normalizeServerUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id =
    typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : typeof obj._id === 'string' && obj._id.trim()
      ? obj._id.trim()
      : typeof obj.userId === 'string' && obj.userId.trim()
      ? obj.userId.trim()
      : '';

  const email = typeof obj.email === 'string' ? obj.email.trim().toLowerCase() : '';
  const role =
    normalizeUserRole(obj.role) ||
    (Array.isArray(obj.roles) ? normalizeUserRole(obj.roles[0]) : null);

  if (!id || !email || !role) return null;

  const name =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim()
      : email.split('@')[0] || 'User';

  return {
    id,
    name,
    email,
    phone: typeof obj.phone === 'string' && obj.phone.trim() ? obj.phone.trim() : undefined,
    role,
    status: normalizeAccountStatus(obj.status ?? obj.accountStatus),
    pharmacyId:
      typeof obj.pharmacyId === 'string' && obj.pharmacyId.trim()
        ? obj.pharmacyId.trim()
        : undefined,
  };
}

function extractAuthResponse(raw: unknown): { user: User; token: string } {
  if (!raw || typeof raw !== 'object') {
    throw new AuthServiceError(
      'Server returned an invalid authentication response.',
      'INVALID_RESPONSE',
      502
    );
  }

  const root = raw as Record<string, unknown>;
  const payload =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  const rawToken = payload.token ?? payload.accessToken;
  const token = typeof rawToken === 'string' && rawToken.trim() ? rawToken.trim() : '';
  const user = normalizeServerUser(payload.user ?? payload.account);

  if (!token || !user) {
    throw new AuthServiceError(
      'Server authentication confirmation was missing required session or account details.',
      'INVALID_RESPONSE',
      502
    );
  }

  return { user, token };
}

function mapAxiosAuthError(
  err: unknown,
  fallbackMessage: string,
  context: 'login' | 'register' | 'me'
): AuthServiceError {
  if (err instanceof AuthServiceError) return err;

  if (axios.isAxiosError(err)) {
    const httpStatus = err.response?.status;
    const responseData = err.response?.data as Record<string, unknown> | undefined;
    const errorPayload =
      responseData?.error && typeof responseData.error === 'object'
        ? (responseData.error as Record<string, unknown>)
        : undefined;

    const serverMessage =
      typeof errorPayload?.message === 'string' && errorPayload.message.trim()
        ? errorPayload.message.trim()
        : typeof responseData?.message === 'string' && responseData.message.trim()
        ? responseData.message.trim()
        : undefined;

    const code = typeof errorPayload?.code === 'string' ? errorPayload.code : undefined;
    const fields =
      errorPayload?.fields && typeof errorPayload.fields === 'object'
        ? (errorPayload.fields as Record<string, string>)
        : undefined;

    if (!err.response) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return new AuthServiceError(
          'The server took too long to respond. Please check your connection and try again.',
          'TIMEOUT',
          0,
          undefined,
          err
        );
      }
      return new AuthServiceError(
        'Could not reach the MediFind server. Check your connection and try again.',
        'NETWORK_ERROR',
        0,
        undefined,
        err
      );
    }

    if (httpStatus === 401) {
      const defaultMsg =
        context === 'login'
          ? 'Invalid email or password. Please check your credentials and try again.'
          : 'Your session has expired. Please sign in again.';
      return new AuthServiceError(serverMessage || defaultMsg, code || 'UNAUTHORIZED', 401, fields, err);
    }
    if (httpStatus === 403) {
      return new AuthServiceError(
        serverMessage || 'This account does not have permission to sign in or access this workspace.',
        code || 'FORBIDDEN',
        403,
        fields,
        err
      );
    }
    if (httpStatus === 409) {
      return new AuthServiceError(
        serverMessage || 'An account with this email address already exists.',
        code || 'CONFLICT',
        409,
        fields,
        err
      );
    }
    if (httpStatus === 400 || httpStatus === 422) {
      return new AuthServiceError(
        serverMessage || 'Please review the highlighted fields and try again.',
        code || 'VALIDATION_ERROR',
        httpStatus,
        fields,
        err
      );
    }
    if (httpStatus === 429) {
      return new AuthServiceError(
        serverMessage || 'Too many authentication attempts. Please wait a moment before trying again.',
        code || 'RATE_LIMITED',
        429,
        fields,
        err
      );
    }

    return new AuthServiceError(
      serverMessage || fallbackMessage,
      code || 'SERVER_ERROR',
      httpStatus,
      fields,
      err
    );
  }

  if (err instanceof Error) {
    return new AuthServiceError(err.message, undefined, undefined, undefined, err);
  }

  return new AuthServiceError(fallbackMessage);
}

function getStoredMockUsers(): StoredMockUser[] {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const authService = {
  getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem(TOKEN_KEY);
    return token && token !== 'undefined' && token !== 'null' ? token : null;
  },

  getCurrentUser(): User | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return normalizeServerUser(JSON.parse(raw));
    } catch {
      return null;
    }
  },

  async getMe(): Promise<User | null> {
    if (isMockApiEnabled()) {
      return this.getCurrentUser();
    }

    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await api.get('/me');
      const rawData = res.data?.data ?? res.data;
      const userObj =
        rawData && typeof rawData === 'object' && 'user' in (rawData as Record<string, unknown>)
          ? (rawData as Record<string, unknown>).user
          : rawData;
      const user = normalizeServerUser(userObj);
      if (!user) {
        throw new AuthServiceError('Server returned an invalid session profile.', 'INVALID_RESPONSE', 502);
      }
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 501)) {
        // /me endpoint may not be deployed yet; keep existing session without fabricating profile fields
        return this.getCurrentUser();
      }
      throw mapAxiosAuthError(err, 'Unable to verify your active session.', 'me');
    }
  },

  async register(payload: RegisterPayload): Promise<{ user: User; token: string }> {
    if (payload.role === 'ADMIN') {
      throw new AuthServiceError(
        'Administrator accounts cannot be created via public registration.',
        'FORBIDDEN_ROLE',
        403
      );
    }

    const normalizedEmail = payload.email.trim().toLowerCase();

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const users = getStoredMockUsers();
      if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        throw new AuthServiceError(
          'An account with this email address already exists.',
          'DUPLICATE_EMAIL',
          409,
          { email: 'An account with this email address already exists.' }
        );
      }

      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: payload.name.trim(),
        email: normalizedEmail,
        phone: payload.phone?.trim() || undefined,
        role: payload.role,
        status: 'active',
      };

      const updatedUsers: StoredMockUser[] = [...users, { ...newUser, password: payload.password }];
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(updatedUsers));

      const token = `local_session_${newUser.id}`;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      return { user: newUser, token };
    }

    try {
      const res = await api.post('/auth/register', {
        name: payload.name.trim(),
        email: normalizedEmail,
        phone: payload.phone?.trim() || undefined,
        password: payload.password,
        role: payload.role,
      });
      const { user, token } = extractAuthResponse(res.data);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user, token };
    } catch (err: unknown) {
      throw mapAxiosAuthError(
        err,
        'Registration failed. Please check your connection and try again.',
        'register'
      );
    }
  },

  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    const normalizedEmail = credentials.email.trim().toLowerCase();

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (credentials.expectedRole === 'ADMIN') {
        if (!normalizedEmail || !credentials.password) {
          throw new AuthServiceError('Please enter both email and password.', 'VALIDATION_ERROR', 422);
        }
        const adminName = normalizedEmail.split('@')[0] || 'Administrator';
        const adminUser: User = {
          id: `usr_admin_${Date.now()}`,
          name: adminName,
          email: normalizedEmail,
          role: 'ADMIN',
          status: 'active',
        };
        const token = `local_session_${adminUser.id}`;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(adminUser));
        return { user: adminUser, token };
      }

      const users = getStoredMockUsers();
      const matched = users.find(
        (u) => u.email.toLowerCase() === normalizedEmail && u.password === (credentials.password || '')
      );
      if (!matched) {
        throw new AuthServiceError(
          'Invalid email or password. Please verify your credentials or create an account.',
          'UNAUTHORIZED',
          401
        );
      }

      if (matched.status === 'suspended') {
        throw new AuthServiceError(
          'This account has been suspended. Please contact MediFind support.',
          'ACCOUNT_SUSPENDED',
          403
        );
      }

      const user: User = {
        id: matched.id,
        name: matched.name,
        email: matched.email,
        phone: matched.phone,
        role: matched.role,
        status: matched.status,
        pharmacyId: matched.pharmacyId,
      };
      const token = `local_session_${user.id}`;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user, token };
    }

    try {
      const res = await api.post('/auth/login', {
        email: normalizedEmail,
        password: credentials.password,
      });
      const { user, token } = extractAuthResponse(res.data);
      if (user.status === 'suspended') {
        throw new AuthServiceError(
          'This account has been suspended and cannot sign in.',
          'ACCOUNT_SUSPENDED',
          403
        );
      }
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user, token };
    } catch (err: unknown) {
      throw mapAxiosAuthError(
        err,
        'Authentication failed. Please verify your credentials and try again.',
        'login'
      );
    }
  },

  logout(): void {
    const existingToken = this.getToken();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    if (!isMockApiEnabled() && existingToken) {
      api
        .post('/auth/logout', undefined, {
          headers: { Authorization: `Bearer ${existingToken}` },
        })
        .catch(() => {});
    }
  },
};

