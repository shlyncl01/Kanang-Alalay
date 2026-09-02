import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { HIDDEN_LOGIN_PATH } from '../config/hiddenRoute';
import {
    FaUserCircle, FaHome, FaUsers, FaBell, FaCalendarCheck,
    FaUserMd, FaExclamationTriangle, FaChartBar, FaFileAlt, FaUserPlus,
    FaSignOutAlt, FaSync, FaEye, FaEdit, FaTrash,
    FaCheckCircle, FaBan, FaClock, FaMoneyBillWave,
    FaPhone, FaEnvelope, FaCalendarAlt, FaUserTag, FaIdCard, FaDownload, FaBox, FaChevronDown,
    FaSearch, FaCog, FaQuestionCircle, FaTimes, FaCheck, FaInfoCircle,
    FaExclamationCircle, FaSpinner, FaTimesCircle, FaHistory, FaFilter,
    FaPrint, FaChevronLeft, FaChevronRight, FaBars,
    FaMapMarkerAlt, FaLandmark, FaArrowLeft
} from 'react-icons/fa';
import UserRegistrationModal from '../components/UserRegistrationModal';
import AddInventoryModal from '../components/AddInventoryModal';
import InventoryTab from '../components/admin/InventoryTab';
import mainLogo from '../assets/mainLogo.png';

import OverviewTab from '../components/admin/OverviewTab';
import StaffRosterTab from '../components/admin/StaffRosterTab';
import UserManagementTab from '../components/admin/UserManagementTab';
import DonationManagementTab from '../components/admin/DonationManagementTab';
import BookingManagementTab from '../components/admin/BookingManagementTab';

import '../styles/Dashboard.css';
import { useSocket } from '../hooks/useSocket';
import '../styles/AdminDashboard.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const NOTIF_TYPES = {
    booking: { color: '#17a2b8', icon: <FaCalendarAlt />, label: 'Booking', section: 'booking' },
    donation: { color: '#28a745', icon: <FaMoneyBillWave />, label: 'Donation', section: 'donation' },
    personnel: { color: '#b85c2d', icon: <FaUsers />, label: 'Personnel', section: 'staff' },
    inventory: { color: '#dc3545', icon: <FaExclamationTriangle />, label: 'Inventory', section: 'inventory' },
    system: { color: '#6c757d', icon: <FaInfoCircle />, label: 'System', section: null },
};

const buildNotifications = (bookings, donations, staff, inventory) => {
    const notifs = [];
    bookings.filter(b => b.status === 'pending').forEach(b => notifs.push({
        id: `bk-${b._id}`, type: 'booking',
        title: 'New Booking Request',
        body: `${b.name} — ${new Date(b.visitDate).toLocaleDateString()}`,
        time: b.createdAt || new Date().toISOString(), read: false,
    }));
    donations.filter(d => d.paymentStatus === 'pending').forEach(d => notifs.push({
        id: `dn-${d._id}`, type: 'donation',
        title: 'Pending Donation',
        body: `${d.donorName} — ₱${d.amount?.toLocaleString()}`,
        time: d.createdAt || new Date().toISOString(), read: false,
    }));
    staff.filter(m => !m.isActive && m.status !== 'terminated').forEach(m => notifs.push({
        id: `st-${m._id}`, type: 'personnel',
        title: 'Personnel Inactive',
        body: `${m.firstName} ${m.lastName} (${m.role}) - ${m.status || 'inactive'}`,
        time: m.createdAt || new Date().toISOString(), read: false,
    }));
    inventory.filter(i => i.quantity <= (i.minThreshold || 10)).forEach(i => notifs.push({
        id: `iv-${i._id}`, type: 'inventory',
        title: 'Low Stock Alert',
        body: `${i.name} — only ${i.quantity} ${i.unit} left`,
        time: new Date().toISOString(), read: false,
    }));
    return notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
};

const timeAgo = (iso) => {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const ALERT_TYPE_OPTIONS = ['All', 'Medication', 'Inventory', 'Stock Request', 'Resident', 'System'];
const ALERT_STATUS_OPTIONS = ['All', 'Unread', 'Read'];
const ALERT_DATE_OPTIONS = ['All', 'Today', 'This Week', 'This Month'];
const alertSelectStyle = { padding: '8px 10px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.83rem', background: '#fff', color: '#1A0A00', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };

const bucketizeAlertType = (rawType) => {
    const t = (rawType || '').toLowerCase();
    if (t.includes('medication')) return 'Medication';
    if (t.includes('stock-request') || t.includes('stock_request') || t.includes('stockrequest')) return 'Stock Request';
    if (t.includes('inventory')) return 'Inventory';
    if (t.includes('resident')) return 'Resident';
    return 'System';
};

const matchesAlertDateFilter = (isoTime, filterValue) => {
    if (filterValue === 'All') return true;
    const t = new Date(isoTime);
    const now = new Date();
    if (filterValue === 'Today') {
        return t.toDateString() === now.toDateString();
    }
    if (filterValue === 'This Week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return t >= startOfWeek;
    }
    if (filterValue === 'This Month') {
        return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
    }
    return true;
};

const DB_ALERT_TYPE_COLORS = { OTP: '#6c757d', Booking: '#17a2b8', Inventory: '#dc3545', System: '#6c757d' };

const buildUnifiedAlerts = (notifications, dbAlerts, readIds) => {
    const fromNotifications = notifications.map(n => {
        const meta = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
        return {
            uid: `n-${n.id}`,
            source: 'notification',
            raw: n,
            rawType: n.type,
            bucket: bucketizeAlertType(n.type),
            title: n.title,
            message: n.body,
            time: n.time,
            isRead: readIds.has(n.id),
            color: meta.color,
            icon: meta.icon,
            typeLabel: meta.label,
            section: meta.section,
        };
    });

    const fromDbAlerts = dbAlerts.map(a => {
        const color = DB_ALERT_TYPE_COLORS[a.type] || '#6c757d';
        return {
            uid: `a-${a._id}`,
            source: 'db',
            raw: a,
            rawType: a.type,
            bucket: bucketizeAlertType(a.type),
            title: a.title,
            message: a.message,
            time: a.createdAt,
            isRead: !!a.isRead,
            color,
            icon: null,
            typeLabel: a.type,
            section: null,
        };
    });

    return [...fromNotifications, ...fromDbAlerts].sort((x, y) => new Date(y.time) - new Date(x.time));
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
            <div className="registration-modal" style={{ maxWidth: 440, padding: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    {danger
                        ? <FaExclamationTriangle color="#dc3545" size={22} />
                        : <FaInfoCircle color="#b85c2d" size={22} />}
                    <h4 style={{ margin: 0, color: 'var(--d-ink)', fontSize: '1.05rem' }}>{title}</h4>
                </div>
                <p style={{ color: 'var(--d-muted)', fontSize: '.92rem', marginBottom: 24 }}>{message}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button className="btn-outline-sm" onClick={onCancel}>Cancel</button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '9px 22px', borderRadius: 9, border: 'none', cursor: 'pointer',
                            fontFamily: 'var(--d-font-body)', fontWeight: 600, fontSize: '.9rem',
                            background: danger ? '#dc3545' : 'linear-gradient(135deg, var(--d-orange), var(--d-orange-dk))',
                            color: '#fff', transition: 'all .2s',
                        }}
                    >{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
};

const ReasonModal = ({ isOpen, action, userName, currentStatus, reason, setReason, effectiveDate, setEffectiveDate, notes, setNotes, onConfirm, onCancel, loading }) => {
    if (!isOpen) return null;

    const getActionTitle = () => {
        switch(action) {
            case 'restrict': return 'Restrict Access';
            case 'deactivate': return 'Deactivate Account (Permanent)';
            case 'suspend': return 'Suspend Account';
            case 'terminate': return 'Terminate Employment';
            case 'loa': return 'Leave of Absence';
            default: return 'Personnel Action';
        }
    };

    const getActionColor = () => {
        switch(action) {
            case 'restrict': return '#E65100';
            case 'deactivate': return '#C0392B';
            case 'suspend': return '#856404';
            case 'terminate': return '#dc3545';
            case 'loa': return '#1565C0';
            default: return '#7A5C4E';
        }
    };

    const getActionDescription = () => {
        switch(action) {
            case 'restrict': return 'Temporarily restrict system access while keeping the account active.';
            case 'deactivate': return 'Permanently deactivate account when staff leaves the organization for good.';
            case 'suspend': return 'Temporarily suspend account due to policy violations or pending investigation.';
            case 'terminate': return 'Terminate employment with immediate effect. Account will be disabled.';
            case 'loa': return 'Grant leave of absence. Account will be temporarily disabled until return date.';
            default: return '';
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
            <div className="registration-modal" style={{ maxWidth: 500, padding: 0 }}>
                <div style={{ padding: '20px 24px', borderBottom: '1.5px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: getActionColor(), borderRadius: '20px 20px 0 0' }}>
                    <h4 style={{ margin: 0, color: '#fff' }}>{getActionTitle()}</h4>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}><FaTimes /></button>
                </div>
                <div style={{ padding: '24px' }}>
                    <div style={{ background: '#FFF8F3', padding: '12px 16px', borderRadius: 10, marginBottom: 20 }}>
                        <strong>{userName}</strong> (Current Status: {currentStatus || 'Active'})
                    </div>
                    <p style={{ color: getActionColor(), fontSize: '.88rem', marginBottom: 20, padding: '10px', background: `${getActionColor()}10`, borderRadius: 8 }}>
                        {getActionDescription()}
                    </p>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '.82rem', color: '#7A5C4E' }}>Reason *</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Provide detailed reason for this action..."
                            rows={3}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10,
                                fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem', resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '.82rem', color: '#7A5C4E' }}>Effective Date</label>
                        <input
                            type="date"
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10 }}
                        />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '.82rem', color: '#7A5C4E' }}>Additional Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any additional information or documentation reference..."
                            rows={2}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10,
                                fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem', resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1.5px solid #E8D6CC' }}>
                        <button className="btn-outline-sm" onClick={onCancel}>Cancel</button>
                        <button
                            onClick={onConfirm}
                            disabled={!reason.trim() || loading}
                            style={{
                                padding: '10px 24px', borderRadius: 9, border: 'none',
                                background: !reason.trim() || loading ? '#ccc' : getActionColor(),
                                color: '#fff', fontWeight: 600, cursor: !reason.trim() || loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? <FaSpinner className="spin" /> : `Confirm ${getActionTitle()}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const proofUrl = (filename) => {
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${base}/uploads/${filename}`;
};

const DetailsModal = ({ data, type, onClose }) => {
    if (!data) return null;
    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="registration-modal" style={{ maxWidth: 520, padding: 35 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1.5px solid var(--d-border)', paddingBottom: 14 }}>
                    <h4 style={{ margin: 0, color: 'var(--d-ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        {type === 'booking' ? <FaCalendarCheck color="#b85c2d" /> : <FaMoneyBillWave color="#28a745" />}
                        {type === 'booking' ? 'Booking Details' : 'Donation Details'}
                    </h4>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--d-muted)' }}><FaTimes /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {type === 'booking' ? (<>
                        <InfoRow label="Visitor" value={data.name} />
                        <InfoRow label="Email" value={data.email} />
                        <InfoRow label="Phone" value={data.phone} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, background: 'var(--d-cream)', padding: 14, borderRadius: 8 }}>
                            <InfoMini label="Date" value={new Date(data.visitDate).toLocaleDateString()} />
                            <InfoMini label="Time" value={data.visitTime} />
                            <InfoMini label="Visitors" value={`${data.numberOfVisitors} pax`} />
                        </div>
                        <InfoRow label="Purpose" value={data.purpose} highlight />
                        <div><small style={{ color: 'var(--d-muted)', fontWeight: 700 }}>Status</small>
                            <div style={{ marginTop: 6 }}><span className={`status ${data.status}`}>{data.status}</span></div>
                        </div>
                    </>) : (<>
                        <InfoRow label="Donor" value={data.donorName} />
                        <InfoRow label="Email" value={data.email} />
                        <InfoRow label="Phone" value={data.phone || '—'} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--d-cream)', padding: 14, borderRadius: 8 }}>
                            <InfoMini label="Amount" value={`₱${data.amount?.toLocaleString()}`} accent="#28a745" />
                            <InfoMini label="Type" value={data.donationType} />
                        </div>
                        {data.donationType === 'cash' && (data.appointmentDate || data.appointmentTime) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--d-cream)', padding: 14, borderRadius: 8 }}>
                                {data.appointmentDate && (
                                    <InfoMini label="Appt. Date" value={new Date(data.appointmentDate).toLocaleDateString()} />
                                )}
                                {data.appointmentTime && (
                                    <InfoMini label="Appt. Time" value={data.appointmentTime} />
                                )}
                            </div>
                        )}
                        <InfoRow label="Receipt" value={data.receiptNumber || 'Awaiting confirmation'} mono />
                        <div>
                            <small style={{ color: 'var(--d-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '.7rem' }}>
                                Transaction Receipt
                            </small>
                            {data.proofOfPayment ? (
                                <div style={{ marginTop: 8 }}>
                                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(data.proofOfPayment) ? (
                                        <a href={proofUrl(data.proofOfPayment)} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={proofUrl(data.proofOfPayment)}
                                                alt="Transaction Receipt"
                                                style={{
                                                    width: '100%', maxHeight: 260,
                                                    objectFit: 'contain', borderRadius: 10,
                                                    border: '1.5px solid var(--d-border)',
                                                    background: 'var(--d-cream)', padding: 6,
                                                    cursor: 'zoom-in', display: 'block',
                                                }}
                                            />
                                            <small style={{ display: 'block', textAlign: 'center', marginTop: 6, color: 'var(--d-muted)', fontSize: '.75rem' }}>
                                                Click image to open full size ↗
                                            </small>
                                        </a>
                                    ) : (
                                        <a
                                            href={proofUrl(data.proofOfPayment)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                                padding: '10px 16px', borderRadius: 9,
                                                background: 'var(--d-cream)', border: '1.5px solid var(--d-border)',
                                                color: 'var(--d-orange-dk)', fontWeight: 600, fontSize: '.88rem',
                                                textDecoration: 'none',
                                            }}
                                        >
                                            <FaFileAlt /> View PDF Receipt ↗
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <div style={{ marginTop: 6, fontSize: '.88rem', color: 'var(--d-muted)', fontStyle: 'italic' }}>
                                    No proof uploaded
                                </div>
                            )}
                        </div>
                        <div><small style={{ color: 'var(--d-muted)', fontWeight: 700 }}>Status</small>
                            <div style={{ marginTop: 6 }}><span className={`status ${data.paymentStatus}`}>{data.paymentStatus}</span></div>
                        </div>
                    </>)}
                </div>
                <div style={{ marginTop: 24, textAlign: 'right', borderTop: '1.5px solid var(--d-border)', paddingTop: 16 }}>
                    <button className="btn-outline-sm" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const InfoRow = ({ label, value, highlight, mono }) => (
    <div>
        <small style={{ color: 'var(--d-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '.7rem' }}>{label}</small>
        <div style={{
            fontWeight: 600, marginTop: 3,
            ...(highlight ? { background: 'var(--d-cream)', padding: '10px 14px', borderRadius: 8, borderLeft: '4px solid var(--d-orange)' } : {}),
            ...(mono ? { fontFamily: 'monospace', background: 'var(--d-cream)', padding: '8px 12px', borderRadius: 8 } : {}),
        }}>{value}</div>
    </div>
);

const InfoMini = ({ label, value, accent }) => (
    <div><small style={{ color: 'var(--d-muted)' }}>{label}</small>
        <div style={{ fontWeight: 600, color: accent || 'var(--d-ink)' }}>{value}</div>
    </div>
);

const EditUserModal = ({ user, onSave, onClose }) => {
    const ROLES_LIST = ['admin', 'head_caregiver', 'caregiver'];
    const ROLE_LABEL = { admin: 'Admin', head_caregiver: 'Head Caregiver', caregiver: 'Caregiver' };
    const [form, setForm] = React.useState({
        firstName: user.firstName || '',
        lastName:  user.lastName  || '',
        email:     user.email     || '',
        phone:     user.phone     || '',
        role:      user.role      || 'caregiver',
    });
    const [saving, setSaving] = React.useState(false);
    const [err, setErr]       = React.useState('');

    const handleSave = async () => {
        if (!form.firstName.trim() || !form.lastName.trim()) { setErr('First and last name are required.'); return; }
        setSaving(true);
        try { await onSave(form); }
        catch (e) { setErr(e.message || 'Failed to save.'); setSaving(false); }
    };

    const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10, fontSize: '.9rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--d-font-body)', transition: 'border-color .2s' };
    const lbl = { display: 'block', fontSize: '.76rem', fontWeight: 700, color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 };
    const roleChanged = form.role !== user.role;

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }}>
            <div className="registration-modal" style={{ maxWidth: 500, padding: 0 }}>
                <div style={{ padding: '20px 26px', background: 'linear-gradient(135deg,#b85c2d,#7d3a06)', borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FaEdit style={{ color: '#fff', fontSize: '1.1rem' }} />
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: 'var(--d-font-head)', fontSize: '1.1rem' }}>Edit — {user.firstName} {user.lastName}</h4>
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
                            {ROLES_LIST.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        {roleChanged && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#FFF8E1', border: '1.5px solid #ffc107', fontSize: '.78rem', color: '#856404', display: 'flex', gap: 7, alignItems: 'center' }}>
                                <FaExclamationTriangle style={{ flexShrink: 0 }} />
                                <span>Role will change from <strong>{ROLE_LABEL[user.role] || user.role}</strong> → <strong>{ROLE_LABEL[form.role]}</strong>. This affects dashboard access.</span>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 16, borderTop: '1.5px solid var(--d-border)' }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid var(--d-border)', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--d-muted)', fontFamily: 'var(--d-font-body)' }}>Cancel</button>
                        <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: saving ? '#ccc' : 'linear-gradient(135deg,#F96B38,#D94E1B)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'var(--d-font-body)' }}>{saving ? 'Saving…' : '✓ Save Changes'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const to24 = (str) => {
    const [h, m] = (str || '00:00').split(':').map(Number);
    return h * 60 + m;
};
const from12 = (hour12, period, minute) => {
    let h24 = hour12 % 12;
    if (period === 'PM') h24 += 12;
    return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const to12Parts = (str) => {
    const [h24, m] = (str || '00:00').split(':').map(Number);
    const period = h24 >= 12 ? 'PM' : 'AM';
    let hour12 = h24 % 12;
    if (hour12 === 0) hour12 = 12;
    return { hour12, minute: m, period };
};
const formatDisplay = (str) => {
    const { hour12, minute, period } = to12Parts(str);
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
};

const SlotTimePicker = ({ value, onChange, min, max, disabled }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const minTotal = to24(min);
    const maxTotal = to24(max);
    const { hour12, minute, period } = to12Parts(value);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const hourAllowed = (h12, p) => {
        const h24 = (h12 % 12) + (p === 'PM' ? 12 : 0);
        const start = h24 * 60;
        const end = h24 * 60 + 59;
        return end >= minTotal && start <= maxTotal;
    };
    const minuteAllowed = (m, h12 = hour12, p = period) => {
        const h24 = (h12 % 12) + (p === 'PM' ? 12 : 0);
        const total = h24 * 60 + m;
        return total >= minTotal && total <= maxTotal;
    };
    const periodAllowed = (p) => [1,2,3,4,5,6,7,8,9,10,11,12].some(h => hourAllowed(h, p));

    const commit = (h12, p, m) => {
        let candidateMinute = m;
        if (!minuteAllowed(candidateMinute, h12, p)) {
            candidateMinute = [0, 15, 30, 45].find(mm => minuteAllowed(mm, h12, p)) ?? 0;
        }
        onChange(from12(h12, p, candidateMinute));
    };

    const pickHour = (h12) => { if (hourAllowed(h12, period)) commit(h12, period, minute); };
    const pickMinute = (m) => { if (minuteAllowed(m)) commit(hour12, period, m); };
    const pickPeriod = (p) => {
        if (!periodAllowed(p)) return;
        const newHour = hourAllowed(hour12, p) ? hour12 : [1,2,3,4,5,6,7,8,9,10,11,12].find(h => hourAllowed(h, p));
        commit(newHour, p, minute);
    };

    const colStyle = { display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 168, padding: '4px 0' };
    const itemStyle = (active, allowed) => ({
        padding: '5px 12px',
        fontSize: '0.85rem',
        textAlign: 'center',
        cursor: allowed ? 'pointer' : 'default',
        color: !allowed ? '#D8CFC4' : (active ? '#E65100' : '#1A0A00'),
        fontWeight: active && allowed ? 700 : 500,
        background: active && allowed ? '#FFF3E0' : 'transparent',
        userSelect: 'none'
    });

    return (
        <div ref={wrapRef} style={{ position: 'relative', flex: '1 1 auto', minWidth: 110 }}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 7,
                    border: '1.5px solid #FFB74D',
                    background: disabled ? '#F5EFE8' : '#fff',
                    color: disabled ? '#B3A99C' : '#1A0A00',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    boxSizing: 'border-box'
                }}
            >
                {formatDisplay(value)}
                <FaClock size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
            </button>

            {open && !disabled && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    zIndex: 20,
                    background: '#fff',
                    border: '1.5px solid #E8D6CC',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    display: 'flex',
                    minWidth: 170
                }}>
                    <div style={{ ...colStyle, borderRight: '1px solid #F0E5DA' }}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                            <div key={h} style={itemStyle(h === hour12, hourAllowed(h, period))} onClick={() => pickHour(h)}>
                                {String(h).padStart(2, '0')}
                            </div>
                        ))}
                    </div>
                    <div style={{ ...colStyle, borderRight: '1px solid #F0E5DA' }}>
                        {[0, 15, 30, 45].map(m => (
                            <div key={m} style={itemStyle(m === minute, minuteAllowed(m))} onClick={() => pickMinute(m)}>
                                {String(m).padStart(2, '0')}
                            </div>
                        ))}
                    </div>
                    <div style={colStyle}>
                        {['AM', 'PM'].map(p => (
                            <div key={p} style={itemStyle(p === period, periodAllowed(p))} onClick={() => pickPeriod(p)}>
                                {p}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const notifRef = useRef(null);
    const dropdownRef = useRef(null);
    const searchRef = useRef(null);

    const [activeSection, setActiveSection] = useState(location.state?.section || 'overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [readIds, setReadIds] = useState(() => {
        try {
            const stored = localStorage.getItem('admin_read_notif_ids');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch { return new Set(); }
    });
    const [toastMessage, setToastMessage] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [bookingPage, setBookingPage] = useState(1);
    const [donationPage, setDonationPage] = useState(1);
    const [inventoryPage, setInventoryPage] = useState(1);
    const itemsPerPage = 10;

    const [alertSearch, setAlertSearch] = useState('');
    const [alertTypeFilter, setAlertTypeFilter] = useState('All');
    const [alertStatusFilter, setAlertStatusFilter] = useState('All');
    const [alertDateFilter, setAlertDateFilter] = useState('All');
    const [alertPage, setAlertPage] = useState(1);

    const [bookings, setBookings] = useState([]);
    const [donations, setDonations] = useState([]);
    const [staff, setStaff] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [residentStats, setResidentStats] = useState({ totalResidents: 0, averageAge: 0, conditionStats: [] });
    const [dbAlerts, setDbAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [showAddInventory, setShowAddInventory] = useState(false);
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, type: '', data: null });

    const [reasonModal, setReasonModal] = useState({
        isOpen: false,
        action: null,
        userId: null,
        userName: '',
        currentStatus: null,
        reason: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        notes: ''
    });
    const [actionLoading, setActionLoading] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', onConfirm: null, danger: false, confirmLabel: 'Confirm'
    });
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const [stats, setStats] = useState({
        totalResidents: 0, activeStaff: 0, pendingBookings: 0,
        totalDonations: 0, totalDonationAmount: 0, lowStockItems: 0,
        complianceRate: null, missedMeds: null, delayedMeds: null
    });

    const DEFAULT_AVAILABILITY = {
        morningEnabled: true,
        morningStart: '09:00',
        morningEnd: '11:00',
        afternoonEnabled: true,
        afternoonStart: '15:00',
        afternoonEnd: '17:00',
        maxPerSlot: 10,
        arrivalNote: 'Please arrive 10 minutes early',
        rules: [
            'Valid ID required upon arrival',
            'No photography without permission',
            'Respect resident privacy and dignity',
            'Follow facility staff instructions'
        ]
    };

    const [editStatusModal, setEditStatusModal] = useState({ isOpen: false, booking: null, newStatus: '' });
    const [stockRequests, setStockRequests] = useState([]);
    const [rejectionModal, setRejectionModal] = useState({ isOpen: false, bookingId: null, booking: null, reason: '' });
    const [approvalModal, setApprovalModal] = useState({ isOpen: false, bookingId: null, booking: null, availability: DEFAULT_AVAILABILITY, editTimeSlots: false });

    const isMorningBooking = (booking) => booking?.visitTime === '09:00';
    const [openDropdown, setOpenDropdown] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const { on, off } = useSocket();

    const toast = (msg, type = 'success') => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const showConfirm = (title, message, onConfirm, danger = false, confirmLabel = 'Confirm') => {
        setConfirmModal({ isOpen: true, title, message, onConfirm, danger, confirmLabel });
    };
    const closeConfirm = () => setConfirmModal(p => ({ ...p, isOpen: false }));

    useEffect(() => {
        const handleNewBooking = (booking) => {
            setBookings(prev => [booking, ...prev]);
            setStats(p => ({ ...p, pendingBookings: p.pendingBookings + 1 }));
        };
        const handleUpdateBooking = (updated) => {
            setBookings(prev => prev.map(b => b._id === updated._id ? { ...b, ...updated } : b));
            setStats(p => ({
                ...p,
                pendingBookings: Math.max(0,
                    updated.status !== 'pending' ? p.pendingBookings - 1 : p.pendingBookings
                ),
            }));
        };
        const handleDeleteBooking = (id) => {
            setBookings(prev => {
                const removed = prev.find(b => b._id === id);
                if (removed?.status === 'pending') {
                    setStats(p => ({ ...p, pendingBookings: Math.max(0, p.pendingBookings - 1) }));
                }
                return prev.filter(b => b._id !== id);
            });
        };

        const handleStaffStatusUpdated = (updated) => {
            setStaff(prev => {
                const existing = prev.find(m => m._id === updated._id);
                const wasActive = existing?.status === 'active' || existing?.isActive;
                const isNowActive = updated.status === 'active';
                if (wasActive !== isNowActive) {
                    setStats(p => ({
                        ...p,
                        activeStaff: isNowActive
                            ? p.activeStaff + 1
                            : Math.max(0, p.activeStaff - 1),
                    }));
                }
                return prev.map(m => m._id === updated._id ? { ...m, ...updated } : m);
            });
        };
        const handleStaffListUpdated = () => { fetchStaffList(); };

        const handleStockRequest = (req) => {
            setStockRequests(prev => [req, ...prev]);
        };
        const handleInventoryUpdate = () => {
            fetchApi('/admin/inventory?limit=500').then(d => {
                if (d.success) {
                    const fresh = d.data || [];
                    setInventory(fresh);
                    setStats(p => ({
                        ...p,
                        lowStockItems: fresh.filter(i => i.quantity <= (i.minThreshold || 10)).length,
                    }));
                }
            });
        };

        const handleStatsUpdated = (data) => {
            setStats(p => ({ ...p, ...data }));
        };

        const handleResidentsUpdated = () => { fetchResidentStats(); };

        on('new_booking',          handleNewBooking);
        on('update_booking',       handleUpdateBooking);
        on('delete_booking',       handleDeleteBooking);
        on('staff_status_updated', handleStaffStatusUpdated);
        on('staff_list_updated',   handleStaffListUpdated);
        on('stock_request',        handleStockRequest);
        on('inventory_update',     handleInventoryUpdate);
        on('stats_updated',        handleStatsUpdated);
        on('residentsUpdated',     handleResidentsUpdated);

        return () => {
            off('new_booking',          handleNewBooking);
            off('update_booking',       handleUpdateBooking);
            off('delete_booking',       handleDeleteBooking);
            off('staff_status_updated', handleStaffStatusUpdated);
            off('staff_list_updated',   handleStaffListUpdated);
            off('stock_request',        handleStockRequest);
            off('inventory_update',     handleInventoryUpdate);
            off('stats_updated',        handleStatsUpdated);
            off('residentsUpdated',     handleResidentsUpdated);
        };
    }, [on, off]);

    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null);
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setGlobalSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 250);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        const built = buildNotifications(bookings, donations, staff, inventory);
        setNotifications(built);
    }, [bookings, donations, staff, inventory]);

    const unreadCount = useMemo(() =>
        notifications.filter(n => !readIds.has(n.id)).length,
        [notifications, readIds]);

    const markAllRead = () => {
        const ids = new Set(notifications.map(n => n.id));
        setReadIds(ids);
        try { localStorage.setItem('admin_read_notif_ids', JSON.stringify([...ids])); } catch {}
    };
    const markRead = (id) => {
        setReadIds(prev => {
            const next = new Set([...prev, id]);
            try { localStorage.setItem('admin_read_notif_ids', JSON.stringify([...next])); } catch {}
            return next;
        });
    };

    const unifiedAlerts = useMemo(
        () => buildUnifiedAlerts(notifications, dbAlerts, readIds),
        [notifications, dbAlerts, readIds]
    );

    const filteredAlerts = useMemo(() => {
        const q = alertSearch.trim().toLowerCase();
        return unifiedAlerts.filter(a => {
            const searchMatch = !q
                || a.title?.toLowerCase().includes(q)
                || a.message?.toLowerCase().includes(q)
                || a.rawType?.toLowerCase().includes(q)
                || (a.raw?.details && JSON.stringify(a.raw.details).toLowerCase().includes(q));

            const typeMatch = alertTypeFilter === 'All' || a.bucket === alertTypeFilter;

            const statusMatch = alertStatusFilter === 'All'
                || (alertStatusFilter === 'Unread' && !a.isRead)
                || (alertStatusFilter === 'Read' && a.isRead);

            const dateMatch = matchesAlertDateFilter(a.time, alertDateFilter);

            return searchMatch && typeMatch && statusMatch && dateMatch;
        });
    }, [unifiedAlerts, alertSearch, alertTypeFilter, alertStatusFilter, alertDateFilter]);

    const pagedAlerts = filteredAlerts.slice((alertPage - 1) * itemsPerPage, alertPage * itemsPerPage);

    useEffect(() => { setAlertPage(1); }, [alertSearch, alertTypeFilter, alertStatusFilter, alertDateFilter]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredAlerts.length / itemsPerPage));
        if (alertPage > maxPage) setAlertPage(maxPage);
    }, [filteredAlerts.length, alertPage]);

    const clearAlertFilters = () => {
        setAlertSearch('');
        setAlertTypeFilter('All');
        setAlertStatusFilter('All');
        setAlertDateFilter('All');
    };

    const combinedUnreadCount = useMemo(
        () => unifiedAlerts.filter(a => !a.isRead).length,
        [unifiedAlerts]
    );

    const markDbAlertRead = async (alertId) => {
        const res = await fetchApi(`/alerts/${alertId}/read`, { method: 'PUT' });
        if (res.success) {
            setDbAlerts(prev => prev.map(a => a._id === alertId ? { ...a, isRead: true } : a));
        }
    };

    const markAllAlertsRead = async () => {
        markAllRead();
        const res = await fetchApi('/alerts/mark-all-read', { method: 'PUT' });
        if (res.success) {
            setDbAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
        }
    };

    const filteredStaff = useMemo(() => {
        const q = debouncedSearchQuery.toLowerCase().trim();
        if (!q) return staff;
        return staff.filter(m =>
            `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            m.username?.toLowerCase().includes(q) ||
            m.role?.toLowerCase().includes(q) ||
            m.staffId?.toLowerCase().includes(q) ||
            m.phone?.toLowerCase().includes(q)
        );
    }, [staff, debouncedSearchQuery]);

    const filteredBookings = useMemo(() => {
        const q = debouncedSearchQuery.toLowerCase().trim();
        if (!q) return bookings;
        return bookings.filter(b =>
            b.name?.toLowerCase().includes(q) ||
            b.email?.toLowerCase().includes(q) ||
            b.phone?.toLowerCase().includes(q) ||
            b.purpose?.toLowerCase().includes(q) ||
            b.status?.toLowerCase().includes(q)
        );
    }, [bookings, debouncedSearchQuery]);

    const filteredDonations = useMemo(() => {
        const q = debouncedSearchQuery.toLowerCase().trim();
        if (!q) return donations;
        return donations.filter(d =>
            d.donorName?.toLowerCase().includes(q) ||
            d.email?.toLowerCase().includes(q) ||
            d.donationType?.toLowerCase().includes(q) ||
            d.paymentStatus?.toLowerCase().includes(q)
        );
    }, [donations, debouncedSearchQuery]);

    const filteredInventory = useMemo(() => {
        const q = debouncedSearchQuery.toLowerCase().trim();
        if (!q) return inventory;
        return inventory.filter(i =>
            i.name?.toLowerCase().includes(q) ||
            i.category?.toLowerCase().includes(q) ||
            i.status?.toLowerCase().includes(q)
        );
    }, [inventory, debouncedSearchQuery]);

    const globalSearchResults = useMemo(() => {
        const q = debouncedSearchQuery.toLowerCase().trim();
        if (!q) return null;

        const MAX_PER_GROUP = 5;

        const staffMatches = staff.filter(m =>
            `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            m.role?.toLowerCase().includes(q)
        ).slice(0, MAX_PER_GROUP).map(m => ({
            id: m._id, label: `${m.firstName} ${m.lastName}`, sub: m.role || 'staff', section: 'staff',
        }));

        const inventoryMatches = inventory.filter(i =>
            i.name?.toLowerCase().includes(q) ||
            i.category?.toLowerCase().includes(q) ||
            i.status?.toLowerCase().includes(q)
        ).slice(0, MAX_PER_GROUP).map(i => ({
            id: i._id, label: i.name, sub: `${i.category || 'General'} • Qty: ${i.quantity}`, section: 'inventory',
        }));

        const bookingMatches = bookings.filter(b =>
            b.name?.toLowerCase().includes(q) ||
            b.email?.toLowerCase().includes(q) ||
            b.purpose?.toLowerCase().includes(q) ||
            b.status?.toLowerCase().includes(q)
        ).slice(0, MAX_PER_GROUP).map(b => ({
            id: b._id, label: b.name || 'Booking', sub: b.status || '', section: 'booking',
        }));

        const donationMatches = donations.filter(d =>
            d.donorName?.toLowerCase().includes(q) ||
            d.email?.toLowerCase().includes(q) ||
            d.donationType?.toLowerCase().includes(q) ||
            d.paymentStatus?.toLowerCase().includes(q)
        ).slice(0, MAX_PER_GROUP).map(d => ({
            id: d._id, label: d.donorName || 'Donor', sub: `${d.donationType || ''} • ${d.paymentStatus || ''}`, section: 'donation',
        }));

        const notificationMatches = notifications.filter(n =>
            n.body?.toLowerCase().includes(q) || n.title?.toLowerCase().includes(q)
        ).slice(0, MAX_PER_GROUP).map(n => ({
            id: n.id, label: n.title || 'Notification', sub: n.body || '', section: NOTIF_TYPES[n.type]?.section || null,
        }));

        const groups = [
            { key: 'staff', label: 'Staff', items: staffMatches },
            { key: 'inventory', label: 'Inventory', items: inventoryMatches },
            { key: 'booking', label: 'Bookings', items: bookingMatches },
            { key: 'donation', label: 'Donations', items: donationMatches },
            { key: 'notification', label: 'Notifications', items: notificationMatches },
        ].filter(g => g.items.length > 0);

        return { groups, total: groups.reduce((sum, g) => sum + g.items.length, 0) };
    }, [staff, inventory, bookings, donations, notifications, debouncedSearchQuery]);

    const handleGlobalResultClick = (section) => {
        if (section) setActiveSection(section);
        setGlobalSearchOpen(false);
    };

    useEffect(() => {
        setCurrentPage(1);
        setBookingPage(1);
        setDonationPage(1);
        setInventoryPage(1);
    }, [activeSection, debouncedSearchQuery]);

    useEffect(() => {
        if (location.state?.section) {
            setActiveSection(location.state.section);

            navigate(location.pathname, { replace: true, state: {} });
        }

    }, [location.state?.section]);

    const sectionHistoryRef = useRef([]);
    const prevSectionRef = useRef(activeSection);
    useEffect(() => {
        if (prevSectionRef.current !== activeSection) {
            sectionHistoryRef.current.push(prevSectionRef.current);
            prevSectionRef.current = activeSection;
        }
    }, [activeSection]);

    const handleBackNavigation = () => {
        const previous = sectionHistoryRef.current.pop();

        setActiveSection(previous || 'overview');
    };

    const fetchApi = useCallback(async (endpoint, options = {}) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                    ...options.headers
                }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            setApiError(`Server error: ${err.message}`);
            return { success: false };
        }
    }, []);

    const fetchResidentStats = useCallback(async () => {
        const d = await fetchApi('/residents/statistics');
        if (d.success && d.data) {
            setResidentStats(d.data);
            return d.data;
        }
        return null;
    }, [fetchApi]);

    const fetchStaffList = useCallback(async () => {
        const d = await fetchApi('/admin/staff');
        if (d.success) setStaff(d.staff || []);
        return d;
    }, [fetchApi]);

    const fetchDbAlerts = useCallback(async () => {
        const d = await fetchApi('/alerts');
        if (d.success) setDbAlerts(d.data || []);
    }, [fetchApi]);

    const loadAllData = useCallback(async (silent = false) => {
        if (silent) setIsAutoRefreshing(true); else setLoading(true);
        setApiError(null);
        const [bRes, dRes, sRes, iRes, complianceRes] = await Promise.all([
            fetchApi('/bookings?limit=100'),
            fetchApi('/donations?limit=100'),
            fetchApi('/stats'),
            fetchApi('/inventory?limit=100'),
            fetchApi('/medications/compliance/stats'),
        ]);
        if (bRes.success) setBookings(bRes.data || []);
        if (dRes.success) setDonations(dRes.data || []);
        if (sRes.success && sRes.data) setStats(p => ({ ...p, ...sRes.data }));
        if (iRes.success) setInventory(iRes.data || []);

        if (complianceRes.success && complianceRes.stats) {
            setStats(p => ({
                ...p,
                complianceRate: complianceRes.stats.complianceRate,
                missedMeds: complianceRes.stats.missed,
                delayedMeds: complianceRes.stats.delayed,
                overdueCount: complianceRes.stats.overdue,
                administeredCount: complianceRes.stats.administered
            }));
        }

        await Promise.all([fetchResidentStats(), fetchStaffList(), fetchDbAlerts()]);
        setLastUpdated(new Date());
        if (silent) setIsAutoRefreshing(false); else setLoading(false);
    }, [fetchApi, fetchResidentStats, fetchStaffList, fetchDbAlerts]);

    useEffect(() => {
        loadAllData(false);

    }, [fetchApi]);

    useEffect(() => {
        const REFRESH_INTERVAL_MS = 30000;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadAllData(true);
            }
        }, REFRESH_INTERVAL_MS);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                loadAllData(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [loadAllData]);

    const realLowStockCount = useMemo(() =>
        inventory.filter(i => i.quantity <= (i.minThreshold || 10)).length,
        [inventory]);

    const handleRefresh = async () => {
        await loadAllData(false);
        toast('All data refreshed successfully');
    };

    const handleLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = async () => {
        await logout();
        navigate(HIDDEN_LOGIN_PATH);
    };

    const renderPagination = (total, page, setPage, perPage = itemsPerPage) => {
        const pages = Math.ceil(total / perPage);
        if (pages <= 1) return null;

        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(pages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        const pageNumbers = [];
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }

        return (
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderTop: '1px solid #E8D6CC',
                background: '#FFF8F3',
                marginTop: 16,
                borderRadius: '0 0 12px 12px'
            }}>
                <span style={{ fontSize: '0.8rem', color: '#7A5C4E' }}>
                    Showing {Math.min((page - 1) * perPage + 1, total)} – {Math.min(page * perPage, total)} of {total}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid #E8D6CC',
                            background: page === 1 ? '#f5f5f5' : '#FFF8F3',
                            cursor: page === 1 ? 'not-allowed' : 'pointer',
                            opacity: page === 1 ? 0.5 : 1,
                            fontFamily: "'DM Sans', sans-serif"
                        }}
                    >
                        <FaChevronLeft size={11} /> Prev
                    </button>
                    {pageNumbers.map(n => (
                        <button
                            key={n}
                            onClick={() => setPage(n)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: page === n ? 'none' : '1px solid #E8D6CC',
                                background: page === n ? '#F96B38' : '#FFF8F3',
                                color: page === n ? '#fff' : '#7A5C4E',
                                fontWeight: page === n ? 600 : 400,
                                cursor: 'pointer',
                                fontFamily: "'DM Sans', sans-serif"
                            }}
                        >
                            {n}
                        </button>
                    ))}
                    <button
                        disabled={page === pages}
                        onClick={() => setPage(p => p + 1)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid #E8D6CC',
                            background: page === pages ? '#f5f5f5' : '#FFF8F3',
                            cursor: page === pages ? 'not-allowed' : 'pointer',
                            opacity: page === pages ? 0.5 : 1,
                            fontFamily: "'DM Sans', sans-serif"
                        }}
                    >
                        Next <FaChevronRight size={11} />
                    </button>
                </div>
            </div>
        );
    };

    const handleRegisterSuccess = async () => {
        fetchStaffList();
        toast('Account created! Login credentials have been emailed to the new user.');
    };

    const toggleStaffStatus = async (id, cur) => {
        const next = cur === 'active' ? 'inactive' : 'active';
        const member = staff.find(m => m._id === id);
        showConfirm(
            `${next === 'active' ? 'Activate' : 'Deactivate'} Staff`,
            `Are you sure you want to ${next === 'active' ? 'activate' : 'deactivate'} ${member?.firstName} ${member?.lastName}?`,
            async () => {
                closeConfirm();
                setStaff(staff.map(m => m._id === id ? { ...m, isActive: next === 'active', status: next === 'active' ? 'active' : 'inactive' } : m));
                await fetchApi(`/admin/staff/${id}/status`, {
                    method: 'PUT', body: JSON.stringify({ status: next })
                });
                toast(`${member?.firstName} ${member?.lastName} has been ${next === 'active' ? 'activated' : 'deactivated'}.`);
                await fetchStaffList();
            },
            next === 'inactive',
            next === 'active' ? 'Activate' : 'Deactivate'
        );
    };

    const handleRestrictUser = (userId, userName, currentStatus) => {
        setReasonModal({
            isOpen: true,
            action: 'restrict',
            userId,
            userName,
            currentStatus,
            reason: '',
            effectiveDate: new Date().toISOString().slice(0, 10),
            notes: ''
        });
    };

    const handleDeactivateUser = (userId, userName, currentStatus) => {
        setReasonModal({
            isOpen: true,
            action: 'deactivate',
            userId,
            userName,
            currentStatus,
            reason: '',
            effectiveDate: new Date().toISOString().slice(0, 10),
            notes: ''
        });
    };

    const confirmPersonnelAction = async () => {
        const { action, userId, reason, effectiveDate, notes, userName, currentStatus } = reasonModal;

        let newStatus = 'inactive';
        let actionMessage = '';

        switch(action) {
            case 'restrict':
                newStatus = 'restricted';
                actionMessage = 'restricted';
                break;
            case 'deactivate':
                newStatus = 'deactivated';
                actionMessage = 'deactivated permanently';
                break;
            case 'suspend':
                newStatus = 'suspended';
                actionMessage = 'suspended';
                break;
            case 'terminate':
                newStatus = 'terminated';
                actionMessage = 'terminated';
                break;
            default:
                return;
        }

        setActionLoading(true);

        try {
            await fetchApi(`/admin/staff/${userId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus, reason })
            });

            fetchApi(`/admin/staff/${userId}/action-log`, {
                method: 'POST',
                body: JSON.stringify({ action, reason, effectiveDate, notes, performedBy: user._id, newStatus })
            }).catch(() => {});

            setStaff(staff.map(m =>
                m._id === userId
                    ? { ...m, isActive: false, status: newStatus, actionReason: reason, actionDate: effectiveDate }
                    : m
            ));

            toast(`${userName} has been ${actionMessage}. Reason: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''}`);
            setReasonModal({ isOpen: false, action: null, userId: null, userName: '', currentStatus: null, reason: '', effectiveDate: '', notes: '' });

            await fetchStaffList();

        } catch (error) {
            console.error('Action error:', error);
            toast('Failed to perform action. Please try again.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReactivateUser = async (userId, userName) => {
        showConfirm(
            'Reactivate Account',
            `Are you sure you want to reactivate ${userName}'s account? This will restore their access.`,
            async () => {
                closeConfirm();
                setLoading(true);
                try {
                    await fetchApi(`/admin/staff/${userId}/status`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: 'active' })
                    });

                    fetchApi(`/admin/staff/${userId}/action-log`, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'reactivate', reason: 'Account reactivated', performedBy: user._id, newStatus: 'active' })
                    }).catch(() => {});

                    setStaff(staff.map(m => m._id === userId ? { ...m, isActive: true, status: 'active' } : m));
                    toast(`${userName} has been reactivated.`);
                    await fetchStaffList();
                } catch (error) {
                    toast('Failed to reactivate account.', 'error');
                } finally {
                    setLoading(false);
                }
            },
            false,
            'Reactivate'
        );
    };

    const deleteStaff = async (id) => {
        const member = staff.find(m => m._id === id);
        showConfirm(
            'Delete Staff Member',
            `Are you sure you want to permanently delete ${member?.firstName} ${member?.lastName}? This action cannot be undone.`,
            async () => {
                closeConfirm();
                setStaff(staff.filter(m => m._id !== id));
                await fetchApi(`/admin/staff/${id}`, { method: 'DELETE' });
                toast(`${member?.firstName} ${member?.lastName} has been deleted.`);
                await fetchStaffList();
            },
            true,
            'Delete'
        );
    };

    const updateBookingStatus = async (id, status, rejectionReason = '', extra = {}) => {
        const booking = bookings.find(b => b._id === id);
        const prevStatus = booking?.status;
        const actionLabel = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Complete';

        showConfirm(
            `${actionLabel} Booking`,
            `Are you sure you want to ${actionLabel.toLowerCase()} the booking for "${booking?.name}"?${status === 'rejected' ? '\n\nThe visitor will be notified via email.' : ''}`,
            async () => {
                closeConfirm();
                setBookings(prev => prev.map(b => b._id === id ? { ...b, status } : b));
                if (prevStatus === 'pending' && status !== 'pending') {
                    setStats(p => ({ ...p, pendingBookings: Math.max(0, p.pendingBookings - 1) }));
                }
                const res = await fetchApi(`/bookings/${id}/status`, {
                    method: 'PUT', body: JSON.stringify({ status, rejectionReason, ...extra })
                });
                if (!res.success) {
                    setBookings(prev => prev.map(b => b._id === id ? { ...b, status: prevStatus } : b));
                    if (prevStatus === 'pending' && status !== 'pending') {
                        setStats(p => ({ ...p, pendingBookings: p.pendingBookings + 1 }));
                    }
                    toast('Failed to update booking status.', 'error');
                    return;
                }
                toast(`Booking ${actionLabel.toLowerCase()}d successfully.`);
            },
            status === 'rejected',
            actionLabel
        );
    };

    const handleRejectWithReason = (bookingId) => {
        const booking = bookings.find(b => b._id === bookingId);
        setRejectionModal({ isOpen: true, bookingId, booking, reason: '' });
    };

    const confirmRejection = async () => {
        if (!rejectionModal.reason.trim() || rejectionModal.reason.trim().length < 5) {
            toast('Please provide a rejection reason (minimum 5 characters)', 'error');
            return;
        }
        await updateBookingStatus(rejectionModal.bookingId, 'rejected', rejectionModal.reason);
        setRejectionModal({ isOpen: false, bookingId: null, booking: null, reason: '' });
    };

    const handleApproveWithDetails = (bookingId) => {
        const booking = bookings.find(b => b._id === bookingId);
        const bookedMorning = isMorningBooking(booking);
        setApprovalModal({
            isOpen: true,
            bookingId,
            booking,
            editTimeSlots: false,
            availability: {
                ...DEFAULT_AVAILABILITY,
                rules: [...DEFAULT_AVAILABILITY.rules],

                morningEnabled: bookedMorning,
                afternoonEnabled: !bookedMorning
            }
        });
    };

    const updateAvailabilityField = (field, value) => {
        setApprovalModal(prev => ({ ...prev, availability: { ...prev.availability, [field]: value } }));
    };

    const SLOT_BOUNDS = {
        morningStart: { min: '09:00', max: '11:00' },
        morningEnd: { min: '09:00', max: '11:00' },
        afternoonStart: { min: '15:00', max: '17:00' },
        afternoonEnd: { min: '15:00', max: '17:00' }
    };

    const clampToSlotBounds = (field, value) => {
        const bounds = SLOT_BOUNDS[field];
        if (!bounds || !value) return value;
        if (value < bounds.min) return bounds.min;
        if (value > bounds.max) return bounds.max;
        return value;
    };

    const updateSlotTimeField = (field, value) => {
        updateAvailabilityField(field, clampToSlotBounds(field, value));
    };

    const availInputStyle = (enabled, width) => ({
        width: width || 130,
        padding: '7px 10px',
        borderRadius: 7,
        border: '1.5px solid #FFB74D',
        background: enabled ? '#fff' : '#F5EFE8',
        color: enabled ? '#1A0A00' : '#B3A99C',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.85rem',
        outline: 'none',
        boxSizing: 'border-box'
    });

    const confirmApproval = async () => {
        const a = approvalModal.availability;

        if (!a.morningEnabled && !a.afternoonEnabled) {
            toast('Select at least one available visiting slot.', 'error');
            return;
        }

        const slots = [];
        if (a.morningEnabled) slots.push({ label: 'Morning Slot', start: a.morningStart, end: a.morningEnd });
        if (a.afternoonEnabled) slots.push({ label: 'Afternoon Slot', start: a.afternoonStart, end: a.afternoonEnd });

        const facilityAvailability = {
            slots,
            maxPerSlot: Number(a.maxPerSlot) || 0,
            arrivalNote: a.arrivalNote.trim(),
            rules: a.rules.map(r => r.trim()).filter(Boolean)
        };

        await updateBookingStatus(approvalModal.bookingId, 'approved', '', { facilityAvailability });
        setApprovalModal({ isOpen: false, bookingId: null, booking: null, availability: DEFAULT_AVAILABILITY, editTimeSlots: false });
    };

    const updateDonationStatus = async (id, paymentStatus) => {
        const donation = donations.find(d => d._id === id);
        showConfirm(
            'Update Donation Status',
            `Mark donation from "${donation?.donorName}" (₱${donation?.amount?.toLocaleString()}) as ${paymentStatus}?`,
            async () => {
                closeConfirm();
                setDonations(prev => prev.map(d => d._id === id ? { ...d, paymentStatus } : d));
                const res = await fetchApi(`/donations/${id}/payment`, {
                    method: 'PUT', body: JSON.stringify({ paymentStatus })
                });
                if (!res.success) {
                    setDonations(prev => prev.map(d => d._id === id ? { ...d, paymentStatus: donation?.paymentStatus } : d));
                    toast('Failed to update donation status.', 'error');
                    return;
                }
                toast(`Donation marked as ${paymentStatus}.`);
            },
            false,
            'Confirm'
        );
    };

    const handleAddInventory = async (item) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/admin/inventory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    name: item.name,
                    category: item.category,
                    quantity: Number(item.quantity),
                    unit: item.unit,
                    minThreshold: Number(item.minThreshold),
                    expirationDate: item.doesNotExpire ? undefined : (item.expirationDate || undefined),
                    doesNotExpire: !!item.doesNotExpire,
                    brand: item.brand || undefined,
                    dosage: item.dosage || undefined,
                    supplier: item.supplier || undefined,
                    notes: item.notes || '',
                }),
            });
            const data = await res.json();
            if (data.success && data.data) {
                setInventory(prev => [data.data, ...prev]);
                toast('Inventory item added successfully.');
                setShowAddInventory(false);
                return { success: true };
            }

            const message = data.message || 'Failed to add inventory item. Please check the details and try again.';
            toast(message, 'error');
            return { success: false, message };
        } catch (err) {
            console.error('Add inventory error:', err);
            const message = 'Could not reach the server. Please check your connection and try again.';
            toast(message, 'error');
            return { success: false, message };
        }
    };

    const handleViewDetails = (type, data) => setDetailsModal({ isOpen: true, type, data });
    const closeDetailsModal = () => setDetailsModal({ isOpen: false, type: '', data: null });

    const handleExportPDF = (type = 'bookings') => {
        try {
            const doc = new jsPDF();
            const now = new Date().toLocaleString('en-PH');

            doc.setFontSize(20);
            doc.setTextColor(184, 92, 45);
            doc.text('Kanang-Alalay Care Facility', 14, 20);

            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`, 14, 32);

            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.text(`Generated: ${now}`, 14, 40);

            let startY = 50;

            if (type === 'bookings') {
                const dataToExport = searchQuery && filteredBookings.length !== bookings.length ? filteredBookings : bookings;
                autoTable(doc, {
                    head: [['Visitor Name', 'Email', 'Phone', 'Visit Date', 'Time', 'Purpose', 'Visitors', 'Status']],
                    body: dataToExport.slice(0, 500).map(b => [
                        b.name || `${b.firstName || ''} ${b.lastName || ''}`,
                        b.email || '—',
                        b.phone || '—',
                        new Date(b.visitDate).toLocaleDateString(),
                        b.visitTime || '—',
                        b.purpose || '—',
                        b.numberOfVisitors || '—',
                        b.status || 'pending'
                    ]),
                    startY: startY,
                    headStyles: { fillColor: [184, 92, 45], textColor: [255, 255, 255] },
                    alternateRowStyles: { fillColor: [255, 248, 243] },
                    margin: { left: 14, right: 14 }
                });
            } else if (type === 'donations') {
                const dataToExport = searchQuery && filteredDonations.length !== donations.length ? filteredDonations : donations;
                autoTable(doc, {
                    head: [['Donor Name', 'Email', 'Phone', 'Amount', 'Type', 'Status', 'Receipt #']],
                    body: dataToExport.slice(0, 500).map(d => [
                        d.donorName || '—',
                        d.email || '—',
                        d.phone || '—',
                        `₱${(d.amount || 0).toLocaleString()}`,
                        d.donationType || '—',
                        d.paymentStatus || 'pending',
                        d.receiptNumber || '—'
                    ]),
                    startY: startY,
                    headStyles: { fillColor: [40, 167, 69], textColor: [255, 255, 255] },
                    alternateRowStyles: { fillColor: [240, 255, 244] },
                    margin: { left: 14, right: 14 }
                });
            }

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    `Kanang-Alalay • Page ${i} of ${pageCount} • ${new Date().toLocaleDateString()}`,
                    doc.internal.pageSize.getWidth() / 2,
                    doc.internal.pageSize.getHeight() - 10,
                    { align: 'center' }
                );
            }

            doc.save(`Kanang-Alalay_${type}_${Date.now()}.pdf`);
            toast(`${type.charAt(0).toUpperCase() + type.slice(1)} report exported successfully.`);
        } catch (error) {
            console.error('PDF export error:', error);
            toast('Failed to generate PDF report.', 'error');
        }
    };

    const handleEditBooking = (b) => {
        setEditStatusModal({ isOpen: true, booking: b, newStatus: b.status });
    };

    const getSearchPlaceholder = () => {
        switch (activeSection) {
            case 'staff':
            case 'booking':
                return 'Search by name, email, phone, or status…';
            case 'donation':
                return 'Search by donor name, email, donation type, or status…';
            case 'inventory':
                return 'Search by item name, category, or status…';
            case 'roster':
                return 'Search staff by name, role, or shift…';
            default:
                return 'Search across dashboard…';
        }
    };

    const renderOverview = () => (
        <OverviewTab
            stats={stats}
            activities={[]}
            setActiveSection={setActiveSection}
            bookings={bookings}
            donations={donations}
            staff={staff}
            inventory={inventory}
            residentStats={residentStats}
            lastUpdated={lastUpdated}
            isAutoRefreshing={isAutoRefreshing}
            onRefresh={handleRefresh}
        />
    );

    const _renderOverview_OLD = () => (
        <div>
            {apiError && (
                <div className="api-error-banner" style={{ background: '#f8d7da', color: '#721c24', padding: '12px 16px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FaExclamationCircle /> {apiError}
                    <button onClick={() => setApiError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' }}><FaTimes /></button>
                </div>
            )}
            <div className="welcome-banner card-white" style={{ padding: '24px', borderRadius: 16, marginBottom: 24, background: 'linear-gradient(135deg, #FFF8F3, #fff)' }}>
                <div className="welcome-text">
                    <h2 style={{ margin: '0 0 8px 0', color: '#1A0A00' }}>Welcome back, {user?.firstName} {user?.lastName}</h2>
                    <p style={{ margin: 0, color: '#7A5C4E' }}>
                        {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        {' '}·{' '}
                        {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <button className="btn-outline-sm" onClick={handleRefresh} style={{ marginTop: 12 }} title="Refresh all data">
                    <FaSync /> Refresh Data
                </button>
            </div>

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
                {[
                    { bg: '#b85c2d', icon: <FaUsers />, val: stats.totalResidents || 71, label: 'Total Residents', section: null },
                    { bg: '#28a745', icon: <FaUserMd />, val: stats.activeStaff, label: 'Active Staff', section: 'roster' },
                    { bg: '#ffc107', icon: <FaCalendarCheck />, val: stats.pendingBookings, label: 'Pending Bookings', section: 'booking' },
                    { bg: '#17a2b8', icon: <FaChartBar />, val: `₱${(stats.totalDonationAmount || 0).toLocaleString()}`, label: 'Total Donations', section: 'donation' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.section ? 'clickable' : ''}`}
                        onClick={() => s.section && setActiveSection(s.section)}
                        style={{ cursor: s.section ? 'pointer' : 'default', background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        <div className="stat-icon" style={{ background: s.bg, width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem', marginBottom: 12 }}>{s.icon}</div>
                        <div className="stat-info"><h3 style={{ margin: 0, fontSize: '1.8rem', color: '#1A0A00' }}>{s.val}</h3><p style={{ margin: '4px 0 0', color: '#7A5C4E', fontSize: '0.85rem' }}>{s.label}</p></div>
                    </div>
                ))}
            </div>

            <div className="content-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="card-white" style={{ background: 'white', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
                    <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h5 style={{ margin: 0 }}>Recent Bookings</h5>
                        <button className="btn-view-all" onClick={() => setActiveSection('booking')} style={{ background: 'none', border: 'none', color: '#F96B38', cursor: 'pointer' }}>View All →</button>
                    </div>
                    {bookings.length === 0 ? (
                        <div className="no-data" style={{ padding: '40px', textAlign: 'center', color: '#7A5C4E' }}>No bookings yet.</div>
                    ) : (
                        <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFF8F3' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Name</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.slice(0, 5).map(b => (
                                    <tr key={b._id} style={{ cursor: 'pointer', borderBottom: '1px solid #E8D6CC' }} onClick={() => handleViewDetails('booking', b)}>
                                        <td style={{ padding: '12px 16px' }}>{b.name}</td>
                                        <td style={{ padding: '12px 16px' }}>{new Date(b.visitDate).toLocaleDateString()}</td>
                                        <td style={{ padding: '12px 16px' }}><span className={`status ${b.status}`} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem' }}>{b.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="card-white" style={{ background: 'white', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
                    <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h5 style={{ margin: 0 }}>Recent Donations</h5>
                        <button className="btn-view-all" onClick={() => setActiveSection('donation')} style={{ background: 'none', border: 'none', color: '#F96B38', cursor: 'pointer' }}>View All →</button>
                    </div>
                    {donations.length === 0 ? (
                        <div className="no-data" style={{ padding: '40px', textAlign: 'center', color: '#7A5C4E' }}>No donations yet.</div>
                    ) : (
                        <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFF8F3' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Donor</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Amount</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {donations.slice(0, 5).map(d => (
                                    <tr key={d._id} style={{ cursor: 'pointer', borderBottom: '1px solid #E8D6CC' }} onClick={() => handleViewDetails('donation', d)}>
                                        <td style={{ padding: '12px 16px' }}>{d.donorName}</td>
                                        <td style={{ padding: '12px 16px', color: '#28a745', fontWeight: 600 }}>₱{d.amount?.toLocaleString()}</td>
                                        <td style={{ padding: '12px 16px' }}><span className={`status ${d.paymentStatus}`} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem' }}>{d.paymentStatus}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStaffManagement = () => (
        <UserManagementTab
            users={staff}
            setUsers={setStaff}
            onEdit={(updated) => {
                setStaff(prev => prev.map(u => u._id === updated._id ? updated : u));
                toast(`User ${updated.firstName} ${updated.lastName} updated successfully.`);
            }}
        />
    );

    const renderStaffRoster = () => (
        <StaffRosterTab staff={staff} onRefresh={fetchStaffList} currentUser={user} />
    );

    const renderBookingManagement = () => (
        <BookingManagementTab
            bookings={bookings}
            updateBookingStatus={updateBookingStatus}
            handleRejectWithReason={handleRejectWithReason}
            handleApproveWithDetails={handleApproveWithDetails}
            handleViewDetails={handleViewDetails}
            handleEditBooking={handleEditBooking}
            handleExportPDF={() => handleExportPDF('bookings')}
        />
    );

    const renderDonationManagement = () => (
        <DonationManagementTab
            donations={donations}
            updateDonationStatus={updateDonationStatus}
            handleViewDetails={handleViewDetails}
            handleExportPDF={() => handleExportPDF('donations')}
        />
    );

    const renderAlerts = () => (
        <div className="card-white" style={{ background: 'white', borderRadius: 16, overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <h5 style={{ margin: 0 }}>
                    Alerts &amp; Notifications
                    {combinedUnreadCount > 0 && <span style={{ marginLeft: 10, background: '#dc3545', color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem' }}>{combinedUnreadCount}</span>}
                </h5>
                <div style={{ display: 'flex', gap: 8 }}>
                    {combinedUnreadCount > 0 && (
                        <button className="btn-outline-sm" onClick={markAllAlertsRead} style={{ padding: '6px 12px' }}><FaCheck /> Mark All Read</button>
                    )}
                    <button className="btn-primary-sm" onClick={handleRefresh} style={{ padding: '6px 12px' }}><FaSync /> Refresh</button>
                </div>
            </div>

            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: '#FFF8F3' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                    <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B58968', fontSize: '.8rem' }} />
                    <input
                        value={alertSearch}
                        onChange={e => setAlertSearch(e.target.value)}
                        placeholder="Search by title, message, medication, resident…"
                        style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#fff', color: '#1A0A00', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }}
                    />
                </div>
                <select value={alertTypeFilter} onChange={e => setAlertTypeFilter(e.target.value)} style={alertSelectStyle}>
                    {ALERT_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o === 'All' ? 'All Types' : o}</option>)}
                </select>
                <select value={alertStatusFilter} onChange={e => setAlertStatusFilter(e.target.value)} style={alertSelectStyle}>
                    {ALERT_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o === 'All' ? 'All Status' : o}</option>)}
                </select>
                <select value={alertDateFilter} onChange={e => setAlertDateFilter(e.target.value)} style={alertSelectStyle}>
                    {ALERT_DATE_OPTIONS.map(o => <option key={o} value={o}>{o === 'All' ? 'All Dates' : o}</option>)}
                </select>
                <button className="btn-outline-sm" onClick={clearAlertFilters} style={{ padding: '7px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaFilter size={11} /> Clear Filters
                </button>
            </div>

            {filteredAlerts.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FaBell style={{ fontSize: '3rem', color: '#E8D6CC', marginBottom: 12 }} />
                    <p style={{ color: '#7A5C4E' }}>
                        {unifiedAlerts.length === 0
                            ? 'System is running smoothly. No alerts at this time.'
                            : 'No alerts match your current filters.'}
                    </p>
                    {unifiedAlerts.length > 0 && (
                        <button className="btn-outline-sm" onClick={clearAlertFilters} style={{ marginTop: 12 }}>Clear Filters</button>
                    )}
                </div>
            ) : (
                <>
                    <div className="alerts-list-full">
                        {pagedAlerts.map(a => {
                            const isRead = a.isRead;
                            const isClickable = (a.source === 'notification' && a.section) || (a.source === 'db' && !isRead);
                            const handleRowClick = () => {
                                if (a.source === 'notification') {
                                    markRead(a.raw.id);
                                    if (a.section) {
                                        setActiveSection(a.section);
                                        setNotifOpen(false);
                                        setSearchQuery('');
                                    }
                                } else if (!isRead) {
                                    markDbAlertRead(a.raw._id);
                                }
                            };
                            return (
                                <div key={a.uid}
                                    className={`alert-row ${isRead ? 'read' : 'unread'}`}
                                    style={{
                                        cursor: isClickable ? 'pointer' : 'default',
                                        padding: '16px 20px',
                                        borderBottom: '1px solid #E8D6CC',
                                        background: isRead ? '#fff' : '#FFF8F3',
                                        transition: 'background 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12
                                    }}
                                    onClick={handleRowClick}
                                    onMouseEnter={e => e.currentTarget.style.background = '#FFF0E6'}
                                    onMouseLeave={e => e.currentTarget.style.background = isRead ? '#fff' : '#FFF8F3'}
                                >
                                    <div className="alert-row-icon" style={{ background: a.color + '20', color: a.color, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                                        {a.icon || <FaBell />}
                                    </div>
                                    <div className="alert-row-body" style={{ flex: 1, minWidth: 0 }}>
                                        <strong style={{ display: 'block', marginBottom: 4 }}>{a.title}</strong>
                                        <span style={{ fontSize: '0.85rem', color: '#555' }}>{a.message}</span>
                                        {a.source === 'notification' && a.section && <small style={{ color: a.color, fontWeight: 600, marginTop: 4, display: 'block', fontSize: '0.7rem' }}>Click to view →</small>}
                                        {a.source === 'db' && !isRead && <small style={{ color: a.color, fontWeight: 600, marginTop: 4, display: 'block', fontSize: '0.7rem' }}>Click to mark as read</small>}
                                    </div>
                                    <div className="alert-row-meta" style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <span className="alert-type-tag" style={{ background: a.color + '18', color: a.color, padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', display: 'inline-block', marginBottom: 6 }}>{a.typeLabel}</span>
                                        <br />
                                        <span className="alert-time" style={{ fontSize: '0.7rem', color: '#999' }}>{timeAgo(a.time)}</span>
                                    </div>
                                    {!isRead && <div className="unread-dot" style={{ width: 8, height: 8, background: a.color, borderRadius: '50%', flexShrink: 0 }} />}
                                </div>
                            );
                        })}
                    </div>
                    {renderPagination(filteredAlerts.length, alertPage, setAlertPage, itemsPerPage)}
                </>
            )}
        </div>
    );

    const renderInventory = () => (
        <InventoryTab
            inventory={filteredInventory}
            setInventory={setInventory}
            setShowAddInventory={setShowAddInventory}
            currentUser={user}
            showConfirm={showConfirm}
            closeConfirm={closeConfirm}

            onStockApproved={() => loadAllData(true)}
        />
    );

    const handleComplianceReport = () => {
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) {
            alert('Print was blocked by your browser\'s popup blocker. Please allow popups for this site and try again.');
            return;
        }

        const now = new Date();
        const generatedByName = user
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.username || 'Admin'
            : 'Admin';
        const generatedByRole = user?.role || 'admin';
        const complianceRows = [
            ['Scheduled Today', 24],
            ['Administered', 21],
            ['Missed', stats.missedMeds !== null ? stats.missedMeds : 'N/A'],
            ['Delayed', stats.delayedMeds !== null ? stats.delayedMeds : 'N/A'],
        ];

        win.document.write(`
            <html>
            <head>
                <title>Compliance Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #F96B38; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    h4 { color: #F96B38; font-family: 'Playfair Display', serif; margin: 26px 0 10px; font-size: 1rem; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    .summary-grid { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
                    .summary-box { flex: 1; min-width: 130px; background: #FFF8F3; border: 1px solid #E8D6CC; border-radius: 10px; padding: 12px 14px; text-align: center; }
                    .summary-box .val { font-size: 1.5rem; font-weight: 700; font-family: 'Playfair Display', serif; }
                    .summary-box .lbl { font-size: .72rem; color: #7A5C4E; text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
                    th { background: #F96B38; color: #fff; padding: 10px 12px; text-align: left; font-weight: 700; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    .audit-table td, .audit-table th { font-size: .8rem; }
                    .audit-table th { background: #7d3a06; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Medication Compliance Report</h2>
                <p class="sub">Generated: ${now.toLocaleString('en-PH')}</p>

                <div class="summary-grid">
                    <div class="summary-box"><div class="val" style="color:#F96B38">${stats.complianceRate !== null ? stats.complianceRate : 'N/A'}%</div><div class="lbl">Overall Compliance Rate</div></div>
                </div>

                <h4>Today's Medication Summary</h4>
                <table>
                    <thead><tr><th>Category</th><th>Count</th></tr></thead>
                    <tbody>
                        ${complianceRows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}
                    </tbody>
                </table>

                <h4>Weekly Adherence Trend</h4>
                <table>
                    <thead><tr><th>Day</th><th>Adherence Rate</th></tr></thead>
                    <tbody>
                        ${weeklyData.map(d => `<tr><td>${d.day}</td><td>${d.rate}%</td></tr>`).join('')}
                    </tbody>
                </table>

                <h4>Audit Trail</h4>
                <table class="audit-table">
                    <tbody>
                        <tr><th style="width:180px">Generated By</th><td>${generatedByName}</td></tr>
                        <tr><th>Role</th><td>${generatedByRole}</td></tr>
                        <tr><th>Date</th><td>${now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                        <tr><th>Time</th><td>${now.toLocaleTimeString('en-PH')}</td></tr>
                        <tr><th>Action Performed</th><td>Compliance Report Generated</td></tr>
                        <tr><th>Report Type</th><td>Medication Compliance — Full Report</td></tr>
                        <tr><th>System Version</th><td>Kanang-Alalay Admin Panel v1.0</td></tr>
                        <tr><th>Export Timestamp</th><td>${now.toISOString()}</td></tr>
                    </tbody>
                </table>
            </body>
            </html>
        `);
        win.document.close();

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

    const renderCompliance = () => (
        <div className="card-white" style={{ background: 'white', borderRadius: 16, padding: 24 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h5 style={{ margin: 0 }}>Medication Compliance Chart</h5>
                <button className="btn-primary-sm" onClick={handleComplianceReport} style={{ padding: '8px 16px' }}>
                    <FaFileAlt /> Full Report
                </button>
            </div>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', padding: '24px', background: '#FFF8F3', borderRadius: 16, minWidth: 180 }}>
                    <h1 style={{ fontSize: '3rem', color: '#F96B38', margin: 0 }}>{stats.complianceRate !== null ? `${stats.complianceRate}%` : 'Loading...'}</h1>
                    <p style={{ margin: '8px 0 0', color: '#7A5C4E', fontWeight: 600 }}>Overall Compliance Rate</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, flex: 1 }}>
                    {[
                        ['24', 'Scheduled Today', null],
                        ['21', 'Administered', '#28a745'],
                        [stats.missedMeds !== null ? stats.missedMeds : '--', 'Missed', '#dc3545'],
                        [stats.delayedMeds !== null ? stats.delayedMeds : '--', 'Delayed', '#ffc107'],
                    ].map(([v, l, c], i) => (
                        <div key={i} style={{ padding: '16px', background: '#FFF8F3', borderRadius: 12, textAlign: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: c || '#1A0A00' }}>{v}</h3>
                            <p style={{ margin: '4px 0 0', color: '#7A5C4E', fontSize: '0.8rem' }}>{l}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ marginTop: 24, padding: '20px', background: '#FFF8F3', borderRadius: 12, textAlign: 'center' }}>
                <h6 style={{ margin: '0 0 12px', color: '#7A5C4E' }}>Weekly Adherence Trend</h6>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, justifyContent: 'center' }}>
                    {[
                        { day: 'Mon', rate: 88, color: '#F96B38' },
                        { day: 'Tue', rate: 91, color: '#F96B38' },
                        { day: 'Wed', rate: 85, color: '#E65100' },
                        { day: 'Thu', rate: 95, color: '#28a745' },
                        { day: 'Fri', rate: 92, color: '#F96B38' },
                        { day: 'Sat', rate: 89, color: '#F96B38' },
                        { day: 'Sun', rate: 92, color: '#28a745' },
                    ].map((item, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <small style={{ fontSize: '0.7rem', color: '#7A5C4E' }}>{item.rate}%</small>
                            <div style={{ width: '100%', height: `${item.rate * 0.8}px`, minHeight: 4, borderRadius: '4px 4px 0 0', background: item.color }} />
                            <small style={{ fontSize: '0.7rem', color: '#7A5C4E' }}>{item.day}</small>
                        </div>
                    ))}
                </div>
                <p style={{ marginTop: 16, fontSize: '0.8rem', color: '#7A5C4E' }}>
                    Average <strong style={{ color: '#F96B38' }}>{(weeklyData.reduce((sum, d) => sum + d.rate, 0) / 7).toFixed(1)}% adherence</strong> tracked this week.
                </p>
            </div>
        </div>
    );

    const weeklyData = [
        { day: 'Mon', rate: 88 }, { day: 'Tue', rate: 91 }, { day: 'Wed', rate: 85 },
        { day: 'Thu', rate: 95 }, { day: 'Fri', rate: 92 }, { day: 'Sat', rate: 89 }, { day: 'Sun', rate: 92 }
    ];

    const renderContent = () => {
        if (loading) return (
            <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 400 }}>
                <FaSpinner className="spin" style={{ color: '#F96B38', fontSize: '1.8rem' }} />
                <span style={{ color: '#7A5C4E' }}>Loading dashboard…</span>
            </div>
        );

        switch (activeSection) {
            case 'overview': return renderOverview();
            case 'staff': return renderStaffManagement();
            case 'roster': return renderStaffRoster();
            case 'booking': return renderBookingManagement();
            case 'donation': return renderDonationManagement();
            case 'alerts': return renderAlerts();
            case 'inventory': return renderInventory();
            case 'compliance': return renderCompliance();
            case 'reports': return renderOverview();
            default: return renderOverview();
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">
                {mobileSidebarOpen && (
                    <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />
                )}
                <div
                    className={`sidebar admin-sidebar${mobileSidebarOpen ? ' mobile-open' : ''}`}
                    style={{ background: '#1A0A00', color: '#fff', display: 'flex', flexDirection: 'column' }}
                >
                    <div className="sidebar-header" style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <img src={mainLogo} alt="Kanang-Alalay logo" className="logo-circle" />
                            <div className="brand-text">
                                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Kanang-Alalay</h4>
                                <h5 style={{ margin: 0, fontSize: '0.7rem', opacity: 0.7 }}>Admin Panel</h5>
                            </div>
                        </div>
                    </div>

                    <ul className="sidebar-menu" style={{ flex: 1, padding: '20px 0', margin: 0, listStyle: 'none' }}>
                        {[
                            { key: 'overview', icon: <FaHome />, label: 'System Overview' },
                            { key: 'staff', icon: <FaUsers />, label: 'User Management' },
                            { key: 'roster', icon: <FaCalendarAlt />, label: 'Staff Roster' },
                            { key: 'alerts', icon: <FaBell />, label: 'Alerts & Notifications', badge: unreadCount },
                            { key: 'booking', icon: <FaCalendarCheck />, label: 'Admission & Booking', badge: stats.pendingBookings },
                            { key: 'inventory', icon: <FaExclamationTriangle />, label: 'Inventory Alerts', badge: realLowStockCount },
                            { key: 'compliance', icon: <FaChartBar />, label: 'Compliance Chart' },
                            { key: 'donation', icon: <FaMoneyBillWave />, label: 'Donation Ledger' },

                        ].map(({ key, icon, label, badge }) => (
                            <li key={key}
                                className={activeSection === key ? 'active' : ''}
                                onClick={() => {
                                    setActiveSection(key);
                                    setSearchQuery('');
                                    setMobileSidebarOpen(false);
                                }}
                                style={{
                                    padding: '12px 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    cursor: 'pointer',
                                    background: activeSection === key ? 'rgba(249,107,56,0.2)' : 'transparent',
                                    borderLeft: activeSection === key ? '3px solid #F96B38' : '3px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {icon} <span style={{ flex: 1 }}>{label}</span>
                                {badge > 0 && <span className="sidebar-badge" style={{ background: '#dc3545', padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem' }}>{badge}</span>}
                            </li>
                        ))}
                    </ul>

                    <div className="sidebar-footer" onClick={handleLogout} style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FaSignOutAlt /> <span>Sign Out</span>
                    </div>
                </div>

                <div className="main-content-wrapper" style={{ flex: 1, background: '#F5F0EB', display: 'flex', flexDirection: 'column' }}>
                    <div className="admin-topbar">
                        <div className="topbar-left">
                            <button
                                className="mobile-menu-toggle"
                                onClick={() => setMobileSidebarOpen(o => !o)}
                                aria-label="Toggle menu"
                                title="Menu"
                            >
                                <FaBars />
                            </button>
                        </div>

                        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div className="topbar-notif-menu" ref={notifRef} style={{ position: 'relative' }}>
                                <button
                                    className="topbar-icon-btn"
                                    onClick={() => { setNotifOpen(o => !o); setAccountMenuOpen(false); }}
                                    title="Notifications"
                                >
                                    <FaBell />
                                    {unreadCount > 0 && (
                                        <span className="notif-dot-badge">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {notifOpen && (
                                    <div className="notif-dropdown" style={{ position: 'absolute', top: '100%', right: 0, width: 380, background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000, marginTop: 8, overflow: 'hidden' }}>
                                        <div className="notif-dropdown-header" style={{ padding: '12px 16px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600 }}>Notifications</span>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {unreadCount > 0 && (
                                                    <button className="notif-action-btn" onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#F96B38' }}>Mark all read</button>
                                                )}
                                                <button className="notif-action-btn" onClick={handleRefresh} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><FaSync /></button>
                                            </div>
                                        </div>

                                        <div className="notif-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
                                            {notifications.length === 0 ? (
                                                <div className="notif-empty" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                                    <FaBell style={{ fontSize: '2rem', color: '#E8D6CC' }} />
                                                    <p style={{ marginTop: 12, color: '#7A5C4E' }}>All caught up! No new alerts.</p>
                                                </div>
                                            ) : notifications.slice(0, 20).map(n => {
                                                const meta = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
                                                const isRead = readIds.has(n.id);
                                                return (
                                                    <div key={n.id}
                                                        className={`notif-item ${isRead ? 'read' : 'unread'}`}
                                                        onClick={() => {
                                                            markRead(n.id);
                                                            if (meta.section) {
                                                                setActiveSection(meta.section);
                                                                setNotifOpen(false);
                                                                setSearchQuery('');
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '12px 16px',
                                                            borderBottom: '1px solid #E8D6CC',
                                                            cursor: meta.section ? 'pointer' : 'default',
                                                            background: isRead ? '#fff' : '#FFF8F3',
                                                            display: 'flex',
                                                            gap: 12
                                                        }}
                                                    >
                                                        <div className="notif-item-icon" style={{ color: meta.color, fontSize: '1.1rem' }}>{meta.icon}</div>
                                                        <div className="notif-item-body" style={{ flex: 1 }}>
                                                            <strong style={{ fontSize: '0.85rem', display: 'block' }}>{n.title}</strong>
                                                            <span style={{ fontSize: '0.75rem', color: '#666' }}>{n.body}</span>
                                                            <small style={{ fontSize: '0.65rem', color: '#999', display: 'block', marginTop: 4 }}>{timeAgo(n.time)}</small>
                                                        </div>
                                                        {!isRead && <div className="notif-unread-dot" style={{ width: 8, height: 8, background: meta.color, borderRadius: '50%', alignSelf: 'center' }} />}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {notifications.length > 0 && (
                                            <div className="notif-footer" onClick={() => { setActiveSection('alerts'); setNotifOpen(false); }} style={{ padding: '12px 16px', textAlign: 'center', borderTop: '1px solid #E8D6CC', cursor: 'pointer', color: '#F96B38', fontSize: '0.8rem' }}>
                                                View all {notifications.length + dbAlerts.length} notifications →
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="topbar-user-menu">
                                <div
                                    className={`topbar-user-trigger ${accountMenuOpen ? 'active' : ''}`}
                                    onClick={() => { setAccountMenuOpen(o => !o); setNotifOpen(false); }}
                                >
                                    <FaUserCircle className="topbar-user-avatar" />
                                    <div className="topbar-user-info">
                                        <span className="topbar-user-name">{user?.firstName} {user?.lastName}</span>
                                        <span className="topbar-user-role">{user?.role?.toUpperCase() || 'ADMIN'}</span>
                                    </div>
                                    <FaChevronDown className={`topbar-arrow ${accountMenuOpen ? 'rotate' : ''}`} />
                                </div>

                                {accountMenuOpen && (
                                    <ul className="topbar-dropdown" style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', marginTop: 8, padding: '8px 0', minWidth: 200, zIndex: 1000 }}>
                                        <li onClick={() => { navigate('/profile'); setAccountMenuOpen(false); }} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                            <FaUserCircle /> View Profile
                                        </li>
                                        <li onClick={() => { navigate('/settings'); setAccountMenuOpen(false); }} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                            <FaCog /> Account Settings
                                        </li>
                                        <li onClick={() => { navigate('/help'); setAccountMenuOpen(false); }} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                            <FaQuestionCircle /> Help Center
                                        </li>
                                        <li className="dropdown-divider" onClick={handleLogout} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderTop: '1px solid #E8D6CC', marginTop: 4, color: '#dc3545' }}>
                                            <FaSignOutAlt /> Sign Out
                                        </li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="main-content" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                        {!loading && activeSection !== 'overview' && (
                            <button
                                type="button"
                                className="admin-back-btn"
                                onClick={handleBackNavigation}
                                aria-label="Back"
                            >
                                <FaArrowLeft /> Back
                            </button>
                        )}
                        {renderContent()}
                    </div>
                </div>
            </div>

            {toastMessage && (
                <div className="toast-container" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10002 }}>
                    <div className={`toast ${toastMessage.type === 'error' ? 'error' : toastMessage.type === 'info' ? 'warn' : 'success'}`} style={{
                        background: toastMessage.type === 'error' ? '#dc3545' : toastMessage.type === 'info' ? '#ffc107' : '#28a745',
                        color: '#fff',
                        padding: '12px 20px',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        {toastMessage.type === 'error' ? <FaTimes /> : <FaCheck />} {toastMessage.msg}
                    </div>
                </div>
            )}

            <UserRegistrationModal
                isOpen={showRegistrationModal}
                onClose={() => setShowRegistrationModal(false)}
                onRegister={handleRegisterSuccess}
            />

            {showEditModal && selectedUser && (
                <EditUserModal
                    user={selectedUser}
                    onSave={async (form) => {
                        try {
                            await fetchApi(`/admin/users/${selectedUser._id}`, {
                                method: 'PUT',
                                body: JSON.stringify(form)
                            });
                            setStaff(prev => prev.map(u => u._id === selectedUser._id ? { ...u, ...form } : u));
                            toast(`${form.firstName} ${form.lastName} updated successfully.`);
                        } catch (e) {
                            toast('Failed to save changes.', 'error');
                        } finally {
                            setShowEditModal(false);
                            setSelectedUser(null);
                        }
                    }}
                    onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
                />
            )}

            <AddInventoryModal
                isOpen={showAddInventory}
                onClose={() => setShowAddInventory(false)}
                onSave={handleAddInventory}
            />

            {detailsModal.isOpen && (
                <DetailsModal
                    type={detailsModal.type}
                    data={detailsModal.data}
                    onClose={closeDetailsModal}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
                confirmLabel={confirmModal.confirmLabel}
                danger={confirmModal.danger}
            />

            {showLogoutConfirm && (
                <div className="modal-overlay" style={{ zIndex: 10002 }}>
                    <div className="registration-modal" style={{ maxWidth: 380, width: '100%', padding: 'clamp(20px,6vw,28px)', boxSizing: 'border-box' }}>
                        <div className="logout-confirm-header">
                            <FaSignOutAlt className="logout-confirm-icon" />
                            <h4>Sign Out</h4>
                        </div>
                        <p className="logout-confirm-msg">Are you sure you want to sign out? Any unsaved changes will be lost.</p>
                        <div className="modal-footer" style={{ padding: '14px 0 0', margin: 0 }}>
                            <button className="btn-outline-sm" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
                            <button className="btn-logout-confirm" onClick={confirmLogout}>
                                <FaSignOutAlt /> Yes, Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ReasonModal
                isOpen={reasonModal.isOpen}
                action={reasonModal.action}
                userName={reasonModal.userName}
                currentStatus={reasonModal.currentStatus}
                reason={reasonModal.reason}
                setReason={(val) => setReasonModal(prev => ({ ...prev, reason: val }))}
                effectiveDate={reasonModal.effectiveDate}
                setEffectiveDate={(val) => setReasonModal(prev => ({ ...prev, effectiveDate: val }))}
                notes={reasonModal.notes}
                setNotes={(val) => setReasonModal(prev => ({ ...prev, notes: val }))}
                onConfirm={confirmPersonnelAction}
                onCancel={() => setReasonModal(prev => ({ ...prev, isOpen: false }))}
                loading={actionLoading}
            />

            {editStatusModal.isOpen && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="registration-modal" style={{ maxWidth: 420, padding: 32, background: '#fff', borderRadius: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1.5px solid #E8D6CC', paddingBottom: 14 }}>
                            <h4 style={{ margin: 0, color: '#1A0A00' }}>Update Booking Status</h4>
                            <button onClick={() => setEditStatusModal({ isOpen: false, booking: null, newStatus: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E', fontSize: '1.2rem' }}><FaTimes /></button>
                        </div>
                        <p style={{ fontSize: '.88rem', color: '#7A5C4E', marginBottom: 16 }}>
                            Booking for: <strong>{editStatusModal.booking?.name}</strong>
                        </p>
                        <label style={{ fontSize: '.82rem', fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                            New Status
                        </label>
                        <select
                            value={editStatusModal.newStatus}
                            onChange={e => setEditStatusModal(p => ({ ...p, newStatus: e.target.value }))}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #E8D6CC',
                                borderRadius: 9, fontFamily: "'DM Sans', sans-serif", fontSize: '.92rem',
                                background: '#FFF8F3', color: '#1A0A00', outline: 'none',
                                marginBottom: 22,
                            }}
                        >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="completed">Completed</option>
                        </select>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button className="btn-outline-sm" onClick={() => setEditStatusModal({ isOpen: false, booking: null, newStatus: '' })} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E8D6CC', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                            <button
                                className="btn-primary-sm"
                                onClick={() => {
                                    if (!editStatusModal.newStatus) return;
                                    if (editStatusModal.newStatus === editStatusModal.booking?.status) {
                                        setEditStatusModal({ isOpen: false, booking: null, newStatus: '' });
                                        return;
                                    }
                                    updateBookingStatus(editStatusModal.booking._id, editStatusModal.newStatus);
                                    setEditStatusModal({ isOpen: false, booking: null, newStatus: '' });
                                }}
                                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#F96B38', color: '#fff', cursor: 'pointer' }}
                            >Save</button>
                        </div>
                    </div>
                </div>
            )}

            {approvalModal.isOpen && approvalModal.booking && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div
                        className="registration-modal"
                        style={{
                            maxWidth: 600,
                            width: '100%',
                            maxHeight: '85vh',
                            padding: 32,
                            background: '#fff',
                            borderRadius: 20,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1.5px solid #E8D6CC', paddingBottom: 16, flexShrink: 0 }}>
                            <h4 style={{ margin: 0, color: '#1A0A00', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <FaCheckCircle size={20} color="#28a745" />
                                Approve Booking
                            </h4>
                            <button onClick={() => setApprovalModal({ isOpen: false, bookingId: null, booking: null, availability: DEFAULT_AVAILABILITY, editTimeSlots: false })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E', fontSize: '1.2rem' }}>
                                <FaTimes />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>

                        <div style={{ marginBottom: 24 }}>
                            <h5 style={{ margin: '0 0 12px 0', color: '#1A0A00', fontSize: '0.95rem', fontWeight: 700 }}>Visitor Details</h5>
                            <div style={{ background: '#FFF8F3', padding: 16, borderRadius: 12, border: '1.5px solid #E8D6CC' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Full Name</span>
                                        <span style={{ display: 'block', fontSize: '0.95rem', color: '#1A0A00', fontWeight: 600 }}>{approvalModal.booking.name}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Email</span>
                                        <span style={{ display: 'block', fontSize: '0.85rem', color: '#1A0A00', wordBreak: 'break-all' }}>{approvalModal.booking.email}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Phone</span>
                                        <span style={{ display: 'block', fontSize: '0.95rem', color: '#1A0A00' }}>{approvalModal.booking.phone}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Purpose</span>
                                        <span style={{ display: 'block', fontSize: '0.95rem', color: '#1A0A00', textTransform: 'capitalize' }}>{approvalModal.booking.purpose?.replace('_', ' ')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <h5 style={{ margin: '0 0 12px 0', color: '#1A0A00', fontSize: '0.95rem', fontWeight: 700 }}>Visit Schedule</h5>
                            <div style={{ background: '#E8F5E9', padding: 16, borderRadius: 12, border: '1.5px solid #28a745' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#1E7D56', fontWeight: 600, marginBottom: 4 }}>Date</span>
                                        <span style={{ display: 'block', fontSize: '0.95rem', color: '#1E7D56', fontWeight: 600 }}>
                                            {new Date(approvalModal.booking.visitDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#1E7D56', fontWeight: 600, marginBottom: 4 }}>Time Slot</span>
                                        <span style={{ display: 'block', fontSize: '0.95rem', color: '#1E7D56', fontWeight: 600 }}>
                                            {approvalModal.booking.visitTime === '09:00' ? '9:00 AM - 11:00 AM' : '3:00 PM - 5:00 PM'}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#1E7D56', fontWeight: 600, marginBottom: 4 }}>Number of Visitors</span>
                                        <span style={{ display: 'block', fontSize: '0.95rem', color: '#1E7D56', fontWeight: 600 }}>{approvalModal.booking.numberOfVisitors} visitor{approvalModal.booking.numberOfVisitors > 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div>
                                    <h5 style={{ margin: '0 0 4px 0', color: '#1A0A00', fontSize: '0.95rem', fontWeight: 700 }}>Visiting Hours for Visitor Email</h5>
                                    <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#7A5C4E' }}>
                                        {approvalModal.editTimeSlots
                                            ? 'Manual override is on — you can enable/disable either slot.'
                                            : `Locked to the visitor's requested slot (${isMorningBooking(approvalModal.booking) ? 'Morning, 9:00 AM–11:00 AM' : 'Afternoon, 3:00 PM–5:00 PM'}). You can still fine-tune the time within that window. Turn on "Edit time slots" to switch to the other slot.`}
                                    </p>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#E65100', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', marginTop: 2 }}>
                                    <input
                                        type="checkbox"
                                        checked={approvalModal.editTimeSlots}
                                        onChange={e => {
                                            const editOn = e.target.checked;
                                            setApprovalModal(prev => ({
                                                ...prev,
                                                editTimeSlots: editOn,

                                                availability: editOn
                                                    ? prev.availability
                                                    : {
                                                        ...prev.availability,
                                                        morningEnabled: isMorningBooking(prev.booking),
                                                        afternoonEnabled: !isMorningBooking(prev.booking)
                                                    }
                                            }));
                                        }}
                                    />
                                    Edit time slots
                                </label>
                            </div>
                            <div style={{ background: '#FFF3E0', padding: 16, borderRadius: 12, border: '1.5px solid #FF9800' }}>
                                <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#E65100', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FaMapMarkerAlt size={14} /> Available Visiting Hours
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap', opacity: (!approvalModal.editTimeSlots && !approvalModal.availability.morningEnabled) ? 0.5 : 1 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#1A0A00', fontWeight: 600, minWidth: 110 }}>
                                        <input
                                            type="checkbox"
                                            checked={approvalModal.availability.morningEnabled}
                                            disabled={!approvalModal.editTimeSlots}
                                            onChange={e => updateAvailabilityField('morningEnabled', e.target.checked)}
                                        />
                                        Morning Slot
                                    </label>
                                    <SlotTimePicker
                                        value={approvalModal.availability.morningStart}
                                        min={SLOT_BOUNDS.morningStart.min}
                                        max={SLOT_BOUNDS.morningStart.max}
                                        disabled={!approvalModal.availability.morningEnabled}
                                        onChange={val => updateSlotTimeField('morningStart', val)}
                                    />
                                    <span style={{ fontSize: '0.85rem', color: '#7A5C4E' }}>to</span>
                                    <SlotTimePicker
                                        value={approvalModal.availability.morningEnd}
                                        min={SLOT_BOUNDS.morningEnd.min}
                                        max={SLOT_BOUNDS.morningEnd.max}
                                        disabled={!approvalModal.availability.morningEnabled}
                                        onChange={val => updateSlotTimeField('morningEnd', val)}
                                    />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap', opacity: (!approvalModal.editTimeSlots && !approvalModal.availability.afternoonEnabled) ? 0.5 : 1 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#1A0A00', fontWeight: 600, minWidth: 110 }}>
                                        <input
                                            type="checkbox"
                                            checked={approvalModal.availability.afternoonEnabled}
                                            disabled={!approvalModal.editTimeSlots}
                                            onChange={e => updateAvailabilityField('afternoonEnabled', e.target.checked)}
                                        />
                                        Afternoon Slot
                                    </label>
                                    <SlotTimePicker
                                        value={approvalModal.availability.afternoonStart}
                                        min={SLOT_BOUNDS.afternoonStart.min}
                                        max={SLOT_BOUNDS.afternoonStart.max}
                                        disabled={!approvalModal.availability.afternoonEnabled}
                                        onChange={val => updateSlotTimeField('afternoonStart', val)}
                                    />
                                    <span style={{ fontSize: '0.85rem', color: '#7A5C4E' }}>to</span>
                                    <SlotTimePicker
                                        value={approvalModal.availability.afternoonEnd}
                                        min={SLOT_BOUNDS.afternoonEnd.min}
                                        max={SLOT_BOUNDS.afternoonEnd.max}
                                        disabled={!approvalModal.availability.afternoonEnabled}
                                        onChange={val => updateSlotTimeField('afternoonEnd', val)}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Maximum visitors per slot</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={approvalModal.availability.maxPerSlot}
                                            onChange={e => updateAvailabilityField('maxPerSlot', e.target.value)}
                                            style={availInputStyle(true, '100%')}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Arrival note</label>
                                        <input
                                            type="text"
                                            value={approvalModal.availability.arrivalNote}
                                            onChange={e => updateAvailabilityField('arrivalNote', e.target.value)}
                                            placeholder="e.g. Please arrive 10 minutes early"
                                            style={availInputStyle(true, '100%')}
                                        />
                                    </div>
                                </div>

                                <hr style={{ margin: '16px 0 12px', border: 'none', borderTop: '1px solid #FFB74D' }} />

                                <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#E65100', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FaLandmark size={14} /> Facility Rules
                                </p>
                                <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#7A5C4E' }}>One rule per line.</p>
                                <textarea
                                    value={approvalModal.availability.rules.join('\n')}
                                    onChange={e => updateAvailabilityField('rules', e.target.value.split('\n'))}
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1.5px solid #FFB74D',
                                        background: '#fff',
                                        color: '#1A0A00',
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: '0.85rem',
                                        lineHeight: 1.7,
                                        resize: 'vertical',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexShrink: 0, paddingTop: 20, borderTop: '1.5px solid #E8D6CC' }}>
                            <button
                                onClick={() => setApprovalModal({ isOpen: false, bookingId: null, booking: null, availability: DEFAULT_AVAILABILITY, editTimeSlots: false })}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: 8,
                                    border: '1.5px solid #E8D6CC',
                                    background: '#fff',
                                    color: '#1A0A00',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmApproval}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#28a745',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}
                            >
                                <FaCheck size={13} /> Approve Booking
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {rejectionModal.isOpen && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div
                        className="registration-modal"
                        style={{
                            maxWidth: 600,
                            width: '100%',
                            maxHeight: '85vh',
                            padding: 32,
                            background: '#fff',
                            borderRadius: 20,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1.5px solid #E8D6CC', paddingBottom: 14, flexShrink: 0 }}>
                            <h4 style={{ margin: 0, color: '#1A0A00', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <FaExclamationTriangle color="#dc3545" />
                                Reject Booking
                            </h4>
                            <button onClick={() => setRejectionModal({ isOpen: false, bookingId: null, booking: null, reason: '' })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E', fontSize: '1.2rem' }}>
                                <FaTimes />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>

                        {rejectionModal.booking && (
                            <>
                                <div style={{ marginBottom: 24 }}>
                                    <h5 style={{ margin: '0 0 12px 0', color: '#1A0A00', fontSize: '0.95rem', fontWeight: 700 }}>Visitor Details</h5>
                                    <div style={{ background: '#FFF8F3', padding: 16, borderRadius: 12, border: '1.5px solid #E8D6CC' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Full Name</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', color: '#1A0A00', fontWeight: 600 }}>{rejectionModal.booking.name}</span>
                                            </div>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Email</span>
                                                <span style={{ display: 'block', fontSize: '0.85rem', color: '#1A0A00', wordBreak: 'break-all' }}>{rejectionModal.booking.email}</span>
                                            </div>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Phone</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', color: '#1A0A00' }}>{rejectionModal.booking.phone}</span>
                                            </div>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#7A5C4E', fontWeight: 600, marginBottom: 4 }}>Purpose</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', color: '#1A0A00', textTransform: 'capitalize' }}>{rejectionModal.booking.purpose?.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: 24 }}>
                                    <h5 style={{ margin: '0 0 12px 0', color: '#1A0A00', fontSize: '0.95rem', fontWeight: 700 }}>Visit Schedule</h5>
                                    <div style={{ background: '#FDEDED', padding: 16, borderRadius: 12, border: '1.5px solid #dc3545' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#c0392b', fontWeight: 600, marginBottom: 4 }}>Date</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', color: '#c0392b', fontWeight: 600 }}>
                                                    {new Date(rejectionModal.booking.visitDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#c0392b', fontWeight: 600, marginBottom: 4 }}>Time Slot</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', color: '#c0392b', fontWeight: 600 }}>
                                                    {rejectionModal.booking.visitTime === '09:00' ? '9:00 AM - 11:00 AM' : '3:00 PM - 5:00 PM'}
                                                </span>
                                            </div>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#c0392b', fontWeight: 600, marginBottom: 4 }}>Number of Visitors</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', color: '#c0392b', fontWeight: 600 }}>{rejectionModal.booking.numberOfVisitors} visitor{rejectionModal.booking.numberOfVisitors > 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <p style={{ fontSize: '.88rem', color: '#7A5C4E', marginBottom: 16 }}>
                            Please provide a reason for rejecting this booking. The visitor will be notified via email.
                        </p>

                        <label style={{ fontSize: '.82rem', fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                            Rejection Reason <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <textarea
                            value={rejectionModal.reason}
                            onChange={e => setRejectionModal(p => ({ ...p, reason: e.target.value }))}
                            placeholder="e.g., Time slot is fully booked, Facility maintenance, No available staff, etc."
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                border: '1.5px solid #E8D6CC',
                                borderRadius: 9,
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '.88rem',
                                background: '#FFF8F3',
                                color: '#1A0A00',
                                outline: 'none',
                                resize: 'vertical',
                                marginBottom: 4,
                            }}
                        />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0, paddingTop: 20, borderTop: '1.5px solid #E8D6CC' }}>
                            <button className="btn-outline-sm" onClick={() => setRejectionModal({ isOpen: false, bookingId: null, booking: null, reason: '' })} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E8D6CC', background: 'transparent', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button
                                className="btn-danger-sm"
                                onClick={confirmRejection}
                                disabled={!rejectionModal.reason.trim() || rejectionModal.reason.trim().length < 5}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: (!rejectionModal.reason.trim() || rejectionModal.reason.trim().length < 5) ? '#ccc' : '#dc3545',
                                    color: '#fff',
                                    cursor: (!rejectionModal.reason.trim() || rejectionModal.reason.trim().length < 5) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;