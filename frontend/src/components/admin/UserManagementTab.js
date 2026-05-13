import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    FaEdit, FaTrash, FaUserCheck, FaSearch, FaFilter,
    FaPrint, FaExclamationTriangle, FaChevronLeft, FaChevronRight,
    FaUserCircle, FaTimes,
} from 'react-icons/fa';
import { API_URL } from '../../config/api';

const ROLES = ['admin', 'head_caregiver', 'caregiver', 'nurse', 'staff'];
const STATUSES = ['all', 'active', 'pending', 'deactivated', 'suspended'];
const PER_PAGE = 10;

const DELETE_REASONS = [
    'Resignation', 'End of contract', 'Terminated for cause',
    'Retirement', 'Transferred to another facility', 'Other',
];

const getAccountStatus = (u) => {
    if (u.status) return u.status;
    if (!u.isVerified && !u.isActive) return 'pending';
    if (u.isActive) return 'active';
    return 'deactivated';
};

const STATUS_STYLE = {
    active:      { bg: '#EEFBF5', color: '#1E7D56' },
    pending:     { bg: '#FFF8E1', color: '#B8860B' },
    deactivated: { bg: '#FFF0F0', color: '#C0392B' },
    suspended:   { bg: '#FFF3CD', color: '#856404' },
    restricted:  { bg: '#FFF3E0', color: '#E65100' },
    terminated:  { bg: '#F3F4F6', color: '#4B5563' },
};

// ── Delete Modal ───────────────────────────────────────────────────────────────
const DeleteModal = ({ user, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [err, setErr] = useState('');

    const confirm = () => {
        if (!reason.trim()) { setErr('A reason is required.'); return; }
        onConfirm(user._id, reason);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }}>
            <div className="registration-modal" style={{ maxWidth: 460, padding: 0 }}>
                <div style={{
                    padding: '20px 26px',
                    background: 'linear-gradient(135deg, #dc3545, #a71d2a)',
                    borderRadius: '20px 20px 0 0',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <FaExclamationTriangle style={{ color: '#fff', fontSize: '1.1rem' }} />
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.1rem' }}>
                        Remove User Account
                    </h4>
                    <button
                        onClick={onClose}
                        style={{
                            marginLeft: 'auto', background: 'rgba(255,255,255,.15)',
                            border: '2px solid rgba(255,255,255,.2)', color: '#fff',
                            width: 32, height: 32, borderRadius: '50%',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>
                <div style={{ padding: '22px 26px' }}>
                    <p style={{ color: '#555', marginBottom: 16, fontSize: '.9rem' }}>
                        Removing <strong>{user.firstName} {user.lastName}</strong> <span style={{ color: '#7A5C4E' }}>({user.role})</span>.
                        This action is permanent.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {DELETE_REASONS.map(r => (
                            <button
                                key={r}
                                onClick={() => { setReason(r); setErr(''); }}
                                style={{
                                    padding: '5px 13px', borderRadius: 20, fontSize: '.77rem', cursor: 'pointer',
                                    fontWeight: 600,
                                    border: `1.5px solid ${reason === r ? '#dc3545' : '#E8D6CC'}`,
                                    background: reason === r ? '#fdecea' : '#FFF8F3',
                                    color: reason === r ? '#dc3545' : '#7A5C4E',
                                }}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <textarea
                        rows={3}
                        value={reason}
                        onChange={e => { setReason(e.target.value); setErr(''); }}
                        placeholder="Type or select a reason above…"
                        style={{
                            width: '100%', padding: '10px 14px',
                            border: `1.5px solid ${err ? '#dc3545' : '#E8D6CC'}`,
                            borderRadius: 10, fontSize: '.88rem',
                            background: '#FFF8F3', color: '#1A0A00',
                            outline: 'none', boxSizing: 'border-box', resize: 'vertical',
                            fontFamily: "'DM Sans', system-ui, sans-serif",
                        }}
                    />
                    {err && <small style={{ color: '#dc3545', fontSize: '.75rem' }}>{err}</small>}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, paddingTop: 16, borderTop: '1.5px solid #E8D6CC' }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans', sans-serif" }}>
                            Cancel
                        </button>
                        <button onClick={confirm} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #dc3545, #a71d2a)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
                            Confirm Removal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Edit / Promote Modal ───────────────────────────────────────────────────────
const EditUserModal = ({ user, onSave, onClose }) => {
    const [form, setForm] = useState({
        firstName: user.firstName || '',
        lastName:  user.lastName  || '',
        email:     user.email     || '',
        phone:     user.phone     || '',
        role:      user.role      || 'caregiver',
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr]       = useState('');

    const handleSave = async () => {
        if (!form.firstName.trim() || !form.lastName.trim()) {
            setErr('First and last name are required.'); return;
        }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/admin/users/${user._id}`, form, {
                headers: { Authorization: `Bearer ${token}` },
            });
            onSave(res.data.data || { ...user, ...form });
        } catch (e) {
            setErr(e.response?.data?.message || 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const inp = {
        width: '100%', padding: '10px 14px',
        border: '1.5px solid #E8D6CC', borderRadius: 10,
        fontSize: '.9rem', background: '#FFF8F3', color: '#1A0A00',
        outline: 'none', boxSizing: 'border-box',
        fontFamily: "'DM Sans', system-ui, sans-serif",
    };
    const lbl = {
        display: 'block', fontSize: '.76rem', fontWeight: 700,
        color: '#2c3e50', textTransform: 'uppercase',
        letterSpacing: '.04em', marginBottom: 5,
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }}>
            <div className="registration-modal" style={{ maxWidth: 480, padding: 0 }}>
                <div style={{
                    padding: '20px 26px',
                    background: 'linear-gradient(135deg, #b85c2d, #7d3a06)',
                    borderRadius: '20px 20px 0 0',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <FaEdit style={{ color: '#fff', fontSize: '1.1rem' }} />
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.1rem' }}>
                        Edit User — {user.firstName} {user.lastName}
                    </h4>
                    <button
                        onClick={onClose}
                        style={{
                            marginLeft: 'auto', background: 'rgba(255,255,255,.15)',
                            border: '2px solid rgba(255,255,255,.2)', color: '#fff',
                            width: 32, height: 32, borderRadius: '50%',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>
                <div style={{ padding: '22px 26px' }}>
                    {err && (
                        <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '.85rem' }}>
                            ⚠️ {err}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                            <label style={lbl}>First Name *</label>
                            <input style={inp} value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
                        </div>
                        <div>
                            <label style={lbl}>Last Name *</label>
                            <input style={inp} value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
                        </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        <label style={lbl}>Email</label>
                        <input type="email" style={inp} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        <label style={lbl}>Phone</label>
                        <input style={inp} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))} placeholder="09XXXXXXXXX" />
                    </div>

                    <div style={{ marginBottom: 6 }}>
                        <label style={lbl}>Role / Promotion</label>
                        <select
                            style={inp}
                            value={form.role}
                            onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                        >
                            {ROLES.map(r => (
                                <option key={r} value={r}>
                                    {r === 'head_caregiver' ? 'Head Caregiver' : r.charAt(0).toUpperCase() + r.slice(1)}
                                </option>
                            ))}
                        </select>
                        {form.role !== user.role && (
                            <small style={{ color: '#b85c2d', fontSize: '.76rem', marginTop: 4, display: 'block', fontWeight: 600 }}>
                                ⚠ Role will change from <strong>{user.role}</strong> to <strong>{form.role}</strong>. This affects dashboard access.
                            </small>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1.5px solid #E8D6CC' }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans', sans-serif" }}>
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                padding: '9px 22px', borderRadius: 10, border: 'none',
                                background: saving ? '#ccc' : 'linear-gradient(135deg, #F96B38, #D94E1B)',
                                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                                fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                            }}
                        >
                            {saving ? 'Saving…' : '✓ Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const UserManagementTab = ({ users = [], setUsers, onDelete, onEdit }) => {
    const [showModal, setShowModal]     = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [email, setEmail]             = useState('');
    const [password, setPassword]       = useState('');
    const [strength, setStrength]       = useState('');
    const [otp, setOtp]                 = useState('');
    const [timer, setTimer]             = useState(0);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [editTarget, setEditTarget]   = useState(null);
    const [search, setSearch]           = useState('');
    const [roleFilter, setRoleFilter]   = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage]               = useState(1);
    const printRef = useRef(null);

    useEffect(() => {
        if (password.length === 0) setStrength('');
        else if (password.length <= 3) setStrength('Weak');
        else if (password.length <= 7) setStrength('Moderate');
        else setStrength('Strong');
    }, [password]);

    useEffect(() => {
        let interval;
        if (timer > 0) interval = setInterval(() => setTimer(p => p - 1), 1000);
        return () => clearInterval(interval);
    }, [timer]);

    // Reset page on filter changes
    useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

    const handleSaveUser = async () => {
        try {
            await axios.post(`${API_URL}/auth/register`, { username: email.split('@')[0], email, password });
            setShowModal(false);
            setShowOtpModal(true);
            setTimer(30);
        } catch (err) {
            alert(err.response?.data?.message || 'Registration failed');
        }
    };

    const handleVerifyOtp = async () => {
        try {
            await axios.post(`${API_URL}/auth/verify-otp`, { email, otpCode: otp });
            alert('Activated!');
            setShowOtpModal(false);
        } catch {
            alert('Incorrect OTP or expired');
        }
    };

    const handleDeleteConfirm = (userId, reason) => {
        onDelete && onDelete(userId, reason);
        setDeleteTarget(null);
    };

    const handleEditSave = (updated) => {
        onEdit && onEdit(updated);
        setEditTarget(null);
    };

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>User Management Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #b85c2d; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
                    th { background: #b85c2d; color: #fff; padding: 10px 12px; text-align: left; font-weight: 700; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — User Management Report</h2>
                <p class="sub">Generated: ${new Date().toLocaleString('en-PH')} &nbsp;|&nbsp; Showing ${filteredUsers.length} users</p>
                <table>
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Username</th></tr>
                    </thead>
                    <tbody>
                        ${filteredUsers.map(u => `
                            <tr>
                                <td>${u.firstName || ''} ${u.lastName || ''}</td>
                                <td>${u.email || '—'}</td>
                                <td>${u.role || '—'}</td>
                                <td>${getAccountStatus(u)}</td>
                                <td>@${u.username || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        win.print();
        win.close();
    };

    // Filtered + searched list
    const filteredUsers = users.filter(u => {
        const q = search.toLowerCase();
        const nameMatch = !q ||
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q);
        const roleMatch = roleFilter === 'all' || u.role === roleFilter;
        const statusMatch = statusFilter === 'all' || getAccountStatus(u) === statusFilter;
        return nameMatch && roleMatch && statusMatch;
    });

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PER_PAGE));
    const paged = filteredUsers.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div>
            {/* ── Controls ── */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <FaSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.82rem' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, email, or username…"
                        style={{
                            width: '100%', padding: '9px 12px 9px 34px',
                            border: '1.5px solid #E8D6CC', borderRadius: 9,
                            fontFamily: "'DM Sans', system-ui, sans-serif",
                            fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00',
                            outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E' }}>
                            <FaTimes size={12} />
                        </button>
                    )}
                </div>

                {/* Role filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaFilter style={{ color: '#7A5C4E', fontSize: '.8rem' }} />
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        style={{ padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                    >
                        <option value="all">Role: All</option>
                        {ROLES.map(r => <option key={r} value={r}>{r === 'head_caregiver' ? 'Head Caregiver' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                </div>

                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{ padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                >
                    {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'Status: All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>

                <button className="btn-outline-sm" onClick={handlePrint} title="Print">
                    <FaPrint /> Print
                </button>
                <button onClick={() => setShowModal(true)} style={{
                    padding: '9px 18px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #F96B38, #D94E1B)',
                    color: '#fff', cursor: 'pointer', fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem',
                }}>
                    + Add New User
                </button>
            </div>

            {/* ── Table ── */}
            <div className="card-white" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5 style={{ margin: 0 }}>User Accounts</h5>
                    <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>
                        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                    </small>
                </div>
                <div ref={printRef}>
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: '#7A5C4E', fontStyle: 'italic' }}>
                                        No users match your filters.
                                    </td>
                                </tr>
                            ) : (
                                paged.map(u => {
                                    const st = getAccountStatus(u);
                                    const stStyle = STATUS_STYLE[st] || STATUS_STYLE.pending;
                                    return (
                                        <tr key={u._id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <FaUserCircle size={28} color="#ccc" />
                                                    <div>
                                                        <strong>{u.firstName} {u.lastName}</strong>
                                                        <br />
                                                        <small style={{ color: '#7A5C4E' }}>@{u.username || '—'}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '.88rem' }}>{u.email || '—'}</td>
                                            <td>
                                                <span className={`badge-custom ${u.role}`}>
                                                    {u.role === 'head_caregiver' ? 'Head Caregiver' : u.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block', padding: '3px 11px', borderRadius: 20,
                                                    fontSize: '.76rem', fontWeight: 700,
                                                    background: stStyle.bg, color: stStyle.color,
                                                }}>
                                                    {st.charAt(0).toUpperCase() + st.slice(1)}
                                                </span>
                                            </td>
                                            <td className="actions">
                                                <span
                                                    className="edit"
                                                    title="Edit / Promote"
                                                    onClick={() => setEditTarget(u)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <FaEdit />
                                                </span>
                                                <span
                                                    className="delete"
                                                    title="Remove"
                                                    onClick={() => setDeleteTarget(u)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <FaTrash />
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 20px', borderTop: '1.5px solid #E8D6CC', background: '#FFF8F3',
                    }}>
                        <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>
                            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                        </small>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: page === 1 ? '#f5f5f5' : '#FFF8F3', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#7A5C4E' }}
                            >
                                <FaChevronLeft size={11} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                <button
                                    key={n}
                                    onClick={() => setPage(n)}
                                    style={{
                                        padding: '5px 11px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600,
                                        border: `1.5px solid ${page === n ? '#b85c2d' : '#E8D6CC'}`,
                                        background: page === n ? '#b85c2d' : '#FFF8F3',
                                        color: page === n ? '#fff' : '#7A5C4E',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {n}
                                </button>
                            ))}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: page === totalPages ? '#f5f5f5' : '#FFF8F3', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: '#7A5C4E' }}
                            >
                                <FaChevronRight size={11} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Add User Modal ── */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content registration-modal" style={{ maxWidth: 420 }}>
                        <h4 style={{ marginBottom: 16 }}>Add New User</h4>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '.8rem', marginBottom: 5 }}>Email</label>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.9rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '.8rem', marginBottom: 5 }}>Password</label>
                            <input
                                type="password"
                                placeholder="Password"
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.9rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        {strength && (
                            <p style={{ fontSize: '.82rem', marginBottom: 14, color: strength === 'Weak' ? '#dc3545' : strength === 'Moderate' ? '#ffc107' : '#28a745' }}>
                                Strength: <strong>{strength}</strong>
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleSaveUser} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #F96B38, #D94E1B)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── OTP Modal ── */}
            {showOtpModal && (
                <div className="modal-overlay">
                    <div className="modal-content registration-modal" style={{ maxWidth: 380, textAlign: 'center' }}>
                        <h3 style={{ marginBottom: 8 }}>Verify Account</h3>
                        <p style={{ color: '#7A5C4E', fontSize: '.88rem', marginBottom: 16 }}>Enter the 6-digit OTP sent to <strong>{email}</strong></p>
                        <input
                            type="text"
                            value={email}
                            readOnly
                            style={{ display: 'none' }}
                        />
                        <input
                            type="text"
                            placeholder="6-digit OTP"
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10, fontSize: '1.1rem', textAlign: 'center', letterSpacing: '.2em', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
                        />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleVerifyOtp} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #F96B38, #D94E1B)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                                <FaUserCheck style={{ marginRight: 6 }} /> Activate
                            </button>
                            <button
                                disabled={timer > 0}
                                onClick={() => setTimer(30)}
                                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: timer > 0 ? 'not-allowed' : 'pointer', color: '#7A5C4E', fontWeight: 600 }}
                            >
                                {timer > 0 ? `Resend (${timer}s)` : 'Resend OTP'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ── */}
            {editTarget && (
                <EditUserModal
                    user={editTarget}
                    onSave={handleEditSave}
                    onClose={() => setEditTarget(null)}
                />
            )}

            {/* ── Delete Modal ── */}
            {deleteTarget && (
                <DeleteModal
                    user={deleteTarget}
                    onConfirm={handleDeleteConfirm}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
};

export default UserManagementTab;