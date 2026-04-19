import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaShieldAlt, FaEye, FaEyeSlash,
    FaCheckCircle, FaTimesCircle, FaPhone, FaCheck
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
        if (!pw.current.trim())    errs.current = 'Current password is required.';
        if (!pw.newPw.trim())      errs.newPw   = 'New password is required.';
        else if (pw.newPw.length < 8) errs.newPw = 'Password must be at least 8 characters.';
        if (pw.newPw !== pw.confirm)  errs.confirm = 'Passwords do not match.';
        if (pw.newPw === pw.current)  errs.newPw = 'New password must be different from current password.';
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
                setPwSuccess('Password updated successfully!');
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

    const handlePhoneSave = async (e) => {
        e.preventDefault();
        if (phone && !/^[0-9+\s\-()]{7,20}$/.test(phone)) {
            setPhoneErr('Enter a valid phone number.'); return;
        }
        setPhoneLoading(true); setPhoneErr(''); setPhoneSuccess('');
        try {
            const res  = await fetch(`${API_BASE_URL}/auth/update-phone`, {
                method:  'PUT',
                headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
                body:    JSON.stringify({ phone }),
            });
            const data = await res.json();
            if (data.success) {
                // Update local storage
                const stored = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...stored, phone }));
                setPhoneSuccess('Contact number updated!');
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
            tabIndex={-1}>
            {showPw[field] ? <FaEyeSlash /> : <FaEye />}
        </button>
    );

    return (
        <div className="page-wrapper">
            <div className="content-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Back
                    </button>
                    <h2>Account Settings</h2>
                </div>

                {/* ── Update Password ── */}
                <div className="settings-card">
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

                    <form className="settings-form" onSubmit={handlePasswordSave}>
                        <div className="input-group">
                            <label>Current Password</label>
                            <div className="pw-input-wrap">
                                <input
                                    type={showPw.current ? 'text' : 'password'}
                                    placeholder="Enter current password"
                                    value={pw.current}
                                    onChange={e => { setPw(p=>({...p,current:e.target.value})); setPwErrors(p=>({...p,current:''})); }}
                                    className={pwErrors.current ? 'input-error' : ''}
                                />
                                <EyeBtn field="current" />
                            </div>
                            {pwErrors.current && <span className="input-err-msg"><FaTimesCircle /> {pwErrors.current}</span>}
                        </div>

                        <div className="input-group">
                            <label>New Password</label>
                            <div className="pw-input-wrap">
                                <input
                                    type={showPw.newPw ? 'text' : 'password'}
                                    placeholder="Enter new password (min. 8 characters)"
                                    value={pw.newPw}
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

                        <div className="input-group">
                            <label>Confirm New Password</label>
                            <div className="pw-input-wrap">
                                <input
                                    type={showPw.confirm ? 'text' : 'password'}
                                    placeholder="Re-enter new password"
                                    value={pw.confirm}
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
                            <button type="button" className="cancel-btn" onClick={() => { setPw({current:'',newPw:'',confirm:''}); setPwErrors({}); }}>
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

                    <form className="settings-form" onSubmit={handlePhoneSave}>
                        <div className="input-group">
                            <label>Phone / Mobile Number</label>
                            <input
                                type="tel"
                                placeholder="e.g. +63 912 345 6789"
                                value={phone}
                                onChange={e => { setPhone(e.target.value); setPhoneErr(''); }}
                                className={phoneErr ? 'input-error' : ''}
                            />
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