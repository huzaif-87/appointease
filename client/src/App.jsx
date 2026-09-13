import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import ProvidersPage from './pages/ProvidersPage';
import ProviderDetailPage from './pages/ProviderDetailPage';
import BookingEntryPage from './pages/BookingEntryPage';
import MyAppointmentsPage from './pages/MyAppointmentsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

// Admin Console
import AdminLayout from './components/admin/AdminLayout';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage';
import AdminProvidersPage from './pages/admin/AdminProvidersPage';
import AdminServicesPage from './pages/admin/AdminServicesPage';
import AdminAvailabilityPage from './pages/admin/AdminAvailabilityPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';

// Provider Console
import ProviderLayout from './components/provider/ProviderLayout';
import ProviderDashboardPage from './pages/provider/ProviderDashboardPage';
import ProviderAppointmentsPage from './pages/provider/ProviderAppointmentsPage';
import ProviderAvailabilityPage from './pages/provider/ProviderAvailabilityPage';
import ProviderServicesPage from './pages/provider/ProviderServicesPage';
import ProviderProfilePage from './pages/provider/ProviderProfilePage';

import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            <Layout>
              <HomePage />
            </Layout>
          }
        />
        <Route
          path="/services"
          element={
            <Layout>
              <ServicesPage />
            </Layout>
          }
        />
        <Route
          path="/services/:id"
          element={
            <Layout>
              <ServiceDetailPage />
            </Layout>
          }
        />
        <Route
          path="/providers"
          element={
            <Layout>
              <ProvidersPage />
            </Layout>
          }
        />
        <Route
          path="/providers/:id"
          element={
            <Layout>
              <ProviderDetailPage />
            </Layout>
          }
        />

        {/* Authentication Routes */}
        <Route
          path="/login"
          element={
            <Layout>
              <LoginPage portalRole="PATIENT" />
            </Layout>
          }
        />
        <Route
          path="/provider/login"
          element={
            <Layout>
              <LoginPage portalRole="PROVIDER" />
            </Layout>
          }
        />
        <Route
          path="/admin/login"
          element={
            <Layout>
              <LoginPage portalRole="ADMIN" />
            </Layout>
          }
        />
        <Route
          path="/register"
          element={
            <Layout>
              <RegisterPage />
            </Layout>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Layout>
              <ForgotPasswordPage />
            </Layout>
          }
        />
        <Route
          path="/reset-password/:token"
          element={
            <Layout>
              <ResetPasswordPage />
            </Layout>
          }
        />
        <Route
          path="/verify-email"
          element={
            <Layout>
              <VerifyEmailPage />
            </Layout>
          }
        />

        {/* Authenticated Patient Routes */}
        <Route
          path="/book"
          element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <Layout>
                <BookingEntryPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <Layout>
                <MyAppointmentsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN', 'PROVIDER']}>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Authenticated Provider Routes */}
        <Route
          path="/provider/*"
          element={
            <ProtectedRoute allowedRoles={['PROVIDER']}>
              <ProviderLayout>
                <Routes>
                  <Route path="" element={<ProviderDashboardPage />} />
                  <Route path="appointments" element={<ProviderAppointmentsPage />} />
                  <Route path="availability" element={<ProviderAvailabilityPage />} />
                  <Route path="services" element={<ProviderServicesPage />} />
                  <Route path="profile" element={<ProviderProfilePage />} />
                  <Route path="*" element={<Navigate to="/provider" replace />} />
                </Routes>
              </ProviderLayout>
            </ProtectedRoute>
          }
        />

        {/* Authenticated Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout>
                <Routes>
                  <Route path="" element={<AdminOverviewPage />} />
                  <Route path="appointments" element={<AdminAppointmentsPage />} />
                  <Route path="providers" element={<AdminProvidersPage />} />
                  <Route path="services" element={<AdminServicesPage />} />
                  <Route path="availability" element={<AdminAvailabilityPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
