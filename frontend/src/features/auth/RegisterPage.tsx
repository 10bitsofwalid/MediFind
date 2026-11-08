// src/features/auth/RegisterPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/useAuth';
import type { Role } from '../../types/pharmacy';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { switchRole } = useAuth();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<Role>('PHARMACY');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (phone.trim()) {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        setErrorMessage('Phone number should be 10 to 15 digits.');
        return;
      }
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate account registration & session creation
      await new Promise((resolve) => setTimeout(resolve, 500));
      switchRole(role);

      if (role === 'PHARMACY') {
        // Direct new pharmacy owners to the DGDA onboarding wizard
        navigate('/pharmacy/register');
      } else {
        navigate('/pharmacy/dashboard');
      }
    } catch {
      setErrorMessage('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '520px', margin: '48px auto', padding: '0 16px 64px' }}>
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
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-action-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '24px',
              margin: '0 auto 14px',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-hidden="true"
          >
            M
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            Create MediFind Account
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Join MediFind to manage your pharmacy or find verified medicines
          </p>
        </div>

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

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Role Selection */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                I am registering as:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRole('PHARMACY')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: role === 'PHARMACY' ? '2px solid var(--color-action-primary)' : '1px solid var(--color-border-default)',
                    backgroundColor: role === 'PHARMACY' ? 'var(--color-action-subtle)' : 'var(--color-surface-panel)',
                    color: role === 'PHARMACY' ? 'var(--color-action-primary)' : 'var(--color-text-primary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Building2 size={16} aria-hidden="true" />
                  <span>Pharmacy Owner</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('CUSTOMER')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: role === 'CUSTOMER' ? '2px solid var(--color-action-primary)' : '1px solid var(--color-border-default)',
                    backgroundColor: role === 'CUSTOMER' ? 'var(--color-action-subtle)' : 'var(--color-surface-panel)',
                    color: role === 'CUSTOMER' ? 'var(--color-action-primary)' : 'var(--color-text-primary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <User size={16} aria-hidden="true" />
                  <span>Customer / Patient</span>
                </button>
              </div>
            </div>

            {/* Name Field */}
            <div>
              <label
                htmlFor="register-name"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={16}
                  color="var(--color-text-secondary)"
                  style={{ position: 'absolute', left: '12px', top: '13px', pointerEvents: 'none' }}
                  aria-hidden="true"
                />
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Kazi Nazrul"
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

            {/* Email Field */}
            <div>
              <label
                htmlFor="register-email"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Official Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="var(--color-text-secondary)"
                  style={{ position: 'absolute', left: '12px', top: '13px', pointerEvents: 'none' }}
                  aria-hidden="true"
                />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@pharmacy.com"
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

            {/* Phone Field */}
            <div>
              <label
                htmlFor="register-phone"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Mobile Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <Phone
                  size={16}
                  color="var(--color-text-secondary)"
                  style={{ position: 'absolute', left: '12px', top: '13px', pointerEvents: 'none' }}
                  aria-hidden="true"
                />
                <input
                  id="register-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +8801712345678"
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
                htmlFor="register-password"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
              >
                Create Password <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>(min 6 chars)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="var(--color-text-secondary)"
                  style={{ position: 'absolute', left: '12px', top: '13px', pointerEvents: 'none' }}
                  aria-hidden="true"
                />
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Continue</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-action-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
