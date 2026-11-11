// src/app/routes.tsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from './useAuth';

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
const AdminDashboard = lazy(() =>
  import('../features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const VerificationQueue = lazy(() =>
  import('../features/admin/VerificationQueue').then((m) => ({ default: m.VerificationQueue }))
);
const CatalougeManager = lazy(() =>
  import('../features/admin/CatalougeManager').then((m) => ({ default: m.CatalougeManager }))
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

const RootEntry: React.FC = () => {
  const { user, selectedUserType } = useAuth();
  const effectiveRole = user?.role ?? selectedUserType;

  if (effectiveRole === 'PHARMACY') {
    return <Navigate to={user ? '/pharmacy/dashboard' : '/login'} replace />;
  }
  if (effectiveRole === 'ADMIN') {
    return <Navigate to={user ? '/admin/dashboard' : '/login'} replace />;
  }
  if (effectiveRole === 'CUSTOMER') {
    return <HomePage />;
  }

  // Neutral background until user selects a user type in the Welcome modal
  return <div style={{ minHeight: '60vh' }} aria-hidden="true" />;
};

const CatchAllRedirect: React.FC = () => {
  const { user, selectedUserType } = useAuth();
  const effectiveRole = user?.role ?? selectedUserType;

  if (effectiveRole === 'PHARMACY') {
    return <Navigate to={user ? '/pharmacy/dashboard' : '/login'} replace />;
  }
  if (effectiveRole === 'ADMIN') {
    return <Navigate to={user ? '/admin/dashboard' : '/login'} replace />;
  }
  return <Navigate to="/" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* Role-aware Entry Route */}
        <Route path="/" element={<RootEntry />} />

        {/* Customer Discovery Routes (CUSTOMER only) */}
        <Route
          path="/search"
          element={
            <ProtectedRoute allowedRoles={['CUSTOMER']} requireAuth={false}>
              <SearchResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medicine"
          element={
            <ProtectedRoute allowedRoles={['CUSTOMER']} requireAuth={false}>
              <MedicineDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medicine/:id"
          element={
            <ProtectedRoute allowedRoles={['CUSTOMER']} requireAuth={false}>
              <MedicineDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Authentication Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Pharmacy Owner Routes (PHARMACY only) */}
        <Route
          path="/pharmacy/register"
          element={
            <ProtectedRoute allowedRoles={['PHARMACY']} requireAuth={false}>
              <PharmacyRegisterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/dashboard"
          element={
            <ProtectedRoute allowedRoles={['PHARMACY']}>
              <PharmacyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/profile"
          element={
            <ProtectedRoute allowedRoles={['PHARMACY']}>
              <PharmacyProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/pharmacy/status" element={<Navigate to="/pharmacy/dashboard" replace />} />

        {/* Administrator Routes (ADMIN only) */}
        <Route
          path="/admin"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/verification"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <VerificationQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/catalogue"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CatalougeManager />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route */}
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </Suspense>
  );
};
