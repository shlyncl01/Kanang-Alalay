import React, { useState, useEffect } from 'react';
import { FaEye, FaEyeSlash, FaTimes } from 'react-icons/fa';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

// FIX: Ward and Department options as dropdowns
const WARD_OPTIONS = [
    'Ward A', 'Ward B', 'Ward C', 'Ward D',
    'ICU', 'General Ward', 'Rehabilitation', 'Kitchen', 'Administration', 'Laundry',
];

const DEPARTMENT_OPTIONS = [
    'Nursing', 'Caregiving', 'Administration', 'Housekeeping',
    'Kitchen & Nutrition', 'Maintenance', 'Social Services', 'Medical',
];

const UserRegistrationModal = ({ isOpen, onClose, onRegister }) => {
    const [form, setForm] = useState({
        firstName: '', middleName: '', lastName: '',
        email: '', phone: '', username: '',
        password: '', confirmPassword: '',
        role: 'staff',
        ward: '', department: '',
    });
    const [errors, setErrors]       = useState({});
    const [loading, setLoading]     = useState(false);
    const [apiError, setApiError]   = useState('');
    const [showPwd, setShowPwd]     = useState(false);
    const [showCPwd, setShowCPwd]   = useState(false);
    // FIX: staffId is auto-generated on the server — shown as readonly preview
    const [previewStaffId] = useState(`LSAE-${Date.now().toString(36).toUpperCase().slice(-4)}`);

    const set = (k, v) => {
        setForm(p => ({ ...p, [k]: v }));
        setErrors(p => ({ ...p, [k]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.firstName.trim()) e.firstName = 'Required';
        if (!form.lastName.trim())  e.lastName  = 'Required';
        if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Valid email required';
        if (!form.password || form.password.length < 8) e.password = 'Minimum 8 characters';
        if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setApiError('');
        if (!validate()) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/auth/register-staff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    firstName:   form.firstName.trim(),
                    middleName:  form.middleName.trim(),
                    lastName:    form.lastName.trim(),
                    email:       form.email.trim().toLowerCase(),
                    phone:       form.phone.trim(),
                    username:    form.username.trim() || form.email.split('@')[0],
                    password:    form.password,
                    role:        form.role,
                    ward:        form.ward,
                    department:  form.department,
                    // staffId is auto-generated on the backend
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Registration failed');

            onRegister && onRegister(data);
            // Reset form
            setForm({ firstName:'', middleName:'', lastName:'', email:'', phone:'', username:'', password:'', confirmPassword:'', role:'staff', ward:'', department:'' });
            onClose();
        } catch (err) {
            setApiError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="registration-modal">
                <div className="modal-header">
                    <h3>Add New Staff Member</h3>
                    <button className="close-btn" onClick={onClose} type="button"><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    {apiError && (
                        <div className="form-error">{apiError}</div>
                    )}

                    {/* FIX: Staff ID shown as auto-generated (readonly) — no regenerate button */}
                    <div className="form-group" style={{ marginBottom: 18 }}>
                        <label className="optional" style={{ color: 'var(--d-muted)', fontSize: '.8rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.05em' }}>
                            Staff ID (Auto-Generated)
                        </label>
                        <input
                            className="readonly-field"
                            value={previewStaffId + '…'}
                            readOnly
                            title="Staff ID is automatically assigned by the system upon registration"
                        />
                        <span className="hint">Staff ID is assigned automatically by the system.</span>
                    </div>

                    {/* FIX: First Name : Last Name side by side */}
                    <div className="form-grid">
                        <div className="form-group">
                            <label>First Name</label>
                            <input
                                className={errors.firstName ? 'error' : ''}
                                value={form.firstName}
                                onChange={e => set('firstName', e.target.value)}
                                placeholder="First Name"
                            />
                            {errors.firstName && <span className="error-text">{errors.firstName}</span>}
                        </div>
                        <div className="form-group">
                            <label className="optional">Middle Name</label>
                            <input
                                value={form.middleName}
                                onChange={e => set('middleName', e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                        <div className="form-group">
                            <label>Last Name</label>
                            <input
                                className={errors.lastName ? 'error' : ''}
                                value={form.lastName}
                                onChange={e => set('lastName', e.target.value)}
                                placeholder="Last Name"
                            />
                            {errors.lastName && <span className="error-text">{errors.lastName}</span>}
                        </div>
                    </div>

                    {/* Email + Phone */}
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                className={errors.email ? 'error' : ''}
                                value={form.email}
                                onChange={e => set('email', e.target.value)}
                                placeholder="staff@lsae.org"
                            />
                            {errors.email && <span className="error-text">{errors.email}</span>}
                        </div>
                        <div className="form-group">
                            <label className="optional">Phone Number</label>
                            <input
                                value={form.phone}
                                onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                                placeholder="09XXXXXXXXX"
                            />
                        </div>
                    </div>

                    {/* Username + Role */}
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="optional">Username</label>
                            <input
                                value={form.username}
                                onChange={e => set('username', e.target.value)}
                                placeholder="Auto from email if blank"
                            />
                        </div>
                        <div className="form-group">
                            <label>Role</label>
                            <select value={form.role} onChange={e => set('role', e.target.value)}>
                                <option value="staff">Staff</option>
                                <option value="nurse">Nurse</option>
                                <option value="caregiver">Caregiver</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    </div>

                    {/* FIX: Ward/Department as dropdowns */}
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="optional">Ward / Area</label>
                            <select value={form.ward} onChange={e => set('ward', e.target.value)}>
                                <option value="">Select ward…</option>
                                {WARD_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="optional">Department</label>
                            <select value={form.department} onChange={e => set('department', e.target.value)}>
                                <option value="">Select department…</option>
                                {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* FIX: Password : Confirm Password side by side */}
                    <div className="form-grid">
                        <div className="form-group password-field">
                            <label>Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    className={errors.password ? 'error' : ''}
                                    value={form.password}
                                    onChange={e => set('password', e.target.value)}
                                    placeholder="Min 8 characters"
                                />
                                <button type="button" className="password-toggle" onClick={() => setShowPwd(p => !p)}>
                                    {showPwd ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            {errors.password && <span className="error-text">{errors.password}</span>}
                        </div>
                        <div className="form-group password-field">
                            <label>Confirm Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showCPwd ? 'text' : 'password'}
                                    className={errors.confirmPassword ? 'error' : ''}
                                    value={form.confirmPassword}
                                    onChange={e => set('confirmPassword', e.target.value)}
                                    placeholder="Repeat password"
                                />
                                <button type="button" className="password-toggle" onClick={() => setShowCPwd(p => !p)}>
                                    {showCPwd ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                        </div>
                    </div>

                    <div className="security-note">
                        <h4>Security Notes</h4>
                        <p>Staff ID is assigned automatically — no manual input needed.</p>
                        <p>The new staff member must change their password on first login.</p>
                        <p>All activity is logged for audit and compliance purposes.</p>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? 'Registering…' : 'Register Staff'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserRegistrationModal;