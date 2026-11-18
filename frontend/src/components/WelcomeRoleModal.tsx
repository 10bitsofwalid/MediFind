// src/components/WelcomeRoleModal.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/useAuth';
import type { Role } from '../types/pharmacy';
import { BrandLogo } from './BrandLogo';
import { Search, Store, ShieldCheck, ArrowRight, X, AlertCircle } from 'lucide-react';

interface RoleOption {
  role: Role;
  title: string;
  subtitle: string;
  operations: string[];
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  accentBg: string;
  accentColor: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'CUSTOMER',
    title: 'Customer / Patient',
    subtitle: 'Search for medicines nearby and compare pharmacy availability.',
    operations: ['Medicine brand & generic search', 'Compare availability & freshness', 'Check hours & locations'],
    icon: Search,
    accentBg: 'var(--color-action-subtle)',
    accentColor: 'var(--color-action-primary)',
  },
  {
    role: 'PHARMACY',
    title: 'Pharmacy Owner',
    subtitle: 'Register your pharmacy, track verification, and report stock levels.',
    operations: ['Submit license onboarding', 'Track verification status', 'Manage profile & one-tap stock'],
    icon: Store,
    accentBg: 'var(--color-status-available-bg)',
    accentColor: 'var(--color-status-available)',
  },
  {
    role: 'ADMIN',
    title: 'Administrator',
    subtitle: 'Verify submitted pharmacy licenses and curate the medicine catalogue.',
    operations: ['Review verification queue', 'Approve, reject, or suspend', 'Manage medicine catalogue'],
    icon: ShieldCheck,
    accentBg: 'var(--color-status-caution-bg)',
    accentColor: 'var(--color-status-caution)',
  },
];

export const WelcomeRoleModal: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedUserType, isWelcomeOpen, selectUserType, closeWelcomeModal } = useAuth();

  const canDismiss = Boolean(selectedUserType || user);

  useEffect(() => {
    if (!isWelcomeOpen || !canDismiss) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWelcomeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWelcomeOpen, canDismiss, closeWelcomeModal]);

  if (!isWelcomeOpen) return null;

  const handleSelectRole = (role: Role) => {
    const isAlreadyAuthenticatedAsRole = Boolean(user && user.role === role);
    selectUserType(role);

    if (role === 'CUSTOMER') {
      navigate('/');
    } else if (role === 'PHARMACY') {
      navigate(isAlreadyAuthenticatedAsRole ? '/pharmacy/dashboard' : '/login');
    } else {
      navigate(isAlreadyAuthenticatedAsRole ? '/admin/dashboard' : '/login');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-role-modal-title"
      aria-describedby="welcome-role-modal-desc"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(23, 43, 58, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '880px',
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: '28px 24px',
          position: 'relative',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        {canDismiss && (
          <button
            type="button"
            onClick={closeWelcomeModal}
            aria-label="Close user type selection"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-canvas)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <BrandLogo size={52} style={{ margin: '0 auto 14px' }} />
          <h1
            id="welcome-role-modal-title"
            style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: '0 0 8px',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome to MediFind
          </h1>
          <p
            id="welcome-role-modal-desc"
            style={{
              fontSize: '15px',
              color: 'var(--color-text-secondary)',
              margin: '0 auto',
              maxWidth: '560px',
              lineHeight: 1.5,
            }}
          >
            Select your user type to continue to the workspace and operations designed for you.
          </p>
        </div>

        {/* Notice if user is currently signed in and switching */}
        {user && (
          <div
            role="note"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-action-subtle)',
              color: 'var(--color-action-primary)',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>
              You are currently signed in as <strong>{user.name}</strong> ({user.role}). Selecting a different user type
              will sign you out of this session.
            </span>
          </div>
        )}

        {/* 3 Role Selection Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '16px',
          }}
        >
          {ROLE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedUserType === option.role;
            return (
              <button
                key={option.role}
                type="button"
                onClick={() => handleSelectRole(option.role)}
                style={{
                  textAlign: 'left',
                  padding: '20px',
                  borderRadius: 'var(--radius-lg)',
                  border: isSelected
                    ? '2px solid var(--color-action-primary)'
                    : '1px solid var(--color-border-default)',
                  backgroundColor: isSelected ? 'var(--color-action-subtle)' : 'var(--color-surface-canvas)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'border-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: option.accentBg,
                      color: option.accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-hidden="true"
                  >
                    <Icon size={22} />
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--color-action-primary)',
                        backgroundColor: 'var(--color-surface-panel)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--color-action-primary)',
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>

                <div>
                  <h2
                    style={{
                      fontSize: '17px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      margin: '0 0 6px',
                    }}
                  >
                    {option.title}
                  </h2>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-text-secondary)',
                      margin: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    {option.subtitle}
                  </p>
                </div>

                <ul
                  style={{
                    margin: '4px 0 0',
                    padding: '0 0 0 16px',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                  }}
                >
                  {option.operations.map((op) => (
                    <li key={op}>{op}</li>
                  ))}
                </ul>

                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--color-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-action-primary)',
                  }}
                >
                  <span>Continue as {option.title}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

