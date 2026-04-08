import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute - Component to protect routes based on authentication and roles
 * @param {Object} props
 * @param {ReactNode} props.children - The component to render if authorized
 * @param {Array} props.allowedRoles - Array of roles allowed to access the route
 * @param {boolean} props.requireAuth - Whether authentication is required (default: true)
 * @param {string} props.redirectTo - Where to redirect unauthorized users (default: '/login')
 */
const ProtectedRoute = ({ 
    children, 
    allowedRoles = [], 
    requireAuth = true,
    redirectTo = '/login'
}) => {
    const { user, loading } = useAuth();

    // Show loading state
    if (loading) {
        return (
            <div className="auth-loading">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Verifying access...</p>
            </div>
        );
    }

    // If authentication is required but no user is logged in
    if (requireAuth && !user) {
        return <Navigate to={redirectTo} replace />;
    }

    // If user exists but route requires specific roles
    if (user && allowedRoles.length > 0) {
        const hasRequiredRole = allowedRoles.includes(user.role);
        
        if (!hasRequiredRole) {
            // Redirect based on user role
            let fallbackRoute = '/';
            switch (user.role) {
                case 'admin':
                    fallbackRoute = '/admin';
                    break;
                case 'nurse':
                    fallbackRoute = '/nurse';
                    break;
                case 'caregiver':
                    fallbackRoute = '/caregiver';
                    break;
                case 'staff':
                    fallbackRoute = '/dashboard';
                    break;
                default:
                    fallbackRoute = '/';
            }
            return <Navigate to={fallbackRoute} replace />;
        }
    }

    // All checks passed, render the children
    return children;
};

export default ProtectedRoute;