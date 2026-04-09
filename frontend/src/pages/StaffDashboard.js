import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    FaBars, FaUserCircle, FaSearch, FaHome, FaCalendarCheck,
    FaMoneyBillWave, FaBell, FaFileAlt, FaSignOutAlt,
    FaChevronDown, FaEye, FaEdit, FaDownload, FaCheck,
    FaTimes, FaCog, FaQuestionCircle, FaPhone, FaEnvelope,
    FaCalendarAlt, FaSpinner
} from 'react-icons/fa';
import '../styles/Dashboard.css';
import '../styles/StaffDashboard.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://kanang-alalay-backend.onrender.com/api' : 'http://localhost:5000/api');

const StaffDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen]     = useState(true);
    const [activeSection, setActiveSection] = useState('overview');
    const [searchQuery, setSearchQuery]     = useState('');
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [loading, setLoading]             = useState(true);
    const [apiError, setApiError]           = useState(null);

    // Data
    const [bookings, setBookings]   = useState([]);
    const [donations, setDonations] = useState([]);
    const [alerts, setAlerts]       = useState([]);
    const [stats, setStats]         = useState({
        totalResidents: 0, pendingBookings: 0,
        totalDonations: 0, totalDonationAmount: 0
    });

    // Pagination
    const [bookingPage, setBookingPage]   = useState(1);
    const [donationPage, setDonationPage] = useState(1);
    const itemsPerPage = 10;

    // ── API helper ──────────────────────────────────────────────────────────
    const fetchApi = async (endpoint, options = {}) => {
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
            setApiError(`Connection error: ${err.message}`);
            return { success: false };
        }
    };

    // ── Initial load ────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [bookRes, donRes, statsRes] = await Promise.all([
                fetchApi('/bookings?limit=50'),
                fetchApi('/donations?limit=50'),
                fetchApi('/stats')
            ]);
            if (bookRes.success)   setBookings(bookRes.data || []);
            if (donRes.success)    setDonations(donRes.data || []);
            if (statsRes.success && statsRes.data) setStats(prev => ({ ...prev, ...statsRes.data }));
            setLoading(false);
        };
        load();
    }, []);

    useEffect(() => {
        setBookingPage(1);
        setDonationPage(1);
    }, [activeSection, searchQuery]);

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            logout();
            navigate('/login');
        }
    };

    // ── Working search filter ───────────────────────────────────────────────
    const filteredBookings = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return bookings;
        return bookings.filter(b =>
            b.name?.toLowerCase().includes(q) ||
            b.email?.toLowerCase().includes(q) ||
            b.phone?.toLowerCase().includes(q) ||
            b.purpose?.toLowerCase().includes(q) ||
            b.status?.toLowerCase().includes(q)
        );
    }, [bookings, searchQuery]);

    const filteredDonations = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return donations;
        return donations.filter(d =>
            d.donorName?.toLowerCase().includes(q) ||
            d.email?.toLowerCase().includes(q) ||
            d.donationType?.toLowerCase().includes(q) ||
            d.paymentStatus?.toLowerCase().includes(q)
        );
    }, [donations, searchQuery]);

    // ── Pagination helper ───────────────────────────────────────────────────
    const paginate = (arr, page) =>
        arr.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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

    // ── Actions ─────────────────────────────────────────────────────────────
    const updateBookingStatus = async (id, status) => {
        setBookings(prev => prev.map(b => b._id === id ? { ...b, status } : b));
        await fetchApi(`/bookings/${id}/status`, {
            method: 'PUT', body: JSON.stringify({ status })
        });
    };

    const handleExportPDF = (type = 'bookings') => {
        const doc = new jsPDF();
        doc.text(`Kanang-Alalay ${type.toUpperCase()} Report`, 14, 15);
        const rows = type === 'bookings'
            ? filteredBookings.map(b => [b.name, new Date(b.visitDate).toLocaleDateString(), b.status])
            : filteredDonations.map(d => [d.donorName, `₱${d.amount?.toLocaleString()}`, d.paymentStatus]);
        autoTable(doc, {
            head: [type === 'bookings' ? ['Name', 'Visit Date', 'Status'] : ['Donor', 'Amount', 'Status']],
            body: rows
        });
        doc.save(`KanangAlalay_${type}_report.pdf`);
    };

    // ── Sections ────────────────────────────────────────────────────────────
    const renderOverview = () => (
        <div>
            {apiError && <div className="login-error" style={{ marginBottom: 20 }}>{apiError}</div>}

            <div className="welcome-banner card-white">
                <div className="welcome-text">
                    <h2>Welcome back, {user?.firstName} {user?.lastName}</h2>
                    <p>
                        {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        &nbsp;·&nbsp; <span className="badge-custom staff">{user?.role?.toUpperCase()}</span>
                    </p>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card clickable" onClick={() => setActiveSection('bookings')}>
                    <div className="stat-icon" style={{ background: '#b85c2d' }}><FaCalendarCheck /></div>
                    <div className="stat-info"><h3>{stats.pendingBookings}</h3><p>Pending Bookings</p></div>
                </div>
                <div className="stat-card clickable" onClick={() => setActiveSection('donations')}>
                    <div className="stat-icon" style={{ background: '#17a2b8' }}><FaMoneyBillWave /></div>
                    <div className="stat-info"><h3>₱{stats.totalDonationAmount?.toLocaleString() || 0}</h3><p>Total Donations</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#28a745' }}><FaBell /></div>
                    <div className="stat-info"><h3>{alerts.length}</h3><p>Unread Alerts</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#6f42c1' }}><FaFileAlt /></div>
                    <div className="stat-info"><h3>{bookings.length}</h3><p>Total Bookings</p></div>
                </div>
            </div>

            <div className="content-row">
                {/* Recent Bookings preview */}
                <div className="card-white" style={{ flex: 1 }}>
                    <div className="card-header">
                        <h5>Recent Bookings</h5>
                        <button className="btn-view-all" onClick={() => setActiveSection('bookings')}>View All</button>
                    </div>
                    {bookings.length === 0
                        ? <div className="no-data">No bookings yet.</div>
                        : (
                            <table className="custom-table">
                                <thead><tr><th>Name</th><th>Date</th><th>Status</th></tr></thead>
                                <tbody>
                                    {bookings.slice(0, 5).map(b => (
                                        <tr key={b._id}>
                                            <td>{b.name}</td>
                                            <td>{new Date(b.visitDate).toLocaleDateString()}</td>
                                            <td><span className={`status ${b.status}`}>{b.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    }
                </div>

                {/* Recent Donations preview */}
                <div className="card-white" style={{ flex: 1 }}>
                    <div className="card-header">
                        <h5>Recent Donations</h5>
                        <button className="btn-view-all" onClick={() => setActiveSection('donations')}>View All</button>
                    </div>
                    {donations.length === 0
                        ? <div className="no-data">No donations yet.</div>
                        : donations.slice(0, 5).map(d => (
                            <div key={d._id} className="donation-item">
                                <div className="donation-top">
                                    <strong>{d.donorName}</strong>
                                    <span className="amount">₱{d.amount?.toLocaleString()}</span>
                                </div>
                                <div><span className={`status ${d.paymentStatus}`}>{d.paymentStatus}</span></div>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    );

    const renderBookings = () => {
        const shown = paginate(filteredBookings, bookingPage);
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>
                        Booking Management
                        {searchQuery && (
                            <small style={{ marginLeft: 10, color: 'var(--d-muted)', fontWeight: 400 }}>
                                — {filteredBookings.length} result{filteredBookings.length !== 1 ? 's' : ''} for "{searchQuery}"
                            </small>
                        )}
                    </h5>
                    <button className="btn-primary-sm" onClick={() => handleExportPDF('bookings')}>
                        <FaDownload /> Export PDF
                    </button>
                </div>
                {filteredBookings.length === 0
                    ? <div className="no-data">{searchQuery ? 'No bookings match your search.' : 'No bookings found.'}</div>
                    : (
                        <>
                            <table className="custom-table">
                                <thead>
                                    <tr><th>Visitor</th><th>Details</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {shown.map(b => (
                                        <tr key={b._id}>
                                            <td>
                                                <strong>{b.name}</strong><br />
                                                <small><FaEnvelope /> {b.email} &nbsp;|&nbsp; <FaPhone /> {b.phone}</small>
                                            </td>
                                            <td>
                                                <FaCalendarAlt /> {new Date(b.visitDate).toLocaleDateString()} at {b.visitTime}<br />
                                                <small>Purpose: {b.purpose} ({b.numberOfVisitors} pax)</small>
                                            </td>
                                            <td><span className={`status ${b.status}`}>{b.status}</span></td>
                                            <td className="actions">
                                                {b.status === 'pending' && (
                                                    <>
                                                        <button className="btn-success-sm"
                                                            onClick={() => updateBookingStatus(b._id, 'approved')}>
                                                            <FaCheck /> Approve
                                                        </button>
                                                        <button className="btn-outline-sm"
                                                            style={{ color: 'red', borderColor: 'red' }}
                                                            onClick={() => updateBookingStatus(b._id, 'rejected')}>
                                                            <FaTimes /> Reject
                                                        </button>
                                                    </>
                                                )}
                                                {b.status === 'approved' && (
                                                    <button className="btn-primary-sm"
                                                        onClick={() => updateBookingStatus(b._id, 'completed')}>
                                                        Complete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {renderPagination(filteredBookings.length, bookingPage, setBookingPage)}
                        </>
                    )
                }
            </div>
        );
    };

    const renderDonations = () => {
        const shown = paginate(filteredDonations, donationPage);
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>
                        Donation Records
                        {searchQuery && (
                            <small style={{ marginLeft: 10, color: 'var(--d-muted)', fontWeight: 400 }}>
                                — {filteredDonations.length} result{filteredDonations.length !== 1 ? 's' : ''} for "{searchQuery}"
                            </small>
                        )}
                    </h5>
                    <button className="btn-primary-sm" onClick={() => handleExportPDF('donations')}>
                        <FaDownload /> Export PDF
                    </button>
                </div>
                {filteredDonations.length === 0
                    ? <div className="no-data">{searchQuery ? 'No donations match your search.' : 'No donations found.'}</div>
                    : (
                        <>
                            <table className="custom-table">
                                <thead>
                                    <tr><th>Donor</th><th>Amount / Type</th><th>Status</th><th>Date</th></tr>
                                </thead>
                                <tbody>
                                    {shown.map(d => (
                                        <tr key={d._id}>
                                            <td>
                                                <strong>{d.donorName}</strong><br />
                                                <small>{d.email}</small>
                                            </td>
                                            <td>
                                                <strong style={{ color: '#28a745' }}>₱{d.amount?.toLocaleString()}</strong><br />
                                                <small>{d.donationType}</small>
                                            </td>
                                            <td><span className={`status ${d.paymentStatus}`}>{d.paymentStatus}</span></td>
                                            <td>{new Date(d.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {renderPagination(filteredDonations.length, donationPage, setDonationPage)}
                        </>
                    )
                }
            </div>
        );
    };

    const renderAlerts = () => (
        <div className="card-white">
            <div className="card-header"><h5>Alerts &amp; Notifications</h5></div>
            {alerts.length === 0
                ? (
                    <div className="empty-state">
                        <FaBell style={{ fontSize: '3rem', color: '#ccc', display: 'block', margin: '0 auto 12px' }} />
                        <p>No alerts at this time. System is running smoothly.</p>
                    </div>
                )
                : alerts.map(a => (
                    <div key={a._id} className="alert-item">
                        <strong>{a.title}</strong>
                        <p>{a.message}</p>
                    </div>
                ))
            }
        </div>
    );

    const renderContent = () => {
        if (loading) return <div className="loading">Loading…</div>;
        switch (activeSection) {
            case 'overview':  return renderOverview();
            case 'bookings':  return renderBookings();
            case 'donations': return renderDonations();
            case 'alerts':    return renderAlerts();
            default:          return renderOverview();
        }
    };

    // Section display name for topbar
    const sectionLabel = {
        overview:  'System Overview',
        bookings:  'Booking Management',
        donations: 'Donation Records',
        alerts:    'Alerts & Notifications'
    }[activeSection] || '';

    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">

                {/* SIDEBAR */}
                <div className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
                    <div className="sidebar-header">
                        <div className="brand-section">
                            <div className="logo-circle"></div>
                            <div className="brand-text">
                                <h4>Kanang - Alalay</h4>
                                <h5>STAFF</h5>
                            </div>
                        </div>
                    </div>

                    <ul className="sidebar-menu">
                        <li className={activeSection === 'overview'  ? 'active' : ''} onClick={() => setActiveSection('overview')}>
                            <FaHome /> System Overview
                        </li>
                        <li className={activeSection === 'bookings'  ? 'active' : ''} onClick={() => setActiveSection('bookings')}>
                            <FaCalendarCheck /> Booking Management
                        </li>
                        <li className={activeSection === 'donations' ? 'active' : ''} onClick={() => setActiveSection('donations')}>
                            <FaMoneyBillWave /> Donation Records
                        </li>
                        <li className={activeSection === 'alerts'    ? 'active' : ''} onClick={() => setActiveSection('alerts')}>
                            <FaBell /> Alerts
                        </li>
                    </ul>

                    <div className="sidebar-footer" onClick={handleLogout}>
                        <FaSignOutAlt /> LOGOUT
                    </div>
                </div>

                {/* MAIN CONTENT WRAPPER */}
                <div className="main-content-wrapper">

                    {/* TOPBAR */}
                    <div className="admin-topbar">
                        <div className="topbar-left">
                            <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)}>
                                <FaBars />
                            </button>
                            <div className="topbar-search-wrapper">
                                <FaSearch className="topbar-search-icon" />
                                <input
                                    type="text"
                                    className="topbar-search-input"
                                    placeholder={
                                        activeSection === 'bookings'  ? 'Search by name, email, purpose, status…' :
                                        activeSection === 'donations' ? 'Search by donor, type, status…' :
                                        'Search…'
                                    }
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        style={{ position:'absolute', right:10, background:'var(--d-orange-lt)', border:'none', borderRadius:6, padding:'3px 9px', fontSize:'.78rem', color:'var(--d-orange-dk)', cursor:'pointer', fontWeight:600 }}
                                        onClick={() => setSearchQuery('')}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="topbar-right">
                            <button className="topbar-icon-btn" title="Notifications" onClick={() => setActiveSection('alerts')}>
                                <FaBell />
                                {alerts.length > 0 && <span className="notif-dot"></span>}
                            </button>

                            <div className="topbar-user-menu">
                                <div
                                    className={`topbar-user-trigger ${accountMenuOpen ? 'active' : ''}`}
                                    onClick={() => setAccountMenuOpen(o => !o)}
                                >
                                    <FaUserCircle className="topbar-user-avatar" />
                                    <div className="topbar-user-info">
                                        <span className="topbar-user-name">{user?.firstName} {user?.lastName}</span>
                                        <span className="topbar-user-role">{user?.role?.toUpperCase()}</span>
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

                    {/* PAGE CONTENT */}
                    <div className="main-content">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffDashboard;