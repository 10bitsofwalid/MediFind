// src/app/routes.tsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';

// Lazy-loaded routes for code splitting and optimized bundle size (resolves TECH-06)
const PharmacyRegisterPage = lazy(() =>
  import('../features/pharmacy/PharmacyRegisterPage').then((m) => ({ default: m.PharmacyRegisterPage }))
);
const PharmacyDashboard = lazy(() =>
  import('../features/pharmacy/PharmacyDashboard').then((m) => ({ default: m.PharmacyDashboard }))
);
const PharmacyProfilePage = lazy(() =>
  import('../features/pharmacy/PharmacyProfilePage').then((m) => ({ default: m.PharmacyProfilePage }))
);
const LoginPage = lazy(() =>
  import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('../features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const HomePage = lazy(() =>
  import('../features/customer/HomePage').then((m) => ({ default: m.HomePage }))
);
const SearchResults = lazy(() =>
  import('../features/customer/SearchResults').then((m) => ({ default: m.SearchResults }))
);
const MedicineDetailPage = lazy(() =>
  import('../features/customer/MedicineDetailPage').then((m) => ({ default: m.MedicineDetailPage }))
);

const RouteLoading: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
      flexDirection: 'column',
      gap: '12px',
    }}
  >
    <div className="spinner" aria-hidden="true" />
    <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Loading...</span>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* Public Customer Discovery Routes (Developer 1) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/medicine" element={<MedicineDetailPage />} />
        <Route path="/medicine/:id" element={<MedicineDetailPage />} />

        {/* Authentication Routes (resolves TECH-02 & TECH-03) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Owner-facing Pharmacy Registration & Onboarding Flow */}
        <Route path="/pharmacy/register" element={<PharmacyRegisterPage />} />

        {/* Pharmacy Workspace Dashboard & Verification Status Tracking */}
        <Route
          path="/pharmacy/dashboard"
          element={
            <ProtectedRoute allowedRoles={['PHARMACY', 'ADMIN']}>
              <PharmacyDashboard />
            </ProtectedRoute>
          }
        />

        {/* Pharmacy Profile Viewing & Editing Flow */}
        <Route
          path="/pharmacy/profile"
          element={
            <ProtectedRoute allowedRoles={['PHARMACY', 'ADMIN']}>
              <PharmacyProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="/pharmacy/status" element={<Navigate to="/pharmacy/dashboard" replace />} />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
