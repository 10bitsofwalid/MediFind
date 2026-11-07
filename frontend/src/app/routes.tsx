// src/app/routes.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PharmacyRegisterPage } from '../features/pharmacy/PharmacyRegisterPage';
import { PharmacyDashboard } from '../features/pharmacy/PharmacyDashboard';
import { ProtectedRoute } from '../components/ProtectedRoute';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect to pharmacy onboarding */}
      <Route path="/" element={<Navigate to="/pharmacy/register" replace />} />

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

      <Route path="/pharmacy/status" element={<Navigate to="/pharmacy/dashboard" replace />} />

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/pharmacy/register" replace />} />
    </Routes>
  );
};

