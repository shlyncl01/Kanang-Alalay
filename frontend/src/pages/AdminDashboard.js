// AdminDashboard.js - COMPLETE FIXED VERSION
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    FaUserCircle, FaHome, FaUsers, FaBell, FaCalendarCheck,
    FaUserMd, FaExclamationTriangle, FaChartBar, FaFileAlt, FaUserPlus,
    FaSignOutAlt, FaSync, FaEye, FaEdit, FaTrash,
    FaCheckCircle, FaBan, FaClock, FaMoneyBillWave,
    FaPhone, FaEnvelope, FaCalendarAlt, FaUserTag, FaIdCard, FaDownload, FaBox, FaChevronDown,
    FaSearch, FaCog, FaQuestionCircle, FaTimes, FaCheck, FaInfoCircle,
    FaExclamationCircle, FaSpinner, FaTimesCircle, FaHistory, FaFilter,
    FaPrint, FaChevronLeft, FaChevronRight, FaBars
} from 'react-icons/fa';
import UserRegistrationModal from '../components/UserRegistrationModal';
import AddInventoryModal from '../components/AddInventoryModal';
import InventoryTab from '../components/admin/InventoryTab';
import mainLogo from '../assets/mainLogo.png';
// ReportsTab removed — reports now embedded in OverviewTab
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

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const notifRef = useRef(null);
    const dropdownRef = useRef(null);
    const searchRef = useRef(null);

    const [activeSection, setActiveSection] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false); // drawer toggle, <768px only
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

    const [bookings, setBookings] = useState([]);
    const [donations, setDonations] = useState([]);
    const [staff, setStaff] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [dbAlerts, setDbAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState(null);

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
    
    const [stats, setStats] = useState({
        totalResidents: 0, activeStaff: 0, pendingBookings: 0,
        totalDonations: 0, totalDonationAmount: 0, lowStockItems: 0,
        complianceRate: 92, missedMeds: 2, delayedMeds: 1
    });

    const [editStatusModal, setEditStatusModal] = useState({ isOpen: false, booking: null, newStatus: '' });
    const [stockRequests, setStockRequests] = useState([]);
    const [rejectionModal, setRejectionModal] = useState({ isOpen: false, bookingId: null, reason: '' });
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

        on('new_booking',          handleNewBooking);
        on('update_booking',       handleUpdateBooking);
        on('delete_booking',       handleDeleteBooking);
        on('staff_status_updated', handleStaffStatusUpdated);
        on('staff_list_updated',   handleStaffListUpdated);
        on('stock_request',        handleStockRequest);
        on('inventory_update',     handleInventoryUpdate);
        on('stats_updated',        handleStatsUpdated);

        return () => {
            off('new_booking',          handleNewBooking);
            off('update_booking',       handleUpdateBooking);
            off('delete_booking',       handleDeleteBooking);
            off('staff_status_updated', handleStaffStatusUpdated);
            off('staff_list_updated',   handleStaffListUpdated);
            off('stock_request',        handleStockRequest);
            off('inventory_update',     handleInventoryUpdate);
            off('stats_updated',        handleStatsUpdated);
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

    // Debounce the search query so filtering/searching doesn't run on every keystroke.
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

    // Instant cross-module results for the topbar global search dropdown.
    // Searches Staff, Inventory, Bookings, Donations, and Notifications at once,
    // case-insensitively, with partial matching. (Resident records are not
    // fetched/available in this dashboard, so they're excluded from this list.)
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

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [bRes, dRes, sRes, iRes] = await Promise.all([
                fetchApi('/bookings?limit=100'),
                fetchApi('/donations?limit=100'),
                fetchApi('/stats'),
                fetchApi('/inventory?limit=100'),
            ]);
            if (bRes.success) setBookings(bRes.data || []);
            if (dRes.success) setDonations(dRes.data || []);
            if (sRes.success && sRes.data) setStats(p => ({ ...p, ...sRes.data }));
            if (iRes.success) setInventory(iRes.data || []);
            setLoading(false);
        };
        load();
        fetchStaffList();
        fetchDbAlerts();
    }, [fetchApi]);

    const fetchStaffList = async () => {
        const d = await fetchApi('/admin/staff');
        if (d.success) setStaff(d.staff || []);
        return d;
    };

    const fetchDbAlerts = async () => {
        const d = await fetchApi('/alerts');
        if (d.success) setDbAlerts(d.data || []);
    };

    const realLowStockCount = useMemo(() =>
        inventory.filter(i => i.quantity <= (i.minThreshold || 10)).length,
        [inventory]);

    const handleRefresh = async () => {
        setApiError(null);
        setLoading(true);
        const [bRes, dRes, sRes, iRes] = await Promise.all([
            fetchApi('/bookings?limit=100'),
            fetchApi('/donations?limit=100'),
            fetchApi('/stats'),
            fetchApi('/inventory?limit=100'),
        ]);
        if (bRes.success) setBookings(bRes.data || []);
        if (dRes.success) setDonations(dRes.data || []);
        if (sRes.success && sRes.data) setStats(p => ({ ...p, ...sRes.data }));
        if (iRes.success) setInventory(iRes.data || []);
        await fetchStaffList();
        await fetchDbAlerts();
        setLoading(false);
        toast('All data refreshed successfully');
    };

    const handleLogout = () => {
        showConfirm(
            'Sign Out',
            'Are you sure you want to sign out of the dashboard?',
            () => { closeConfirm(); logout(); navigate('/login'); },
            false,
            'Sign Out'
        );
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

    const updateBookingStatus = async (id, status, rejectionReason = '') => {
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
                    method: 'PUT', body: JSON.stringify({ status, rejectionReason })
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
        setRejectionModal({ isOpen: true, bookingId, reason: '' });
    };

    const confirmRejection = async () => {
        if (!rejectionModal.reason.trim() || rejectionModal.reason.trim().length < 5) {
            toast('Please provide a rejection reason (minimum 5 characters)', 'error');
            return;
        }
        await updateBookingStatus(rejectionModal.bookingId, 'rejected', rejectionModal.reason);
        setRejectionModal({ isOpen: false, bookingId: null, reason: '' });
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
                    category: item.category || 'General',
                    quantity: Number(item.quantity),
                    unit: item.unit || 'pcs',
                    minThreshold: Number(item.minThreshold) || 10,
                    expirationDate: item.expirationDate || undefined,
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
            // Server responded but rejected the item (e.g. validation failure, duplicate name).
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

    // Overview Tab — uses OverviewTab component which includes embedded Reports & Analytics
    const renderOverview = () => (
        <OverviewTab
            stats={stats}
            activities={[]}
            setActiveSection={setActiveSection}
            bookings={bookings}
            donations={donations}
            staff={staff}
            inventory={inventory}
        />
    );

    // OLD renderOverview kept below for reference — DELETE after migration
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

    // Staff Management Tab
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

    // Staff Roster Tab
    const renderStaffRoster = () => (
        <StaffRosterTab staff={staff} onRefresh={fetchStaffList} currentUser={user} />
    );

    // Booking Management Tab — passes raw bookings; the tab owns its own search
    const renderBookingManagement = () => (
        <BookingManagementTab
            bookings={bookings}
            updateBookingStatus={updateBookingStatus}
            handleViewDetails={handleViewDetails}
            handleEditBooking={handleEditBooking}
            handleExportPDF={() => handleExportPDF('bookings')}
        />
    );

    // Donation Management Tab — passes raw donations; the tab owns its own search
    const renderDonationManagement = () => (
        <DonationManagementTab
            donations={donations}
            updateDonationStatus={updateDonationStatus}
            handleViewDetails={handleViewDetails}
            handleExportPDF={() => handleExportPDF('donations')}
        />
    );

    // Alerts Tab
    const renderAlerts = () => (
        <div className="card-white" style={{ background: 'white', borderRadius: 16, overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 style={{ margin: 0 }}>
                    Alerts &amp; Notifications
                    {unreadCount > 0 && <span style={{ marginLeft: 10, background: '#dc3545', color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem' }}>{unreadCount}</span>}
                </h5>
                <div style={{ display: 'flex', gap: 8 }}>
                    {unreadCount > 0 && (
                        <button className="btn-outline-sm" onClick={markAllRead} style={{ padding: '6px 12px' }}><FaCheck /> Mark All Read</button>
                    )}
                    <button className="btn-primary-sm" onClick={handleRefresh} style={{ padding: '6px 12px' }}><FaSync /> Refresh</button>
                </div>
            </div>

            {notifications.length === 0 && dbAlerts.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FaBell style={{ fontSize: '3rem', color: '#E8D6CC', marginBottom: 12 }} />
                    <p style={{ color: '#7A5C4E' }}>System is running smoothly. No alerts at this time.</p>
                </div>
            ) : (
                <div className="alerts-list-full">
                    {notifications.map(n => {
                        const meta = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
                        const isRead = readIds.has(n.id);
                        const targetSection = meta.section;
                        return (
                            <div key={n.id}
                                className={`alert-row ${isRead ? 'read' : 'unread'}`}
                                style={{
                                    cursor: targetSection ? 'pointer' : 'default',
                                    padding: '16px 20px',
                                    borderBottom: '1px solid #E8D6CC',
                                    background: isRead ? '#fff' : '#FFF8F3',
                                    transition: 'background 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12
                                }}
                                onClick={() => {
                                    markRead(n.id);
                                    if (targetSection) {
                                        setActiveSection(targetSection);
                                        setNotifOpen(false);
                                        setSearchQuery('');
                                    }
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FFF0E6'}
                                onMouseLeave={e => e.currentTarget.style.background = isRead ? '#fff' : '#FFF8F3'}
                            >
                                <div className="alert-row-icon" style={{ background: meta.color + '20', color: meta.color, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                                    {meta.icon}
                                </div>
                                <div className="alert-row-body" style={{ flex: 1 }}>
                                    <strong style={{ display: 'block', marginBottom: 4 }}>{n.title}</strong>
                                    <span style={{ fontSize: '0.85rem', color: '#555' }}>{n.body}</span>
                                    {targetSection && <small style={{ color: meta.color, fontWeight: 600, marginTop: 4, display: 'block', fontSize: '0.7rem' }}>Click to view →</small>}
                                </div>
                                <div className="alert-row-meta" style={{ textAlign: 'right' }}>
                                    <span className="alert-type-tag" style={{ background: meta.color + '18', color: meta.color, padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', display: 'inline-block', marginBottom: 6 }}>{meta.label}</span>
                                    <br />
                                    <span className="alert-time" style={{ fontSize: '0.7rem', color: '#999' }}>{timeAgo(n.time)}</span>
                                </div>
                                {!isRead && <div className="unread-dot" style={{ width: 8, height: 8, background: meta.color, borderRadius: '50%' }} />}
                            </div>
                        );
                    })}

                    {dbAlerts.length > 0 && (
                        <>
                            <div style={{ padding: '8px 20px', background: '#F5F0EB', fontSize: '0.72rem', fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                System Alerts
                            </div>
                            {dbAlerts.map(a => {
                                const typeColors = { OTP: '#6c757d', Booking: '#17a2b8', Inventory: '#dc3545', System: '#6c757d' };
                                const color = typeColors[a.type] || '#6c757d';
                                return (
                                    <div key={a._id}
                                        style={{
                                            padding: '16px 20px',
                                            borderBottom: '1px solid #E8D6CC',
                                            background: a.isRead ? '#fff' : '#FFF8F3',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                        }}
                                    >
                                        <div style={{ background: color + '20', color, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                                            <FaBell />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <strong style={{ display: 'block', marginBottom: 4 }}>{a.title}</strong>
                                            <span style={{ fontSize: '0.85rem', color: '#555' }}>{a.message}</span>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <span style={{ background: color + '18', color, padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', display: 'inline-block', marginBottom: 6 }}>{a.type}</span>
                                            <br />
                                            <span style={{ fontSize: '0.7rem', color: '#999' }}>{timeAgo(a.createdAt)}</span>
                                        </div>
                                        {!a.isRead && <div style={{ width: 8, height: 8, background: color, borderRadius: '50%', flexShrink: 0 }} />}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );

    // Inventory Tab
    const renderInventory = () => (
        <InventoryTab
            inventory={filteredInventory}
            setInventory={setInventory}
            setShowAddInventory={setShowAddInventory}
            currentUser={user}
        />
    );

    // Compliance Tab
    const renderCompliance = () => (
        <div className="card-white" style={{ background: 'white', borderRadius: 16, padding: 24 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h5 style={{ margin: 0 }}>Medication Compliance Chart</h5>
                <button className="btn-primary-sm" onClick={() => toast('Report generation coming soon.', 'info')} style={{ padding: '8px 16px' }}>
                    <FaFileAlt /> Full Report
                </button>
            </div>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', padding: '24px', background: '#FFF8F3', borderRadius: 16, minWidth: 180 }}>
                    <h1 style={{ fontSize: '3rem', color: '#F96B38', margin: 0 }}>{stats.complianceRate || 92}%</h1>
                    <p style={{ margin: '8px 0 0', color: '#7A5C4E', fontWeight: 600 }}>Overall Compliance Rate</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, flex: 1 }}>
                    {[
                        ['24', 'Scheduled Today', null],
                        ['21', 'Administered', '#28a745'],
                        [stats.missedMeds || 2, 'Missed', '#dc3545'],
                        [stats.delayedMeds || 1, 'Delayed', '#ffc107'],
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

    // renderReports removed — reports are now embedded in System Overview (OverviewTab)

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
            case 'reports': return renderOverview(); // redirect to overview which contains reports
            default: return renderOverview();
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">
                {/* Mobile drawer backdrop — click to close */}
                {mobileSidebarOpen && (
                    <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />
                )}
                <div
                    className={`sidebar${mobileSidebarOpen ? ' mobile-open' : ''}`}
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
                            // Reports & Analytics removed — now in System Overview (lower section)
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
                        {renderContent()}
                    </div>
                </div>
            </div>

            {/* Toast Notifications */}
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

            {/* Modals */}
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

            {rejectionModal.isOpen && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="registration-modal" style={{ maxWidth: 450, padding: 32, background: '#fff', borderRadius: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1.5px solid #E8D6CC', paddingBottom: 14 }}>
                            <h4 style={{ margin: 0, color: '#1A0A00', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <FaExclamationTriangle color="#dc3545" />
                                Reject Booking
                            </h4>
                            <button onClick={() => setRejectionModal({ isOpen: false, bookingId: null, reason: '' })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E', fontSize: '1.2rem' }}>
                                <FaTimes />
                            </button>
                        </div>

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
                                marginBottom: 22,
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button className="btn-outline-sm" onClick={() => setRejectionModal({ isOpen: false, bookingId: null, reason: '' })} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E8D6CC', background: 'transparent', cursor: 'pointer' }}>
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