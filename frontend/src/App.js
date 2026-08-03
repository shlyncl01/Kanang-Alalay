import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DonationPage from './pages/DonationPage';
import BookingPage from './pages/BookingPage';
import VerifyEmail from './pages/VerifyEmail';
// import ResetPassword from './pages/ResetPassword';

import AdminDashboard from './pages/AdminDashboard';
import HeadCaregiverDashboard from './pages/HeadCaregiverDashboard';

import ViewProfile from './pages/ViewProfile';
import HelpCenter from './pages/HelpCenter';
import AccountSettings from './pages/AccountSettings';

import 'bootstrap/dist/css/bootstrap.min.css';

const ALL_ROLES = ['admin', 'head_caregiver'];

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/donation" element={<DonationPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          {/* <Route path="/reset-password/:token" element={<ResetPassword />} /> */}

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/head-caregiver" element={
            <ProtectedRoute allowedRoles={['head_caregiver']}>
              <HeadCaregiverDashboard />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={<ProtectedRoute allowedRoles={ALL_ROLES}><ViewProfile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={ALL_ROLES}><AccountSettings /></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute allowedRoles={ALL_ROLES}><HelpCenter /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;