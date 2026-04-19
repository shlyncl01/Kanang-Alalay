import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import HomePage        from './pages/HomePage';
import LoginPage       from './pages/LoginPage';
import DonationPage    from './pages/DonationPage';
import BookingPage     from './pages/BookingPage';
import VerifyEmail     from './pages/VerifyEmail';
import ResetPassword   from './pages/ResetPassword';

// Dashboards
import AdminDashboard  from './pages/AdminDashboard';
import NurseDashboard  from './pages/NurseDashboard';

// Shared Protected Pages
import ViewProfile     from './pages/ViewProfile';
import HelpCenter      from './pages/HelpCenter';
import AccountSettings from './pages/AccountSettings';

// Styles
import 'bootstrap/dist/css/bootstrap.min.css';

const ALL_ROLES = ['admin', 'nurse', 'caregiver'];

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>

          {/* Public Routes */}
          <Route path="/"                      element={<HomePage />} />
          <Route path="/login"                 element={<LoginPage />} />
          <Route path="/donation"              element={<DonationPage />} />
          <Route path="/booking"               element={<BookingPage />} />
          <Route path="/verify-email/:token"   element={<VerifyEmail />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Nurse + Caregiver */}
          <Route path="/nurse" element={
            <ProtectedRoute allowedRoles={['nurse', 'caregiver']}>
              <NurseDashboard />
            </ProtectedRoute>
          } />

          {/* Shared Protected Pages */}
          <Route path="/profile"  element={<ProtectedRoute allowedRoles={ALL_ROLES}><ViewProfile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={ALL_ROLES}><AccountSettings /></ProtectedRoute>} />
          <Route path="/help"     element={<ProtectedRoute allowedRoles={ALL_ROLES}><HelpCenter /></ProtectedRoute>} />

          {/* Catch-all → home */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;