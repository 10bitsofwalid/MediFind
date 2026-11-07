// src/types/auth.ts
import type { Role } from './pharmacy';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: 'active' | 'pending' | 'suspended';
  pharmacyId?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

