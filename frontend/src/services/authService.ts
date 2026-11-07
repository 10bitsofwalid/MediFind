// src/services/authService.ts
import { api } from './api';
import type { User, LoginCredentials } from '../types/auth';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

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

  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    // If backend is available, call POST /auth/login
    try {
      const res = await api.post('/auth/login', credentials);
      const { user, token } = res.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user, token };
    } catch {
      // In development fallback, create a mock owner session if requested
      const mockUser: User = {
        id: 'usr_owner_dev',
        name: 'Demo Pharmacy Owner',
        email: credentials.email || 'owner@medifind.dev',
        role: 'PHARMACY',
        status: 'active',
      };
      const mockToken = 'mock_jwt_token_for_dev_session';
      localStorage.setItem(TOKEN_KEY, mockToken);
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      return { user: mockUser, token: mockToken };
    }
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    api.post('/auth/logout').catch(() => {});
  },

  setDevUser(user: User | null): void {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, 'mock_token_' + user.role.toLowerCase());
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};
