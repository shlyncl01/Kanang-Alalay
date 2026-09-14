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
                        localStorage.removeItem('user');
                        setToken(null);
                    }
                } catch (err) {
                    console.error('Token validation error:', err);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
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

        // Clear every trace of the departing account. 'token' is the only
        // key this file writes, but something outside AuthContext (e.g. the
        // Login component) may be writing a 'user' cache directly — clear
        // it here too so a stale account's data can never survive a logout
        // and bleed into whoever logs in next on this browser.
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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

    // Merge fresh fields into the current context user, in memory only.
    // Lets a page that fetched richer data than validate-token gave us
    // (like ViewProfile hitting /auth/profile) share it with every other
    // component reading `user` from this context, without writing
    // anything to localStorage.
    //
    // Bails out (returns the SAME object reference) when nothing in the
    // patch actually differs from what's already on `user`. This matters
    // because components that depend on `user`/`ctxUser` in a useEffect
    // dependency array will otherwise re-run every time patchUser is
    // called, even with identical data — a fresh {...prev, ...patch}
    // object is always a new reference, which React treats as "changed"
    // and re-triggers those effects, which can call patchUser again,
    // looping forever.
    const patchUser = (patch) => {
        setUser(prev => {
            if (!prev) return prev;
            const changed = Object.keys(patch).some((key) => prev[key] !== patch[key]);
            return changed ? { ...prev, ...patch } : prev;
        });
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
        patchUser,
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