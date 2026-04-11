import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner, FaEnvelope, FaKey, FaCheckCircle, FaTimes, FaArrowLeft } from 'react-icons/fa';
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

// ── Forgot Password Modal ─────────────────────────────────────────────────────
const ForgotPasswordModal = ({ onClose }) => {
    const [step, setStep]               = useState('email');
    const [email, setEmail]             = useState('');
    const [otp, setOtp]                 = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showNew, setShowNew]         = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [msg, setMsg]                 = useState({ text: '', type: '' });
    const [loading, setLoading]         = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setInterval(() => setResendTimer(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [resendTimer]);

    const setInfo  = (text) => setMsg({ text, type: 'info' });
    const setError = (text) => setMsg({ text, type: 'error' });
    const setOk    = (text) => setMsg({ text, type: 'success' });

    // Step 1 – request OTP
    const handleRequestOtp = async () => {
        if (!email.trim()) { setError('Please enter your email address.'); return; }
        setLoading(true);
        setMsg({ text: '', type: '' });
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setOk('OTP sent! Check your email inbox.');
                setStep('otp');
                setResendTimer(60);
            } else {
                setError(data.message || 'Failed to send OTP.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2 – verify OTP
    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 6) { setError('Enter the full 6-digit OTP.'); return; }
        setLoading(true);
        setMsg({ text: '', type: '' });
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/verify-reset-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim(), otp })
            });
            const data = await res.json();
            if (data.success) {
                setOk('OTP verified! Set your new password.');
                setStep('newpass');
            } else {
                setError(data.message || 'Invalid or expired OTP.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2 – resend OTP
    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setInfo('Sending new OTP…');
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/resend-reset-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim() })
            });
            const data = await res.json();
            setOk(data.message || 'New OTP sent.');
            setResendTimer(60);
        } catch {
            setError('Failed to resend OTP.');
        }
    };

    // Step 3 – reset password
    const handleResetPassword = async () => {
        if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (newPassword !== confirmPass) { setError('Passwords do not match.'); return; }
        setLoading(true);
        setMsg({ text: '', type: '' });
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/reset-password-with-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim(), otp, password: newPassword })
            });
            const data = await res.json();
            if (data.success) {
                setNewPassword('');
                setConfirmPass('');
                setOtp('');
                setEmail('');
                setStep('done');
            } else {
                setError(data.message || 'Failed to reset password.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const stepTitles = {
        email:   'Forgot Password',
        otp:     'Enter OTP',
        newpass: 'New Password',
        done:    'All Done!'
    };

    const stepSubs = {
        email:   "Enter the email address linked to your account and we'll send a one-time code.",
        otp:     `We sent a 6-digit code to ${email}. Enter it below.`,
        newpass: 'Choose a strong new password for your account.',
        done:    'Your password has been reset successfully.'
    };

    return (
        <div className="fp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="fp-modal">
                <button className="fp-close" onClick={onClose} aria-label="Close">
                    <FaTimes />
                </button>

                {step !== 'done' && (
                    <div className="fp-steps">
                        {['email', 'otp', 'newpass'].map((s, i) => (
                            <div key={s} className="fp-step-wrap">
                                <div className={`fp-dot ${step === s ? 'active' : ['otp','newpass','done'].indexOf(step) > i-1 && step !== s ? 'done' : ''}`}>
                                    {(['otp','newpass','done'].indexOf(step) > i) ? '✓' : i + 1}
                                </div>
                                {i < 2 && <div className={`fp-line ${['otp','newpass','done'].indexOf(step) > i ? 'done' : ''}`} />}
                            </div>
                        ))}
                    </div>
                )}

                <h3 className="fp-title">{stepTitles[step]}</h3>
                <p className="fp-sub">{stepSubs[step]}</p>

                {msg.text && (
                    <div className={`fp-msg fp-msg-${msg.type}`}>{msg.text}</div>
                )}

                {/* ── Email ── */}
                {step === 'email' && (
                    <div className="fp-body">
                        <div className="fp-field">
                            <label>Email Address</label>
                            <div className="fp-input-wrap">
                                <FaEnvelope className="fp-icon" />
                                <input
                                    type="email"
                                    className="fp-input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setMsg({ text:'', type:'' }); }}
                                    onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button className="fp-btn" onClick={handleRequestOtp} disabled={loading}>
                            {loading ? <FaSpinner className="spin" /> : 'Send OTP'}
                        </button>
                    </div>
                )}

                {/* ── OTP ── */}
                {step === 'otp' && (
                    <div className="fp-body">
                        <div className="fp-field">
                            <label>6-Digit OTP</label>
                            <input
                                type="text"
                                className="fp-input otp-center"
                                placeholder="• • • • • •"
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                                onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                                maxLength={6}
                                autoFocus
                            />
                        </div>
                        <button className="fp-btn" onClick={handleVerifyOtp} disabled={loading}>
                            {loading ? <FaSpinner className="spin" /> : 'Verify OTP'}
                        </button>
                        <div className="fp-resend-row">
                            <button className="fp-link" onClick={handleResendOtp} disabled={resendTimer > 0}>
                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                            </button>
                            <button className="fp-link muted" onClick={() => { setStep('email'); setOtp(''); setMsg({ text:'', type:'' }); }}>
                                ← Change Email
                            </button>
                        </div>
                    </div>
                )}

                {step === 'newpass' && (
                    <div className="fp-body">
                        <div className="fp-field">
                            <label>New Password</label>
                            <div className="fp-input-wrap">
                                <FaKey className="fp-icon" />
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    className="fp-input"
                                    placeholder="At least 6 characters"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    autoFocus
                                />
                                <button type="button" className="fp-eye" onClick={() => setShowNew(p => !p)}>
                                    {showNew ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                        <div className="fp-field">
                            <label>Confirm Password</label>
                            <div className="fp-input-wrap">
                                <FaLock className="fp-icon" />
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    className="fp-input"
                                    placeholder="Repeat your new password"
                                    value={confirmPass}
                                    onChange={e => setConfirmPass(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                                />
                                <button type="button" className="fp-eye" onClick={() => setShowConfirm(p => !p)}>
                                    {showConfirm ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        {/* Password strength bar */}
                        {newPassword && (
                            <div className="fp-strength-wrap">
                                <div className="fp-strength-bar">
                                    <div className={`fp-strength-fill s${Math.min(Math.floor(newPassword.length / 3), 4)}`} />
                                </div>
                                <span className="fp-strength-label">
                                    {newPassword.length < 3 ? 'Too short' : newPassword.length < 6 ? 'Weak' : newPassword.length < 9 ? 'Fair' : newPassword.length < 12 ? 'Good' : 'Strong'}
                                </span>
                            </div>
                        )}

                        <button className="fp-btn" onClick={handleResetPassword} disabled={loading}>
                            {loading ? <FaSpinner className="spin" /> : 'Reset Password'}
                        </button>
                    </div>
                )}

                {step === 'done' && (
                    <div className="fp-body fp-done">
                        <div className="fp-success-icon">
                            <FaCheckCircle />
                        </div>
                        <p className="fp-done-text">You can now sign in with your new password.</p>
                        <button className="fp-btn" onClick={onClose}>
                            Back to Sign In
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main Login Page ────────────────────────────────────────────────────────────
const LoginPage = () => {
    const { login, user, getHomeRoute } = useAuth();
    const navigate = useNavigate();

    const [form, setForm]             = useState({ username: '', password: '' });
    const [showPass, setShowPass]     = useState(false);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');
    const [showForgot, setShowForgot] = useState(false);

    const [needsOtp, setNeedsOtp]         = useState(false);
    const [pendingUserId, setPendingUserId] = useState(null);
    const [otpCode, setOtpCode]           = useState('');
    const [otpMsg, setOtpMsg]             = useState('');
    const [otpLoading, setOtpLoading]     = useState(false);
    const [resendTimer, setResendTimer]   = useState(0);

    useEffect(() => {
        if (user) navigate(getHomeRoute(user.role), { replace: true });
    }, [user, navigate, getHomeRoute]);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setInterval(() => setResendTimer(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [resendTimer]);

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

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

    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length < 6) { setOtpMsg('Please enter the full 6-digit OTP.'); return; }
        setOtpLoading(true);
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ userId: pendingUserId, otp: otpCode })
            });
            const data = await res.json();
            if (data.success) {
                setOtpMsg('Account activated! Logging you in…');
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

    // ── OTP Activation panel ──────────────────────────────────────────────────
    if (needsOtp) {
        return (
            <div className="login-page">
                <button className="back-to-home" onClick={() => navigate("/")}>
                    <FaArrowLeft /> Back to Home
                </button>
                <div className="login-card">
                    <div className="login-logo"><div className="logo-mark"></div></div>
                    <h2 className="login-title">Activate Your Account</h2>
                    <p className="login-sub">Enter the 6-digit OTP sent to your email to activate your account.</p>
                    <div className="otp-input-row">
                        <input
                            type="text"
                            className="login-input otp-big-input"
                            placeholder="Enter 6-digit OTP"
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                            maxLength={6}
                        />
                    </div>
                    {otpMsg && (
                        <p className={`otp-feedback ${otpMsg.startsWith('✅') ? 'success' : 'info'}`}>{otpMsg}</p>
                    )}
                    <button className="login-btn" onClick={handleVerifyOtp} disabled={otpLoading}>
                        {otpLoading ? <FaSpinner className="spin" /> : 'Activate Account'}
                    </button>
                    <div className="otp-resend-row">
                        <button className="resend-link" onClick={handleResendOtp} disabled={resendTimer > 0}>
                            {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                        </button>
                        <button className="back-link" onClick={() => setNeedsOtp(false)}>← Back to Login</button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Login Form ───────────────────────────────────────────────────────
    return (
        <>
            <div className="login-page">
                <button className="back-to-home" onClick={() => navigate("/")}>
                    <FaArrowLeft /> Back to Home
                </button>
                <div className="login-card">
                    <div className="login-logo"><div className="logo-mark"></div></div>
                    <h2 className="login-title">Kanang-Alalay</h2>
                    <p className="login-sub">Sign in to your account</p>

                    <form onSubmit={handleSubmit} noValidate>
                        <div className="login-field">
                            <label htmlFor="username">Username or Email</label>
                            <div className="login-input-wrap">
                                <FaUser className="login-icon" />
                                <input
                                    id="username" name="username" type="text"
                                    className="login-input"
                                    placeholder="Enter username or email"
                                    value={form.username}
                                    onChange={handleChange}
                                    autoComplete="username"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="login-field">
                            <label htmlFor="password">Password</label>
                            <div className="login-input-wrap">
                                <FaLock className="login-icon" />
                                <input
                                    id="password" name="password"
                                    type={showPass ? 'text' : 'password'}
                                    className="login-input"
                                    placeholder="Enter password"
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="current-password"
                                />
                                <button type="button" className="pass-toggle" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                                    {showPass ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        {error && <div className="login-error">{error}</div>}

                        <div className="forgot-row">
                            {/* Changed from Link to button to open modal */}
                            <button
                                type="button"
                                className="forgot-link"
                                onClick={() => setShowForgot(true)}
                            >
                                Forgot Password?
                            </button>
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

            {/* Forgot Password Modal */}
            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
        </>
    );
};

export default LoginPage;