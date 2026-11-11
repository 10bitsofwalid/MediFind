// src/services/authService.ts
import { api } from './api';
import axios from 'axios';
import type { User, LoginCredentials, RegisterPayload } from '../types/auth';
import { isMockApiEnabled } from './pharmacyService';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const MOCK_USERS_KEY = 'medifind_mock_users';

interface StoredMockUser extends User {
  password: string;
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
    return localStorage.getItem(TOKEN_KEY);
  },

  getCurrentUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  async register(payload: RegisterPayload): Promise<{ user: User; token: string }> {
    if (payload.role === 'ADMIN') {
      throw new Error('Administrator accounts cannot be created via public registration.');
    }

    const normalizedEmail = payload.email.trim().toLowerCase();

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const users = getStoredMockUsers();
      if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        throw new Error('An account with this email address already exists.');
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
        ...payload,
        email: normalizedEmail,
      });
      const { user, token } = res.data?.data || res.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user, token };
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        throw new Error(err.response.data.error.message, { cause: err });
      }
      throw new Error('Registration failed. Please check your connection and try again.', { cause: err });
    }
  },

  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    const normalizedEmail = credentials.email.trim().toLowerCase();

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (credentials.expectedRole === 'ADMIN') {
        if (!normalizedEmail || !credentials.password) {
          throw new Error('Please enter both email and password.');
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
        throw new Error('Invalid email or password. Please verify your credentials or create an account.');
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
      const { user, token } = res.data?.data || res.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user, token };
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        throw new Error(err.response.data.error.message, { cause: err });
      }
      throw new Error('Authentication failed. Please verify your credentials and try again.', { cause: err });
    }
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if (!isMockApiEnabled()) {
      api.post('/auth/logout').catch(() => {});
    }
  },

  setDevUser(user: User | null): void {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      if (!localStorage.getItem(TOKEN_KEY)) {
        localStorage.setItem(TOKEN_KEY, `local_session_${user.id}`);
      }
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};
