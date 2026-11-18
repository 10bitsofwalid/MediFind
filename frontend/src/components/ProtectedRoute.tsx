// src/components/ProtectedRoute.tsx
import React, { type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../app/useAuth';
import type { Role } from '../types/pharmacy';
import { ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: Role[];
  requireAuth?: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  PHARMACY: 'Pharmacy Owner',
  ADMIN: 'Administrator',
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireAuth = true,
}) => {
  const { user, isAuthenticated, isLoading, selectedUserType, openWelcomeModal } = useAuth();

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

  const effectiveRole: Role | null = user?.role ?? selectedUserType;

  const getFallbackDestination = (role: Role | null): { path: string; label: string } => {
    if (role === 'PHARMACY') {
      return {
        path: user ? '/pharmacy/dashboard' : '/login',
        label: user ? 'Go to Pharmacy Workspace' : 'Go to Pharmacy Sign In',
      };
    }
    if (role === 'ADMIN') {
      return {
        path: user ? '/admin/dashboard' : '/login',
        label: user ? 'Go to Admin Dashboard' : 'Go to Admin Sign In',
      };
    }
    return {
      path: '/',
      label: 'Go to Customer Discovery',
    };
  };

  // Enforce strict user-type screen separation even before login
  if (effectiveRole && !allowedRoles.includes(effectiveRole)) {
    const requiredNames = allowedRoles.map((r) => ROLE_LABELS[r]).join(' or ');
    const currentName = ROLE_LABELS[effectiveRole];
    const fallback = getFallbackDestination(effectiveRole);

    return (
      <main
        className="restricted-access-view"
        style={{
          maxWidth: '560px',
          margin: '48px auto',
          padding: '32px 24px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-sm)',
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
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
          Access Restricted
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1.5, marginBottom: '24px' }}>
          This view is restricted to <strong>{requiredNames}</strong> accounts. Your current user type is{' '}
          <strong>{currentName}</strong>.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            to={fallback.path}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            <span>{fallback.label}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={openWelcomeModal}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-canvas)',
              color: 'var(--color-text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Switch User Type</span>
          </button>
        </div>
      </main>
    );
  }

  if (requireAuth && (!isAuthenticated || !user)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
