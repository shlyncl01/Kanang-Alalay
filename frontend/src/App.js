import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DonationPage from './pages/DonationPage';
import BookingPage from './pages/BookingPage';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';

// Dashboards
import AdminDashboard from './pages/AdminDashboard';
import NurseDashboard from './pages/NurseDashboard';

// User Pages
import ViewProfile from './pages/ViewProfile';
import HelpCenter from './pages/HelpCenter';
import AccountSettings from './pages/AccountSettings';

// Styles
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>

          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/donation" element={<DonationPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Nurse + Caregiver */}
          <Route
            path="/nurse"
            element={
              <ProtectedRoute allowedRoles={['nurse', 'caregiver']}>
                <NurseDashboard />
              </ProtectedRoute>
            }
          />

          {/* Shared Protected Pages */}
          <Route path="/profile"  element={<ProtectedRoute allowedRoles={['admin', 'nurse', 'caregiver']}><ViewProfile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'nurse', 'caregiver']}><AccountSettings /></ProtectedRoute>} />
          <Route path="/help"     element={<ProtectedRoute allowedRoles={['admin', 'nurse', 'caregiver']}><HelpCenter /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;