import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    FaEdit, FaSearch, FaFilter,
    FaPrint, FaExclamationTriangle, FaChevronLeft, FaChevronRight,
    FaUserCircle, FaTimes, FaUserCheck, FaBan, FaUserPlus,
} from 'react-icons/fa';
import { API_URL } from '../../config/api';
import AddStaffModal from './AddStaffModal';

// ─── constants ────────────────────────────────────────────────────────────────

const ROLES = ['admin', 'head_caregiver', 'caregiver'];
const ROLE_FILTER_OPTIONS = ['all', ...ROLES];
const STATUS_FILTER_OPTIONS = ['all', 'active', 'pending', 'deactivated'];
const PER_PAGE = 10;

const DEACTIVATE_REASONS = [
    'Resignation', 'End of contract', 'Terminated for cause',
    'Retirement', 'Transferred to another facility', 'Other',
];

const ROLE_LABEL = { admin: 'Admin', head_caregiver: 'Head Caregiver', caregiver: 'Caregiver' };
const ROLE_COLOR = {
    admin:          { bg: '#dc3545', color: '#fff' },
    head_caregiver: { bg: '#b85c2d', color: '#fff' },
    caregiver:      { bg: '#28a745', color: '#fff' },
};
const STATUS_STYLE = {
    active:      { bg: '#EEFBF5', color: '#1E7D56' },
    pending:     { bg: '#FFF8E1', color: '#B8860B' },
    deactivated: { bg: '#FFF0F0', color: '#C0392B' },
    suspended:   { bg: '#FFF3CD', color: '#856404' },
    restricted:  { bg: '#FFF3E0', color: '#E65100' },
    terminated:  { bg: '#F3F4F6', color: '#4B5563' },
    on_leave:    { bg: '#EFF6FF', color: '#1D4ED8' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const getAccountStatus = (u) => {
    if (u.status && ['active','pending','restricted','suspended','deactivated','on_leave','terminated'].includes(u.status)) return u.status;
    if (!u.isVerified && !u.isActive) return 'pending';
    if (u.isActive) return 'active';
    return 'deactivated';
};

// ─── DeactivateModal ──────────────────────────────────────────────────────────

const DeactivateModal = ({ user, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [err, setErr] = useState('');

    const confirm = () => {
        if (!reason.trim()) { setErr('A reason is required.'); return; }
        onConfirm(user._id, reason);
    };

    const inp = {
        border: `1.5px solid ${err ? '#dc3545' : '#E8D6CC'}`,
        borderRadius: 10, padding: '10px 14px', width: '100%',
        fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00',
        outline: 'none', boxSizing: 'border-box', resize: 'vertical',
        fontFamily: "'DM Sans', system-ui, sans-serif",
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }}>
            <div className="registration-modal" style={{ maxWidth: 480, padding: 0 }}>
                <div style={{ padding: '20px 26px', background: 'linear-gradient(135deg,#C0392B,#922b21)', borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FaBan style={{ color: '#fff', fontSize: '1.1rem' }} />
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display',serif", fontSize: '1.1rem' }}>Deactivate Account</h4>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.2)', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes /></button>
                </div>
                <div style={{ padding: '22px 26px' }}>
                    <div style={{ background: '#FFF8F3', borderRadius: 10, padding: '12px 16px', marginBottom: 18, borderLeft: '4px solid #C0392B' }}>
                        <strong>{user.firstName} {user.lastName}</strong>
                        <span style={{ color: '#7A5C4E', marginLeft: 8, fontSize: '.85rem' }}>({ROLE_LABEL[user.role] || user.role})</span>
                        <p style={{ margin: '4px 0 0', fontSize: '.82rem', color: '#7A5C4E' }}>This will permanently deactivate the account and revoke all system access.</p>
                    </div>
                    <p style={{ fontSize: '.76rem', fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Reason *</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                        {DEACTIVATE_REASONS.map(r => (
                            <button key={r} onClick={() => { setReason(r); setErr(''); }} style={{ padding: '5px 13px', borderRadius: 20, fontSize: '.77rem', cursor: 'pointer', fontWeight: 600, border: `1.5px solid ${reason === r ? '#C0392B' : '#E8D6CC'}`, background: reason === r ? '#fdecea' : '#FFF8F3', color: reason === r ? '#C0392B' : '#7A5C4E' }}>{r}</button>
                        ))}
                    </div>
                    <textarea rows={3} value={reason} onChange={e => { setReason(e.target.value); setErr(''); }} placeholder="Or type a custom reason…" style={inp} />
                    {err && <small style={{ color: '#dc3545', fontSize: '.75rem' }}>{err}</small>}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, paddingTop: 16, borderTop: '1.5px solid #E8D6CC' }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
                        <button onClick={confirm} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#C0392B,#922b21)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Confirm Deactivation</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── EditUserModal ────────────────────────────────────────────────────────────

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
        if (!form.firstName.trim() || !form.lastName.trim()) { setErr('First and last name are required.'); return; }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/admin/users/${user._id}`, form, { headers: { Authorization: `Bearer ${token}` } });
            onSave(res.data.data || { ...user, ...form });
        } catch (e) { setErr(e.response?.data?.message || 'Failed to save changes.'); }
        finally { setSaving(false); }
    };

    const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10, fontSize: '.9rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans',system-ui,sans-serif", transition: 'border-color .2s' };
    const lbl = { display: 'block', fontSize: '.76rem', fontWeight: 700, color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 };
    const roleChanged = form.role !== user.role;

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }}>
            <div className="registration-modal" style={{ maxWidth: 500, padding: 0 }}>
                <div style={{ padding: '20px 26px', background: 'linear-gradient(135deg,#b85c2d,#7d3a06)', borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FaEdit style={{ color: '#fff', fontSize: '1.1rem' }} />
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display',serif", fontSize: '1.1rem' }}>Edit — {user.firstName} {user.lastName}</h4>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.2)', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes /></button>
                </div>
                <div style={{ padding: '24px 26px' }}>
                    {err && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '.85rem' }}>⚠️ {err}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div><label style={lbl}>First Name *</label><input style={inp} value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
                        <div><label style={lbl}>Last Name *</label><input style={inp} value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
                    </div>
                    <div style={{ marginBottom: 14 }}><label style={lbl}>Email</label><input type="email" style={inp} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                    <div style={{ marginBottom: 14 }}><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g,'').slice(0,11) }))} placeholder="09XXXXXXXXX" /></div>
                    <div style={{ marginBottom: 6 }}>
                        <label style={lbl}>Role / Promotion</label>
                        <select style={{ ...inp, cursor: 'pointer' }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        {roleChanged && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#FFF8E1', border: '1.5px solid #ffc107', fontSize: '.78rem', color: '#856404', display: 'flex', gap: 7, alignItems: 'center' }}>
                                <FaExclamationTriangle style={{ flexShrink: 0 }} />
                                Role will change from <strong style={{ marginLeft: 4 }}>{ROLE_LABEL[user.role] || user.role}</strong> to <strong style={{ marginLeft: 4 }}>{ROLE_LABEL[form.role]}</strong>. This affects dashboard access.
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 16, borderTop: '1.5px solid #E8D6CC' }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
                        <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: saving ? '#ccc' : 'linear-gradient(135deg,#F96B38,#D94E1B)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>{saving ? 'Saving…' : '✓ Save Changes'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── UserManagementTab (main) ─────────────────────────────────────────────────

const UserManagementTab = ({ users = [], setUsers, onEdit }) => {
    const [deactivateTarget, setDeactivateTarget] = useState(null);
    const [editTarget, setEditTarget]             = useState(null);
    const [showAddModal, setShowAddModal]         = useState(false);
    const [search, setSearch]                     = useState('');
    const [roleFilter, setRoleFilter]             = useState('all');
    const [statusFilter, setStatusFilter]         = useState('all');
    const [page, setPage]                         = useState(1);
    const [activating, setActivating]             = useState(null);
    const printRef = useRef(null);

    useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

    const existingPhones = users.map(u => u.phone).filter(Boolean);

    const handleActivate = async (userId) => {
        setActivating(userId);
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/admin/staff/${userId}/status`, { status: 'active' }, { headers: { Authorization: `Bearer ${token}` } });
            setUsers && setUsers(prev => prev.map(u => u._id === userId ? { ...u, status: 'active', isActive: true } : u));
        } catch (e) { alert(e.response?.data?.message || 'Failed to activate.'); }
        finally { setActivating(null); }
    };

    const handleDeactivateConfirm = async (userId, reason) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/admin/staff/${userId}/status`, { status: 'deactivated', reason }, { headers: { Authorization: `Bearer ${token}` } });
            setUsers && setUsers(prev => prev.map(u => u._id === userId ? { ...u, status: 'deactivated', isActive: false, statusReason: reason } : u));
        } catch (e) { alert(e.response?.data?.message || 'Failed to deactivate.'); }
        finally { setDeactivateTarget(null); }
    };

    const handleEditSave = (updated) => {
        setUsers && setUsers(prev => prev.map(u => u._id === updated._id ? { ...u, ...updated } : u));
        onEdit && onEdit(updated);
        setEditTarget(null);
    };

    const handleStaffAdded = (newUser) => {
        setUsers && setUsers(prev => [newUser, ...prev]);
    };

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Personnel Report</title><style>body{font-family:sans-serif;padding:24px;color:#1A0A00}h2{color:#b85c2d}table{width:100%;border-collapse:collapse;font-size:.85rem}th{background:#b85c2d;color:#fff;padding:10px 12px;text-align:left}td{padding:9px 12px;border-bottom:1px solid #E8D6CC}tr:nth-child(even) td{background:#FFF8F3}</style></head><body><h2>Kanang-Alalay — Personnel Report</h2><p>Generated: ${new Date().toLocaleString('en-PH')} | ${filteredUsers.length} shown</p><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Username</th></tr></thead><tbody>${filteredUsers.map(u=>`<tr><td>${u.firstName||''} ${u.lastName||''}</td><td>${u.email||'—'}</td><td>${ROLE_LABEL[u.role]||u.role||'—'}</td><td>${getAccountStatus(u)}</td><td>@${u.username||'—'}</td></tr>`).join('')}</tbody></table></body></html>`);
        win.document.close();

        // Wait for the report to finish loading before printing, and only
        // auto-close once the print dialog has actually been dismissed —
        // closing immediately after print() can cause the window to flash
        // shut before the print dialog renders.
        let printed = false;
        const triggerPrint = () => {
            if (printed) return;
            printed = true;
            win.focus();
            win.print();
        };
        win.onload = triggerPrint;
        setTimeout(triggerPrint, 300);
        win.onafterprint = () => win.close();
    };

    const filteredUsers = users.filter(u => {
        const q = search.toLowerCase();
        const nameMatch  = !q || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.username||'').toLowerCase().includes(q);
        const roleMatch  = roleFilter === 'all' || u.role === roleFilter;
        const statusMatch = statusFilter === 'all' || getAccountStatus(u) === statusFilter;
        return nameMatch && roleMatch && statusMatch;
    });

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PER_PAGE));
    const paged      = filteredUsers.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const sel   = { padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans',sans-serif", cursor: 'pointer' };
    const pgBtn = (disabled) => ({ padding: '5px 9px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: disabled ? '#f5f5f5' : '#FFF8F3', cursor: disabled ? 'not-allowed' : 'pointer', color: '#7A5C4E', display: 'flex', alignItems: 'center' });

    return (
        <div>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <FaSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.82rem' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or username…" style={{ width: '100%', padding: '9px 34px 9px 34px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontFamily: "'DM Sans',system-ui,sans-serif", fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box' }} />
                    {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E' }}><FaTimes size={12} /></button>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaFilter style={{ color: '#7A5C4E', fontSize: '.8rem' }} />
                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={sel}>
                        {ROLE_FILTER_OPTIONS.map(r => <option key={r} value={r}>{r === 'all' ? 'Role: All' : ROLE_LABEL[r] || r}</option>)}
                    </select>
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
                    {STATUS_FILTER_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'Status: All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <button className="btn-outline-sm" onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FaPrint /> Print</button>
                <button
                    onClick={() => setShowAddModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#b85c2d,#7d3a06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '.88rem', fontFamily: "'DM Sans',sans-serif", boxShadow: '0 3px 10px rgba(184,92,45,.35)', transition: 'opacity .2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '.88'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <FaUserPlus size={13} /> Add New Staff
                </button>
            </div>

            {/* Table */}
            <div className="card-white" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5 style={{ margin: 0 }}>User Accounts</h5>
                    <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>{filteredUsers.length} account{filteredUsers.length !== 1 ? 's' : ''} found</small>
                </div>
                <div ref={printRef} style={{ overflowX: 'auto' }}>
                    <table className="custom-table" style={{ minWidth: 600 }}>
                        <thead>
                            <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th style={{ textAlign: 'center' }}>Actions</th></tr>
                        </thead>
                        <tbody>
                            {paged.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: '#7A5C4E', fontStyle: 'italic' }}>
                                    {search || roleFilter !== 'all' || statusFilter !== 'all' ? 'No accounts match your filters.' : 'No users found.'}
                                </td></tr>
                            ) : paged.map(u => {
                                const st = getAccountStatus(u);
                                const stStyle   = STATUS_STYLE[st] || STATUS_STYLE.pending;
                                const isActive  = st === 'active';
                                const roleStyle = ROLE_COLOR[u.role] || { bg: '#6c757d', color: '#fff' };
                                return (
                                    <tr key={u._id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <FaUserCircle size={28} color="#d4b5a0" />
                                                <div>
                                                    <strong style={{ fontSize: '.9rem' }}>{u.firstName} {u.lastName}</strong><br />
                                                    <small style={{ color: '#7A5C4E' }}>@{u.username || '—'}</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '.88rem', color: '#444' }}>{u.email || '—'}</td>
                                        <td>
                                            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: '.76rem', fontWeight: 700, background: roleStyle.bg, color: roleStyle.color }}>
                                                {ROLE_LABEL[u.role] || u.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ display: 'inline-block', padding: '3px 11px', borderRadius: 20, fontSize: '.76rem', fontWeight: 700, background: stStyle.bg, color: stStyle.color }}>
                                                {st === 'on_leave' ? 'On Leave' : st.charAt(0).toUpperCase() + st.slice(1)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                                {isActive ? (
                                                    <button title="Deactivate account" onClick={() => setDeactivateTarget(u)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #f5c6cb', background: '#fff0f0', color: '#C0392B', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>
                                                        <FaBan size={11} /> Deactivate
                                                    </button>
                                                ) : (
                                                    <button title="Activate account" disabled={activating === u._id} onClick={() => handleActivate(u._id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #b7e4cc', background: '#EEFBF5', color: '#1E7D56', cursor: activating === u._id ? 'not-allowed' : 'pointer', fontSize: '.8rem', fontWeight: 600, fontFamily: "'DM Sans',sans-serif", opacity: activating === u._id ? .6 : 1 }}>
                                                        <FaUserCheck size={11} /> {activating === u._id ? 'Activating…' : 'Activate'}
                                                    </button>
                                                )}
                                                <button title="Edit user" onClick={() => setEditTarget(u)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: '#FFF8F3', color: '#7A5C4E', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>
                                                    <FaEdit size={11} /> Edit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1.5px solid #E8D6CC', background: '#FFF8F3' }}>
                        <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filteredUsers.length)} of {filteredUsers.length}</small>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} style={pgBtn(page===1)}><FaChevronLeft size={11} /></button>
                            {(() => {
                                let start = Math.max(1, page-2); let end = Math.min(totalPages, start+4); start = Math.max(1, end-4);
                                return Array.from({ length: end-start+1 }, (_, i) => start+i).map(n => (
                                    <button key={n} onClick={() => setPage(n)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, border: `1.5px solid ${page===n ? '#b85c2d' : '#E8D6CC'}`, background: page===n ? '#b85c2d' : '#FFF8F3', color: page===n ? '#fff' : '#7A5C4E', cursor: 'pointer' }}>{n}</button>
                                ));
                            })()}
                            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} style={pgBtn(page===totalPages)}><FaChevronRight size={11} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showAddModal && (
                <AddStaffModal
                    onClose={() => setShowAddModal(false)}
                    onAdded={handleStaffAdded}
                    existingPhones={existingPhones}
                />
            )}
            {editTarget      && <EditUserModal    user={editTarget}       onSave={handleEditSave}          onClose={() => setEditTarget(null)} />}
            {deactivateTarget && <DeactivateModal user={deactivateTarget} onConfirm={handleDeactivateConfirm} onClose={() => setDeactivateTarget(null)} />}
        </div>
    );
};

export default UserManagementTab;