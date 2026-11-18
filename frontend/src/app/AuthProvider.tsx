// src/app/AuthProvider.tsx
import React, { useState, useEffect, type ReactNode } from 'react';
import type { Role } from '../types/pharmacy';
import type { User, RegisterPayload } from '../types/auth';
import { authService, AuthServiceError } from '../services/authService';
import { SESSION_EXPIRED_EVENT } from '../services/api';
import { isMockApiEnabled } from '../services/pharmacyService';
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

  // Immediately clear React auth state whenever the API client detects an expired session (401)
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  // In live API mode, validate any persisted token via GET /me on initial load
  useEffect(() => {
    if (isMockApiEnabled()) return;
    const existingToken = authService.getToken();
    if (!existingToken) return;

    let active = true;
    authService
      .getMe()
      .then((serverUser) => {
        if (!active) return;
        if (!serverUser || serverUser.status === 'suspended') {
          authService.logout();
          setUser(null);
          setToken(null);
          return;
        }
        setUser(serverUser);
        setSelectedUserType(serverUser.role);
        try {
          sessionStorage.setItem(USER_TYPE_STORAGE_KEY, serverUser.role);
        } catch {
          // ignore storage failure
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof AuthServiceError && (err.status === 401 || err.status === 403)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
