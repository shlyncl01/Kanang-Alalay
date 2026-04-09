import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';
import '../styles/LoginPage.css';

const getApiBaseUrl = () => {
    const fallback = process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api';
    const raw = process.env.REACT_APP_API_URL || fallback;
    const trimmed = raw.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API_BASE_URL = getApiBaseUrl();

const LoginPage = () => {
    const { login, user, getHomeRoute } = useAuth();
    const navigate = useNavigate();

    const [form, setForm]             = useState({ username: '', password: '' });
    const [showPass, setShowPass]     = useState(false);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');

    // OTP activation flow (shown when account is unverified)
    const [needsOtp, setNeedsOtp]     = useState(false);
    const [pendingUserId, setPendingUserId] = useState(null);
    const [otpCode, setOtpCode]       = useState('');
    const [otpMsg, setOtpMsg]         = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    // If already logged in → redirect to role home
    useEffect(() => {
        if (user) navigate(getHomeRoute(user.role), { replace: true });
    }, [user, navigate, getHomeRoute]);

    // Resend OTP countdown
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setInterval(() => setResendTimer(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [resendTimer]);

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    // ── Main login submit ──────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username.trim() || !form.password.trim()) {
            setError('Please enter your username/email and password.');
            return;
        }

        setLoading(true);
        setError('');

        const result = await login(form.username.trim(), form.password);

        setLoading(false);

        if (result.success) {
            navigate(getHomeRoute(result.user.role), { replace: true });
        } else {
            // Account not verified → show OTP entry panel
            if (result.userId) {
                setPendingUserId(result.userId);
                setNeedsOtp(true);
                setOtpMsg('Your account needs to be activated. Enter the OTP sent to your email, or request a new one.');
                setResendTimer(30);
            } else {
                setError(result.message || 'Invalid credentials.');
            }
        }
    };

    // ── OTP verify ────────────────────────────────────────────────────────
    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length < 6) {
            setOtpMsg('Please enter the full 6-digit OTP.');
            return;
        }
        setOtpLoading(true);
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ userId: pendingUserId, otp: otpCode })
            });
            const data = await res.json();
            if (data.success) {
                setOtpMsg('✅ Account activated! Logging you in…');
                // Re-try login automatically
                setTimeout(async () => {
                    const result = await login(form.username.trim(), form.password);
                    if (result.success) navigate(getHomeRoute(result.user.role), { replace: true });
                }, 1200);
            } else {
                setOtpMsg(data.message || 'Invalid or expired OTP.');
            }
        } catch {
            setOtpMsg('Network error. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    // ── Resend OTP ────────────────────────────────────────────────────────
    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setOtpMsg('Sending new OTP…');
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ userId: pendingUserId })
            });
            const data = await res.json();
            setOtpMsg(data.message || 'OTP resent.');
            setResendTimer(30);
        } catch {
            setOtpMsg('Failed to resend OTP.');
        }
    };

    // ── Render OTP activation panel ────────────────────────────────────────
    if (needsOtp) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="login-logo">
                        <div className="logo-mark"></div>
                    </div>
                    <h2 className="login-title">Activate Your Account</h2>
                    <p className="login-sub">Enter the 6-digit OTP sent to your email to activate your account.</p>

                    <div className="otp-input-row">
                        <input
                            type="text"
                            className="login-input otp-big-input"
                            placeholder="Enter 6-digit OTP"
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                        />
                    </div>

                    {otpMsg && (
                        <p className={`otp-feedback ${otpMsg.startsWith('✅') ? 'success' : 'info'}`}>
                            {otpMsg}
                        </p>
                    )}

                    <button
                        className="login-btn"
                        onClick={handleVerifyOtp}
                        disabled={otpLoading}
                    >
                        {otpLoading ? <FaSpinner className="spin" /> : 'Activate Account'}
                    </button>

                    <div className="otp-resend-row">
                        <button
                            className="resend-link"
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0}
                        >
                            {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                        </button>
                        <button className="back-link" onClick={() => setNeedsOtp(false)}>
                            ← Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Login Form ────────────────────────────────────────────────────
    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <div className="logo-mark"></div>
                </div>

                <h2 className="login-title">Kanang-Alalay</h2>
                <p className="login-sub">Sign in to your account</p>

                <form onSubmit={handleSubmit} noValidate>
                    {/* Username / Email */}
                    <div className="login-field">
                        <label htmlFor="username">Username or Email</label>
                        <div className="login-input-wrap">
                            <FaUser className="login-icon" />
                            <input
                                id="username"
                                name="username"
                                type="text"
                                className="login-input"
                                placeholder="Enter username or email"
                                value={form.username}
                                onChange={handleChange}
                                autoComplete="username"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="login-field">
                        <label htmlFor="password">Password</label>
                        <div className="login-input-wrap">
                            <FaLock className="login-icon" />
                            <input
                                id="password"
                                name="password"
                                type={showPass ? 'text' : 'password'}
                                className="login-input"
                                placeholder="Enter password"
                                value={form.password}
                                onChange={handleChange}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="pass-toggle"
                                onClick={() => setShowPass(p => !p)}
                                tabIndex={-1}
                            >
                                {showPass ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && <div className="login-error">{error}</div>}

                    {/* Forgot password */}
                    <div className="forgot-row">
                        <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? <><FaSpinner className="spin" /> Signing in…</> : 'Sign In'}
                    </button>
                </form>

                <p className="login-footer-note">
                    Need access? Contact your administrator to receive a registration code.
                </p>
            </div>
        </div>
    );
};

export default LoginPage;