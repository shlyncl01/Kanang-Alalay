import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    FaBars, FaUserCircle, FaSearch, FaHome, FaUsers, FaPills,
    FaCheckCircle, FaSignOutAlt, FaChevronDown, FaBell,
    FaPlus, FaClipboardList, FaQrcode, FaFileAlt, FaExclamationTriangle,
    FaCog, FaQuestionCircle, FaMicrophone, FaFilter, FaSortAmountDown
} from 'react-icons/fa';
import '../styles/Dashboard.css';
import '../styles/NurseDashboard.css';

const NurseDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeSection, setActiveSection] = useState('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('All');
    const [sortBy, setSortBy] = useState('Time');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // ── Mock Data ──
    const scheduleItems = [];
    const residents = [];
    const todayStatus = { total: 0, onTime: 0, delayed: 0, missed: 0, pending: 0 };
    const complianceRate = 0;

    // ── Filter residents ──
    const filteredResidents = residents.filter(r => {
        const q = searchQuery.toLowerCase();
        return (
            r.name?.toLowerCase().includes(q) ||
            r.room?.toLowerCase().includes(q) ||
            r.conditions?.some(c => c.toLowerCase().includes(q))
        );
    });

    // ── Filter medications schedule ──
    const filteredSchedule = scheduleItems.filter(item => {
        const q = searchQuery.toLowerCase();
        const matchSearch = (
            item.patient?.toLowerCase().includes(q) ||
            item.medication?.toLowerCase().includes(q) ||
            item.room?.toLowerCase().includes(q)
        );
        const matchStatus = filterStatus === 'All' || item.status === filterStatus.toLowerCase();
        return matchSearch && matchStatus;
    });

    // ── Sections ──
    const renderHome = () => (
        <div>
            {/* Welcome + Shift Info */}
            <div className="card-white welcome-banner nurse-welcome">
                <div className="welcome-text">
                    <h2>Dashboard</h2>
                    <p>Welcome back, <strong>{user?.firstName} {user?.lastName}</strong> &nbsp;|&nbsp; Last login: {new Date().toLocaleDateString('en-PH')} at {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</p>
                    <div className="nurse-badges" style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="badge-custom staff">Shift: Morning (6AM–2PM)</span>
                        <span className="badge-custom nurse">Ward B</span>
                        <span className="badge-custom caregiver">Status: On Duty</span>
                    </div>
                </div>
            </div>

            {/* Today's Schedule + Today's Status */}
            <div className="nurse-two-col">
                {/* Today's Schedule */}
                <div className="card-white" style={{ flex: 1 }}>
                    <div className="card-header">
                        <h5>Today's Schedule</h5>
                    </div>
                    {scheduleItems.length === 0 ? (
                        <div className="no-data">No scheduled medications for today.</div>
                    ) : (
                        scheduleItems.map((item, i) => (
                            <div key={i} className={`schedule-item ${item.status}`}>
                                <div className="schedule-time">{item.time}</div>
                                <div className="schedule-details">
                                    <strong>{item.patient}</strong>
                                    <div>{item.medication}</div>
                                    {item.status === 'overdue' && <small className="text-danger">OVERDUE</small>}
                                </div>
                                <div className="schedule-action">
                                    {item.status === 'pending' && <button className="btn-success-sm">Mark Complete</button>}
                                    {item.status === 'overdue' && <button className="btn-primary-sm">Mark Now</button>}
                                    {item.status === 'completed' && <span className="status approved">Done</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Today's Status */}
                <div className="card-white nurse-status-card">
                    <h5 style={{ marginBottom: '20px', fontFamily: 'var(--d-font-head)' }}>Today's Status</h5>
                    <div className="nurse-stat-row">
                        <div className="nurse-stat-box"><strong>{todayStatus.total}</strong><span>Total</span></div>
                        <div className="nurse-stat-box success"><strong>{todayStatus.onTime}</strong><span>On Time</span></div>
                        <div className="nurse-stat-box warn"><strong>{todayStatus.delayed}</strong><span>Delayed</span></div>
                        <div className="nurse-stat-box danger"><strong>{todayStatus.missed}</strong><span>Missed</span></div>
                        <div className="nurse-stat-box muted"><strong>{todayStatus.pending}</strong><span>Pending</span></div>
                    </div>
                    <div className="compliance-bar-wrap" style={{ marginTop: '20px' }}>
                        <div className="compliance-bar">
                            <div className="compliance-progress" style={{ width: `${complianceRate}%` }}></div>
                        </div>
                        <small style={{ color: 'var(--d-muted)', marginTop: '6px', display: 'block' }}>
                            Your Compliance Rate: <strong>{complianceRate}%</strong>
                            {complianceRate === 0 ? ' (Needs Improvement)' : complianceRate >= 90 ? ' (Excellent)' : ' (Good)'}
                        </small>
                    </div>

                    {/* Quick Actions */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--d-border)', paddingTop: '18px' }}>
                        <h6 style={{ color: 'var(--d-muted)', fontSize: '.78rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em', marginBottom: '12px' }}>Quick Actions</h6>
                        <div className="quick-actions-grid">
                            <button className="quick-action-btn" onClick={() => setActiveSection('medicines')}>
                                <FaPlus /> Add Medication
                            </button>
                            <button className="quick-action-btn" onClick={() => setActiveSection('residents')}>
                                <FaClipboardList /> Log Vital Signs
                            </button>
                            <button className="quick-action-btn" onClick={() => setActiveSection('verify')}>
                                <FaQrcode /> Check Scanner
                            </button>
                            <button className="quick-action-btn">
                                <FaFileAlt /> Flag Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* My Assigned Residents */}
            <div className="card-white">
                <div className="card-header">
                    <h5>My Assigned Residents</h5>
                    <button className="btn-outline-sm" onClick={() => setActiveSection('residents')}>View All Residents</button>
                </div>
                {residents.length === 0 ? (
                    <div className="no-data">No assigned residents yet.</div>
                ) : (
                    <div className="resident-grid">
                        {residents.slice(0, 3).map((resident, i) => (
                            <div key={i} className="resident-card">
                                <strong>{resident.name}</strong>
                                <div>Room {resident.room} | Age: {resident.age}</div>
                                <div className="conditions">
                                    {resident.conditions?.map((c, ci) => (
                                        <span key={ci} className="condition-tag">{c}</span>
                                    ))}
                                </div>
                                {resident.status === 'OVERDUE' ? (
                                    <div className="alert-danger-sm">⚠ MEDICATION OVERDUE</div>
                                ) : (
                                    <div style={{ color: 'var(--d-muted)', fontSize: '.82rem', marginTop: '6px' }}>Next Med: {resident.nextMed}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderResidents = () => (
        <div className="card-white">
            <div className="card-header">
                <h5>My Assigned Residents</h5>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                        className="filter-select"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option>All</option>
                        <option>Alert</option>
                        <option>Stable</option>
                    </select>
                    <select
                        className="filter-select"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                    >
                        <option>Sort: All</option>
                        <option>Room</option>
                        <option>Name</option>
                    </select>
                    <button className="btn-success-sm"><FaPlus /> Add More</button>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>Room | Bed</th>
                            <th>Name | Age</th>
                            <th>Conditions</th>
                            <th>Status</th>
                            <th>Today's Medication</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredResidents.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center" style={{ padding: '2rem', color: 'var(--d-muted)', fontStyle: 'italic' }}>
                                    {searchQuery ? 'No residents match your search.' : 'No assigned residents yet.'}
                                </td>
                            </tr>
                        ) : (
                            filteredResidents.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.room} | Bed {r.bed}</td>
                                    <td>
                                        <strong>{r.name}</strong>
                                        <br /><small style={{ color: 'var(--d-muted)' }}>Age: {r.age}</small>
                                    </td>
                                    <td>
                                        {r.conditions?.map((c, ci) => (
                                            <span key={ci} className="condition-tag">{c}</span>
                                        ))}
                                    </td>
                                    <td>
                                        <span className={`status ${r.status === 'OVERDUE' ? 'rejected' : r.alertLevel === 'Alert' ? 'pending' : 'active'}`}>
                                            {r.alertLevel || 'Stable'}
                                        </span>
                                        {r.status === 'OVERDUE' && (
                                            <div style={{ fontSize: '.72rem', color: '#dc3545', marginTop: '4px' }}>
                                                ⚠ Medication Overdue
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontSize: '.82rem', color: 'var(--d-muted)' }}>
                                        {r.medications?.map((m, mi) => (
                                            <div key={mi}>{m}</div>
                                        )) || '—'}
                                    </td>
                                    <td className="actions">
                                        <button className="btn-outline-sm" style={{ fontSize: '.75rem', padding: '5px 10px' }}>View Full Profile</button>
                                        <button className="btn-outline-sm" style={{ fontSize: '.75rem', padding: '5px 10px' }}>Log Vital Signs</button>
                                        <button className="btn-primary-sm" style={{ fontSize: '.75rem', padding: '5px 10px' }}>Medication History</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderMedicines = () => (
        <div>
            <div className="card-white">
                <div className="card-header">
                    <h5>Today's Medication Schedule</h5>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option>All</option>
                            <option>Overdue</option>
                            <option>Pending</option>
                            <option>Completed</option>
                        </select>
                        <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                            <option>Sort: Time</option>
                            <option>Resident</option>
                            <option>Room</option>
                        </select>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Time</th>
                                <th>Residents</th>
                                <th>Room</th>
                                <th>Medication</th>
                                <th>Dosage</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSchedule.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--d-muted)', fontStyle: 'italic' }}>
                                        No medication schedule for today.
                                    </td>
                                </tr>
                            ) : (
                                filteredSchedule.map((item, i) => (
                                    <tr key={i}>
                                        <td>
                                            <span className={`status ${item.status === 'overdue' ? 'rejected' : item.status === 'pending' ? 'pending' : 'approved'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>{item.time}</td>
                                        <td><strong>{item.patient}</strong></td>
                                        <td>{item.room}</td>
                                        <td>{item.medication}</td>
                                        <td>{item.dosage}</td>
                                        <td>
                                            {item.status === 'pending' && <button className="btn-success-sm" style={{ fontSize: '.78rem' }}>Prepare</button>}
                                            {item.status === 'overdue' && <button className="btn-primary-sm" style={{ fontSize: '.78rem' }}>Verify</button>}
                                            {item.status === 'completed' && <button className="btn-outline-sm" style={{ fontSize: '.78rem' }}>View</button>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {scheduleItems.length > 7 && (
                    <div style={{ textAlign: 'center', padding: '12px', borderTop: '1px solid var(--d-border)', marginTop: '8px' }}>
                        <button className="btn-outline-sm">Show {scheduleItems.length - 7} more medications...</button>
                    </div>
                )}
            </div>

            {/* Active Medication By Residents */}
            <div className="card-white">
                <div className="card-header">
                    <h5>Active Medication By Residents</h5>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Residents</th>
                                <th>Medication</th>
                                <th>Dosage</th>
                                <th>Time</th>
                                <th>Next Dose</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--d-muted)', fontStyle: 'italic' }}>
                                    No active medications tracked yet.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Medication Inventory Status */}
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--d-border)', paddingTop: '18px' }}>
                    <h6 style={{ color: 'var(--d-muted)', fontSize: '.82rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em', marginBottom: '12px' }}>
                        Medication Inventory Status
                    </h6>
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Medication</th>
                                <th>Ward</th>
                                <th>Stock Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan="3" className="text-center" style={{ padding: '1.5rem', color: 'var(--d-muted)', fontStyle: 'italic' }}>
                                    No inventory data available.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                        <button className="btn-outline-sm">Request Stock</button>
                        <button className="btn-primary-sm">View Full History</button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderVerify = () => (
        <div className="card-white">
            <div className="card-header">
                <h5>Verify / QR Scanner</h5>
            </div>
            <div className="no-data" style={{ padding: '60px 20px' }}>
                <FaQrcode style={{ fontSize: '3rem', color: 'var(--d-orange)', marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
                <p>Scanner functionality is ready. Place a resident or medication QR code in front of the camera to verify.</p>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeSection) {
            case 'home':      return renderHome();
            case 'residents': return renderResidents();
            case 'medicines': return renderMedicines();
            case 'verify':    return renderVerify();
            default:          return renderHome();
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">

                {/* SIDEBAR */}
                <div className={`sidebar nurse-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
                    <div className="sidebar-header">
                        <div className="brand-section">
                            <div className="logo-circle"></div>
                            <div className="brand-text">
                                <h4>Kanang - Alalay</h4>
                                <h5>NURSE</h5>
                            </div>
                        </div>
                    </div>

                    <ul className="sidebar-menu">
                        <li className={activeSection === 'home' ? 'active' : ''} onClick={() => setActiveSection('home')}>
                            <FaHome /> Home
                        </li>
                        <li className={activeSection === 'residents' ? 'active' : ''} onClick={() => setActiveSection('residents')}>
                            <FaUsers /> Residents
                        </li>
                        <li className={activeSection === 'medicines' ? 'active' : ''} onClick={() => setActiveSection('medicines')}>
                            <FaPills /> Medicines
                        </li>
                        <li className={activeSection === 'verify' ? 'active' : ''} onClick={() => setActiveSection('verify')}>
                            <FaCheckCircle /> Verify
                        </li>
                    </ul>

                    <div className="sidebar-footer" onClick={handleLogout}>
                        <FaSignOutAlt /> LOGOUT
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="main-content-wrapper">

                    {/* TOP BAR */}
                    <div className="admin-topbar nurse-topbar">
                        <div className="topbar-left">
                            <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                <FaBars />
                            </button>
                            <div className="topbar-search-wrapper">
                                <FaSearch className="topbar-search-icon" />
                                <input
                                    type="text"
                                    className="topbar-search-input"
                                    placeholder="Search residents, medications, rooms..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="topbar-right">
                            <button className="topbar-icon-btn" title="Notifications">
                                <FaBell />
                            </button>

                            <div className="topbar-user-menu">
                                <div
                                    className={`topbar-user-trigger ${accountMenuOpen ? 'active' : ''}`}
                                    onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                                >
                                    <FaUserCircle className="topbar-user-avatar" />
                                    <div className="topbar-user-info">
                                        <span className="topbar-user-name">{user?.firstName} {user?.lastName}</span>
                                        <span className="topbar-user-role">NURSE</span>
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

export default NurseDashboard;