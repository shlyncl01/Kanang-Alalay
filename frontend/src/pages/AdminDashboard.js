import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    FaBars, FaUserCircle, FaHome, FaUsers, FaBell, FaCalendarCheck,
    FaUserMd, FaExclamationTriangle, FaChartBar, FaFileAlt, FaUserPlus,
    FaSignOutAlt, FaSync, FaEye, FaEdit, FaTrash,
    FaCheckCircle, FaBan, FaClock, FaMoneyBillWave,
    FaPhone, FaEnvelope, FaCalendarAlt, FaUserTag, FaIdCard, FaDownload, FaBox, FaChevronDown,
    FaSearch, FaCog, FaQuestionCircle
} from 'react-icons/fa';
import UserRegistrationModal from '../components/UserRegistrationModal';
import AddInventoryModal from '../components/AddInventoryModal';
import AlertsNotifications from '../components/AlertsNotifications';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://kanang-alalay-backend.onrender.com/api';

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen]         = useState(true);
    const [activeSection, setActiveSection]     = useState('overview');
    const [searchQuery, setSearchQuery]         = useState('');
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);

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

    const [otpSent, setOtpSent]                   = useState(false);
    const [otpCode, setOtpCode]                   = useState('');
    const [otpMessage, setOtpMessage]             = useState('');
    const [registeredUserId, setRegisteredUserId] = useState(null);
    const [registeredEmail, setRegisteredEmail]   = useState('');
    const [registeredName, setRegisteredName]     = useState('');

    const [stats, setStats] = useState({
        totalResidents: 0, staffOnDuty: 0, pendingBookings: 0,
        totalDonations: 0, totalDonationAmount: 0, lowStockItems: 0,
        complianceRate: 0, missedMeds: 0, delayedMeds: 0
    });

    // ── Live search filters ──────────────────────────────────────────────────
    const filteredStaff = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return staff;
        return staff.filter(m =>
            `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            m.username?.toLowerCase().includes(q) ||
            m.role?.toLowerCase().includes(q)
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

    const filteredInventory = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return inventory;
        return inventory.filter(i =>
            i.name?.toLowerCase().includes(q) ||
            i.category?.toLowerCase().includes(q)
        );
    }, [inventory, searchQuery]);

    // Reset pages when search or section changes
    useEffect(() => {
        setCurrentPage(1); setBookingPage(1); setDonationPage(1); setInventoryPage(1);
    }, [activeSection, searchQuery]);

    const fetchApi = async (endpoint, options = {}) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...options.headers }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            setApiError(`Server error: ${err.message}`);
            return { success: false };
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [bRes, dRes, sRes] = await Promise.all([
                fetchApi('/bookings?limit=50'), fetchApi('/donations?limit=50'), fetchApi('/stats')
            ]);
            if (bRes.success) setBookings(bRes.data || []);
            if (dRes.success) setDonations(dRes.data || []);
            if (sRes.success && sRes.data) setStats(p => ({ ...p, ...sRes.data }));
            setLoading(false);
        };
        load();
    }, []);

    useEffect(() => {
        if (activeSection === 'staff') fetchStaffList();
    }, [activeSection]);

    const fetchStaffList = async () => {
        const d = await fetchApi('/admin/staff');
        if (d.success) setStaff(d.staff || []);
    };

    const handleLogout = () => {
        if (window.confirm('Logout?')) { logout(); navigate('/login'); }
    };

    const renderPagination = (total, page, setPage) => {
        const pages = Math.ceil(total / itemsPerPage);
        if (pages <= 1) return null;
        return (
            <div className="pagination-container">
                <span className="pagination-info">
                    Showing {Math.min((page-1)*itemsPerPage+1,total)}–{Math.min(page*itemsPerPage,total)} of {total}
                </span>
                <div className="pagination-controls">
                    <button className="page-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>&laquo; Prev</button>
                    {Array.from({length:pages},(_,i)=>i+1).map(n=>(
                        <button key={n} className={`page-btn ${page===n?'active':''}`} onClick={()=>setPage(n)}>{n}</button>
                    ))}
                    <button className="page-btn" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Next &raquo;</button>
                </div>
            </div>
        );
    };

    const generateRegistrationCode = async (role='staff') => {
        const d = await fetchApi('/admin/generate-codes', { method:'POST', body: JSON.stringify({count:1,role}) });
        if (d.success && d.codes?.length) {
            const code = d.codes[0].code;
            alert(`Code for ${role.toUpperCase()}: ${code}\n(Copied to clipboard)`);
            navigator.clipboard.writeText(code);
            fetchStaffList();
        } else alert(d.message || 'Failed to generate code.');
    };

    const sendOtp = async (email, userId, firstName) => {
        if (!email) { setOtpMessage('Email required'); return; }
        setOtpMessage('Sending OTP…');
        const d = await fetchApi('/auth/send-otp', { method:'POST', body: JSON.stringify({email,userId}) });
        if (d.success) {
            setOtpSent(true); setRegisteredEmail(email);
            setRegisteredName(firstName||'Staff'); setOtpCode('');
            setOtpMessage(`OTP sent to ${email}.`);
        } else setOtpMessage(d.message||'Failed to send OTP.');
    };

    const verifyOtp = async () => {
        if (!otpCode || otpCode.length < 6) { setOtpMessage('Enter full 6-digit OTP.'); return; }
        const d = await fetchApi('/auth/verify-otp', { method:'POST', body: JSON.stringify({userId:registeredUserId,otp:otpCode}) });
        if (d.success) {
            setOtpMessage('✅ Account activated!');
            setTimeout(() => { setOtpSent(false); setRegisteredUserId(null); setOtpCode(''); setOtpMessage(''); fetchStaffList(); }, 1500);
        } else setOtpMessage('❌ Invalid or expired OTP.');
    };

    const handleRegisterSuccess = async (data) => {
        const userId = data.userId || data.data?.userId;
        const email  = data.email  || data.data?.email;
        const first  = data.firstName || data.data?.firstName;
        if (userId && email) { setRegisteredUserId(userId); await sendOtp(email, userId, first); }
        fetchStaffList();
    };

    const handleResendOTP = () => sendOtp(registeredEmail, registeredUserId, registeredName);

    const toggleStaffStatus = async (id, cur) => {
        const next = cur === 'active' ? 'inactive' : 'active';
        setStaff(staff.map(m => m._id===id ? {...m, isActive: next==='active'} : m));
        await fetchApi(`/admin/staff/${id}/status`, { method:'PUT', body: JSON.stringify({status:next}) });
    };

    const deleteStaff = async (id) => {
        if (!window.confirm('Delete this staff member?')) return;
        setStaff(staff.filter(m => m._id!==id));
        await fetchApi(`/admin/staff/${id}`, { method:'DELETE' });
    };

    const updateBookingStatus = async (id, status) => {
        setBookings(bookings.map(b => b._id===id ? {...b,status} : b));
        await fetchApi(`/bookings/${id}/status`, { method:'PUT', body: JSON.stringify({status}) });
        setStats(p => ({...p, pendingBookings: Math.max(0,p.pendingBookings-1)}));
    };

    const updateDonationStatus = async (id, paymentStatus) => {
        setDonations(donations.map(d => d._id===id ? {...d,paymentStatus} : d));
        await fetchApi(`/donations/${id}/payment`, { method:'PUT', body: JSON.stringify({paymentStatus}) });
    };

    const handleAddInventory = (item) => {
        setInventory(prev => [...prev, {_id:uuidv4(), name:item.name, category:item.category||'General', quantity:Number(item.quantity), unit:item.unit||'pcs'}]);
        setShowAddInventory(false);
        alert(`"${item.name}" added!`);
    };

    const handleViewDetails = (type, data) => setDetailsModal({ isOpen:true, type, data });
    const closeDetailsModal = () => setDetailsModal({ isOpen:false, type:'', data:null });

    const handleExportPDF = (type='bookings') => {
        const doc = new jsPDF();
        doc.text(`Kanang-Alalay ${type.toUpperCase()} Report`, 14, 15);
        const rows = type==='bookings'
            ? filteredBookings.map(b=>[b.name, new Date(b.visitDate).toLocaleDateString(), b.status])
            : filteredDonations.map(d=>[d.donorName, `₱${d.amount?.toLocaleString()}`, d.paymentStatus]);
        autoTable(doc, { head:[['Col1','Col2','Col3']], body:rows });
        doc.save(`KA_${type}.pdf`);
    };

    const handleGenerateReport = (type) =>
        alert(`📄 ${type} Report will be emailed to ${user?.email}`);

    const handleEditBooking = (b) => {
        const s = prompt(`Status for ${b.name} (pending/approved/rejected/completed):`, b.status);
        if (s && ['pending','approved','rejected','completed'].includes(s.toLowerCase()))
            updateBookingStatus(b._id, s.toLowerCase());
    };

    const handleMarkAttendance = (id, name) =>
        alert(`⏰ Attendance logged for ${name} at ${new Date().toLocaleString()}`);

    const searchBadge = (filtered, total) =>
        searchQuery.trim() && filtered.length !== total
            ? <small style={{marginLeft:8,color:'var(--d-muted)',fontWeight:400}}>— {filtered.length} result{filtered.length!==1?'s':''} for "{searchQuery}"</small>
            : null;

    // ── Renderers ────────────────────────────────────────────────────────────

    const renderOverview = () => (
        <div>
            {apiError && <div style={{background:'#fff0f0',border:'1px solid #f5c6cb',borderLeft:'4px solid #dc3545',color:'#721c24',padding:'10px 14px',borderRadius:8,marginBottom:20}}>{apiError}</div>}
            <div className="welcome-banner card-white">
                <div className="welcome-text">
                    <h2>Welcome back, {user?.firstName} {user?.lastName}</h2>
                    <p>{new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} at {new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</p>
                </div>
            </div>
            <div className="stats-grid">
                {[
                    {bg:'#b85c2d',icon:<FaUsers/>,   val:stats.totalResidents,label:'Total Residents'},
                    {bg:'#28a745',icon:<FaUserMd/>,   val:stats.staffOnDuty,  label:'Staff on Duty'},
                    {bg:'#ffc107',icon:<FaCalendarCheck/>,val:stats.pendingBookings,label:'Pending Bookings'},
                    {bg:'#17a2b8',icon:<FaChartBar/>, val:`₱${stats.totalDonationAmount?.toLocaleString()||0}`,label:'Total Donations'}
                ].map((s,i)=>(
                    <div key={i} className="stat-card">
                        <div className="stat-icon" style={{background:s.bg}}>{s.icon}</div>
                        <div className="stat-info"><h3>{s.val}</h3><p>{s.label}</p></div>
                    </div>
                ))}
            </div>
            <div className="content-row">
                <div className="card-white" style={{flex:1}}>
                    <div className="card-header">
                        <h5>Recent Bookings</h5>
                        <button className="btn-view-all" onClick={()=>setActiveSection('booking')}>View All</button>
                    </div>
                    {bookings.length===0 ? <div className="no-data">No bookings yet.</div> : (
                        <table className="custom-table">
                            <thead><tr><th>Name</th><th>Date</th><th>Status</th></tr></thead>
                            <tbody>
                                {bookings.slice(0,5).map(b=>(
                                    <tr key={b._id}>
                                        <td>{b.name}</td>
                                        <td>{new Date(b.visitDate).toLocaleDateString()}</td>
                                        <td><span className={`status ${b.status}`}>{b.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="card-white" style={{flex:1}}>
                    <div className="card-header"><h5>Recent Activity</h5></div>
                    <div className="no-data">No recent activities.</div>
                </div>
            </div>
        </div>
    );

    const renderStaffManagement = () => {
        const paged = filteredStaff.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
        return (
            <div className="staff-management">
                <div className="card-white">
                    <div className="card-header">
                        <h5>Staff Management {searchBadge(filteredStaff,staff)}</h5>
                        <button className="btn-success-sm" onClick={()=>setShowRegistrationModal(true)}><FaUserPlus/> Add New Staff</button>
                    </div>
                    <div className="quick-code-section" style={{marginBottom:20}}>
                        <h6>Generate Registration Codes</h6>
                        <div className="code-buttons">
                            <button className="btn-outline-sm" onClick={()=>generateRegistrationCode('staff')}><FaIdCard/> Staff Code</button>
                            <button className="btn-outline-sm" onClick={()=>generateRegistrationCode('nurse')}><FaUserMd/> Nurse Code</button>
                            <button className="btn-outline-sm" onClick={()=>generateRegistrationCode('admin')}><FaUserTag/> Admin Code</button>
                        </div>
                    </div>
                    <table className="custom-table">
                        <thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {paged.length===0 ? (
                                <tr><td colSpan="5" className="text-center">{searchQuery?'No staff match your search.':'No staff found.'}</td></tr>
                            ) : paged.map(m=>(
                                <tr key={m._id}>
                                    <td>
                                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                                            <FaUserCircle size={30} color="#ccc"/>
                                            <div><strong>{m.firstName} {m.lastName}</strong><br/><small className="text-muted">@{m.username}</small></div>
                                        </div>
                                    </td>
                                    <td>{m.email}</td>
                                    <td><span className={`badge-custom ${m.role}`}>{m.role}</span></td>
                                    <td><span className={`status ${m.isActive?'active':'inactive'}`}>{m.isActive?'Active':'Inactive'}</span></td>
                                    <td className="actions">
                                        <span className="edit" title="Mark Attendance" onClick={()=>handleMarkAttendance(m._id,`${m.firstName} ${m.lastName}`)}><FaClock/></span>
                                        {m.isActive
                                            ? <span className="deactivate" title="Deactivate" onClick={()=>toggleStaffStatus(m._id,'active')}><FaBan/></span>
                                            : <span className="activate"   title="Activate"   onClick={()=>toggleStaffStatus(m._id,'inactive')}><FaCheckCircle/></span>
                                        }
                                        <span className="delete" title="Delete" onClick={()=>deleteStaff(m._id)}><FaTrash/></span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {renderPagination(filteredStaff.length, currentPage, setCurrentPage)}
                    {otpSent && registeredUserId && (
                        <div className="otp-management" style={{marginTop:20}}>
                            <h5>Activate: {registeredName}</h5>
                            <p>OTP sent to <strong>{registeredEmail}</strong></p>
                            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                                <input type="text" placeholder="6-digit OTP" value={otpCode} onChange={e=>setOtpCode(e.target.value)}
                                    maxLength="6" className="form-control-custom otp-input"/>
                                <button className="btn-primary-sm" onClick={verifyOtp}>Verify</button>
                                <button className="btn-outline-sm" onClick={handleResendOTP}>Resend OTP</button>
                            </div>
                            {otpMessage && <p style={{marginTop:10,fontWeight:'bold',color:otpMessage.includes('✅')?'green':otpMessage.includes('❌')?'red':'#666'}}>{otpMessage}</p>}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderBookingManagement = () => {
        const paged = filteredBookings.slice((bookingPage-1)*itemsPerPage, bookingPage*itemsPerPage);
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>Admission &amp; Booking {searchBadge(filteredBookings,bookings)}</h5>
                    <button className="btn-primary-sm" onClick={()=>handleExportPDF('bookings')}><FaDownload/> Export</button>
                </div>
                {filteredBookings.length===0
                    ? <p className="no-data">{searchQuery?'No bookings match your search.':'No bookings found.'}</p>
                    : <>
                        <table className="custom-table">
                            <thead><tr><th>Visitor</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {paged.map(b=>(
                                    <tr key={b._id}>
                                        <td><strong>{b.name}</strong><br/><small><FaEnvelope/> {b.email} | <FaPhone/> {b.phone}</small></td>
                                        <td><FaCalendarAlt/> {new Date(b.visitDate).toLocaleDateString()} at {b.visitTime}<br/><small>Purpose: {b.purpose} ({b.numberOfVisitors} pax)</small></td>
                                        <td><span className={`status ${b.status}`}>{b.status}</span></td>
                                        <td className="actions">
                                            {b.status==='pending' && <>
                                                <button className="btn-success-sm" onClick={()=>updateBookingStatus(b._id,'approved')}>Approve</button>
                                                <button className="btn-outline-sm" style={{color:'red',borderColor:'red'}} onClick={()=>updateBookingStatus(b._id,'rejected')}>Reject</button>
                                            </>}
                                            {b.status==='approved' && <button className="btn-primary-sm" onClick={()=>updateBookingStatus(b._id,'completed')}>Complete</button>}
                                            <span className="view" title="View" onClick={()=>handleViewDetails('booking',b)}><FaEye/></span>
                                            <span className="edit" title="Edit"  onClick={()=>handleEditBooking(b)}><FaEdit/></span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {renderPagination(filteredBookings.length, bookingPage, setBookingPage)}
                    </>
                }
            </div>
        );
    };

    const renderDonationManagement = () => {
        const paged = filteredDonations.slice((donationPage-1)*itemsPerPage, donationPage*itemsPerPage);
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>Donation Management {searchBadge(filteredDonations,donations)}</h5>
                    <button className="btn-primary-sm" onClick={()=>handleExportPDF('donations')}><FaDownload/> Export</button>
                </div>
                {filteredDonations.length===0
                    ? <p className="no-data">{searchQuery?'No donations match your search.':'No donations found.'}</p>
                    : <>
                        <table className="custom-table">
                            <thead><tr><th>Donor</th><th>Amount / Type</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {paged.map(d=>(
                                    <tr key={d._id}>
                                        <td><strong>{d.donorName}</strong><br/><small>{d.email}</small></td>
                                        <td><strong style={{color:'#28a745'}}>₱{d.amount?.toLocaleString()}</strong><br/><small>{d.donationType}{d.receiptNumber&&` | Rec: ${d.receiptNumber}`}</small></td>
                                        <td><span className={`status ${d.paymentStatus}`}>{d.paymentStatus}</span></td>
                                        <td className="actions">
                                            {d.paymentStatus==='pending'    && <button className="btn-success-sm" onClick={()=>updateDonationStatus(d._id,'paid')}>Mark Paid</button>}
                                            {d.paymentStatus==='processing' && <button className="btn-primary-sm" onClick={()=>updateDonationStatus(d._id,'paid')}>Confirm</button>}
                                            <span className="view" title="View" onClick={()=>handleViewDetails('donation',d)}><FaEye/></span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {renderPagination(filteredDonations.length, donationPage, setDonationPage)}
                    </>
                }
            </div>
        );
    };

    const renderAlerts = () => (
        <div className="card-white">
            <div className="card-header">
                <h5>Alerts &amp; Notifications</h5>
                <button className="btn-primary-sm" onClick={()=>alert('Sync complete. No new alerts.')}><FaSync/> Refresh</button>
            </div>
            <AlertsNotifications/>
            <div className="empty-state">
                <FaBell style={{fontSize:'3rem',color:'#ccc',display:'block',margin:'0 auto 12px'}}/>
                <p>No recent alerts. System is running normally.</p>
            </div>
        </div>
    );

    const renderInventory = () => {
        const paged = filteredInventory.slice((inventoryPage-1)*itemsPerPage, inventoryPage*itemsPerPage);
        return (
            <div className="card-white">
                <div className="card-header">
                    <h5>Inventory &amp; Stock {searchBadge(filteredInventory,inventory)}</h5>
                    <button className="btn-success-sm" onClick={()=>setShowAddInventory(true)}><FaBox/> Add Item</button>
                </div>
                <div className="stats-grid" style={{marginBottom:20}}>
                    <div className="stat-card" style={{padding:15}}><h3 style={{color:'#dc3545'}}>{stats.lowStockItems}</h3><p>Low Stock</p></div>
                    <div className="stat-card" style={{padding:15}}><h3>{inventory.length}</h3><p>Total Items</p></div>
                    <div className="stat-card" style={{padding:15}}><h3>0</h3><p>Expiring Soon</p></div>
                </div>
                <table className="custom-table">
                    <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Status</th></tr></thead>
                    <tbody>
                        {filteredInventory.length===0
                            ? <tr><td colSpan="4" style={{textAlign:'center',padding:'2rem',color:'#666'}}>{searchQuery?'No items match.':'No inventory yet.'}</td></tr>
                            : paged.map(i=>(
                                <tr key={i._id}>
                                    <td><strong>{i.name}</strong></td>
                                    <td><span className="badge-custom staff">{i.category}</span></td>
                                    <td>{i.quantity} {i.unit}</td>
                                    <td><span className="status active">In Stock</span></td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
                {renderPagination(filteredInventory.length, inventoryPage, setInventoryPage)}
            </div>
        );
    };

    const renderCompliance = () => (
        <div className="card-white">
            <div className="card-header">
                <h5>Medication Compliance Chart</h5>
                <button className="btn-primary-sm" onClick={()=>handleGenerateReport('Compliance')}><FaFileAlt/> Full Report</button>
            </div>
            <div style={{display:'flex',gap:'2rem',alignItems:'center',padding:'1rem 0',flexWrap:'wrap'}}>
                <div style={{textAlign:'center',padding:'2rem',background:'#f8f9fa',borderRadius:10,minWidth:200,border:'1px solid #eee'}}>
                    <h1 style={{fontSize:'3.5rem',color:'#b85c2d',margin:0}}>{stats.complianceRate||0}%</h1>
                    <p style={{margin:0,color:'#666',fontWeight:'bold'}}>COMPLIANCE TODAY</p>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',flex:1,minWidth:250}}>
                    {[['0','Scheduled'],['0','Administered','#28a745'],[stats.missedMeds||0,'Missed','#dc3545'],[stats.delayedMeds||0,'Delayed','#ffc107']].map(([v,l,c],i)=>(
                        <div key={i} style={{padding:'1rem',border:'1px solid #eee',borderRadius:8,background:'white'}}>
                            <h3 style={{margin:0,color:c||'inherit'}}>{v}</h3>
                            <p style={{margin:0,color:'#666'}}>{l}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderReports = () => (
        <div className="card-white">
            <div className="card-header">
                <h5>Reports &amp; Analytics</h5>
                <button className="btn-primary-sm" onClick={()=>handleExportPDF('bookings')}><FaDownload/> Export PDF</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:'1.5rem',marginTop:'1rem'}}>
                {[
                    {title:'Financial Summary',val:`₱${stats.totalDonationAmount?.toLocaleString()||0}`,valColor:'#28a745',desc:'Total donations collected.',type:'Financial Overview'},
                    {title:'Staff Performance', val:stats.staffOnDuty, desc:'Active staff on duty.', type:'Staff Performance'},
                    {title:'Resident Health',   val:'0',               desc:'Incident reports filed.', type:'Resident Health'}
                ].map((r,i)=>(
                    <div key={i} style={{padding:'1.5rem',border:'1px solid #eee',borderRadius:8,background:'#fafafa'}}>
                        <h6 style={{color:'#555'}}>{r.title}</h6>
                        <h3 style={{margin:'10px 0',color:r.valColor||'#333'}}>{r.val}</h3>
                        <p style={{fontSize:'.85rem',color:'#666'}}>{r.desc}</p>
                        <button className="btn-outline-sm" onClick={()=>handleGenerateReport(r.type)} style={{width:'100%',marginTop:10}}>Generate</button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderContent = () => {
        if (loading) return <div className="loading">Loading secure dashboard…</div>;
        switch (activeSection) {
            case 'overview':   return renderOverview();
            case 'staff':      return renderStaffManagement();
            case 'booking':    return renderBookingManagement();
            case 'donation':   return renderDonationManagement();
            case 'alerts':     return renderAlerts();
            case 'inventory':  return renderInventory();
            case 'compliance': return renderCompliance();
            case 'reports':    return renderReports();
            default:           return renderOverview();
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">
                <div className={`sidebar ${sidebarOpen?'':'collapsed'}`}>
                    <div className="sidebar-header">
                        <div className="brand-section">
                            <div className="logo-circle"></div>
                            <div className="brand-text"><h4>Kanang - Alalay</h4><h5>ADMIN</h5></div>
                        </div>
                    </div>
                    <ul className="sidebar-menu">
                        {[
                            {key:'overview',  icon:<FaHome/>,             label:'System Overview'},
                            {key:'staff',     icon:<FaUsers/>,            label:'User Management'},
                            {key:'alerts',    icon:<FaBell/>,             label:'Alerts & Notifications'},
                            {key:'booking',   icon:<FaCalendarCheck/>,    label:'Admission & Booking'},
                            {key:'inventory', icon:<FaExclamationTriangle/>, label:'Inventory Alerts'},
                            {key:'compliance',icon:<FaChartBar/>,         label:'Compliance Chart'},
                            {key:'donation',  icon:<FaMoneyBillWave/>,    label:'Donation Ledger'},
                            {key:'reports',   icon:<FaFileAlt/>,          label:'Reports & Analytics'}
                        ].map(({key,icon,label})=>(
                            <li key={key} className={activeSection===key?'active':''} onClick={()=>setActiveSection(key)}>
                                {icon} {label}
                            </li>
                        ))}
                    </ul>
                    <div className="sidebar-footer" onClick={handleLogout}><FaSignOutAlt/> LOGOUT</div>
                </div>

                <div className="main-content-wrapper">
                    <div className="admin-topbar">
                        <div className="topbar-left">
                            <button className="hamburger-btn" onClick={()=>setSidebarOpen(o=>!o)}><FaBars/></button>
                            <div className="topbar-search-wrapper">
                                <FaSearch className="topbar-search-icon"/>
                                <input
                                    type="text"
                                    className="topbar-search-input"
                                    placeholder={
                                        activeSection==='staff'     ? 'Search by name, email, role…' :
                                        activeSection==='booking'   ? 'Search by visitor, email, purpose, status…' :
                                        activeSection==='donation'  ? 'Search by donor, type, status…' :
                                        activeSection==='inventory' ? 'Search by item name or category…' :
                                        'Search…'
                                    }
                                    value={searchQuery}
                                    onChange={e=>setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        style={{position:'absolute',right:10,background:'var(--d-orange-lt)',border:'none',borderRadius:6,padding:'3px 9px',fontSize:'.78rem',color:'var(--d-orange-dk)',cursor:'pointer',fontWeight:600}}
                                        onClick={()=>setSearchQuery('')}
                                    >Clear</button>
                                )}
                            </div>
                        </div>
                        <div className="topbar-right">
                            <button className="topbar-icon-btn" onClick={()=>setActiveSection('alerts')} title="Alerts">
                                <FaBell/><span className="notif-dot"></span>
                            </button>
                            <div className="topbar-user-menu">
                                <div className={`topbar-user-trigger ${accountMenuOpen?'active':''}`} onClick={()=>setAccountMenuOpen(o=>!o)}>
                                    <FaUserCircle className="topbar-user-avatar"/>
                                    <div className="topbar-user-info">
                                        <span className="topbar-user-name">{user?.firstName} {user?.lastName}</span>
                                        <span className="topbar-user-role">{user?.role?.toUpperCase()||'ADMIN'}</span>
                                    </div>
                                    <FaChevronDown className={`topbar-arrow ${accountMenuOpen?'rotate':''}`}/>
                                </div>
                                {accountMenuOpen && (
                                    <ul className="topbar-dropdown">
                                        <li onClick={()=>{navigate('/profile');setAccountMenuOpen(false);}}><FaUserCircle/> View Profile</li>
                                        <li onClick={()=>{navigate('/settings');setAccountMenuOpen(false);}}><FaCog/> Account Settings</li>
                                        <li onClick={()=>{navigate('/help');setAccountMenuOpen(false);}}><FaQuestionCircle/> Help Center</li>
                                        <li className="dropdown-divider" onClick={handleLogout}><FaSignOutAlt/> Sign Out</li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="main-content">{renderContent()}</div>
                </div>
            </div>

            <UserRegistrationModal isOpen={showRegistrationModal} onClose={()=>setShowRegistrationModal(false)} onRegister={handleRegisterSuccess}/>
            <AddInventoryModal isOpen={showAddInventory} onClose={()=>setShowAddInventory(false)} onSave={handleAddInventory}/>

            {detailsModal.isOpen && detailsModal.data && (
                <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:9999,display:'flex',justifyContent:'center',alignItems:'center',backdropFilter:'blur(5px)'}}>
                    <div className="registration-modal" style={{background:'white',padding:35,borderRadius:15,width:500,boxShadow:'0 15px 35px rgba(0,0,0,.3)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20,borderBottom:'2px solid #f0f0f0',paddingBottom:14}}>
                            <h4 style={{margin:0,color:'#2c3e50',display:'flex',alignItems:'center',gap:10}}>
                                {detailsModal.type==='booking'?<FaCalendarCheck color="#b85c2d"/>:<FaMoneyBillWave color="#28a745"/>}
                                {detailsModal.type==='booking'?'Booking Details':'Donation Details'}
                            </h4>
                            <button onClick={closeDetailsModal} style={{background:'none',border:'none',fontSize:'1.4rem',cursor:'pointer',color:'#888'}}>✕</button>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:16}}>
                            {detailsModal.type==='booking' ? (<>
                                <div><small style={{color:'#888',fontWeight:'bold',textTransform:'uppercase'}}>Visitor</small><div style={{fontWeight:600}}>{detailsModal.data.name}</div></div>
                                <div><small style={{color:'#888',fontWeight:'bold',textTransform:'uppercase'}}>Contact</small><div>{detailsModal.data.email}<br/>{detailsModal.data.phone}</div></div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,background:'#f8f9fa',padding:14,borderRadius:8}}>
                                    <div><small>Date</small><div style={{fontWeight:500}}>{new Date(detailsModal.data.visitDate).toLocaleDateString()}</div></div>
                                    <div><small>Time</small><div style={{fontWeight:500}}>{detailsModal.data.visitTime}</div></div>
                                    <div><small>Pax</small><div style={{fontWeight:500}}>{detailsModal.data.numberOfVisitors}</div></div>
                                </div>
                                <div><small style={{color:'#888',fontWeight:'bold'}}>Purpose</small><div style={{background:'#f8f9fa',padding:12,borderRadius:8,borderLeft:'4px solid #b85c2d'}}>{detailsModal.data.purpose}</div></div>
                                <div><small style={{color:'#888',fontWeight:'bold'}}>Status</small><div style={{marginTop:6}}><span className={`status ${detailsModal.data.status}`}>{detailsModal.data.status}</span></div></div>
                            </>) : (<>
                                <div><small style={{color:'#888',fontWeight:'bold',textTransform:'uppercase'}}>Donor</small><div style={{fontWeight:600}}>{detailsModal.data.donorName}</div></div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,background:'#f8f9fa',padding:14,borderRadius:8}}>
                                    <div><small>Amount</small><div style={{color:'#28a745',fontWeight:'bold',fontSize:'1.3rem'}}>₱{detailsModal.data.amount?.toLocaleString()}</div></div>
                                    <div><small>Type</small><div style={{fontWeight:500}}>{detailsModal.data.donationType}</div></div>
                                </div>
                                <div><small style={{color:'#888',fontWeight:'bold'}}>Receipt</small><div style={{fontFamily:'monospace',background:'#f8f9fa',padding:'10px 14px',borderRadius:8}}>{detailsModal.data.receiptNumber||'Awaiting confirmation'}</div></div>
                                <div><small style={{color:'#888',fontWeight:'bold'}}>Status</small><div style={{marginTop:6}}><span className={`status ${detailsModal.data.paymentStatus}`}>{detailsModal.data.paymentStatus}</span></div></div>
                            </>)}
                        </div>
                        <div style={{marginTop:24,textAlign:'right',borderTop:'2px solid #f0f0f0',paddingTop:18}}>
                            <button className="btn-outline-sm" onClick={closeDetailsModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;