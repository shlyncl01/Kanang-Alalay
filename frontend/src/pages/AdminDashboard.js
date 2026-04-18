// AdminDashboard.js - Fix search bar to work consistently

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
    FaExclamationCircle, FaSpinner
} from 'react-icons/fa';
import UserRegistrationModal from '../components/UserRegistrationModal';
import AddInventoryModal from '../components/AddInventoryModal';
import StaffRosterTab from '../components/admin/StaffRosterTab';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

// ── Notification helpers ─────────────────────────────────────────────────────
const NOTIF_TYPES = {
    booking:   { color: '#17a2b8', icon: <FaCalendarAlt />, label: 'Booking', section: 'booking' },
    donation:  { color: '#28a745', icon: <FaMoneyBillWave />, label: 'Donation', section: 'donation' },
    staff:     { color: '#b85c2d', icon: <FaUsers />, label: 'Staff', section: 'roster' },
    inventory: { color: '#dc3545', icon: <FaExclamationTriangle />, label: 'Inventory', section: 'inventory' },
    system:    { color: '#6c757d', icon: <FaInfoCircle />, label: 'System', section: null },
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
    staff.filter(m => !m.isActive && !m.isVerified).forEach(m => notifs.push({
        id: `st-${m._id}`, type: 'staff',
        title: 'Staff Pending Activation',
        body: `${m.firstName} ${m.lastName} (${m.role})`,
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
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

// ── Confirmation Modal ────────────────────────────────────────────────────────
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

// ── Proof-of-payment URL builder ─────────────────────────────────────────────
// API_BASE_URL may end with /api — strip it so we get the server root.
const proofUrl = (filename) => {
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${base}/uploads/${filename}`;
};

// ── Details Modal ─────────────────────────────────────────────────────────────
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
                        <InfoRow label="Visitor"  value={data.name} />
                        <InfoRow label="Email"    value={data.email} />
                        <InfoRow label="Phone"    value={data.phone} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, background: 'var(--d-cream)', padding: 14, borderRadius: 8 }}>
                            <InfoMini label="Date"     value={new Date(data.visitDate).toLocaleDateString()} />
                            <InfoMini label="Time"     value={data.visitTime} />
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
                            <InfoMini label="Type"   value={data.donationType} />
                        </div>
                        {/* Appointment info for cash/in-person donations */}
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

                        {/* ── Proof of Payment ── */}
                        <div>
                            <small style={{ color: 'var(--d-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '.7rem' }}>
                                Proof of Payment
                            </small>
                            {data.proofOfPayment ? (
                                <div style={{ marginTop: 8 }}>
                                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(data.proofOfPayment) ? (
                                        // ── Image preview ──
                                        <a href={proofUrl(data.proofOfPayment)} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={proofUrl(data.proofOfPayment)}
                                                alt="Proof of payment"
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
                                        // ── PDF link ──
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

// ── Main Component ────────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const notifRef = useRef(null);

    const [activeSection, setActiveSection]     = useState('overview');
    const [searchQuery, setSearchQuery]         = useState('');
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen]             = useState(false);
    const [notifications, setNotifications]     = useState([]);
    const [readIds, setReadIds]                 = useState(new Set());

    const [currentPage, setCurrentPage]     = useState(1);
    const [bookingPage, setBookingPage]     = useState(1);
    const [donationPage, setDonationPage]   = useState(1);
    const [inventoryPage, setInventoryPage] = useState(1);
    const itemsPerPage = 10;

    const [bookings, setBookings]   = useState([]);
    const [donations, setDonations] = useState([]);
    const [staff, setStaff]         = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [apiError, setApiError]   = useState(null);

    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [showAddInventory, setShowAddInventory]           = useState(false);
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, type: '', data: null });

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', onConfirm: null, danger: false, confirmLabel: 'Confirm'
    });
    const showConfirm = (title, message, onConfirm, danger = false, confirmLabel = 'Confirm') => {
        setConfirmModal({ isOpen: true, title, message, onConfirm, danger, confirmLabel });
    };
    const closeConfirm = () => setConfirmModal(p => ({ ...p, isOpen: false }));

    const [otpSent, setOtpSent]                   = useState(false);
    const [otpCode, setOtpCode]                   = useState('');
    const [otpMessage, setOtpMessage]             = useState('');
    const [registeredUserId, setRegisteredUserId] = useState(null);
    const [registeredEmail, setRegisteredEmail]   = useState('');
    const [registeredName, setRegisteredName]     = useState('');

    const [stats, setStats] = useState({
        totalResidents: 0, staffOnDuty: 0, pendingBookings: 0,
        totalDonations: 0, totalDonationAmount: 0, lowStockItems: 0,
        complianceRate: 92, missedMeds: 2, delayedMeds: 1
    });

    const [editStatusModal, setEditStatusModal] = useState({ isOpen: false, booking: null, newStatus: '' });

    // ── Close dropdowns when clicking outside ─────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Build notifications from live data ────────────────────────────────
    useEffect(() => {
        const built = buildNotifications(bookings, donations, staff, inventory);
        setNotifications(built);
    }, [bookings, donations, staff, inventory]);

    const unreadCount = useMemo(() =>
        notifications.filter(n => !readIds.has(n.id)).length,
    [notifications, readIds]);

    const markAllRead = () => setReadIds(new Set(notifications.map(n => n.id)));
    const markRead    = (id) => setReadIds(prev => new Set([...prev, id]));

    // ==================== FIXED SEARCH FILTERS ====================
    // These now properly filter based on searchQuery and activeSection context
    
    const filteredStaff = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return staff;
        return staff.filter(m =>
            `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            m.username?.toLowerCase().includes(q) ||
            m.role?.toLowerCase().includes(q) ||
            m.staffId?.toLowerCase().includes(q) ||
            m.phone?.toLowerCase().includes(q)
        );
    }, [staff, searchQuery]);

    const filteredBookings = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return bookings;
        return bookings.filter(b =>
            b.name?.toLowerCase().includes(q) ||
            b.email?.toLowerCase().includes(q) ||
            b.phone?.toLowerCase().includes(q) ||
            b.purpose?.toLowerCase().includes(q) ||
            b.status?.toLowerCase().includes(q) ||
            (b.firstName && b.firstName.toLowerCase().includes(q)) ||
            (b.lastName && b.lastName.toLowerCase().includes(q))
        );
    }, [bookings, searchQuery]);

    const filteredDonations = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return donations;
        return donations.filter(d =>
            d.donorName?.toLowerCase().includes(q) ||
            d.email?.toLowerCase().includes(q) ||
            d.donationType?.toLowerCase().includes(q) ||
            d.paymentStatus?.toLowerCase().includes(q) ||
            (d.firstName && d.firstName.toLowerCase().includes(q)) ||
            (d.lastName && d.lastName.toLowerCase().includes(q))
        );
    }, [donations, searchQuery]);

    const filteredInventory = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return inventory;
        return inventory.filter(i =>
            i.name?.toLowerCase().includes(q) ||
            i.category?.toLowerCase().includes(q) ||
            i.status?.toLowerCase().includes(q)
        );
    }, [inventory, searchQuery]);

    // Reset pages when section or search changes
    useEffect(() => {
        setCurrentPage(1);
        setBookingPage(1);
        setDonationPage(1);
        setInventoryPage(1);
    }, [activeSection, searchQuery]);

    // Clear search when changing sections (optional - remove if you want search to persist)
    // Uncomment the line below if you want search to clear when changing sections
    // useEffect(() => { setSearchQuery(''); }, [activeSection]);

    // ── API helper ────────────────────────────────────────────────────────
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

    // ── Initial data load ─────────────────────────────────────────────────
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
    }, [fetchApi]);

    useEffect(() => {
        if (activeSection === 'staff' || activeSection === 'roster') fetchStaffList();
    }, [activeSection]);

    const fetchStaffList = async () => {
        const d = await fetchApi('/admin/staff');
        if (d.success) setStaff(d.staff || []);
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
        setLoading(false);
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

    // ── Pagination renderer ───────────────────────────────────────────────
    const renderPagination = (total, page, setPage) => {
        const pages = Math.ceil(total / itemsPerPage);
        if (pages <= 1) return null;
        return (
            <div className="pagination-container">
                <span className="pagination-info">
                    Showing {Math.min((page - 1) * itemsPerPage + 1, total)}–{Math.min(page * itemsPerPage, total)} of {total}
                </span>
                <div className="pagination-controls">
                    <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&laquo; Prev</button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                        <button key={n} className={`page-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                    ))}
                    <button className="page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next &raquo;</button>
                </div>
            </div>
        );
    };

    // ── Staff actions ─────────────────────────────────────────────────────
    const generateRegistrationCode = async (role = 'staff') => {
        const d = await fetchApi('/admin/generate-codes', {
            method: 'POST', body: JSON.stringify({ count: 1, role })
        });
        if (d.success && d.codes?.length) {
            const code = d.codes[0].code;
            navigator.clipboard.writeText(code).catch(() => {});
            showConfirm(
                `Code Generated for ${role.toUpperCase()}`,
                `Registration code: ${code}\n\nThis code has been copied to your clipboard. Share it with the new staff member — they will use it to self-register their account on the Staff Registration page. Each code is single-use and expires in 72 hours.`,
                closeConfirm,
                false,
                'OK'
            );
        } else {
            showConfirm('Error', d.message || 'Failed to generate code.', closeConfirm, true, 'OK');
        }
    };

    const sendOtp = async (email, userId, firstName) => {
        if (!email) { setOtpMessage('Email required'); return; }
        setOtpMessage('Sending OTP…');
        const d = await fetchApi('/auth/send-otp', {
            method: 'POST', body: JSON.stringify({ email, userId })
        });
        if (d.success) {
            setOtpSent(true);
            setRegisteredEmail(email);
            setRegisteredName(firstName || 'Staff');
            setOtpCode('');
            setOtpMessage(`OTP sent to ${email}.`);
        } else {
            setOtpMessage(d.message || 'Failed to send OTP.');
        }
    };

    const verifyOtp = async () => {
        if (!otpCode || otpCode.length < 6) { setOtpMessage('Enter the full 6-digit OTP.'); return; }
        const d = await fetchApi('/auth/verify-otp', {
            method: 'POST', body: JSON.stringify({ userId: registeredUserId, otp: otpCode })
        });
        if (d.success) {
            setOtpMessage('✅ Account activated!');
            setTimeout(() => {
                setOtpSent(false); setRegisteredUserId(null);
                setOtpCode(''); setOtpMessage('');
                fetchStaffList();
            }, 1500);
        } else {
            setOtpMessage('❌ Invalid or expired OTP.');
        }
    };

    const handleRegisterSuccess = async (data) => {
        const userId = data.userId || data.data?.userId;
        const email  = data.email  || data.data?.email;
        const first  = data.firstName || data.data?.firstName;
        if (userId && email) {
            setRegisteredUserId(userId);
            await sendOtp(email, userId, first);
        }
        fetchStaffList();
    };

    const toggleStaffStatus = async (id, cur) => {
        const next = cur === 'active' ? 'inactive' : 'active';
        const member = staff.find(m => m._id === id);
        showConfirm(
            `${next === 'active' ? 'Activate' : 'Deactivate'} Staff`,
            `Are you sure you want to ${next === 'active' ? 'activate' : 'deactivate'} ${member?.firstName} ${member?.lastName}?`,
            async () => {
                closeConfirm();
                setStaff(staff.map(m => m._id === id ? { ...m, isActive: next === 'active' } : m));
                await fetchApi(`/admin/staff/${id}/status`, {
                    method: 'PUT', body: JSON.stringify({ status: next })
                });
            },
            next === 'inactive',
            next === 'active' ? 'Activate' : 'Deactivate'
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
            },
            true,
            'Delete'
        );
    };

    const updateBookingStatus = async (id, status, rejectionReason = '') => {
        const booking = bookings.find(b => b._id === id);
        const actionLabel = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Complete';
        
        showConfirm(
            `${actionLabel} Booking`,
            `Are you sure you want to ${actionLabel.toLowerCase()} the booking for "${booking?.name}"?${status === 'rejected' ? '\n\nThe visitor will be notified via email.' : ''}`,
            async () => {
                closeConfirm();
                setBookings(bookings.map(b => b._id === id ? { ...b, status } : b));
                await fetchApi(`/bookings/${id}/status`, {
                    method: 'PUT', body: JSON.stringify({ status, rejectionReason })
                });
                
                if (status !== 'pending') {
                    setStats(p => ({ ...p, pendingBookings: Math.max(0, p.pendingBookings - 1) }));
                }
            },
            status === 'rejected',
            actionLabel
        );
    };

    const updateDonationStatus = async (id, paymentStatus) => {
        const donation = donations.find(d => d._id === id);
        showConfirm(
            'Update Donation Status',
            `Mark donation from "${donation?.donorName}" (₱${donation?.amount?.toLocaleString()}) as ${paymentStatus}?`,
            async () => {
                closeConfirm();
                setDonations(donations.map(d => d._id === id ? { ...d, paymentStatus } : d));
                await fetchApi(`/donations/${id}/payment`, {
                    method: 'PUT', body: JSON.stringify({ paymentStatus })
                });
            },
            false,
            'Confirm'
        );
    };

    const handleAddInventory = (item) => {
        setInventory(prev => [...prev, {
            _id: uuidv4(),
            name: item.name,
            category: item.category || 'General',
            quantity: Number(item.quantity),
            unit: item.unit || 'pcs',
            minThreshold: Number(item.minThreshold) || 10,
        }]);
        setShowAddInventory(false);
    };

    const handleViewDetails = (type, data) => setDetailsModal({ isOpen: true, type, data });
    const closeDetailsModal = () => setDetailsModal({ isOpen: false, type: '', data: null });

    const handleExportPDF = (type = 'bookings') => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Kanang-Alalay — ${type.charAt(0).toUpperCase() + type.slice(1)} Report`, 14, 18);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
        if (type === 'bookings') {
            autoTable(doc, {
                head: [['Visitor', 'Date', 'Time', 'Purpose', 'Status']],
                body: filteredBookings.map(b => [
                    b.name,
                    new Date(b.visitDate).toLocaleDateString(),
                    b.visitTime || '—',
                    b.purpose || '—',
                    b.status
                ]),
                startY: 32,
            });
        } else {
            autoTable(doc, {
                head: [['Donor', 'Amount', 'Type', 'Status']],
                body: filteredDonations.map(d => [
                    d.donorName,
                    `₱${d.amount?.toLocaleString()}`,
                    d.donationType,
                    d.paymentStatus
                ]),
                startY: 32,
            });
        }
        doc.save(`KA_${type}_${Date.now()}.pdf`);
    };

    const handleGenerateReport = (type) =>
        showConfirm('Generate Report', `A ${type} report will be emailed to ${user?.email}. Continue?`, closeConfirm, false, 'Send Report');

    const handleEditBooking = (b) => {
        setEditStatusModal({ isOpen: true, booking: b, newStatus: b.status });
    };

    const handleMarkAttendance = (id, name) =>
        showConfirm('Mark Attendance', `Log attendance for ${name} at ${new Date().toLocaleTimeString()}?`, closeConfirm, false, 'Log');

    // Search badge helper - shows search results count
    const getSearchBadge = (filteredArray, totalArray, label) => {
        if (!searchQuery.trim()) return null;
        if (filteredArray.length !== totalArray.length) {
            return (
                <small style={{ marginLeft: 8, color: 'var(--d-muted)', fontWeight: 400 }}>
                    — {filteredArray.length} result{filteredArray.length !== 1 ? 's' : ''} for "{searchQuery}"
                </small>
            );
        }
        return null;
    };

    // ==================== SECTION RENDERERS ====================

    const renderOverview = () => (
        <div>
            {apiError && (
                <div className="api-error-banner">
                    <FaExclamationCircle /> {apiError}
                    <button onClick={() => setApiError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' }}><FaTimes /></button>
                </div>
            )}
            <div className="welcome-banner card-white">
                <div className="welcome-text">
                    <h2>Welcome back, {user?.firstName} {user?.lastName}</h2>
                    <p>
                        {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        {' '}&nbsp;·&nbsp;{' '}
                        {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <button className="btn-outline-sm" onClick={handleRefresh} title="Refresh all data">
                    <FaSync /> Refresh
                </button>
            </div>

            <div className="stats-grid">
                {[
                    { bg: '#b85c2d', icon: <FaUsers />,        val: stats.totalResidents,                              label: 'Total Residents',    section: null },
                    { bg: '#28a745', icon: <FaUserMd />,        val: stats.staffOnDuty,                                 label: 'Staff on Duty',      section: 'roster' },
                    { bg: '#ffc107', icon: <FaCalendarCheck />, val: stats.pendingBookings,                             label: 'Pending Bookings',   section: 'booking' },
                    { bg: '#17a2b8', icon: <FaChartBar />,      val: `₱${(stats.totalDonationAmount || 0).toLocaleString()}`, label: 'Total Donations', section: 'donation' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.section ? 'clickable' : ''}`}
                        onClick={() => s.section && setActiveSection(s.section)}
                        style={{ cursor: s.section ? 'pointer' : 'default' }}>
                        <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                        <div className="stat-info"><h3>{s.val}</h3><p>{s.label}</p></div>
                    </div>
                ))}
            </div>

            <div className="content-row">
                <div className="card-white" style={{ flex: 1 }}>
                    <div className="card-header">
                        <h5>Recent Bookings</h5>
                        <button className="btn-view-all" onClick={() => setActiveSection('booking')}>View All</button>
                    </div>
                    {bookings.length === 0 ? (
                        <div className="no-data">No bookings yet.</div>
                    ) : (
                        <table className="custom-table">
                            <thead><tr><th>Name</th><th>Date</th><th>Status</th></tr></thead>
                            <tbody>
                                {bookings.slice(0, 5).map(b => (
                                    <tr key={b._id} style={{ cursor: 'pointer' }} onClick={() => handleViewDetails('booking', b)}>
                                        <td>{b.name}</td>
                                        <td>{new Date(b.visitDate).toLocaleDateString()}</td>
                                        <td><span className={`status ${b.status}`}>{b.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="card-white" style={{ flex: 1 }}>
                    <div className="card-header">
                        <h5>Recent Donations</h5>
                        <button className="btn-view-all" onClick={() => setActiveSection('donation')}>View All</button>
                    </div>
                    {donations.length === 0 ? (
                        <div className="no-data">No donations yet.</div>
                    ) : (
                        <table className="custom-table">
                            <thead><tr><th>Donor</th><th>Amount</th><th>Status</th></tr></thead>
                            <tbody>
                                {donations.slice(0, 5).map(d => (
                                    <tr key={d._id} style={{ cursor: 'pointer' }} onClick={() => handleViewDetails('donation', d)}>
                                        <td>{d.donorName}</td>
                                        <td style={{ color: '#28a745', fontWeight: 600 }}>₱{d.amount?.toLocaleString()}</td>
                                        <td><span className={`status ${d.paymentStatus}`}>{d.paymentStatus}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStaffManagement = () => {
        const paged = filteredStaff.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        return (
            <div className="staff-management">
                <div className="card-white">
                    <div className="card-header">
                        <h5>
                            Staff Management 
                            {getSearchBadge(filteredStaff, staff, 'staff')}
                        </h5>
                        <button className="btn-primary-sm" onClick={() => setShowRegistrationModal(true)}>
                            <FaUserPlus /> Add New Staff
                        </button>
                    </div>

                    <div className="quick-code-section">
                        <h6>
                            Generate Registration Codes
                            <span className="info-tooltip" title="Registration codes allow new staff to self-register their account. Each code is single-use and expires in 72 hours. Share the generated code with the new hire — they enter it on the Staff Registration page to create their account.">
                                <FaInfoCircle style={{ marginLeft: 6, color: 'var(--d-muted)', fontSize: '.8rem', verticalAlign: 'middle' }} />
                            </span>
                        </h6>
                        <p style={{ fontSize: '.8rem', color: 'var(--d-muted)', marginBottom: 10, marginTop: -6 }}>
                            Generate a one-time code and share it with new staff so they can register their own account.
                        </p>
                        <div className="code-buttons">
                            <button className="btn-outline-sm" onClick={() => generateRegistrationCode('staff')}><FaIdCard /> Staff Code</button>
                            <button className="btn-outline-sm" onClick={() => generateRegistrationCode('nurse')}><FaUserMd /> Nurse Code</button>
                            <button className="btn-outline-sm" onClick={() => generateRegistrationCode('caregiver')}><FaUserTag /> Caregiver Code</button>
                            <button className="btn-outline-sm" onClick={() => generateRegistrationCode('admin')}><FaUserTag /> Admin Code</button>
                        </div>
                    </div>

                    <table className="custom-table">
                        <thead>
                            <tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {paged.length === 0 ? (
                                <tr><td colSpan="5" className="text-center" style={{ padding: '2rem', color: 'var(--d-muted)' }}>
                                    {searchQuery ? `No staff match "${searchQuery}"` : 'No staff found.'}
                                </td></tr>
                            ) : paged.map(m => (
                                <tr key={m._id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <FaUserCircle size={30} color="var(--d-border)" />
                                            <div>
                                                <strong>{m.firstName} {m.lastName}</strong><br />
                                                <small className="text-muted">Staff ID: {m.staffId || m.employeeId || 'Auto-generated'}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div><FaEnvelope size={11} style={{ marginRight: 5, color: 'var(--d-muted)' }} />{m.email}</div>
                                        {m.phone && <small className="text-muted"><FaPhone size={10} style={{ marginRight: 4 }} />{m.phone}</small>}
                                    </td>
                                    <td><span className={`badge-custom ${m.role}`}>{m.role}</span></td>
                                    <td><span className={`status ${m.isActive ? 'active' : 'inactive'}`}>{m.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td className="actions">
                                        <span title="Mark Attendance" className="edit" onClick={() => handleMarkAttendance(m._id, `${m.firstName} ${m.lastName}`)}><FaClock /></span>
                                        {m.isActive
                                            ? <span title="Deactivate" className="deactivate" onClick={() => toggleStaffStatus(m._id, 'active')}><FaBan /></span>
                                            : <span title="Activate"   className="activate"   onClick={() => toggleStaffStatus(m._id, 'inactive')}><FaCheckCircle /></span>
                                        }
                                        <span title="Delete" className="delete" onClick={() => deleteStaff(m._id)}><FaTrash /></span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {renderPagination(filteredStaff.length, currentPage, setCurrentPage)}

                    {otpSent && registeredUserId && (
                        <div className="otp-panel">
                            <div className="otp-panel-header">
                                <FaCheckCircle color="#28a745" />
                                <span>Activate Account — <strong>{registeredName}</strong></span>
                                <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--d-muted)' }}
                                    onClick={() => { setOtpSent(false); setOtpCode(''); setOtpMessage(''); }}>
                                    <FaTimes />
                                </button>
                            </div>
                            <p style={{ margin: '0 0 12px', fontSize: '.88rem', color: 'var(--d-muted)' }}>
                                OTP sent to <strong>{registeredEmail}</strong>
                            </p>
                            <div className="otp-input-group">
                                <input
                                    type="text"
                                    placeholder="6-digit OTP"
                                    value={otpCode}
                                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength="6"
                                    className="otp-input"
                                />
                                <button className="verify-btn" onClick={verifyOtp}>
                                    <FaCheck style={{ marginRight: 6 }} /> Verify
                                </button>
                                <button className="btn-outline-sm" onClick={() => sendOtp(registeredEmail, registeredUserId, registeredName)}>
                                    Resend OTP
                                </button>
                            </div>
                            {otpMessage && (
                                <p className={`otp-message ${otpMessage.includes('✅') ? 'success' : otpMessage.includes('❌') ? 'error' : ''}`} style={{ marginTop: 10 }}>
                                    {otpMessage}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderBookingManagement = () => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        const bookingsByDate = filteredBookings.reduce((acc, b) => {
            if (!b.visitDate) return acc;
            const d = new Date(b.visitDate);
            if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) {
                const key = d.getDate();
                if (!acc[key]) acc[key] = [];
                acc[key].push(b);
            }
            return acc;
        }, {});

        const STATUS_STYLE = {
            approved:  { bg: '#e0faf4', border: '#20c997', text: '#0d6b4f', label: 'Booked' },
            pending:   { bg: '#fff8e1', border: '#ffc107', text: '#7c5a00', label: 'Pending' },
            rejected:  { bg: '#fdecea', border: '#e57373', text: '#b71c1c', label: 'Urgent' },
            completed: { bg: '#e8eaf6', border: '#5c6bc0', text: '#2c3494', label: 'Done' },
        };

        const monthLabel = today.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
        const paged = filteredBookings.slice((bookingPage - 1) * itemsPerPage, bookingPage * itemsPerPage);

        return (
            <div>
                <div className="card-white" style={{ marginBottom: 18 }}>
                    <div className="card-header">
                        <h5>
                            <FaCalendarAlt color="var(--d-orange)" style={{ marginRight: 8 }} />
                            Admission &amp; Booking — {monthLabel}
                            {getSearchBadge(filteredBookings, bookings, 'bookings')}
                        </h5>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {Object.entries(STATUS_STYLE).map(([k, v]) => (
                                <span key={k} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontSize: '.7rem', fontWeight: 600, color: v.text,
                                    background: v.bg, border: `1px solid ${v.border}`,
                                    padding: '2px 8px', borderRadius: 12,
                                }}>{v.label}</span>
                            ))}
                            <button className="btn-primary-sm" onClick={() => handleExportPDF('bookings')}>
                                <FaDownload /> Export PDF
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '.7rem', fontWeight: 700, color: 'var(--d-muted)', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`blank-${i}`} style={{ minHeight: 64, background: '#fafafa', borderRadius: 6, border: '1px solid var(--d-border)', opacity: 0.4 }} />
                        ))}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const dayBookings = bookingsByDate[day] || [];
                            const isToday = day === today.getDate();
                            return (
                                <div key={day} style={{
                                    minHeight: 64, padding: '4px 5px', borderRadius: 6,
                                    border: isToday ? '2px solid var(--d-orange)' : '1px solid var(--d-border)',
                                    background: 'var(--d-white)',
                                }}>
                                    <div style={{ fontSize: '.69rem', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--d-orange-dk)' : 'var(--d-muted)', textAlign: 'right', marginBottom: 3 }}>{day}</div>
                                    {dayBookings.slice(0, 2).map(b => {
                                        const s = STATUS_STYLE[b.status] || STATUS_STYLE.pending;
                                        return (
                                            <div key={b._id}
                                                title={`${b.name} — ${b.purpose}`}
                                                onClick={() => handleViewDetails('booking', b)}
                                                style={{
                                                    background: s.bg, border: `1.5px solid ${s.border}`,
                                                    color: s.text, borderRadius: 4, padding: '2px 5px',
                                                    fontSize: '.62rem', fontWeight: 700, marginBottom: 2,
                                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}
                                            >{s.label}</div>
                                        );
                                    })}
                                    {dayBookings.length > 2 && (
                                        <div style={{ fontSize: '.6rem', color: 'var(--d-muted)', fontWeight: 600 }}>+{dayBookings.length - 2}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="card-white">
                    <div className="card-header">
                        <h5>
                            All Bookings 
                            {getSearchBadge(filteredBookings, bookings, 'bookings')}
                        </h5>
                        {searchQuery && filteredBookings.length === 0 && (
                            <button className="btn-outline-sm" onClick={() => setSearchQuery('')}>
                                <FaTimes /> Clear Search
                            </button>
                        )}
                    </div>
                    {filteredBookings.length === 0 ? (
                        <p className="no-data">
                            {searchQuery ? `No bookings match "${searchQuery}". Try a different search term.` : 'No bookings found.'}
                        </p>
                    ) : (
                        <>
                            <table className="custom-table">
                                <thead>
                                    <tr><th>Visitor</th><th>Details</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {paged.map(b => (
                                        <tr key={b._id}>
                                            <td>
                                                <strong>{b.name}</strong><br />
                                                <small><FaEnvelope size={10} /> {b.email} &nbsp;|&nbsp; <FaPhone size={10} /> {b.phone}</small>
                                            </td>
                                            <td>
                                                <FaCalendarAlt size={11} style={{ marginRight: 5 }} />
                                                {new Date(b.visitDate).toLocaleDateString()} at {b.visitTime}<br />
                                                <small>Purpose: {b.purpose} ({b.numberOfVisitors} pax)</small>
                                            </td>
                                            <td><span className={`status ${b.status}`}>{b.status}</span></td>
                                            <td className="actions">
                                                {b.status === 'pending' && <>
                                                    <button className="btn-success-sm" onClick={() => updateBookingStatus(b._id, 'approved')}>Approve</button>
                                                    <button className="btn-danger-sm" onClick={() => updateBookingStatus(b._id, 'rejected')}>Reject</button>
                                                </>}
                                                {b.status === 'approved' && (
                                                    <button className="btn-primary-sm" onClick={() => updateBookingStatus(b._id, 'completed')}>Complete</button>
                                                )}
                                                <span title="View Details" className="view" onClick={() => handleViewDetails('booking', b)}><FaEye /></span>
                                                <span title="Edit Status" className="edit" onClick={() => handleEditBooking(b)}><FaEdit /></span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {renderPagination(filteredBookings.length, bookingPage, setBookingPage)}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderDonationManagement = () => {
        const paged = filteredDonations.slice((donationPage - 1) * itemsPerPage, donationPage * itemsPerPage);
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>
                        Donation Management 
                        {getSearchBadge(filteredDonations, donations, 'donations')}
                    </h5>
                    <button className="btn-primary-sm" onClick={() => handleExportPDF('donations')}>
                        <FaDownload /> Export PDF
                    </button>
                </div>
                {filteredDonations.length === 0 ? (
                    <p className="no-data">
                        {searchQuery ? `No donations match "${searchQuery}". Try a different search term.` : 'No donations found.'}
                    </p>
                ) : (
                    <>
                        <table className="custom-table">
                            <thead>
                                <tr><th>Donor</th><th>Amount / Type</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {paged.map(d => (
                                    <tr key={d._id}>
                                        <td><strong>{d.donorName}</strong><br /><small>{d.email}</small></td>
                                        <td>
                                            <strong style={{ color: '#28a745' }}>₱{d.amount?.toLocaleString()}</strong><br />
                                            <small>{d.donationType}{d.receiptNumber && ` | Rec: ${d.receiptNumber}`}</small>
                                        </td>
                                        <td><span className={`status ${d.paymentStatus}`}>{d.paymentStatus}</span></td>
                                        <td className="actions">
                                            {d.paymentStatus === 'pending' && <button className="btn-success-sm" onClick={() => updateDonationStatus(d._id, 'paid')}>Mark Paid</button>}
                                            {d.paymentStatus === 'processing' && <button className="btn-primary-sm" onClick={() => updateDonationStatus(d._id, 'paid')}>Confirm</button>}
                                            <span title="View Details" className="view" onClick={() => handleViewDetails('donation', d)}><FaEye /></span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {renderPagination(filteredDonations.length, donationPage, setDonationPage)}
                    </>
                )}
            </div>
        );
    };

    const renderAlerts = () => (
        <div className="card-white">
            <div className="card-header">
                <h5>
                    Alerts &amp; Notifications
                    {unreadCount > 0 && <span className="notif-count-badge" style={{ marginLeft: 10 }}>{unreadCount}</span>}
                </h5>
                <div style={{ display: 'flex', gap: 8 }}>
                    {unreadCount > 0 && (
                        <button className="btn-outline-sm" onClick={markAllRead}><FaCheck /> Mark All Read</button>
                    )}
                    <button className="btn-primary-sm" onClick={handleRefresh}><FaSync /> Refresh</button>
                </div>
            </div>

            {notifications.length === 0 ? (
                <div className="empty-state">
                    <FaBell style={{ fontSize: '3rem', color: 'var(--d-border)', display: 'block', margin: '0 auto 12px' }} />
                    <p>System is running smoothly. No alerts at this time.</p>
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
                                style={{ cursor: targetSection ? 'pointer' : 'default' }}
                                onClick={() => {
                                    markRead(n.id);
                                    if (targetSection) {
                                        setActiveSection(targetSection);
                                        setNotifOpen(false);
                                    }
                                }}
                            >
                                <div className="alert-row-icon" style={{ background: meta.color + '20', color: meta.color }}>
                                    {meta.icon}
                                </div>
                                <div className="alert-row-body">
                                    <strong>{n.title}</strong>
                                    <span>{n.body}</span>
                                    {targetSection && <small style={{ color: meta.color, fontWeight: 600, marginTop: 2, display: 'block' }}>Click to view →</small>}
                                </div>
                                <div className="alert-row-meta">
                                    <span className="alert-type-tag" style={{ background: meta.color + '18', color: meta.color }}>{meta.label}</span>
                                    <span className="alert-time">{timeAgo(n.time)}</span>
                                </div>
                                {!isRead && <div className="unread-dot" />}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderInventory = () => {
        const paged = filteredInventory.slice((inventoryPage - 1) * itemsPerPage, inventoryPage * itemsPerPage);
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>
                        Inventory &amp; Stock 
                        {getSearchBadge(filteredInventory, inventory, 'items')}
                    </h5>
                    <button className="btn-primary-sm" onClick={() => setShowAddInventory(true)}>
                        <FaBox /> Add Item
                    </button>
                </div>
                <div className="stats-grid" style={{ marginBottom: 20 }}>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#dc3545' }}><FaExclamationTriangle /></div>
                        <div className="stat-info"><h3 style={{ color: '#dc3545' }}>{realLowStockCount}</h3><p>Low Stock</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#17a2b8' }}><FaBox /></div>
                        <div className="stat-info"><h3>{inventory.length}</h3><p>Total Items</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#ffc107' }}><FaClock /></div>
                        <div className="stat-info">
                            <h3>{inventory.filter(i => {
                                if (!i.expirationDate) return false;
                                const days = (new Date(i.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24);
                                return days >= 0 && days <= 30;
                            }).length}</h3>
                            <p>Expiring Soon</p>
                        </div>
                    </div>
                </div>
                {filteredInventory.length === 0 ? (
                    <div className="no-data" style={{ textAlign: 'center', padding: '2rem', color: 'var(--d-muted)' }}>
                        {searchQuery ? `No items match "${searchQuery}". Try a different search term.` : 'No inventory yet. Click "Add Item" to begin.'}
                    </div>
                ) : (
                    <>
                        <table className="custom-table">
                            <thead>
                                <tr><th>Item</th><th>Category</th><th>Stock</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {paged.map(i => {
                                    const threshold = i.minThreshold || 10;
                                    const isLow = i.quantity <= threshold;
                                    return (
                                        <tr key={i._id}>
                                            <td><strong>{i.name}</strong></td>
                                            <td><span className="badge-custom staff">{i.category}</span></td>
                                            <td>{i.quantity} {i.unit}</td>
                                            <td>
                                                <span className={`status ${isLow ? 'inactive' : 'active'}`}>
                                                    {i.quantity === 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {renderPagination(filteredInventory.length, inventoryPage, setInventoryPage)}
                    </>
                )}
            </div>
        );
    };

    const renderCompliance = () => {
        const weeklyData = [
            { day: 'Mon', rate: 88, color: '#F96B38' },
            { day: 'Tue', rate: 91, color: '#F96B38' },
            { day: 'Wed', rate: 85, color: '#E65100' },
            { day: 'Thu', rate: 95, color: '#28a745' },
            { day: 'Fri', rate: 92, color: '#F96B38' },
            { day: 'Sat', rate: 89, color: '#F96B38' },
            { day: 'Sun', rate: 92, color: '#28a745' },
        ];

        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>Medication Compliance Chart</h5>
                    <button className="btn-primary-sm" onClick={() => handleGenerateReport('Compliance')}>
                        <FaFileAlt /> Full Report
                    </button>
                </div>
                <div className="compliance-overview">
                    <div className="compliance-score">
                        <h1>{stats.complianceRate || 92}%</h1>
                        <p>Overall Compliance Rate</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1, minWidth: 250 }}>
                        {[
                            ['24', 'Scheduled Today', null],
                            ['21', 'Administered', '#28a745'],
                            [stats.missedMeds || 2, 'Missed', '#dc3545'],
                            [stats.delayedMeds || 1, 'Delayed', '#ffc107'],
                        ].map(([v, l, c], i) => (
                            <div key={i} className="stat-box">
                                <h3 style={c ? { color: c } : {}}>{v}</h3>
                                <p>{l}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="chart-placeholder">
                    <h6 style={{ margin: '0 0 16px', color: 'var(--d-muted)', textTransform: 'uppercase', fontSize: '.8rem', letterSpacing: '.06em' }}>
                        Weekly Adherence Trend
                    </h6>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, padding: '0 8px' }}>
                        {weeklyData.map((item, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <small style={{ fontSize: '.68rem', color: 'var(--d-muted)', fontWeight: 600 }}>{item.rate}%</small>
                                <div style={{
                                    width: '100%',
                                    height: `${item.rate}%`,
                                    borderRadius: '6px 6px 0 0',
                                    background: `linear-gradient(180deg, ${item.color}, ${item.color === '#28a745' ? '#1E7D56' : '#D94E1B'})`,
                                    transition: 'all .3s',
                                }} />
                                <small style={{ fontSize: '.68rem', color: 'var(--d-muted)' }}>
                                    {item.day}
                                </small>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 16, padding: '12px', background: 'var(--d-cream)', borderRadius: 8 }}>
                        <p style={{ margin: 0, fontSize: '.82rem', color: 'var(--d-muted)', textAlign: 'center' }}>
                            Average <strong style={{ color: 'var(--d-orange-dk)' }}>{(weeklyData.reduce((sum, d) => sum + d.rate, 0) / weeklyData.length).toFixed(1)}% adherence</strong> tracked this week.
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const renderReports = () => {
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>Reports &amp; Analytics</h5>
                    <button className="btn-primary-sm" onClick={() => handleExportPDF('bookings')}>
                        <FaDownload /> Export PDF
                    </button>
                </div>
                <div className="reports-grid">
                    {[
                        { title: 'Financial Summary', val: `₱${(stats.totalDonationAmount || 0).toLocaleString()}`, valColor: '#28a745', desc: 'Total donations collected this period.', type: 'Financial Overview' },
                        { title: 'Staff Performance', val: stats.staffOnDuty, desc: 'Active staff members currently on duty.', type: 'Staff Performance' },
                        { title: 'Resident Health', val: '0', desc: 'Incident reports filed this month.', type: 'Resident Health' },
                        { title: 'Booking Summary', val: bookings.length, desc: 'Total booking requests received.', type: 'Booking Summary' },
                        { title: 'Inventory Status', val: realLowStockCount, valColor: realLowStockCount > 0 ? '#dc3545' : '#28a745', desc: 'Items currently low in stock.', type: 'Inventory Status' },
                        { title: 'Donation Records', val: donations.length, desc: 'Total donation entries recorded.', type: 'Donation Report' },
                        { title: 'Pending Approvals', val: bookings.filter(b => b.status === 'pending').length, desc: 'Bookings awaiting approval.', type: 'Pending Approvals' },
                        { title: 'Active Staff', val: staff.filter(s => s.isActive).length, desc: 'Currently active staff members.', type: 'Active Staff' },
                    ].map((r, i) => (
                        <div key={i} className="report-card">
                            <h6>{r.title}</h6>
                            <h3 style={r.valColor ? { color: r.valColor } : {}}>{r.val}</h3>
                            <p>{r.desc}</p>
                            <button className="btn-outline-sm" onClick={() => handleGenerateReport(r.type)} style={{ width: '100%' }}>
                                Generate Report
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (loading) return (
            <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 200 }}>
                <FaSpinner className="spin" style={{ color: 'var(--d-orange)', fontSize: '1.5rem' }} />
                Loading dashboard…
            </div>
        );
        switch (activeSection) {
            case 'overview':   return renderOverview();
            case 'staff':      return renderStaffManagement();
            case 'roster':     return <StaffRosterTab staff={staff} onRefresh={fetchStaffList} />;
            case 'booking':    return renderBookingManagement();
            case 'donation':   return renderDonationManagement();
            case 'alerts':     return renderAlerts();
            case 'inventory':  return renderInventory();
            case 'compliance': return renderCompliance();
            case 'reports':    return renderReports();
            default:           return renderOverview();
        }
    };

    // Get placeholder text for search based on active section
    const getSearchPlaceholder = () => {
        switch (activeSection) {
            case 'staff':
            case 'roster':
                return 'Search by name, email, role, or staff ID…';
            case 'booking':
                return 'Search by visitor name, email, phone, purpose, or status…';
            case 'donation':
                return 'Search by donor name, email, donation type, or status…';
            case 'inventory':
                return 'Search by item name, category, or status…';
            default:
                return 'Search across dashboard…';
        }
    };

    // ==================== MAIN RENDER ====================
    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">

                {/* Sidebar */}
                <div className="sidebar">
                    <div className="sidebar-header">
                        <div className="brand-section">
                            <div className="logo-circle" />
                            <div className="brand-text"><h4>Kanang-Alalay</h4><h5>Admin Panel</h5></div>
                        </div>
                    </div>

                    <ul className="sidebar-menu">
                        {[
                            { key: 'overview', icon: <FaHome />, label: 'System Overview' },
                            { key: 'staff', icon: <FaUsers />, label: 'User Management' },
                            { key: 'roster', icon: <FaCalendarAlt />, label: 'Staff Roster' },
                            { key: 'alerts', icon: <FaBell />, label: 'Alerts & Notifications', badge: unreadCount },
                            { key: 'booking', icon: <FaCalendarCheck />, label: 'Admission & Booking', badge: stats.pendingBookings },
                            { key: 'inventory', icon: <FaExclamationTriangle />, label: 'Inventory Alerts', badge: realLowStockCount },
                            { key: 'compliance', icon: <FaChartBar />, label: 'Compliance Chart' },
                            { key: 'donation', icon: <FaMoneyBillWave />, label: 'Donation Ledger' },
                            { key: 'reports', icon: <FaFileAlt />, label: 'Reports & Analytics' },
                        ].map(({ key, icon, label, badge }) => (
                            <li key={key} className={activeSection === key ? 'active' : ''} onClick={() => setActiveSection(key)}>
                                {icon} {label}
                                {badge > 0 && <span className="sidebar-badge">{badge}</span>}
                            </li>
                        ))}
                    </ul>

                    <div className="sidebar-footer" onClick={handleLogout}>
                        <FaSignOutAlt /> <span>Sign Out</span>
                    </div>
                </div>

                {/* Main area */}
                <div className="main-content-wrapper">

                    {/* Topbar with Search */}
                    <div className="admin-topbar">
                        <div className="topbar-left">
                            <div className="topbar-search-wrapper">
                                <FaSearch className="topbar-search-icon" />
                                <input
                                    type="text"
                                    className="topbar-search-input"
                                    placeholder={getSearchPlaceholder()}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                                        <FaTimes /> Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="topbar-right">

                            {/* Notification Bell */}
                            <div className="topbar-notif-menu" ref={notifRef}>
                                <button
                                    className="topbar-icon-btn"
                                    onClick={() => { setNotifOpen(o => !o); setAccountMenuOpen(false); }}
                                    title="Notifications"
                                >
                                    <FaBell />
                                    {unreadCount > 0 && (
                                        <span className="notif-dot-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                                    )}
                                </button>

                                {notifOpen && (
                                    <div className="notif-dropdown">
                                        <div className="notif-dropdown-header">
                                            <span>Notifications</span>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {unreadCount > 0 && (
                                                    <button className="notif-action-btn" onClick={markAllRead}>Mark all read</button>
                                                )}
                                                <button className="notif-action-btn" onClick={handleRefresh}><FaSync /></button>
                                            </div>
                                        </div>

                                        <div className="notif-list">
                                            {notifications.length === 0 ? (
                                                <div className="notif-empty">
                                                    <FaBell style={{ fontSize: '2rem', color: 'var(--d-border)' }} />
                                                    <p>All caught up! No new alerts.</p>
                                                </div>
                                            ) : notifications.slice(0, 8).map(n => {
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
                                                            }
                                                        }}
                                                    >
                                                        <div className="notif-item-icon" style={{ color: meta.color }}>{meta.icon}</div>
                                                        <div className="notif-item-body">
                                                            <strong>{n.title}</strong>
                                                            <span>{n.body}</span>
                                                            <small>{timeAgo(n.time)}</small>
                                                        </div>
                                                        {!isRead && <div className="notif-unread-dot" style={{ background: meta.color }} />}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {notifications.length > 8 && (
                                            <div className="notif-footer" onClick={() => { setActiveSection('alerts'); setNotifOpen(false); }}>
                                                View all {notifications.length} notifications →
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* User dropdown */}
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
                                    <ul className="topbar-dropdown">
                                        <li onClick={() => { navigate('/profile'); setAccountMenuOpen(false); }}>
                                            <FaUserCircle /> View Profile
                                        </li>
                                        <li onClick={() => { navigate('/settings'); setAccountMenuOpen(false); }}>
                                            <FaCog /> Account Settings
                                        </li>
                                        <li onClick={() => { navigate('/help'); setAccountMenuOpen(false); }}>
                                            <FaQuestionCircle /> Help Center
                                        </li>
                                        <li className="dropdown-divider" onClick={handleLogout}>
                                            <FaSignOutAlt /> Sign Out
                                        </li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Page content */}
                    <div className="main-content">{renderContent()}</div>
                </div>
            </div>

            {/* Modals */}
            <UserRegistrationModal
                isOpen={showRegistrationModal}
                onClose={() => setShowRegistrationModal(false)}
                onRegister={handleRegisterSuccess}
            />
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

            {editStatusModal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="registration-modal" style={{ maxWidth: 420, padding: 32 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1.5px solid var(--d-border)', paddingBottom: 14 }}>
                            <h4 style={{ margin: 0, color: 'var(--d-ink)' }}>Update Booking Status</h4>
                            <button onClick={() => setEditStatusModal({ isOpen: false, booking: null, newStatus: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--d-muted)', fontSize: '1.2rem' }}><FaTimes /></button>
                        </div>
                        <p style={{ fontSize: '.88rem', color: 'var(--d-muted)', marginBottom: 16 }}>
                            Booking for: <strong>{editStatusModal.booking?.name}</strong>
                        </p>
                        <label style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--d-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'block' }}>
                            New Status
                        </label>
                        <select
                            value={editStatusModal.newStatus}
                            onChange={e => setEditStatusModal(p => ({ ...p, newStatus: e.target.value }))}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid var(--d-border)',
                                borderRadius: 9, fontFamily: 'var(--d-font-body)', fontSize: '.92rem',
                                background: 'var(--d-cream)', color: 'var(--d-ink)', outline: 'none',
                                marginBottom: 22,
                            }}
                        >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="completed">Completed</option>
                        </select>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button className="btn-outline-sm" onClick={() => setEditStatusModal({ isOpen: false, booking: null, newStatus: '' })}>Cancel</button>
                            <button
                                className="btn-primary-sm"
                                onClick={() => {
                                    updateBookingStatus(editStatusModal.booking._id, editStatusModal.newStatus);
                                    setEditStatusModal({ isOpen: false, booking: null, newStatus: '' });
                                }}
                            >Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;