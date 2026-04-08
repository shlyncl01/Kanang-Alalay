
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * 
 * Props:
 *   allowedRoles  - array of roles that may access this route, e.g. ['admin']
 *   children      - the component to render if access is granted
 * 
 * Behaviour:
 *   - If still loading (restoring session) → render nothing (or a spinner)
 *   - If not logged in → redirect to /login
 *   - If role not in allowedRoles → redirect to the user's own home route
 *   - Otherwise → render children
 */
const ProtectedRoute = ({ allowedRoles = [], children }) => {
    const { user, loading, getHomeRoute } = useAuth();

    if (loading) {
        // Avoid flash-of-login while token is being validated
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                color: '#7A5C4E',
                fontSize: '1rem'
            }}>
                Loading…
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // User is logged in but wrong role — redirect to their correct dashboard
        return <Navigate to={getHomeRoute(user.role)} replace />;
    }

    return children;
};

export default ProtectedRoute;