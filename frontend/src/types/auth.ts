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

export interface LoginCredentials {
  email: string;
  password?: string;
  expectedRole?: Role;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
}

