import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import OTPVerificationModal from '../components/OTPVerificationModal';

const AuthContext = createContext();

const API_BASE_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showOTPModal, setShowOTPModal] = useState(false);
    const [pendingUserId, setPendingUserId] = useState(null);

    useEffect(() => {
        const validateToken = async () => {
            if (token) {
                try {
                    const response = await axios.get(`${API_BASE_URL}/auth/validate-token`, {
                        headers: { Authorization: `Bearer ${token}` },
                        withCredentials: true,
                    });
                    if (response.data.success) {
                        setUser(response.data.user);
                        setIsAuthenticated(true);
                    } else {
                        localStorage.removeItem('token');
                        setToken(null);
                    }
                } catch (err) {
                    console.error('Token validation error:', err);
                    localStorage.removeItem('token');
                    setToken(null);
                }
            }
            setLoading(false);
        };

        validateToken();
    }, [token]);

    const login = async (username, password) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password }, {
                withCredentials: true,
            });
            const data = response.data;

            if (data.requiresOTP) {
                setPendingUserId(data.userId);
                setShowOTPModal(true);
                setLoading(false);
                return { requiresOTP: true, userId: data.userId };
            }

            if (data.success && data.token) {
                localStorage.setItem('token', data.token);
                setToken(data.token);
                setUser(data.user);
                setIsAuthenticated(true);
                return { success: true, user: data.user };
            }

            throw new Error(data.message || 'Login failed');
        } catch (err) {
            setError(err.response?.data?.message || err.message);
            return { success: false, error: err.response?.data?.message };
        } finally {
            setLoading(false);
        }
    };

    const handleOTPSuccess = (data) => {
        if (data.token) {
            localStorage.setItem('token', data.token);
            setToken(data.token);
            setUser(data.user);
            setIsAuthenticated(true);
            setShowOTPModal(false);
        }
    };

    const logout = async () => {
        try {
            await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                withCredentials: true,
            });
        } catch (err) {
            console.error('Logout request error:', err);
        }

        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setShowOTPModal(false);
        setPendingUserId(null);
    };

    const register = async (userData) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || err.message);
            return { success: false, error: err.response?.data?.message };
        } finally {
            setLoading(false);
        }
    };

    const updateUser = async (userData) => {
        setLoading(true);
        try {
            const response = await axios.put(`${API_BASE_URL}/auth/update-profile`, userData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setUser(response.data.user);
                return response.data;
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message);
            return { success: false, error: err.response?.data?.message };
        } finally {
            setLoading(false);
        }
    };

    const value = {
        user,
        token,
        isAuthenticated,
        loading,
        error,
        login,
        logout,
        register,
        updateUser,
        showOTPModal,
        setShowOTPModal,
        pendingUserId,
        handleOTPSuccess,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            {showOTPModal && (
                <OTPVerificationModal
                    isOpen={showOTPModal}
                    userId={pendingUserId}
                    onClose={() => setShowOTPModal(false)}
                    onVerified={handleOTPSuccess}
                />
            )}
        </AuthContext.Provider>
    );
};

export default AuthProvider;