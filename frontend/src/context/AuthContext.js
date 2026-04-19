import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const VALID_ROLES = ['admin', 'nurse', 'caregiver'];

const getApiBaseUrl = () => {
    const fallback = process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api';
    const raw     = process.env.REACT_APP_API_URL || fallback;
    const trimmed = raw.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API_BASE_URL = getApiBaseUrl();

export const AuthProvider = ({ children }) => {
    const [user,    setUser]    = useState(null);
    const [loading, setLoading] = useState(true);

    // ── On mount: restore session AND validate token with backend ─────────────
    useEffect(() => {
        const restore = async () => {
            const token      = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            // Nothing stored → not logged in
            if (!token || !storedUser) {
                setLoading(false);
                return;
            }

            // Quick local check: reject invalid/removed roles immediately
            let parsed;
            try {
                parsed = JSON.parse(storedUser);
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setLoading(false);
                return;
            }

            if (!VALID_ROLES.includes(parsed.role)) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setLoading(false);
                return;
            }

            // ── Backend validation: check token hasn't expired ─────────────
            try {
                const res = await fetch(`${API_BASE_URL}/auth/validate-token`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    // Token expired or user deactivated/role changed on backend
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setLoading(false);
                    return;
                }

                // Update stored user with fresh data from backend
                // (catches ward/shift/name changes made by admin)
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
            } catch {
                // Network error during validation — fall back to stored user
                // so the app still works offline/slow connections
                setUser(parsed);
            }

            setLoading(false);
        };

        restore();
    }, []);

    // ── Login ──────────────────────────────────────────────────────────────────
    const login = useCallback(async (username, password) => {
        const res  = await fetch(`${API_BASE_URL}/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Login failed.', userId: data.userId };
        }

        // Block invalid roles even if backend returns them
        if (!VALID_ROLES.includes(data.user?.role)) {
            return {
                success: false,
                message: 'Your account role is no longer supported. Please contact the administrator.',
            };
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user',  JSON.stringify(data.user));
        setUser(data.user);
        return { success: true, user: data.user };
    }, []);

    // ── Logout ─────────────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    }, []);

    // ── Role → home route ──────────────────────────────────────────────────────
    const getHomeRoute = useCallback((role) => {
        switch ((role || '').toLowerCase()) {
            case 'admin':     return '/admin';
            case 'nurse':     return '/nurse';
            case 'caregiver': return '/nurse';
            default:          return '/login';
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, getHomeRoute }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
};