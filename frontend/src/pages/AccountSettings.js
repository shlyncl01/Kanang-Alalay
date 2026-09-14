import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaShieldAlt, FaEye, FaEyeSlash,
    FaCheckCircle, FaTimesCircle, FaPhone, FaCheck, FaLock,
    FaCamera, FaUserCircle, FaSpinner
} from 'react-icons/fa';
import '../styles/AccountSettings.css';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const AccountSettings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // If we arrived here via a normal in-app navigation (e.g. Profile → Edit
    // Settings) there's a history entry to go back to; if this page was
    // opened directly (e.g. refreshed, or deep link), fall back to Profile.
    const goBackOrProfile = () => {
        if (location.key !== 'default') navigate(-1);
        else navigate('/profile');
    };

    // Password form
    const [pw, setPw]       = useState({ current:'', newPw:'', confirm:'' });
    const [showPw, setShowPw] = useState({ current:false, newPw:false, confirm:false });
    const [pwErrors, setPwErrors] = useState({});
    const [pwLoading, setPwLoading] = useState(false);
    const [pwSuccess, setPwSuccess] = useState('');

    // Phone form
    const [phone, setPhone]     = useState(user?.phone || '');
    const [phoneErr, setPhoneErr] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [phoneSuccess, setPhoneSuccess] = useState('');

    const token = () => localStorage.getItem('token');

    // Profile photo (staged until "Save Photo" is clicked)
    const fileInputRef = useRef(null);
    const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoErr, setPhotoErr] = useState('');
    const [photoSuccess, setPhotoSuccess] = useState('');

    const pickPhoto = () => { if (!photoLoading) fileInputRef.current?.click(); };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) { setPhotoErr('Please choose an image file.'); return; }
        if (file.size > 5 * 1024 * 1024) { setPhotoErr('Image must be smaller than 5MB.'); return; }

        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(URL.createObjectURL(file));
        setPhotoFile(file);
        setPhotoErr('');
    };

    const discardPhotoEdit = () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview('');
        setPhotoFile(null);
        setPhotoErr('');
    };

    const handlePhotoSave = async () => {
        if (!photoFile) return;
        setPhotoLoading(true); setPhotoErr(''); setPhotoSuccess('');
        try {
            const body = new FormData();
            body.append('photo', photoFile);
            const res  = await fetch(`${API_BASE_URL}/users/photo`, {
                method:  'PUT',
                headers: { Authorization: `Bearer ${token()}` },
                body,
            });
            const data = await res.json();
            if (data.success) {
                setPhotoUrl(data.photoUrl);
                const stored = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...stored, photoUrl: data.photoUrl }));
                if (photoPreview) URL.revokeObjectURL(photoPreview);
                setPhotoPreview('');
                setPhotoFile(null);
                setPhotoSuccess('Profile photo updated successfully.');
                setTimeout(() => setPhotoSuccess(''), 4000);
            } else {
                setPhotoErr(data.message || 'Failed to upload photo.');
            }
        } catch {
            setPhotoErr('Network error. Please try again.');
        } finally {
            setPhotoLoading(false);
        }
    };

    // Password strength checker
    const getStrength = (p) => {
        if (!p) return null;
        let score = 0;
        if (p.length >= 8)            score++;
        if (/[A-Z]/.test(p))          score++;
        if (/[0-9]/.test(p))          score++;
        if (/[^A-Za-z0-9]/.test(p))   score++;
        if (score <= 1) return { label:'Weak',   color:'#C0392B', width:'25%' };
        if (score === 2) return { label:'Fair',   color:'#E65100', width:'50%' };
        if (score === 3) return { label:'Good',   color:'#F9A825', width:'75%' };
        return               { label:'Strong', color:'#1E7D56', width:'100%' };
    };
    const strength = getStrength(pw.newPw);

    const handlePasswordSave = async (e) => {
        e.preventDefault();
        const errs = {};
        if (!pw.current.trim())        errs.current = 'Current password is required.';
        if (!pw.newPw.trim())          errs.newPw   = 'New password is required.';
        else if (pw.newPw.length < 8)  errs.newPw   = 'Password must be at least 8 characters.';
        else if (pw.newPw.length > 12) errs.newPw   = 'Password must not exceed 12 characters.';
        else if (pw.newPw === pw.current) errs.newPw = 'New password must be different from your current password.';
        if (!pw.confirm.trim())        errs.confirm = 'Please confirm your new password.';
        else if (pw.newPw !== pw.confirm) errs.confirm = 'Passwords do not match.';
        if (Object.keys(errs).length) { setPwErrors(errs); return; }

        setPwLoading(true); setPwErrors({}); setPwSuccess('');
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method:  'PUT',
                headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
                body:    JSON.stringify({ currentPassword: pw.current, newPassword: pw.newPw }),
            });
            const data = await res.json();
            if (data.success) {
                setPwSuccess('Password updated successfully.');
                setPw({ current:'', newPw:'', confirm:'' });
                setTimeout(() => setPwSuccess(''), 4000);
            } else {
                setPwErrors({ current: data.message || 'Current password is incorrect.' });
            }
        } catch {
            setPwErrors({ current: 'Network error. Please try again.' });
        } finally {
            setPwLoading(false);
        }
    };

    // Accepts local (09XXXXXXXXX) and international (+639XXXXXXXX / 639XXXXXXXX)
    // Philippine mobile formats, tolerating spaces/dashes as visual separators.
    const PH_MOBILE_REGEX = /^(?:\+63|0)9\d{9}$/;

    const validatePhone = (value) => {
        const trimmed = value.trim();
        if (!trimmed) return 'Contact number is required.';
        if (/[a-zA-Z]/.test(trimmed)) return 'Please enter a valid Philippine mobile number.';
        const normalized = trimmed.replace(/[\s\-()]/g, '');
        if (!PH_MOBILE_REGEX.test(normalized)) return 'Please enter a valid Philippine mobile number.';
        return '';
    };

    const handlePhoneSave = async (e) => {
        e.preventDefault();
        const err = validatePhone(phone);
        if (err) { setPhoneErr(err); return; }

        setPhoneLoading(true); setPhoneErr(''); setPhoneSuccess('');
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/update-phone`, {
                method:  'PUT',
                headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
                body:    JSON.stringify({ phone: phone.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                // Update local storage
                const stored = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...stored, phone: phone.trim() }));
                setPhoneSuccess('Contact number updated successfully.');
                setTimeout(() => setPhoneSuccess(''), 4000);
            } else {
                setPhoneErr(data.message || 'Failed to update phone.');
            }
        } catch {
            setPhoneErr('Network error. Please try again.');
        } finally {
            setPhoneLoading(false);
        }
    };

    const EyeBtn = ({ field }) => (
        <button type="button" className="pw-eye-btn"
            onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
            tabIndex={-1}
            aria-label={showPw[field] ? 'Hide password' : 'Show password'}>
            {showPw[field] ? <FaEyeSlash /> : <FaEye />}
        </button>
    );

    return (
        <div className="page-wrapper settings-page">
            <div className="content-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate('/profile')}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>Account Settings</h2>
                </div>

                {/* ── Profile Photo ── */}
                <div className="settings-card">
                    <div className="settings-card-header">
                        <FaCamera className="header-icon" />
                        <div>
                            <h3>Profile Photo</h3>
                            <p className="settings-card-sub">Update the photo shown on your staff profile.</p>
                        </div>
                    </div>

                    {photoSuccess && (
                        <div className="settings-success-banner">
                            <FaCheckCircle /> {photoSuccess}
                        </div>
                    )}

                    <div className="settings-photo-row">
                        <div className="settings-avatar-wrap">
                            {(photoPreview || photoUrl) ? (
                                <img src={photoPreview || photoUrl} alt="Your profile" className="settings-avatar-img" />
                            ) : (
                                <FaUserCircle className="settings-avatar-placeholder" />
                            )}
                            <button
                                type="button"
                                className="settings-avatar-upload-btn"
                                onClick={pickPhoto}
                                disabled={photoLoading}
                                title="Change photo"
                            >
                                <FaCamera />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handlePhotoChange}
                            />
                            {photoLoading && <div className="settings-avatar-uploading"><FaSpinner className="spin" /></div>}
                        </div>

                        <div className="settings-photo-actions">
                            {photoErr && <span className="input-err-msg"><FaTimesCircle /> {photoErr}</span>}
                            {photoFile ? (
                                <div className="settings-photo-btn-row">
                                    <button type="button" className="cancel-btn" onClick={discardPhotoEdit} disabled={photoLoading}>
                                        Discard
                                    </button>
                                    <button type="button" className="brand-btn" onClick={handlePhotoSave} disabled={photoLoading}>
                                        {photoLoading ? 'Saving…' : <><FaCheck /> Save Photo</>}
                                    </button>
                                </div>
                            ) : (
                                <button type="button" className="cancel-btn" onClick={pickPhoto}>
                                    <FaCamera /> Choose Photo
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Update Password ── */}
                <div className="settings-card" style={{ marginTop:20 }}>
                    <div className="settings-card-header">
                        <FaShieldAlt className="header-icon" />
                        <div>
                            <h3>Update Password</h3>
                            <p className="settings-card-sub">Choose a strong password to keep your account secure.</p>
                        </div>
                    </div>

                    {pwSuccess && (
                        <div className="settings-success-banner">
                            <FaCheckCircle /> {pwSuccess}
                        </div>
                    )}

                    <form className="settings-form" onSubmit={handlePasswordSave} noValidate>
                        <div className="field-group">
                            <label htmlFor="pw-current">Current Password</label>
                            <div className="pw-input-wrap">
                                <FaLock className="field-leading-icon" />
                                <input
                                    id="pw-current"
                                    type={showPw.current ? 'text' : 'password'}
                                    placeholder="Enter current password"
                                    value={pw.current}
                                    autoComplete="current-password"
                                    onChange={e => { setPw(p=>({...p,current:e.target.value})); setPwErrors(p=>({...p,current:''})); }}
                                    className={pwErrors.current ? 'input-error' : ''}
                                />
                                <EyeBtn field="current" />
                            </div>
                            {pwErrors.current && <span className="input-err-msg"><FaTimesCircle /> {pwErrors.current}</span>}
                        </div>

                        <div className="field-group">
                            <label htmlFor="pw-new">New Password</label>
                            <div className="pw-input-wrap">
                                <FaLock className="field-leading-icon" />
                                <input
                                    id="pw-new"
                                    type={showPw.newPw ? 'text' : 'password'}
                                    placeholder="8-12 characters"
                                    value={pw.newPw}
                                    maxLength={12}
                                    autoComplete="new-password"
                                    onChange={e => { setPw(p=>({...p,newPw:e.target.value})); setPwErrors(p=>({...p,newPw:''})); }}
                                    className={pwErrors.newPw ? 'input-error' : ''}
                                />
                                <EyeBtn field="newPw" />
                            </div>
                            {pw.newPw && strength && (
                                <div className="pw-strength">
                                    <div className="pw-strength-bar">
                                        <div className="pw-strength-fill" style={{ width:strength.width, background:strength.color }} />
                                    </div>
                                    <span style={{ color:strength.color, fontSize:'.78rem', fontWeight:700 }}>{strength.label}</span>
                                </div>
                            )}
                            {pwErrors.newPw && <span className="input-err-msg"><FaTimesCircle /> {pwErrors.newPw}</span>}
                        </div>

                        <div className="field-group">
                            <label htmlFor="pw-confirm">Confirm New Password</label>
                            <div className="pw-input-wrap">
                                <FaLock className="field-leading-icon" />
                                <input
                                    id="pw-confirm"
                                    type={showPw.confirm ? 'text' : 'password'}
                                    placeholder="Re-enter new password"
                                    value={pw.confirm}
                                    autoComplete="new-password"
                                    onChange={e => { setPw(p=>({...p,confirm:e.target.value})); setPwErrors(p=>({...p,confirm:''})); }}
                                    className={pwErrors.confirm ? 'input-error' : ''}
                                />
                                <EyeBtn field="confirm" />
                            </div>
                            {pw.confirm && pw.newPw && pw.confirm === pw.newPw && (
                                <span className="input-match-msg"><FaCheckCircle /> Passwords match</span>
                            )}
                            {pwErrors.confirm && <span className="input-err-msg"><FaTimesCircle /> {pwErrors.confirm}</span>}
                        </div>

                        <div className="form-actions">
                            <button type="button" className="cancel-btn" onClick={() => { setPw({current:'',newPw:'',confirm:''}); setPwErrors({}); setPwSuccess(''); goBackOrProfile(); }}>
                                Cancel
                            </button>
                            <button type="submit" className="brand-btn" disabled={pwLoading}>
                                {pwLoading ? 'Saving…' : <><FaCheck /> Save Changes</>}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Update Contact Number ── */}
                <div className="settings-card" style={{ marginTop:20 }}>
                    <div className="settings-card-header">
                        <FaPhone className="header-icon" />
                        <div>
                            <h3>Contact Number</h3>
                            <p className="settings-card-sub">Update your contact number for emergency purposes.</p>
                        </div>
                    </div>

                    {phoneSuccess && (
                        <div className="settings-success-banner">
                            <FaCheckCircle /> {phoneSuccess}
                        </div>
                    )}

                    <form className="settings-form" onSubmit={handlePhoneSave} noValidate>
                        <div className="field-group">
                            <label htmlFor="phone-field">Phone / Mobile Number</label>
                            <div className="pw-input-wrap">
                                <FaPhone className="field-leading-icon" />
                                <input
                                    id="phone-field"
                                    type="tel"
                                    placeholder="e.g. 0912 345 6789"
                                    value={phone}
                                    maxLength={16}
                                    autoComplete="tel"
                                    onChange={e => { setPhone(e.target.value); setPhoneErr(''); }}
                                    className={phoneErr ? 'input-error' : ''}
                                />
                            </div>
                            {phoneErr && <span className="input-err-msg"><FaTimesCircle /> {phoneErr}</span>}
                        </div>
                        <div className="form-actions">
                            <button type="button" className="cancel-btn" onClick={() => { setPhone(user?.phone||''); setPhoneErr(''); }}>
                                Reset
                            </button>
                            <button type="submit" className="brand-btn" disabled={phoneLoading}>
                                {phoneLoading ? 'Saving…' : <><FaCheck /> Update Number</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AccountSettings;