// src/app/AuthContext.ts
import { createContext } from 'react';
import type { Role } from '../types/pharmacy';
import type { User, RegisterPayload } from '../types/auth';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedUserType: Role | null;
  isWelcomeOpen: boolean;
  selectUserType: (role: Role) => void;
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
  login: (email: string, password?: string, expectedRole?: Role) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
