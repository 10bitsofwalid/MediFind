// src/app/AuthProvider.tsx
import React, { useState, type ReactNode } from 'react';
import type { Role } from '../types/pharmacy';
import type { User } from '../types/auth';
import { authService } from '../services/authService';
import { AuthContext } from './AuthContext';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = authService.getCurrentUser();
    if (savedUser) return savedUser;
    const defaultOwner: User = {
      id: 'usr_pharmacy_owner_1',
      name: 'Rahman Medical Store Owner',
      email: 'owner@medifind.com',
      phone: '+8801712345678',
      role: 'PHARMACY',
      status: 'active',
    };
    authService.setDevUser(defaultOwner);
    return defaultOwner;
  });

  const [token, setToken] = useState<string | null>(() => {
    return authService.getToken() || 'mock_owner_jwt_token';
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const login = async (email: string) => {
    setIsLoading(true);
    try {
      const res = await authService.login({ email });
      setUser(res.user);
      setToken(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const switchRole = (newRole: Role) => {
    const updatedUser: User = {
      id: user?.id || 'usr_dev',
      name:
        newRole === 'PHARMACY'
          ? 'Pharmacy Owner'
          : newRole === 'ADMIN'
          ? 'System Administrator'
          : 'Registered Customer',
      email: user?.email || 'user@medifind.com',
      role: newRole,
      status: 'active',
    };
    setUser(updatedUser);
    authService.setDevUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
