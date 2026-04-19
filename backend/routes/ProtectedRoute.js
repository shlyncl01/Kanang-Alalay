import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const VALID_ROLES = ['admin', 'nurse', 'caregiver'];

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                color: '#7A5C4E', gap: 12,
            }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p style={{ margin: 0, fontSize: '.9rem' }}>Verifying access…</p>
            </div>
        );
    }

    // Not logged in → go to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Role no longer valid (e.g. old 'staff' token in localStorage) → force logout
    if (!VALID_ROLES.includes(user.role)) {
        logout(); // clears localStorage
        return <Navigate to="/login" replace />;
    }

    // Logged in but wrong role for this route → redirect to their correct dashboard
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        const fallback = user.role === 'admin' ? '/admin' : '/nurse';
        return <Navigate to={fallback} replace />;
    }

    return children;
};

export default ProtectedRoute;