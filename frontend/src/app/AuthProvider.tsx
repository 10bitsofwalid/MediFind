// src/app/AuthProvider.tsx
import React, { useState, type ReactNode } from 'react';
import type { Role } from '../types/pharmacy';
import type { User, RegisterPayload } from '../types/auth';
import { authService } from '../services/authService';
import { AuthContext } from './AuthContext';

const USER_TYPE_STORAGE_KEY = 'medifind_selected_user_type';

function getStoredUserType(currentUser: User | null): Role | null {
  if (currentUser?.role) {
    sessionStorage.setItem(USER_TYPE_STORAGE_KEY, currentUser.role);
    return currentUser.role;
  }
  try {
    const saved = sessionStorage.getItem(USER_TYPE_STORAGE_KEY);
    if (saved === 'CUSTOMER' || saved === 'PHARMACY' || saved === 'ADMIN') {
      return saved;
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [selectedUserType, setSelectedUserType] = useState<Role | null>(() =>
    getStoredUserType(authService.getCurrentUser())
  );
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(() => {
    const current = authService.getCurrentUser();
    return !current && !getStoredUserType(current);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const selectUserType = (role: Role) => {
    if (user && user.role !== role) {
      authService.logout();
      setUser(null);
      setToken(null);
    }
    setSelectedUserType(role);
    try {
      sessionStorage.setItem(USER_TYPE_STORAGE_KEY, role);
    } catch {
      // ignore storage failure
    }
    setIsWelcomeOpen(false);
  };

  const openWelcomeModal = () => {
    setIsWelcomeOpen(true);
  };

  const closeWelcomeModal = () => {
    if (selectedUserType || user) {
      setIsWelcomeOpen(false);
    }
  };

  const login = async (email: string, password?: string, expectedRole?: Role): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await authService.login({ email, password, expectedRole });
      setUser(res.user);
      setToken(res.token);
      setSelectedUserType(res.user.role);
      try {
        sessionStorage.setItem(USER_TYPE_STORAGE_KEY, res.user.role);
      } catch {
        // ignore storage failure
      }
      setIsWelcomeOpen(false);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await authService.register(payload);
      setUser(res.user);
      setToken(res.token);
      setSelectedUserType(res.user.role);
      try {
        sessionStorage.setItem(USER_TYPE_STORAGE_KEY, res.user.role);
      } catch {
        // ignore storage failure
      }
      setIsWelcomeOpen(false);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        selectedUserType,
        isWelcomeOpen,
        selectUserType,
        openWelcomeModal,
        closeWelcomeModal,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
