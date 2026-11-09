// src/features/auth/LoginPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/useAuth';
import type { Role } from '../../types/pharmacy';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, switchRole } = useAuth();

  const isSessionExpired = searchParams.get('reason') === 'session_expired';

  const [email, setEmail] = useState<string>('owner@medifind.com');
  const [password, setPassword] = useState<string>('••••••••');
  const [selectedRole, setSelectedRole] = useState<Role>('PHARMACY');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailTrimmed)) {
      setErrorMessage('Please enter a valid email address (e.g. owner@pharmacy.com).');
      return;
    }

    setIsLoading(true);
    try {
      await login(emailTrimmed);
      switchRole(selectedRole);
      if (selectedRole === 'PHARMACY') {
        navigate('/pharmacy/dashboard');
      } else {
        navigate('/pharmacy/dashboard');
      }
    } catch {
      setErrorMessage('Authentication failed. Please verify your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoRole = (role: Role, demoEmail: string) => {
    setSelectedRole(role);
    setEmail(demoEmail);
  };

  return (
    <div style={{ maxWidth: '480px', margin: '48px auto', padding: '0 16px 64px' }}>
      <div
        className="card"
        style={{
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 28px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <BrandLogo size={52} style={{ margin: '0 auto 14px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            Sign in to MediFind
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Enter your credentials to access your healthcare workspace
          </p>
        </div>

        {/* Session Expired Notice if arrived via 401 redirect */}
        {isSessionExpired && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-status-caution-bg)',
              border: '1px solid rgba(152, 88, 0, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-caution)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>Your session has expired. Please sign in again to continue your session.</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-status-problem-bg)',
              border: '1px solid rgba(180, 35, 47, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-problem)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Account Role Selector */}
            <div>
              <label
                htmlFor="login-role"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Account Workspace Role
              </label>
              <select
                id="login-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                }}
              >
                <option value="PHARMACY">Pharmacy Owner / Staff</option>
                <option value="CUSTOMER">Customer / Patient</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="var(--color-text-secondary)"
                  style={{ position: 'absolute', left: '12px', top: '13px', pointerEvents: 'none' }}
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@pharmacy.com"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label
                  htmlFor="login-password"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Password
                </label>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Demo: any password
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="var(--color-text-secondary)"
                  style={{ position: 'absolute', left: '12px', top: '13px', pointerEvents: 'none' }}
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginTop: '6px',
              }}
            >
              {isLoading ? (
                <>
                  <span className="spinner-small" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Demo Fast-Logins */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--color-border-default)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
            Quick Demo Persona Accounts:
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleQuickDemoRole('PHARMACY', 'owner@medifind.com')}
              className="btn-secondary"
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-canvas)',
                cursor: 'pointer',
              }}
            >
              Pharmacy Owner
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoRole('CUSTOMER', 'patient@medifind.com')}
              className="btn-secondary"
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-canvas)',
                cursor: 'pointer',
              }}
            >
              Customer / Patient
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoRole('ADMIN', 'admin@medifind.com')}
              className="btn-secondary"
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-canvas)',
                cursor: 'pointer',
              }}
            >
              Administrator
            </button>
          </div>
        </div>

        {/* Register Links */}
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ color: 'var(--color-action-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};
