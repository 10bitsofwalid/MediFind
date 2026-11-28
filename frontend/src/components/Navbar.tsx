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
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const mobileMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuOpen = mobileMenuPath === location.pathname;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 960) {
        setMobileMenuPath(null);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuPath(null);
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
    setMobileMenuPath(null);
    navigate(roleBeforeLogout === 'CUSTOMER' ? '/' : '/login');
  };

  return (
    <header className="navbar-shell">
      {mobileMenuOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMobileMenuPath(null)}
          aria-hidden="true"
        />
      )}

      <div className="navbar-floating-wrap">
        <div className={`navbar-floating${isScrolled ? ' is-scrolled' : ''}`}>
          <div className="navbar-inner">
            {/* Brand Logo & Title */}
            <Link
              to={brandHomePath}
              className="navbar-brand"
              aria-label={`MediFind ${brandSubtitle}`}
            >
              <BrandLogo size={34} style={{ flexShrink: 0 }} />
              <div className="navbar-brand-text">
                <span className="navbar-brand-title">MediFind</span>
                <span className="navbar-brand-subtitle">{brandSubtitle}</span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="desktop-nav" aria-label="Main Navigation">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`navbar-nav-link${isActive ? ' is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Type Switcher, Sign Out & Mobile Menu Toggle */}
            <div className="navbar-actions">
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
                  className="desktop-nav btn-secondary navbar-signout-btn"
                  aria-label="Sign out"
                >
                  <LogOut size={13} aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              )}

              {/* Mobile / Tablet hamburger menu toggle */}
              <button
                ref={mobileMenuBtnRef}
                type="button"
                onClick={() =>
                  setMobileMenuPath((prev) => (prev === location.pathname ? null : location.pathname))
                }
                className="mobile-menu-btn"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        {/* Floating Mobile / Tablet Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav-drawer"
            className="mobile-nav-drawer"
            aria-label="Mobile Navigation"
          >
            {navLinks.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuPath(null)}
                  className={`mobile-nav-link${isActive ? ' is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}

            {navLinks.length > 0 && <div className="mobile-drawer-divider" aria-hidden="true" />}

            <button
              type="button"
              onClick={() => {
                setMobileMenuPath(null);
                openWelcomeModal();
              }}
              className="mobile-drawer-action"
              style={{
                border: '1px solid var(--color-border-default)',
                backgroundColor: '#f6f8fa',
                color: 'var(--color-action-primary)',
              }}
            >
              <RefreshCw size={18} aria-hidden="true" />
              <span>Switch User Type</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="mobile-drawer-action"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--color-status-problem)',
                }}
              >
                <LogOut size={18} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};
