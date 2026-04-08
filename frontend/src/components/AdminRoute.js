import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="admin-loading">
                <h4>Checking Admin Privileges...</h4>
                <div className="spinner"></div>
            </div>
        );
    }

    // Check if user is admin
    if (!user || user.role !== 'admin') {
        // Log unauthorized access attempt
        console.warn('Unauthorized access attempt to admin route');
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default AdminRoute;