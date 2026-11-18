// src/components/Navbar.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/useAuth';
import type { Role } from '../types/pharmacy';
import {
  PlusCircle,
  LayoutDashboard,
  Building2,
  UserCheck,
  Menu,
  X,
  LogIn,
  LogOut,
  Search,
  UserPlus,
  ClipboardCheck,
  Pill,
  RefreshCw,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

const USER_TYPE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  PHARMACY: 'Pharmacy Owner',
  ADMIN: 'Administrator',
};

const USER_TYPE_SHORT_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  PHARMACY: 'Owner',
  ADMIN: 'Admin',
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, selectedUserType, openWelcomeModal, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const effectiveRole: Role | null = user?.role ?? selectedUserType;

  // Strictly separate navigation links by selected or authenticated user type
  const navLinks = useMemo(() => {
    if (effectiveRole === 'PHARMACY') {
      if (user?.role === 'PHARMACY') {
        return [
          { to: '/pharmacy/dashboard', label: 'Owner Workspace', icon: LayoutDashboard },
          { to: '/pharmacy/inventory', label: 'Inventory', icon: Pill },
          { to: '/pharmacy/profile', label: 'Pharmacy Profile', icon: Building2 },
          { to: '/pharmacy/register', label: 'Onboarding Application', icon: PlusCircle },
        ];
      }
      return [
        { to: '/login', label: 'Sign In', icon: LogIn },
        { to: '/register', label: 'Create Account', icon: UserPlus },
        { to: '/pharmacy/register', label: 'Onboarding Application', icon: PlusCircle },
      ];
    }

    if (effectiveRole === 'ADMIN') {
      if (user?.role === 'ADMIN') {
        return [
          { to: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
          { to: '/admin/verification', label: 'Verification Queue', icon: ClipboardCheck },
          { to: '/admin/catalogue', label: 'Medicine Catalogue', icon: Pill },
        ];
      }
      return [{ to: '/login', label: 'Admin Sign In', icon: LogIn }];
    }

    if (effectiveRole === 'CUSTOMER') {
      if (user?.role === 'CUSTOMER') {
        return [
          { to: '/', label: 'Find Medicine', icon: Search },
          { to: '/search', label: 'Search Stock', icon: Search },
          { to: '/medicine', label: 'Medicine Details', icon: Pill },
        ];
      }
      return [
        { to: '/', label: 'Find Medicine', icon: Search },
        { to: '/search', label: 'Search Stock', icon: Search },
        { to: '/medicine', label: 'Medicine Details', icon: Pill },
        { to: '/login', label: 'Sign In', icon: LogIn },
        { to: '/register', label: 'Create Account', icon: UserPlus },
      ];
    }

    return [];
  }, [effectiveRole, user]);

  const brandHomePath = useMemo(() => {
    if (effectiveRole === 'PHARMACY') {
      return user?.role === 'PHARMACY' ? '/pharmacy/dashboard' : '/login';
    }
    if (effectiveRole === 'ADMIN') {
      return user?.role === 'ADMIN' ? '/admin/dashboard' : '/login';
    }
    return '/';
  }, [effectiveRole, user]);

  const brandSubtitle = useMemo(() => {
    if (effectiveRole === 'PHARMACY') return 'Pharmacy Operations';
    if (effectiveRole === 'ADMIN') return 'Platform Administration';
    if (effectiveRole === 'CUSTOMER') return 'Customer Medicine Discovery';
    return 'Healthcare Discovery Platform';
  }, [effectiveRole]);

  const handleLogout = () => {
    const roleBeforeLogout = user?.role ?? selectedUserType;
    logout();
    setMobileMenuOpen(false);
    navigate(roleBeforeLogout === 'CUSTOMER' ? '/' : '/login');
  };

  return (
    <header
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        borderBottom: '1px solid var(--color-border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="navbar-inner">
        {/* Brand Logo & Title */}
        <Link
          to={brandHomePath}
          className="navbar-brand"
          aria-label={`MediFind ${brandSubtitle}`}
        >
          <BrandLogo size={36} style={{ flexShrink: 0 }} />
          <div className="navbar-brand-text">
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              MediFind
            </span>
            <span className="navbar-brand-subtitle">
              {brandSubtitle}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          className="desktop-nav"
          aria-label="Main Navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {navLinks.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-action-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'var(--color-action-subtle)' : 'transparent',
                  minHeight: '38px',
                  whiteSpace: 'nowrap',
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Type Switcher, Sign Out & Mobile Menu Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={openWelcomeModal}
            className="btn-secondary navbar-role-pill"
            aria-label={`Switch user type (current: ${effectiveRole ? USER_TYPE_LABELS[effectiveRole] : 'none selected'})`}
          >
            <UserCheck size={13} color="var(--color-action-primary)" aria-hidden="true" />
            <span className="navbar-role-label-full">
              {effectiveRole ? USER_TYPE_LABELS[effectiveRole] : 'Select Type'}
            </span>
            <span className="navbar-role-label-short">
              {effectiveRole ? USER_TYPE_SHORT_LABELS[effectiveRole] : 'Role'}
            </span>
            <RefreshCw size={11} color="var(--color-text-secondary)" aria-hidden="true" />
          </button>

          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="desktop-nav btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: '36px',
                whiteSpace: 'nowrap',
              }}
              aria-label="Sign out"
            >
              <LogOut size={13} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            ref={mobileMenuBtnRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-btn"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop & Menu (resolves UI-05) */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: '64px',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(23, 43, 58, 0.35)',
              zIndex: 90,
            }}
          />
          <nav
            id="mobile-nav-drawer"
            className="mobile-nav-drawer"
            aria-label="Mobile Navigation"
            style={{
              position: 'relative',
              zIndex: 95,
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface-panel)',
              borderTop: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '15px',
                  textDecoration: 'none',
                  color: location.pathname === to ? 'var(--color-action-primary)' : 'var(--color-text-primary)',
                  backgroundColor: location.pathname === to ? 'var(--color-action-subtle)' : 'transparent',
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openWelcomeModal();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-canvas)',
                color: 'var(--color-action-primary)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <RefreshCw size={18} aria-hidden="true" />
              <span>Switch User Type</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '15px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--color-status-problem)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LogOut size={18} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            )}
          </nav>
        </>
      )}
    </header>
  );
};
