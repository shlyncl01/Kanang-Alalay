import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
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

// Helper: all requests must include credentials so the cookie is sent/received
const authFetch = (path, options = {}) =>
    fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

// Helper: decide where to send each role after login
const getHomeRoute = (role) => {
    if (role === 'admin')          return '/admin';
    if (role === 'head_caregiver') return '/head-caregiver';
    return '/';
};

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 5 * 60; // matches backend's 5-minute OTP expiry
const RESEND_COOLDOWN_SECONDS = 60;

const ForgotPasswordModal = ({ onClose }) => {
    const [step, setStep]               = useState('email');
    const [email, setEmail]             = useState('');
    const [emailTouched, setEmailTouched] = useState(false);
    const [otpDigits, setOtpDigits]     = useState(Array(OTP_LENGTH).fill(''));
    const [newPassword, setNewPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showNew, setShowNew]         = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [msg, setMsg]                 = useState({ text: '', type: '' });
    const [loading, setLoading]         = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [expiryTimer, setExpiryTimer] = useState(OTP_EXPIRY_SECONDS);

    const otpRefs = React.useRef([]);
    const otp = otpDigits.join('');
    const otpComplete = otp.length === OTP_LENGTH;

    // 60s cooldown before the Resend button becomes clickable again
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setInterval(() => setResendTimer(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [resendTimer]);

    // 5:00 countdown showing how long the current code is valid for
    useEffect(() => {
        if (step !== 'otp' || expiryTimer <= 0) return;
        const t = setInterval(() => setExpiryTimer(p => (p <= 1 ? 0 : p - 1)), 1000);
        return () => clearInterval(t);
    }, [step, expiryTimer]);

    const setInfo  = (text) => setMsg({ text, type: 'info' });
    const setError = (text) => setMsg({ text, type: 'error' });
    const setOk    = (text) => setMsg({ text, type: 'success' });

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    const handleRequestOtp = async () => {
        setEmailTouched(true);
        if (!email.trim()) { setError('Please enter your email address.'); return; }
        if (!emailValid) { setError('Please enter a valid email address.'); return; }
        setLoading(true);
        setMsg({ text: '', type: '' });
        try {
            const res  = await authFetch('/auth/forgot-password', {
                method: 'POST',
                body:   JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setOk('A verification code has been sent to your email.');
                setStep('otp');
                setOtpDigits(Array(OTP_LENGTH).fill(''));
                setResendTimer(RESEND_COOLDOWN_SECONDS);
                setExpiryTimer(OTP_EXPIRY_SECONDS);
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else {
                // Covers "No account is registered with this email address." from the backend
                setError(data.message || 'Failed to send verification code.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otpDigits];
        next[index] = value.slice(-1);
        setOtpDigits(next);
        setMsg({ text: '', type: '' });
        if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter' && otpComplete) handleVerifyOtp();
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted) return;
        const next = [...otpDigits];
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setOtpDigits(next);
        otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    };

    const handleVerifyOtp = async () => {
        if (!otpComplete) { setError(`Enter the full ${OTP_LENGTH}-digit code.`); return; }
        if (expiryTimer <= 0) { setError('Verification code has expired.'); return; }
        setLoading(true);
        setMsg({ text: '', type: '' });
        try {
            const res  = await authFetch('/auth/verify-reset-otp', {
                method: 'POST',
                body:   JSON.stringify({ email: email.trim(), otp }),
            });
            const data = await res.json();
            if (data.success) {
                setOk('Code verified! Set your new password.');
                setStep('newpass');
            } else {
                // Backend distinguishes "Invalid verification code." vs "Verification code has expired."
                setError(data.message || 'Invalid verification code.');
                setOtpDigits(Array(OTP_LENGTH).fill(''));
                setTimeout(() => otpRefs.current[0]?.focus(), 50);
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        setInfo('Sending new code…');
        try {
            const res  = await authFetch('/auth/resend-reset-otp', {
                method: 'POST',
                body:   JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setOk(data.message || 'New code sent.');
                setOtpDigits(Array(OTP_LENGTH).fill(''));
                setResendTimer(RESEND_COOLDOWN_SECONDS);
                setExpiryTimer(OTP_EXPIRY_SECONDS);
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else {
                // Covers the "Maximum resend attempts reached" 429 case
                setError(data.message || 'Failed to resend code.');
            }
        } catch {
            setError('Failed to resend code.');
        } finally {
            setLoading(false);
        }
    };

    const passwordsMatch = confirmPass.length > 0 && newPassword === confirmPass;
    const passwordsMismatch = confirmPass.length > 0 && newPassword !== confirmPass;

    const handleResetPassword = async () => {
        if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (newPassword !== confirmPass) { setError('Passwords do not match.'); return; }
        setLoading(true);
        setMsg({ text: '', type: '' });
        try {
            const res  = await authFetch('/auth/reset-password-with-otp', {
                method: 'POST',
                body:   JSON.stringify({ email: email.trim(), otp, password: newPassword }),
            });
            const data = await res.json();
            if (data.success) {
                setNewPassword('');
                setConfirmPass('');
                setOtpDigits(Array(OTP_LENGTH).fill(''));
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
        otp:     'Enter Verification Code',
        newpass: 'New Password',
        done:    'All Done!'
    };

    const stepSubs = {
        email:   "Enter the email address linked to your account and we'll send a one-time code.",
        otp:     `We sent a ${OTP_LENGTH}-digit code to ${email}. Enter it below.`,
        newpass: 'Choose a new password for your account.',
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
                                    onBlur={() => setEmailTouched(true)}
                                    onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                                    autoFocus
                                />
                            </div>
                            {emailTouched && email.trim() && !emailValid && (
                                <span style={{ color: '#dc3545', fontSize: '.8rem', marginTop: 4, display: 'block' }}>
                                    Please enter a valid email address.
                                </span>
                            )}
                        </div>
                        <button className="fp-btn" onClick={handleRequestOtp} disabled={loading || (emailTouched && !!email.trim() && !emailValid)}>
                            {loading ? <FaSpinner className="spin" /> : 'Send Verification Code'}
                        </button>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="fp-body">
                        <div className="fp-field">
                            <label>{OTP_LENGTH}-Digit Code</label>
                            <div
                                onPaste={handleOtpPaste}
                                style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '4px 0 6px' }}
                            >
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => otpRefs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        autoComplete="one-time-code"
                                        style={{
                                            width: 42, height: 52,
                                            textAlign: 'center', fontSize: '1.35rem', fontWeight: 700,
                                            fontFamily: 'monospace',
                                            border: `2px solid ${digit ? '#F96B38' : '#E8D6CC'}`,
                                            borderRadius: 10,
                                            outline: 'none',
                                            background: digit ? '#FFF8F3' : '#fff',
                                        }}
                                    />
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '.8rem', color: expiryTimer <= 30 ? '#dc3545' : '#7A5C4E' }}>
                                {expiryTimer > 0 ? `Code expires in ${formatTime(expiryTimer)}` : 'Code has expired — request a new one'}
                            </div>
                        </div>
                        <button className="fp-btn" onClick={handleVerifyOtp} disabled={loading || !otpComplete}>
                            {loading ? <FaSpinner className="spin" /> : 'Verify Code'}
                        </button>
                        <div className="fp-resend-row">
                            <button className="fp-link" onClick={handleResendOtp} disabled={resendTimer > 0 || loading}>
                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                            </button>
                            <button
                                className="fp-link muted"
                                onClick={() => { setStep('email'); setOtpDigits(Array(OTP_LENGTH).fill('')); setMsg({ text:'', type:'' }); }}
                            >
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
                            {passwordsMismatch && (
                                <span style={{ color: '#dc3545', fontSize: '.8rem', marginTop: 4, display: 'block' }}>
                                    Passwords do not match.
                                </span>
                            )}
                            {passwordsMatch && (
                                <span style={{ color: '#28a745', fontSize: '.8rem', marginTop: 4, display: 'block' }}>
                                    ✓ Passwords match
                                </span>
                            )}
                        </div>

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

                        <button className="fp-btn" onClick={handleResetPassword} disabled={loading || newPassword.length < 6 || passwordsMismatch}>
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

const LoginPage = () => {
    const { login, user } = useAuth();
    const navigate  = useNavigate();
    const location  = useLocation();

    const [form, setForm]             = useState({ username: '', password: '' });
    const [showPass, setShowPass]     = useState(false);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');
    const [showForgot, setShowForgot] = useState(false);

    const [needsOtp, setNeedsOtp]           = useState(false);
    const [pendingUserId, setPendingUserId] = useState(null);
    const [otpCode, setOtpCode]             = useState('');
    const [otpMsg, setOtpMsg]               = useState('');
    const [otpLoading, setOtpLoading]       = useState(false);
    const [resendTimer, setResendTimer]     = useState(0);

    // Redirect if already logged in
    useEffect(() => {
        if (user) navigate(getHomeRoute(user.role), { replace: true });
    }, [user, navigate]);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setInterval(() => setResendTimer(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [resendTimer]);

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const [blockedStatus, setBlockedStatus] = useState(() => {
        const nav = location?.state?.blockedStatus;
        return nav ? { status: nav, reason: '' } : null;
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username.trim() || !form.password.trim()) {
            setError('Please enter your username/email and password.');
            return;
        }
        setLoading(true);
        setError('');
        setBlockedStatus(null);

        // login() in AuthContext should POST to /auth/login with credentials: 'include'
        const result = await login(form.username.trim(), form.password);
        setLoading(false);

        if (!result) {
            setError('Something went wrong. Please try again.');
            return;
        }

        if (result.success) {
            navigate(getHomeRoute(result.user.role), { replace: true });
        } else if (result.requiresOTP) {
            // AuthContext handles the OTP modal for first-time login
        } else {
            const status = result.accountStatus;
            if (status && ['deactivated', 'suspended', 'restricted', 'on_leave', 'terminated', 'role_blocked'].includes(status)) {
                setBlockedStatus({ status, reason: result.reason || '' });
            } else if (result.needsOtp || result.userId) {
                setPendingUserId(result.userId);
                setNeedsOtp(true);
                setOtpMsg('Your account needs to be activated. Enter the OTP sent to your email, or request a new one.');
                setResendTimer(30);
            } else {
                setError(result.error || result.message || 'Invalid credentials.');
            }
        }
    };

    const BLOCKED_CONFIG = {
        deactivated: {
            icon: '⛔', title: 'Account Deactivated',
            message: 'Your account has been permanently deactivated by an administrator. Please contact your HR department or system administrator for assistance.',
            bg: '#FFF0F0', border: '#F5C6CB', color: '#721C24', iconBg: '#F8D7DA',
        },
        suspended: {
            icon: '⏸', title: 'Account Suspended',
            message: 'Your account has been temporarily suspended. This may be due to a policy violation or a pending investigation. Please contact your administrator.',
            bg: '#FFF3CD', border: '#FFEAA7', color: '#856404', iconBg: '#FFF0B3',
        },
        restricted: {
            icon: '🔒', title: 'Access Restricted',
            message: 'Your system access has been restricted by an administrator. You may still be employed but certain features are unavailable. Contact your supervisor for details.',
            bg: '#FFF8E1', border: '#FFE082', color: '#E65100', iconBg: '#FFE0B2',
        },
        on_leave: {
            icon: '🏖', title: 'On Leave',
            message: 'Your account is currently on leave of absence. Access will be restored upon your return. Contact your administrator if this is unexpected.',
            bg: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8', iconBg: '#DBEAFE',
        },
        terminated: {
            icon: '🚫', title: 'Employment Terminated',
            message: 'Your employment has been terminated and your account access has been revoked. Please contact HR if you believe this is an error.',
            bg: '#F3F4F6', border: '#D1D5DB', color: '#374151', iconBg: '#E5E7EB',
        },
        role_blocked: {
            icon: '📱', title: 'Web Access Not Available',
            message: 'Your account role does not have access to the web portal. Please use the mobile app to access your account.',
            bg: '#F5F3FF', border: '#C4B5FD', color: '#5B21B6', iconBg: '#EDE9FE',
        },
    };

    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length < 6) { setOtpMsg('Please enter the full 6-digit OTP.'); return; }
        setOtpLoading(true);
        try {
            const res  = await authFetch('/auth/verify-otp', {
                method: 'POST',
                body:   JSON.stringify({ userId: pendingUserId, otp: otpCode }),
            });
            const data = await res.json();
            if (data.success) {
                setOtpMsg('Account activated! Logging you in…');
                setTimeout(async () => {
                    const result = await login(form.username.trim(), form.password);
                    if (result && result.success) navigate(getHomeRoute(result.user.role), { replace: true });
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
            const res  = await authFetch('/auth/resend-otp', {
                method: 'POST',
                body:   JSON.stringify({ userId: pendingUserId }),
            });
            const data = await res.json();
            setOtpMsg(data.message || 'OTP resent.');
            setResendTimer(30);
        } catch {
            setOtpMsg('Failed to resend OTP.');
        }
    };

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

                        {blockedStatus && (() => {
                            const cfg = BLOCKED_CONFIG[blockedStatus.status];
                            if (!cfg) return null;
                            return (
                                <div style={{
                                    background: cfg.bg, border: `1.5px solid ${cfg.border}`,
                                    borderRadius: 12, padding: '16px', marginBottom: 16,
                                    display: 'flex', gap: 14, alignItems: 'flex-start',
                                    animation: 'shake .3s ease'
                                }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%',
                                        background: cfg.iconBg, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.1rem', flexShrink: 0
                                    }}>{cfg.icon}</div>
                                    <div>
                                        <strong style={{ display: 'block', color: cfg.color, fontSize: '.9rem', marginBottom: 4 }}>
                                            {cfg.title}
                                        </strong>
                                        <span style={{ color: cfg.color, fontSize: '.82rem', lineHeight: 1.5, opacity: .9 }}>
                                            {cfg.message}
                                        </span>
                                        {blockedStatus.reason && (
                                            <div style={{ marginTop: 8, fontSize: '.78rem', color: cfg.color, opacity: .8, fontStyle: 'italic' }}>
                                                Reason: {blockedStatus.reason}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {error && <div className="login-error">{error}</div>}

                        <div className="forgot-row">
                            <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>
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

            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
        </>
    );
};

export default LoginPage;