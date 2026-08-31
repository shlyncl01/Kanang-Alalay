/**
 * AddStaffModal.js
 *
 * Drop-in replacement for the AddStaffModal inside UserManagementTab.js.
 *
 * HOW TO USE
 * ──────────
 * 1. Copy this entire file's contents.
 * 2. In UserManagementTab.js, delete the old AddStaffModal component
 *    (lines ~140-255) and paste this in its place.
 * 3. The API call is updated to hit  POST /admin/create-user-enhanced
 *    which auto-generates username & password and emails the new staff member.
 *    Make sure your adminRoutes.js exposes that endpoint (it already does).
 *
 * FLOW
 * ────
 * Step 1 – Pick a role  (Admin / Head Caregiver / Caregiver)
 * Step 2 – Basic info   (first name, last name, email, phone, shift)
 *           Real-time field-level validation, no submit needed.
 * Step 3 – Confirm      (review card before sending)
 * → POST /admin/create-user-enhanced
 * → Backend auto-generates username + temp password, emails the new user.
 * → New user logs in → OTP → Profile-completion modal → Dashboard.
 */

import React, { useState, useCallback } from 'react';
import {
    FaUserPlus, FaTimes, FaUserShield, FaUserTie, FaUser,
    FaCheckCircle, FaEnvelope, FaSpinner,
} from 'react-icons/fa';
import { API_URL } from '../../config/api';

// ─── constants ───────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
    {
        key: 'admin',
        label: 'Admin',
        desc: 'Full system access — manage users, bookings, inventory and reports.',
        icon: <FaUserShield size={28} />,
        color: '#dc3545',
        lightBg: '#fff0f0',
        border: '#f5c6cb',
    },
    {
        key: 'head_caregiver',
        label: 'Head Caregiver',
        desc: 'Leads caregiver teams, approves tasks and monitors resident care.',
        icon: <FaUserTie size={28} />,
        color: '#b85c2d',
        lightBg: '#fff8f3',
        border: '#E8D6CC',
    },
    {
        key: 'caregiver',
        label: 'Caregiver',
        desc: 'Provides daily care, logs vitals and assists residents.',
        icon: <FaUser size={28} />,
        color: '#28a745',
        lightBg: '#eefbf5',
        border: '#b7e4cc',
    },
];

const SHIFTS = [
    { key: 'DAY',      label: 'Day Shift',   time: '7:00 AM – 7:00 PM' },
    { key: 'NIGHT',    label: 'Night Shift', time: '7:00 PM – 7:00 AM' },
    { key: 'FLEXIBLE', label: 'Flexible',    time: 'Variable hours' },
];

// ─── shift filtering (role-based) ─────────────────────────────────────────────

const getAvailableShifts = (roleKey) => {
    if (roleKey === 'admin') {
        return SHIFTS.filter(s => s.key === 'FLEXIBLE');
    }
    // head_caregiver and caregiver can choose Day or Night
    return SHIFTS.filter(s => s.key !== 'FLEXIBLE');
};

// ─── validation helpers ───────────────────────────────────────────────────────

const validate = (field, value, existingPhones = []) => {
    switch (field) {
        case 'firstName':
        case 'lastName': {
            const trimmed = value.trim();
            if (!trimmed) return `${field === 'firstName' ? 'First' : 'Last'} name is required.`;
            if (trimmed.length < 2) return 'Minimum 2 characters.';
            if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ\s'-]+$/.test(trimmed)) return 'Letters only.';
            return '';
        }
        case 'email': {
            if (!value.trim()) return 'Email is required.';
            // Real-time: show error as soon as format is clearly wrong
            if (value.length > 3 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                return 'Enter a valid email address (e.g. juan@gmail.com).';
            return '';
        }
        case 'phone': {
            if (!value) return ''; // optional
            if (!/^09\d{9}$/.test(value))
                return 'Must start with 09 and be exactly 11 digits.';
            if (existingPhones.includes(value))
                return 'This phone number is already in use.';
            return '';
        }
        default:
            return '';
    }
};

// ─── shared style helpers ─────────────────────────────────────────────────────

const inp = (hasError) => ({
    width: '100%',
    padding: '10px 14px',
    border: `1.5px solid ${hasError ? '#dc3545' : '#E8D6CC'}`,
    borderRadius: 10,
    fontSize: '.9rem',
    background: hasError ? '#fff5f5' : '#FFF8F3',
    color: '#1A0A00',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    transition: 'border-color .2s, background .2s',
});

const lbl = {
    display: 'block',
    fontSize: '.76rem',
    fontWeight: 700,
    color: '#5a3e2b',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    marginBottom: 5,
};

const errMsg = { color: '#dc3545', fontSize: '.75rem', marginTop: 4, display: 'block' };

// ─── AddStaffModal ────────────────────────────────────────────────────────────

const AddStaffModal = ({ onClose, onAdded, existingPhones = [] }) => {
    const [step, setStep]     = useState(1);   // 1 | 2 | 3 | 4(success)
    const [role, setRole]     = useState('');
    const [form, setForm]     = useState({ firstName: '', lastName: '', email: '', phone: '', shift: 'DAY' });
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [saving, setSaving] = useState(false);
    const [apiErr, setApiErr] = useState('');
    const [created, setCreated] = useState(null);

    // ── auto-set shift based on role ──────────────────────────────────────────

    React.useEffect(() => {
        if (role === 'admin') {
            setForm(p => ({ ...p, shift: 'FLEXIBLE' }));
        } else {
            setForm(p => ({ ...p, shift: 'DAY' }));
        }
    }, [role]);

    // ── real-time validation ──────────────────────────────────────────────────

    const handleChange = useCallback((field, raw) => {
        let value = raw;
        // phone: digits only, max 11
        if (field === 'phone') value = raw.replace(/\D/g, '').slice(0, 11);
        setForm(prev => ({ ...prev, [field]: value }));
        if (touched[field]) {
            setErrors(prev => ({ ...prev, [field]: validate(field, value, existingPhones) }));
        }
    }, [touched, existingPhones]);

    const handleBlur = useCallback((field) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        setErrors(prev => ({ ...prev, [field]: validate(field, form[field], existingPhones) }));
    }, [form, existingPhones]);

    // ── step 2 → step 3 gate ─────────────────────────────────────────────────

    const handleProceedToReview = () => {
        const fields = ['firstName', 'lastName', 'email', 'phone'];
        const newErrors = {};
        fields.forEach(f => { newErrors[f] = validate(f, form[f], existingPhones); });
        setErrors(newErrors);
        setTouched({ firstName: true, lastName: true, email: true, phone: true });
        const hasError = Object.values(newErrors).some(Boolean);
        if (!hasError) setStep(3);
    };

    // ── submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        setSaving(true);
        setApiErr('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/create-user-enhanced`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    firstName: form.firstName.trim(),
                    lastName:  form.lastName.trim(),
                    email:     form.email.trim().toLowerCase(),
                    phone:     form.phone.trim(),
                    shift:     form.shift,
                    role,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create account.');
            setCreated(data);
            onAdded && onAdded(data);
            setStep(4);
        } catch (e) {
            setApiErr(e.message);
            setStep(3); // stay on review so admin can see the error
        } finally {
            setSaving(false);
        }
    };

    // ── derived ───────────────────────────────────────────────────────────────

    const selectedRole = ROLE_OPTIONS.find(r => r.key === role);

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <div
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,.55)',
                zIndex: 10002,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: step === 1 ? 560 : 500,
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 28px 72px rgba(0,0,0,.28)',
                    animation: 'modalIn .22s ease',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── header ── */}
                <div style={{
                    padding: '20px 26px',
                    background: 'linear-gradient(135deg,#b85c2d,#7d3a06)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    flexShrink: 0,
                }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: 'rgba(255,255,255,.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FaUserPlus style={{ color: '#fff', fontSize: '1rem' }} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display',serif", fontSize: '1.1rem' }}>
                            Add New Staff
                        </h4>
                        <p style={{ margin: 0, color: 'rgba(255,255,255,.75)', fontSize: '.72rem' }}>
                            {step === 1 && 'Step 1 of 3 — Choose a role'}
                            {step === 2 && 'Step 2 of 3 — Basic information'}
                            {step === 3 && 'Step 3 of 3 — Review & confirm'}
                            {step === 4 && 'Account created successfully'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            marginLeft: 'auto',
                            background: 'rgba(255,255,255,.15)',
                            border: '2px solid rgba(255,255,255,.2)',
                            color: '#fff', width: 32, height: 32, borderRadius: '50%',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    ><FaTimes /></button>
                </div>

                {/* ── step progress bar ── */}
                {step < 4 && (
                    <div style={{ display: 'flex', height: 4, background: '#f0e8e0', flexShrink: 0 }}>
                        <div style={{
                            height: '100%',
                            width: `${(step / 3) * 100}%`,
                            background: 'linear-gradient(90deg,#b85c2d,#F96B38)',
                            transition: 'width .3s ease',
                            borderRadius: '0 2px 2px 0',
                        }} />
                    </div>
                )}

                {/* ── body ── */}
                <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1 }}>

                    {/* ══ STEP 1: Role selection ══ */}
                    {step === 1 && (
                        <div>
                            <p style={{ margin: '0 0 18px', fontSize: '.88rem', color: '#7A5C4E' }}>
                                Select the account type for this new staff member. This determines their dashboard access and permissions.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {ROLE_OPTIONS.map(r => (
                                    <button
                                        key={r.key}
                                        onClick={() => { setRole(r.key); setStep(2); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 16,
                                            padding: '16px 20px',
                                            border: `2px solid ${r.border}`,
                                            borderRadius: 14,
                                            background: r.lightBg,
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'transform .15s, box-shadow .15s, border-color .15s',
                                            fontFamily: "'DM Sans',sans-serif",
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = 'translateX(4px)';
                                            e.currentTarget.style.boxShadow = `0 4px 16px ${r.color}22`;
                                            e.currentTarget.style.borderColor = r.color;
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = 'translateX(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.borderColor = r.border;
                                        }}
                                    >
                                        <div style={{
                                            width: 52, height: 52, borderRadius: 14,
                                            background: r.color, color: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {r.icon}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#1A0A00', marginBottom: 3 }}>
                                                {r.label}
                                            </div>
                                            <div style={{ fontSize: '.8rem', color: '#7A5C4E', lineHeight: 1.4 }}>
                                                {r.desc}
                                            </div>
                                        </div>
                                        <span style={{ color: r.color, fontSize: '1.2rem', flexShrink: 0 }}>›</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 2: Basic info ══ */}
                    {step === 2 && (
                        <div>
                            {/* Role badge */}
                            {selectedRole && (
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    background: selectedRole.lightBg,
                                    border: `1.5px solid ${selectedRole.border}`,
                                    borderRadius: 20, padding: '5px 14px',
                                    fontSize: '.8rem', fontWeight: 700,
                                    color: selectedRole.color,
                                    marginBottom: 18,
                                }}>
                                    {selectedRole.icon && React.cloneElement(selectedRole.icon, { size: 13 })}
                                    {selectedRole.label}
                                </div>
                            )}

                            {/* Name row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                                <div>
                                    <label style={lbl}>First Name *</label>
                                    <input
                                        style={inp(!!errors.firstName && touched.firstName)}
                                        value={form.firstName}
                                        onChange={e => handleChange('firstName', e.target.value)}
                                        onBlur={() => handleBlur('firstName')}
                                        placeholder="Juan"
                                        autoFocus
                                    />
                                    {errors.firstName && touched.firstName && <span style={errMsg}>{errors.firstName}</span>}
                                </div>
                                <div>
                                    <label style={lbl}>Last Name *</label>
                                    <input
                                        style={inp(!!errors.lastName && touched.lastName)}
                                        value={form.lastName}
                                        onChange={e => handleChange('lastName', e.target.value)}
                                        onBlur={() => handleBlur('lastName')}
                                        placeholder="Dela Cruz"
                                    />
                                    {errors.lastName && touched.lastName && <span style={errMsg}>{errors.lastName}</span>}
                                </div>
                            </div>

                            {/* Email */}
                            <div style={{ marginBottom: 14 }}>
                                <label style={lbl}>Email Address *</label>
                                <input
                                    type="email"
                                    style={inp(!!errors.email && touched.email)}
                                    value={form.email}
                                    onChange={e => handleChange('email', e.target.value)}
                                    onBlur={() => handleBlur('email')}
                                    placeholder="juan.delacruz@email.com"
                                />
                                {errors.email && touched.email
                                    ? <span style={errMsg}>{errors.email}</span>
                                    : <span style={{ fontSize: '.73rem', color: '#A38070', marginTop: 4, display: 'block' }}>
                                        Login credentials will be sent to this email.
                                    </span>
                                }
                            </div>

                            {/* Phone */}
                            <div style={{ marginBottom: 14 }}>
                                <label style={lbl}>Phone Number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                                <input
                                    style={inp(!!errors.phone && touched.phone)}
                                    value={form.phone}
                                    onChange={e => handleChange('phone', e.target.value)}
                                    onBlur={() => handleBlur('phone')}
                                    placeholder="09XXXXXXXXX"
                                    inputMode="numeric"
                                />
                                {errors.phone && touched.phone
                                    ? <span style={errMsg}>{errors.phone}</span>
                                    : <span style={{ fontSize: '.73rem', color: '#A38070', marginTop: 4, display: 'block' }}>
                                        11 digits, must start with 09.
                                    </span>
                                }
                            </div>

                            {/* Shift */}
                            <div style={{ marginBottom: 6 }}>
                                <label style={lbl}>Assigned Shift</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {getAvailableShifts(role).map(s => (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => setForm(p => ({ ...p, shift: s.key }))}
                                            disabled={role === 'admin'} // Admins can't change shift
                                            style={{
                                                padding: '9px 12px',
                                                borderRadius: 10,
                                                border: `1.5px solid ${form.shift === s.key ? '#b85c2d' : '#E8D6CC'}`,
                                                background: form.shift === s.key ? '#fff8f3' : '#FFF8F3',
                                                cursor: role === 'admin' ? 'not-allowed' : 'pointer',
                                                textAlign: 'left',
                                                fontFamily: "'DM Sans',sans-serif",
                                                transition: 'border-color .15s, background .15s',
                                                opacity: role === 'admin' ? 0.7 : 1,
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '.82rem', color: form.shift === s.key ? '#b85c2d' : '#1A0A00' }}>
                                                {s.label}
                                            </div>
                                            <div style={{ fontSize: '.72rem', color: '#7A5C4E' }}>{s.time}</div>
                                        </button>
                                    ))}
                                </div>
                                {role === 'admin' && (
                                    <div style={{ fontSize: '.75rem', color: '#28a745', marginTop: 8, fontStyle: 'italic' }}>
                                        Admin accounts are automatically assigned Flexible schedules.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 3: Review ══ */}
                    {step === 3 && (
                        <div>
                            {apiErr && (
                                <div style={{
                                    background: '#f8d7da', color: '#721c24',
                                    padding: '10px 14px', borderRadius: 8,
                                    marginBottom: 16, fontSize: '.85rem',
                                    display: 'flex', gap: 8, alignItems: 'center',
                                }}>
                                    {apiErr}
                                </div>
                            )}

                            <p style={{ margin: '0 0 16px', fontSize: '.87rem', color: '#7A5C4E' }}>
                                Review the details below. Once confirmed, the system will automatically generate a username and temporary password and send them to the staff member's email.
                            </p>

                            {/* Summary card */}
                            <div style={{
                                border: '1.5px solid #E8D6CC', borderRadius: 14,
                                overflow: 'hidden', marginBottom: 16,
                            }}>
                                {[
                                    { label: 'Full Name',  value: `${form.firstName} ${form.lastName}` },
                                    { label: 'Role',       value: selectedRole?.label || role },
                                    { label: 'Email',      value: form.email },
                                    { label: 'Phone',      value: form.phone || '—' },
                                    { label: 'Shift',      value: SHIFTS.find(s => s.key === form.shift)?.label + ' (' + SHIFTS.find(s => s.key === form.shift)?.time + ')' },
                                ].map((row, i) => (
                                    <div key={row.label} style={{
                                        display: 'flex', gap: 12,
                                        padding: '11px 16px',
                                        borderBottom: i < 4 ? '1px solid #E8D6CC' : 'none',
                                        background: i % 2 === 0 ? '#FFF8F3' : '#fff',
                                    }}>
                                        <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 80 }}>{row.label}</span>
                                        <span style={{ fontSize: '.88rem', color: '#1A0A00', fontWeight: 500 }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Email notice */}
                            <div style={{
                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                background: '#e8f4fd', border: '1.5px solid #bee0f7',
                                borderRadius: 10, padding: '12px 14px', fontSize: '.82rem', color: '#1565C0',
                            }}>
                                <FaEnvelope style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>
                                    A welcome email with login credentials will be sent to <strong>{form.email}</strong>.
                                    The new staff member must log in, verify via OTP, and complete their profile before accessing the dashboard.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 4: Success ══ */}
                    {step === 4 && (
                        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                            <div style={{
                                width: 72, height: 72, borderRadius: '50%',
                                background: '#eefbf5', border: '3px solid #b7e4cc',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 18px',
                                animation: 'popIn .35s cubic-bezier(.34,1.56,.64,1)',
                            }}>
                                <FaCheckCircle size={32} color="#28a745" />
                            </div>
                            <h3 style={{ margin: '0 0 8px', fontFamily: "'Playfair Display',serif", color: '#1A0A00' }}>
                                Account Created!
                            </h3>
                            <p style={{ margin: '0 0 20px', color: '#7A5C4E', fontSize: '.88rem', lineHeight: 1.55 }}>
                                The account for <strong>{form.firstName} {form.lastName}</strong> has been created as <strong>{selectedRole?.label}</strong>.<br />
                                Login credentials have been emailed to <strong>{form.email}</strong>.
                            </p>
                            <div style={{
                                background: '#FFF8F3', border: '1.5px solid #E8D6CC',
                                borderRadius: 10, padding: '12px 16px',
                                fontSize: '.82rem', color: '#7A5C4E', marginBottom: 4,
                            }}>
                                The new staff member will be prompted to verify their email via OTP and complete their profile on first login.
                            </div>
                        </div>
                    )}
                </div>

                {/* ── footer ── */}
                <div style={{
                    padding: '14px 26px 20px',
                    borderTop: '1.5px solid #E8D6CC',
                    display: 'flex', gap: 10,
                    justifyContent: step === 1 ? 'flex-end' : 'space-between',
                    flexShrink: 0,
                }}>
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans',sans-serif" }}
                        >
                            ← Back
                        </button>
                    )}
                    {step === 3 && (
                        <button
                            onClick={() => { setApiErr(''); setStep(2); }}
                            style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans',sans-serif" }}
                        >
                            ← Back
                        </button>
                    )}

                    {step === 1 && (
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans',sans-serif" }}>
                            Cancel
                        </button>
                    )}

                    {step === 2 && (
                        <button
                            onClick={handleProceedToReview}
                            style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#b85c2d,#7d3a06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}
                        >
                            Review →
                        </button>
                    )}

                    {step === 3 && (
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            style={{
                                padding: '9px 24px', borderRadius: 10, border: 'none',
                                background: saving ? '#ccc' : 'linear-gradient(135deg,#b85c2d,#7d3a06)',
                                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                                fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}
                        >
                            {saving
                                ? <><FaSpinner style={{ animation: 'spin .7s linear infinite' }} /> Creating…</>
                                : <><FaEnvelope size={13} /> Confirm & Send Email</>
                            }
                        </button>
                    )}

                    {step === 4 && (
                        <button
                            onClick={onClose}
                            style={{ padding: '9px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#28a745,#1e7d40)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans',sans-serif", width: '100%' }}
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>

            {/* keyframe animations — inject once */}
            <style>{`
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(.95) translateY(10px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes popIn {
                    from { transform: scale(0); }
                    to   { transform: scale(1); }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default AddStaffModal;