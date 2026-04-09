import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const getApiBaseUrl = () => {
    const fallback = process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api';
    const raw = process.env.REACT_APP_API_URL || fallback;
    const trimmed = raw.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API_BASE_URL = getApiBaseUrl();

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(true); // true while checking stored token

    // ── On mount: restore session from localStorage ────────────────────────
    useEffect(() => {
        const token     = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    // ── Login: POST /api/auth/login ────────────────────────────────────────
    const login = useCallback(async (username, password) => {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            // Return structured error so LoginPage can display it
            return { success: false, message: data.message || 'Login failed.', userId: data.userId };
        }

        // Persist token + user
        localStorage.setItem('token', data.token);
        localStorage.setItem('user',  JSON.stringify(data.user));
        setUser(data.user);

        return { success: true, user: data.user };
    }, []);

    // ── Logout ─────────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    }, []);

    // ── Helper: get role-based home route ──────────────────────────────────
    const getHomeRoute = useCallback((role) => {
        switch ((role || '').toLowerCase()) {
            case 'admin':     return '/admin';
            case 'nurse':     return '/nurse';
            case 'caregiver': return '/nurse';   
            case 'staff':     return '/staff';
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