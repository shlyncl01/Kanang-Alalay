import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FaEye, FaEyeSlash, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { useAuth, API_BASE_URL } from '../context/AuthContext';

// Shown when user.needsProfileUpdate === true (see ProtectedRoute.js). Fields
// match what the rest of the app already treats as "the profile" — same set
// used by the Admin "Edit User" modal and backed by PUT /auth/update-profile,
// now extended (PART 18D) with Email (read-only), Address, phone
// verification via PART 18C's existing OTP endpoints, and a required
// password replacement.
//
// Intentionally has no close/cancel affordance: the user must not be able to
// permanently bypass required profile completion.
const OTP_LENGTH = 6;
const PHONE_RESEND_COOLDOWN = 60; // matches PART 18C's server-side cooldown

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #E8D6CC',
    borderRadius: 10,
    fontSize: '.9rem',
    background: '#FFF8F3',
    color: '#1A0A00',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--d-font-body)',
};

const readOnlyInputStyle = {
    ...inputStyle,
    background: '#F3ECE6',
    color: '#7A5C4E',
    cursor: 'not-allowed',
};

const labelStyle = {
    display: 'block',
    fontSize: '.76rem',
    fontWeight: 700,
    color: '#2c3e50',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    marginBottom: 5,
};

const smallBtnStyle = (disabled) => ({
    padding: '0 16px',
    borderRadius: 10,
    border: 'none',
    background: disabled ? '#ccc' : 'linear-gradient(135deg,#F96B38,#D94E1B)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '.82rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
});

const eyeBtnStyle = {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#7A5C4E',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
};

const CompleteProfileModal = () => {
    const { user, token, patchUser } = useAuth();

    const [form, setForm] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        middleName: user?.middleName || '',
        phone: user?.phone || '',
        street: user?.address?.street || '',
        city: user?.address?.city || '',
        province: user?.address?.province || '',
        zipCode: user?.address?.zipCode || '',
        newPassword: '',
        confirmNewPassword: '',
    });
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // ── Phone verification (reuses PART 18C's existing endpoints as-is) ────
    // phoneSaved tracks what's actually persisted in MongoDB right now (kept
    // in sync via PUT /auth/update-phone before any OTP is requested, since
    // /send-phone-otp always sends to whatever phone is already on the
    // account — it takes no phone number of its own).
    const [phoneSaved, setPhoneSaved] = useState(user?.phone || '');
    const [phoneVerified, setPhoneVerified] = useState(!!user?.phoneVerified);
    const [phoneStage, setPhoneStage] = useState('idle'); // idle | sending | otp | verifying
    const [phoneOtpDigits, setPhoneOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
    const [phoneOtpError, setPhoneOtpError] = useState('');
    const [phoneResendTimer, setPhoneResendTimer] = useState(0);
    const phoneOtpRefs = useRef([]);

    useEffect(() => {
        if (phoneResendTimer <= 0) return;
        const t = setInterval(() => setPhoneResendTimer((p) => (p <= 1 ? 0 : p - 1)), 1000);
        return () => clearInterval(t);
    }, [phoneResendTimer]);

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    const setField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (error) setError('');
    };

    const handlePhoneChange = (value) => {
        setField('phone', value.replace(/\D/g, '').slice(0, 11));
        // Editing away from whatever's currently saved always resets any
        // in-progress OTP UI — the OTP that was sent (if any) was for the
        // number that used to be in this field, not the one being typed now.
        setPhoneStage('idle');
        setPhoneOtpError('');
    };

    // Phone counts as verified for THIS field's current value only when it
    // exactly matches the number MongoDB has on file AND that number's
    // phoneVerified is true — editing the field always drops back to
    // "needs verification" until the OTP flow below confirms the new one.
    const phoneMatchesSaved = form.phone.trim() === phoneSaved.trim();
    const phoneIsVerifiedForCurrentValue = phoneMatchesSaved && phoneVerified;
    const phoneOk = !form.phone.trim() || phoneIsVerifiedForCurrentValue;

    const handleVerifyPhoneClick = async () => {
        const normalized = form.phone.trim();
        if (!/^(?:\+63|0)9\d{9}$/.test(normalized)) {
            setPhoneOtpError('Please enter a valid Philippine mobile number.');
            return;
        }
        setPhoneOtpError('');
        setPhoneStage('sending');
        try {
            // Persist the (possibly new) number first — PART 18C's
            // /send-phone-otp operates on whatever phone is already stored,
            // not one supplied in this request.
            const saveRes = await axios.put(`${API_BASE_URL}/auth/update-phone`, { phone: normalized }, authHeaders);
            if (!saveRes.data.success) {
                setPhoneOtpError(saveRes.data.message || 'Could not save phone number.');
                setPhoneStage('idle');
                return;
            }
            setPhoneSaved(saveRes.data.phone || normalized);
            setPhoneVerified(false);
            patchUser({ phone: saveRes.data.phone || normalized, phoneVerified: false });

            const otpRes = await axios.post(`${API_BASE_URL}/auth/send-phone-otp`, {}, authHeaders);
            if (!otpRes.data.success) {
                setPhoneOtpError(otpRes.data.message || 'Could not send verification code.');
                setPhoneStage('idle');
                return;
            }
            setPhoneStage('otp');
            setPhoneOtpDigits(Array(OTP_LENGTH).fill(''));
            setPhoneResendTimer(PHONE_RESEND_COOLDOWN);
            setTimeout(() => phoneOtpRefs.current[0]?.focus(), 100);
        } catch (err) {
            setPhoneOtpError(err.response?.data?.message || 'Network error. Please try again.');
            setPhoneStage('idle');
        }
    };

    const handlePhoneOtpDigitChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...phoneOtpDigits];
        next[index] = value.slice(-1);
        setPhoneOtpDigits(next);
        setPhoneOtpError('');
        if (value && index < OTP_LENGTH - 1) phoneOtpRefs.current[index + 1]?.focus();
    };

    const handlePhoneOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !phoneOtpDigits[index] && index > 0) {
            phoneOtpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyPhoneOtp = async () => {
        const otp = phoneOtpDigits.join('');
        if (otp.length !== OTP_LENGTH) {
            setPhoneOtpError(`Enter the full ${OTP_LENGTH}-digit code.`);
            return;
        }
        setPhoneStage('verifying');
        setPhoneOtpError('');
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/verify-phone-otp`, { otp }, authHeaders);
            if (res.data.success) {
                setPhoneVerified(true);
                setPhoneStage('idle');
                patchUser({ phone: phoneSaved, phoneVerified: true });
            } else {
                setPhoneOtpError(res.data.message || 'Invalid verification code.');
                setPhoneStage('otp');
                setPhoneOtpDigits(Array(OTP_LENGTH).fill(''));
                setTimeout(() => phoneOtpRefs.current[0]?.focus(), 50);
            }
        } catch (err) {
            setPhoneOtpError(err.response?.data?.message || 'Invalid verification code.');
            setPhoneStage('otp');
        }
    };

    const handleResendPhoneOtp = async () => {
        if (phoneResendTimer > 0) return;
        setPhoneOtpError('');
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/resend-phone-otp`, {}, authHeaders);
            if (res.data.success) {
                setPhoneResendTimer(PHONE_RESEND_COOLDOWN);
                setPhoneOtpDigits(Array(OTP_LENGTH).fill(''));
                setTimeout(() => phoneOtpRefs.current[0]?.focus(), 100);
            } else {
                setPhoneOtpError(res.data.message || 'Failed to resend code.');
            }
        } catch (err) {
            setPhoneOtpError(err.response?.data?.message || 'Failed to resend code.');
        }
    };

    const passwordsMatch = form.confirmNewPassword.length > 0 && form.newPassword === form.confirmNewPassword;
    const passwordsMismatch = form.confirmNewPassword.length > 0 && form.newPassword !== form.confirmNewPassword;
    const passwordOk = form.newPassword.length >= 6 && form.newPassword === form.confirmNewPassword;

    const phoneBusy = phoneStage === 'sending' || phoneStage === 'verifying';
    const canSave = !!form.firstName.trim() && !!form.lastName.trim() && passwordOk && phoneOk && !saving && !phoneBusy;

    const handleSave = async () => {
        if (!form.firstName.trim() || !form.lastName.trim()) {
            setError('First and last name are required.');
            return;
        }
        if (!phoneOk) {
            setError('Please verify your phone number before continuing.');
            return;
        }
        if (form.newPassword.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (form.newPassword !== form.confirmNewPassword) {
            setError('Passwords do not match.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await axios.put(`${API_BASE_URL}/auth/update-profile`, {
                firstName: form.firstName,
                lastName: form.lastName,
                middleName: form.middleName,
                phone: form.phone,
                address: {
                    street: form.street,
                    city: form.city,
                    province: form.province,
                    zipCode: form.zipCode,
                },
                newPassword: form.newPassword,
                confirmNewPassword: form.confirmNewPassword,
            }, authHeaders);
            if (response.data.success) {
                // Merge the freshly-saved fields (including
                // needsProfileUpdate: false) into context. ProtectedRoute
                // re-renders on this change and the modal disappears — no
                // logout, no page reload.
                patchUser(response.data.user);
            } else {
                setError(response.data.message || 'Failed to update profile.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10050 }}>
            <div className="registration-modal" style={{ maxWidth: 520, padding: 0, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ padding: '20px 26px', background: 'linear-gradient(135deg,#b85c2d,#7d3a06)', borderRadius: '20px 20px 0 0' }}>
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: 'var(--d-font-head)', fontSize: '1.1rem' }}>
                        Complete Your Profile
                    </h4>
                    <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,.85)', fontSize: '.82rem' }}>
                        Please confirm your details and set a new password to continue to your dashboard.
                    </p>
                </div>
                <div style={{ padding: '24px 26px' }}>
                    {error && (
                        <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '.85rem' }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                            <label style={labelStyle}>First Name *</label>
                            <input
                                style={inputStyle}
                                value={form.firstName}
                                onChange={(e) => setField('firstName', e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Last Name *</label>
                            <input
                                style={inputStyle}
                                value={form.lastName}
                                onChange={(e) => setField('lastName', e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Middle Name</label>
                        <input
                            style={inputStyle}
                            value={form.middleName}
                            onChange={(e) => setField('middleName', e.target.value)}
                        />
                    </div>

                    {/* Email — read-only. Verified badge reuses the SAME flag
                        (user.isVerified) already set true by this account's
                        existing first-login email OTP flow; nothing about
                        email verification is created or modified here. */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Email</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input style={{ ...readOnlyInputStyle, flex: 1 }} value={user?.email || ''} disabled readOnly />
                            {user?.isVerified && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#28a745', fontSize: '.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    <FaCheckCircle /> Verified
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Phone — reuses PART 18C's /update-phone, /send-phone-otp,
                        /resend-phone-otp, /verify-phone-otp exactly as-is. */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Phone</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                style={{ ...inputStyle, flex: 1 }}
                                value={form.phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="09XXXXXXXXX"
                            />
                            {form.phone.trim() && phoneIsVerifiedForCurrentValue && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#28a745', fontSize: '.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    <FaCheckCircle /> Verified
                                </span>
                            )}
                            {form.phone.trim() && !phoneIsVerifiedForCurrentValue && phoneStage !== 'otp' && (
                                <button type="button" onClick={handleVerifyPhoneClick} disabled={phoneBusy} style={smallBtnStyle(phoneBusy)}>
                                    {phoneStage === 'sending' ? <FaSpinner className="spin" /> : 'Verify'}
                                </button>
                            )}
                        </div>

                        {phoneStage === 'otp' && (
                            <div style={{ marginTop: 10, padding: 12, background: '#FFF8F3', border: '1.5px solid #E8D6CC', borderRadius: 10 }}>
                                <p style={{ margin: '0 0 8px', fontSize: '.8rem', color: '#7A5C4E' }}>
                                    Enter the {OTP_LENGTH}-digit code sent to {phoneSaved}.
                                </p>
                                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                    {phoneOtpDigits.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={(el) => (phoneOtpRefs.current[i] = el)}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handlePhoneOtpDigitChange(i, e.target.value)}
                                            onKeyDown={(e) => handlePhoneOtpKeyDown(i, e)}
                                            autoComplete="one-time-code"
                                            style={{
                                                width: 36, height: 44,
                                                textAlign: 'center', fontSize: '1.1rem', fontWeight: 700,
                                                fontFamily: 'monospace',
                                                border: `2px solid ${digit ? '#F96B38' : '#E8D6CC'}`,
                                                borderRadius: 8,
                                                outline: 'none',
                                                background: digit ? '#fff' : '#FFF8F3',
                                            }}
                                        />
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={handleVerifyPhoneOtp}
                                        disabled={phoneStage === 'verifying' || phoneOtpDigits.join('').length !== OTP_LENGTH}
                                        style={smallBtnStyle(phoneStage === 'verifying' || phoneOtpDigits.join('').length !== OTP_LENGTH)}
                                    >
                                        {phoneStage === 'verifying' ? <FaSpinner className="spin" /> : 'Verify Code'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResendPhoneOtp}
                                        disabled={phoneResendTimer > 0}
                                        style={{
                                            background: 'none', border: 'none',
                                            color: phoneResendTimer > 0 ? '#aaa' : '#F96B38',
                                            fontWeight: 700, fontSize: '.78rem',
                                            cursor: phoneResendTimer > 0 ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {phoneResendTimer > 0 ? `Resend in ${phoneResendTimer}s` : 'Resend Code'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {phoneOtpError && (
                            <span style={{ color: '#dc3545', fontSize: '.8rem', marginTop: 6, display: 'block' }}>
                                {phoneOtpError}
                            </span>
                        )}
                    </div>

                    {/* Address — reuses the existing User.address sub-schema. */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Street Address</label>
                        <input
                            style={inputStyle}
                            value={form.street}
                            onChange={(e) => setField('street', e.target.value)}
                            placeholder="House/unit no., street"
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                            <label style={labelStyle}>City</label>
                            <input style={inputStyle} value={form.city} onChange={(e) => setField('city', e.target.value)} />
                        </div>
                        <div>
                            <label style={labelStyle}>Province</label>
                            <input style={inputStyle} value={form.province} onChange={(e) => setField('province', e.target.value)} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>Zip Code</label>
                        <input
                            style={{ ...inputStyle, maxWidth: 160 }}
                            value={form.zipCode}
                            onChange={(e) => setField('zipCode', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        />
                    </div>

                    {/* Password replacement — required. Reuses the app's
                        existing "at least 6 characters" rule (same as
                        Forgot Password's reset-password step). */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
                        <div>
                            <label style={labelStyle}>New Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNewPass ? 'text' : 'password'}
                                    style={inputStyle}
                                    value={form.newPassword}
                                    onChange={(e) => setField('newPassword', e.target.value)}
                                    placeholder="At least 6 characters"
                                />
                                <button type="button" style={eyeBtnStyle} onClick={() => setShowNewPass((p) => !p)} tabIndex={-1}>
                                    {showNewPass ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Confirm New Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirmPass ? 'text' : 'password'}
                                    style={inputStyle}
                                    value={form.confirmNewPassword}
                                    onChange={(e) => setField('confirmNewPassword', e.target.value)}
                                    placeholder="Repeat new password"
                                    onKeyDown={(e) => e.key === 'Enter' && canSave && handleSave()}
                                />
                                <button type="button" style={eyeBtnStyle} onClick={() => setShowConfirmPass((p) => !p)} tabIndex={-1}>
                                    {showConfirmPass ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                    </div>
                    {passwordsMismatch && (
                        <span style={{ color: '#dc3545', fontSize: '.8rem', display: 'block', marginBottom: 4 }}>
                            Passwords do not match.
                        </span>
                    )}
                    {passwordsMatch && (
                        <span style={{ color: '#28a745', fontSize: '.8rem', display: 'block', marginBottom: 4 }}>
                            ✓ Passwords match
                        </span>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22, paddingTop: 16, borderTop: '1.5px solid var(--d-border)' }}>
                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            style={{
                                padding: '9px 22px',
                                borderRadius: 10,
                                border: 'none',
                                background: !canSave ? '#ccc' : 'linear-gradient(135deg,#F96B38,#D94E1B)',
                                color: '#fff',
                                cursor: !canSave ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontFamily: 'var(--d-font-body)',
                            }}
                        >
                            {saving ? <FaSpinner className="spin" /> : '✓ Save & Continue'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfileModal;