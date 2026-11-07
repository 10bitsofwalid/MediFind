// src/app/AuthContext.ts
import { createContext } from 'react';
import type { Role } from '../types/pharmacy';
import type { User } from '../types/auth';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

