// src/features/auth/LoginPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/useAuth';
import { isMockApiEnabled } from '../../services/pharmacyService';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, selectedUserType, openWelcomeModal } = useAuth();

  const isSessionExpired = searchParams.get('reason') === 'session_expired';

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const portalTitle =
    selectedUserType === 'PHARMACY'
      ? 'Pharmacy Owner Sign In'
      : selectedUserType === 'ADMIN'
      ? 'Administrator Sign In'
      : selectedUserType === 'CUSTOMER'
      ? 'Customer Sign In'
      : 'Sign in to MediFind';

  const portalSubtitle =
    selectedUserType === 'PHARMACY'
      ? 'Sign in to manage your pharmacy application, profile, and stock reports'
      : selectedUserType === 'ADMIN'
      ? 'Sign in to review pharmacy licenses and maintain the medicine catalogue'
      : 'Enter your credentials to access your MediFind account';

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

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const signedInUser = await login(emailTrimmed, password, selectedUserType || undefined);
      if (signedInUser.role === 'PHARMACY') {
        navigate('/pharmacy/dashboard');
      } else if (signedInUser.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please verify your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
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
            {portalTitle}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {portalSubtitle}
          </p>
        </div>

        {/* Mock Mode Admin Entry Info */}
        {selectedUserType === 'ADMIN' && isMockApiEnabled() && (
          <div
            role="note"
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--color-action-subtle)',
              border: '1px solid rgba(23, 107, 135, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-action-primary)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '20px',
              lineHeight: 1.45,
            }}
          >
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Mock Mode Active:</strong> Enter any valid administrator email and password to open the local
              Administrator workspace while the backend API is offline.
            </span>
          </div>
        )}

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
              <label
                htmlFor="login-password"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
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
                  placeholder="Enter your password"
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

        {/* Portal-Specific Footer Links */}
        {selectedUserType !== 'ADMIN' && (
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Don&apos;t have an account yet?{' '}
            <Link to="/register" style={{ color: 'var(--color-action-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Create an Account
            </Link>
          </div>
        )}

        {selectedUserType === 'PHARMACY' && (
          <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            New pharmacy?{' '}
            <Link
              to="/pharmacy/register"
              style={{ color: 'var(--color-action-primary)', fontWeight: 600, textDecoration: 'none' }}
            >
              Start Onboarding Application
            </Link>
          </div>
        )}

        <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--color-border-default)', textAlign: 'center' }}>
          <button
            type="button"
            onClick={openWelcomeModal}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <RefreshCw size={12} aria-hidden="true" />
            <span>Switch User Type</span>
          </button>
        </div>
      </div>
    </div>
  );
};
