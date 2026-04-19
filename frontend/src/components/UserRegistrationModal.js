import React, { useState, useEffect } from 'react';
import { FaEye, FaEyeSlash, FaTimes, FaUserPlus, FaUserMd, FaUserTag, FaIdCard, FaCheckCircle } from 'react-icons/fa';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const ROLES = [
    { value: 'nurse',     label: 'Nurse',     icon: <FaUserMd />,   color: '#28a745', desc: 'Nursing & medical care' },
    { value: 'caregiver', label: 'Caregiver', icon: <FaUserPlus />, color: '#ffc107', desc: 'Resident caregiver' },
    { value: 'admin',     label: 'Admin',     icon: <FaUserTag />,  color: '#b85c2d', desc: 'Full system access' },
];

const FLOOR_WARDS  = ['1st Floor', '2nd Floor', '3rd Floor', '4th Floor'];

function getRoleConfig(role) {
    switch (role) {
        case 'nurse':     return { department: 'Nursing',        deptLocked: true,  wardOptions: FLOOR_WARDS,  wardLabel: 'Floor / Ward',    wardRequired: true  };
        case 'caregiver': return { department: 'Caregiving',     deptLocked: true,  wardOptions: FLOOR_WARDS,  wardLabel: 'Floor / Ward',    wardRequired: true  };
        case 'admin':     return { department: 'Administration', deptLocked: true,  wardOptions: [],           wardLabel: '',                wardRequired: false };
        default:          return { department: '',               deptLocked: false, wardOptions: [],           wardLabel: '',                wardRequired: false };
    }
}

const STEP_ROLE = 1;
const STEP_INFO = 2;
const STEP_DONE = 3;

const UserRegistrationModal = ({ isOpen, onClose, onRegister }) => {
    const [step, setStep]           = useState(STEP_ROLE);
    const [loading, setLoading]     = useState(false);
    const [apiError, setApiError]   = useState('');
    const [createdId, setCreatedId] = useState('');
    const [form, setForm]           = useState({ role: 'nurse', firstName: '', middleName: '', lastName: '', email: '', phone: '', username: '', password: '', confirmPassword: '', ward: '', department: '', activateImmediately: true });
    const [errors, setErrors]       = useState({});
    const [showPwd, setShowPwd]     = useState(false);
    const [showCPwd, setShowCPwd]   = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep(STEP_ROLE);
            setForm({ role: 'nurse', firstName: '', middleName: '', lastName: '', email: '', phone: '', username: '', password: '', confirmPassword: '', ward: '', department: '', activateImmediately: true });
            setErrors({}); setApiError(''); setCreatedId('');
            setShowPwd(false); setShowCPwd(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); setApiError(''); };

    const roleObj = ROLES.find(r => r.value === form.role) || ROLES[0];
    const roleCfg = getRoleConfig(form.role);
    const idPreview = form.role ? `${form.role === 'caregiver' ? 'CG' : form.role.toUpperCase()}-XXXX` : '—';

    const selectRole = (role) => {
        const cfg = getRoleConfig(role);
        setForm(p => ({ ...p, role, department: cfg.department, ward: '' }));
        setErrors({}); setApiError('');
    };


    const validate = () => {
        const e = {};
        if (!form.firstName.trim()) e.firstName = 'Required';
        if (!form.lastName.trim())  e.lastName  = 'Required';
        if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Valid email required';
        if (!form.password || form.password.length < 8) e.password = 'Minimum 8 characters';
        if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
        if (roleCfg.wardRequired && !form.ward) e.ward = `Please select a ${roleCfg.wardLabel.toLowerCase()}`;
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        setApiError('');
        if (!validate()) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/admin/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                body: JSON.stringify({
                    firstName: form.firstName.trim(), middleName: form.middleName.trim(), lastName: form.lastName.trim(),
                    email: form.email.trim().toLowerCase(), phone: form.phone.trim(),
                    username: form.username.trim() || form.email.split('@')[0],
                    password: form.password, role: form.role, ward: form.ward,
                    department: form.department, activateImmediately: form.activateImmediately,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Registration failed');
            setCreatedId(data.staffId || '');
            setStep(STEP_DONE);
            onRegister && onRegister(data);
        } catch (err) {
            setApiError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Shared styles
    const inp = (hasErr) => ({
        width: '100%', padding: '10px 14px',
        border: `1.5px solid ${hasErr ? '#dc3545' : '#E8D6CC'}`,
        borderRadius: 10, fontSize: '.9rem',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: hasErr ? '#fff8f8' : '#FFF8F3',
        color: '#1A0A00', outline: 'none', boxSizing: 'border-box',
        transition: 'border-color .2s',
    });
    const lbl = (optional) => ({
        display: 'block', marginBottom: 5, fontWeight: 600,
        color: optional ? '#9aada8' : '#2c3e50',
        fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.05em',
    });
    const errTxt = { color: '#dc3545', fontSize: '.75rem', marginTop: 3, display: 'block' };
    const row2   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 };
    const btnBase = { fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600, cursor: 'pointer', borderRadius: 10, padding: '10px 20px', fontSize: '.9rem', border: '1.5px solid #E8D6CC', background: 'transparent', color: '#7A5C4E' };

    // CLOSE BUTTON — inline styles so it always looks right regardless of CSS file
    const CloseBtn = () => (
        <button
            onClick={onClose}
            type="button"
            style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,.18)',
                border: '2px solid rgba(255,255,255,.28)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.95rem', transition: 'all .2s', flexShrink: 0,
                lineHeight: 1, padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.35)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.18)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
        >
            <FaTimes />
        </button>
    );

    // STEP 1 — Choose Role
    const renderStepRole = () => (
        <div style={{ padding: '24px 28px' }}>
            <p style={{ color: '#7A5C4E', fontSize: '.88rem', marginBottom: 20 }}>
                Select the role for the new user. Ward and department will be assigned automatically.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
                {ROLES.map(r => {
                    const sel = form.role === r.value;
                    return (
                        <div
                            key={r.value}
                            onClick={() => selectRole(r.value)}
                            style={{
                                padding: '16px 14px', borderRadius: 14, cursor: 'pointer',
                                border: `2px solid ${sel ? r.color : '#E8D6CC'}`,
                                background: sel ? `${r.color}12` : '#FFF8F3',
                                transition: 'all .18s',
                                display: 'flex', flexDirection: 'column', gap: 5,
                            }}
                        >
                            <div style={{ color: r.color, fontSize: '1.3rem' }}>{r.icon}</div>
                            <strong style={{ color: '#1A0A00', fontSize: '.95rem' }}>{r.label}</strong>
                            <small style={{ color: '#7A5C4E', fontSize: '.76rem' }}>{r.desc}</small>
                            <small style={{ color: r.color, fontSize: '.72rem', fontWeight: 700, fontFamily: 'monospace', marginTop: 2 }}>
                                ID: {r.value === 'caregiver' ? 'CG' : r.label.toUpperCase()}-XXXX
                            </small>
                        </div>
                    );
                })}
            </div>
            {!form.role && <p style={{ color: '#dc3545', fontSize: '.82rem', marginBottom: 10 }}>Please select a role to continue.</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1.5px solid #E8D6CC' }}>
                <button onClick={onClose} style={btnBase}>Cancel</button>
                <button
                    onClick={() => form.role && setStep(STEP_INFO)}
                    disabled={!form.role}
                    style={{ ...btnBase, border: 'none', background: form.role ? 'linear-gradient(135deg,#F96B38,#D94E1B)' : '#ddd', color: form.role ? '#fff' : '#aaa', cursor: form.role ? 'pointer' : 'not-allowed', fontWeight: 700, boxShadow: form.role ? '0 3px 12px rgba(249,107,56,.3)' : 'none' }}
                >
                    Next: Enter Details →
                </button>
            </div>
        </div>
    );

    // STEP 2 — Info Form
    const renderStepInfo = () => (
        <div style={{ padding: '22px 28px' }}>
            {apiError && (
                <div style={{ background: '#f8d7da', color: '#721c24', padding: '11px 15px', borderRadius: 9, marginBottom: 14, borderLeft: '4px solid #dc3545', fontSize: '.86rem' }}>
                    ⚠️ {apiError}
                </div>
            )}

            {/* Staff ID preview */}
            <div style={{ background: '#FFF8F3', border: '1.5px dashed #E8D6CC', borderRadius: 10, padding: '9px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'monospace', color: roleObj.color, fontWeight: 700, fontSize: '1rem' }}>{idPreview}</span>
                <small style={{ color: '#7A5C4E', fontSize: '.76rem' }}>Staff ID will be auto-generated on save</small>
            </div>

            {/* Name — 3 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                    <label style={lbl(false)}>First Name *</label>
                    <input style={inp(errors.firstName)} value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="First" />
                    {errors.firstName && <span style={errTxt}>{errors.firstName}</span>}
                </div>
                <div>
                    <label style={lbl(true)}>Middle Name</label>
                    <input style={inp(false)} value={form.middleName} onChange={e => set('middleName', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                    <label style={lbl(false)}>Last Name *</label>
                    <input style={inp(errors.lastName)} value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Last" />
                    {errors.lastName && <span style={errTxt}>{errors.lastName}</span>}
                </div>
            </div>

            {/* Email + Phone */}
            <div style={row2}>
                <div>
                    <label style={lbl(false)}>Email *</label>
                    <input type="email" style={inp(errors.email)} value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
                    {errors.email && <span style={errTxt}>{errors.email}</span>}
                </div>
                <div>
                    <label style={lbl(true)}>Phone</label>
                    <input style={inp(false)} value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09XXXXXXXXX" />
                </div>
            </div>

            {/* Username */}
            <div style={{ marginBottom: 14 }}>
                <label style={lbl(true)}>Username (auto from email if blank)</label>
                <input style={inp(false)} value={form.username} onChange={e => set('username', e.target.value)} placeholder="Leave blank to auto-generate" />
            </div>

            {/* Ward / Department — smart */}
            {form.role === 'admin' ? (
                <div style={{ background: '#FFF8F3', border: '1.5px solid #E8D6CC', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                    <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>
                        🔒 Admin accounts have access to all areas — no ward/department assignment needed.
                    </small>
                </div>
            ) : (
                <div style={{ marginBottom: 14 }}>
                    {/* Department */}
                    <div style={{ marginBottom: 12 }}>
                        <label style={lbl(false)}>Department</label>
                        <input
                            style={{ ...inp(false), background: roleCfg.deptLocked ? '#f0ebe6' : '#FFF8F3', color: roleCfg.deptLocked ? '#7A5C4E' : '#1A0A00', cursor: roleCfg.deptLocked ? 'not-allowed' : 'text' }}
                            value={form.department}
                            readOnly={roleCfg.deptLocked}
                            onChange={e => !roleCfg.deptLocked && set('department', e.target.value)}
                        />
                        {roleCfg.deptLocked && <small style={{ color: '#7A5C4E', fontSize: '.73rem', marginTop: 3, display: 'block', fontStyle: 'italic' }}>Auto-set based on role</small>}
                    </div>

                    {/* Ward / Area */}
                    {roleCfg.wardOptions.length > 0 && (
                        <div>
                            <label style={lbl(false)}>{roleCfg.wardLabel} *</label>

                            {/* Nurse / Caregiver → floor pill buttons */}
                            {(form.role === 'nurse' || form.role === 'caregiver') && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                    {FLOOR_WARDS.map(floor => {
                                        const sel = form.ward === floor;
                                        return (
                                            <button
                                                key={floor}
                                                type="button"
                                                onClick={() => set('ward', floor)}
                                                style={{
                                                    padding: '8px 18px', borderRadius: 22,
                                                    border: `2px solid ${sel ? roleObj.color : '#E8D6CC'}`,
                                                    background: sel ? `${roleObj.color}15` : '#FFF8F3',
                                                    color: sel ? roleObj.color : '#7A5C4E',
                                                    fontWeight: sel ? 700 : 400, cursor: 'pointer',
                                                    fontSize: '.85rem', fontFamily: "'DM Sans', sans-serif",
                                                    transition: 'all .15s',
                                                }}
                                            >
                                                {floor}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}


                            {errors.ward && <span style={errTxt}>{errors.ward}</span>}
                        </div>
                    )}
                </div>
            )}

            {/* Password row */}
            <div style={row2}>
                <div>
                    <label style={lbl(false)}>Password *</label>
                    <div style={{ position: 'relative' }}>
                        <input type={showPwd ? 'text' : 'password'} style={{ ...inp(errors.password), paddingRight: 40 }} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" />
                        <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E', display: 'flex', alignItems: 'center' }}>
                            {showPwd ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    {errors.password && <span style={errTxt}>{errors.password}</span>}
                </div>
                <div>
                    <label style={lbl(false)}>Confirm Password *</label>
                    <div style={{ position: 'relative' }}>
                        <input type={showCPwd ? 'text' : 'password'} style={{ ...inp(errors.confirmPassword), paddingRight: 40 }} value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repeat password" />
                        <button type="button" onClick={() => setShowCPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E', display: 'flex', alignItems: 'center' }}>
                            {showCPwd ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    {errors.confirmPassword && <span style={errTxt}>{errors.confirmPassword}</span>}
                </div>
            </div>

            {/* Activate toggle */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 18, padding: '11px 14px', background: '#FFF8F3', borderRadius: 10, border: '1.5px solid #E8D6CC' }}>
                <input type="checkbox" checked={form.activateImmediately} onChange={e => set('activateImmediately', e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#F96B38', flexShrink: 0 }} />
                <span>
                    <strong style={{ fontSize: '.88rem', color: '#1A0A00' }}>Activate account immediately</strong>
                    <small style={{ display: 'block', color: '#7A5C4E', fontSize: '.76rem', marginTop: 2 }}>
                        {form.activateImmediately ? 'User can log in right away. No OTP required.' : "An OTP will be sent to the user's email for activation."}
                    </small>
                </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 14, borderTop: '1.5px solid #E8D6CC' }}>
                <button onClick={() => { setStep(STEP_ROLE); setApiError(''); }} style={btnBase}>← Back</button>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={btnBase}>Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        style={{ ...btnBase, border: 'none', background: loading ? '#ccc' : 'linear-gradient(135deg,#F96B38,#D94E1B)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, boxShadow: loading ? 'none' : '0 4px 14px rgba(249,107,56,.3)' }}
                    >
                        {loading ? 'Creating…' : `✓ Create ${roleObj.label}`}
                    </button>
                </div>
            </div>
        </div>
    );

    // STEP 3 — Done
    const renderStepDone = () => (
        <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <div style={{ color: '#28a745', fontSize: '3.2rem', marginBottom: 14 }}><FaCheckCircle /></div>
            <h3 style={{ margin: '0 0 8px', color: '#1A0A00', fontFamily: "'Playfair Display', Georgia, serif" }}>Account Created!</h3>
            <p style={{ color: '#7A5C4E', marginBottom: 4, fontSize: '.92rem' }}>
                <strong>{form.firstName} {form.lastName}</strong> registered as <strong style={{ color: roleObj.color }}>{roleObj.label}</strong>.
            </p>
            {form.ward && (
                <p style={{ color: '#7A5C4E', fontSize: '.84rem', marginBottom: 4 }}>
                    {roleCfg.wardLabel}: <strong>{form.ward}</strong>{form.department && form.department !== form.ward && <> · Dept: <strong>{form.department}</strong></>}
                </p>
            )}
            {createdId && (
                <div style={{ display: 'inline-block', background: '#FFF8F3', border: `2px solid ${roleObj.color}40`, borderRadius: 10, padding: '7px 20px', margin: '12px 0 16px', fontFamily: 'monospace', fontWeight: 700, color: roleObj.color, fontSize: '1.1rem' }}>
                    {createdId}
                </div>
            )}
            <p style={{ color: '#7A5C4E', fontSize: '.82rem', marginBottom: 24 }}>
                {form.activateImmediately ? 'The account is active. The user can log in immediately.' : "An OTP has been sent to the user's email for activation."}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                    onClick={() => { setStep(STEP_ROLE); setForm({ role: 'nurse', firstName: '', middleName: '', lastName: '', email: '', phone: '', username: '', password: '', confirmPassword: '', ward: '', department: '', activateImmediately: true }); setCreatedId(''); }}
                    style={btnBase}
                >
                    Add Another
                </button>
                <button onClick={onClose} style={{ ...btnBase, border: 'none', background: 'linear-gradient(135deg,#F96B38,#D94E1B)', color: '#fff', fontWeight: 700 }}>
                    Done
                </button>
            </div>
        </div>
    );

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={{ maxWidth: 660 }}>

                {/* Header */}
                <div className="modal-header">
                    <h3 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', Georgia, serif", display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.2rem' }}>
                        <FaUserPlus /> Add New User
                    </h3>
                    {/* FIXED: proper circular close button using inline styles */}
                    <button
                        onClick={onClose}
                        type="button"
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'rgba(255,255,255,.18)',
                            border: '2px solid rgba(255,255,255,.28)',
                            color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.95rem', transition: 'all .2s', flexShrink: 0,
                            lineHeight: 1, padding: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.35)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.18)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 28px', background: '#FFF8F3', borderBottom: '1.5px solid #E8D6CC', gap: 8 }}>
                    {[{ n: 1, l: 'Role' }, { n: 2, l: 'Details' }, { n: 3, l: 'Done' }].map((s, i, arr) => (
                        <React.Fragment key={s.n}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= s.n ? (step === STEP_DONE ? '#28a745' : '#F96B38') : '#E8D6CC', color: step >= s.n ? '#fff' : '#7A5C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.74rem', transition: 'all .3s' }}>
                                    {step > s.n ? '✓' : s.n}
                                </div>
                                <span style={{ fontSize: '.78rem', fontWeight: step === s.n ? 700 : 400, color: step >= s.n ? '#1A0A00' : '#7A5C4E' }}>{s.l}</span>
                            </div>
                            {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: step > s.n ? '#F96B38' : '#E8D6CC', borderRadius: 2, transition: 'background .3s' }} />}
                        </React.Fragment>
                    ))}
                </div>

                {step === STEP_ROLE && renderStepRole()}
                {step === STEP_INFO && renderStepInfo()}
                {step === STEP_DONE && renderStepDone()}
            </div>
        </div>
    );
};

export default UserRegistrationModal;