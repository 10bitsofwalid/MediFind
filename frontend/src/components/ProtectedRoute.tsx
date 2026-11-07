// src/components/ProtectedRoute.tsx
import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/useAuth';
import type { Role } from '../types/pharmacy';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="loading-screen"
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div className="spinner" aria-hidden="true" />
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
          Loading authentication state...
        </span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <main
        className="restricted-access-view"
        style={{
          maxWidth: '540px',
          margin: '48px auto',
          padding: '32px 24px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-default)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-status-problem-bg)',
            color: 'var(--color-status-problem)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
          aria-hidden="true"
        >
          <ShieldAlert size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
          Access Restricted
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1.5, marginBottom: '24px' }}>
          This workspace requires a Pharmacy Owner account. Your current active role is{' '}
          <strong>{user.role}</strong>. Frontend route restrictions are navigation aids; backend permissions are enforced on the server.
        </p>
        <a
          href="/pharmacy/register"
          className="btn-primary"
          style={{ display: 'inline-flex', padding: '10px 20px', textDecoration: 'none' }}
        >
          Register as Pharmacy Owner
        </a>
      </main>
    );
  }

  return <>{children}</>;
};
