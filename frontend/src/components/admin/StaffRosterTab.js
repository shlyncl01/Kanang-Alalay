// StaffRosterTab.js - COMPLETE FIXED VERSION
import React, { useMemo, useState, useEffect } from 'react';
import { 
    FaSun, FaUserShield, FaMoon, FaPrint, FaSync, FaPhone, FaEnvelope, 
    FaTimes, FaCalendarAlt, FaFilter, FaSearch, FaChevronLeft, FaChevronRight,
    FaEye
} from 'react-icons/fa';

// The 3 shift types used across the Staff Roster page.
// DAY and NIGHT are fixed 12-hour windows; FLEXIBLE is reserved for Admin
// users, whose hours aren't a fixed block, so its "time" is shown as "Admin".
const SHIFTS = [
    { key: 'DAY', label: 'Day Shift', time: '7:00 AM – 7:00 PM', icon: <FaSun />, color: '#F96B38' },
    { key: 'NIGHT', label: 'Night Shift', time: '7:00 PM – 7:00 AM', icon: <FaMoon />, color: '#6f42c1' },
    { key: 'FLEXIBLE', label: 'Flexible Shift', time: 'Admin', icon: <FaUserShield />, color: '#17a2b8' },
];

// NIGHT shift (7:00 PM – 7:00 AM) crosses midnight, so "is this shift active
// right now" can't use a simple start < now < end check — it has to treat
// the window as wrapping past 12:00 AM (i.e. hour >= 19 OR hour < 7).
const isShiftActiveNow = (shiftKey, now = new Date()) => {
    const hour = now.getHours();
    if (shiftKey === 'DAY') return hour >= 7 && hour < 19;       // 7:00 AM – 7:00 PM
    if (shiftKey === 'NIGHT') return hour >= 19 || hour < 7;     // 7:00 PM – 7:00 AM (wraps midnight)
    return false; // FLEXIBLE has no fixed window
};

const ROLES = ['all', 'admin', 'head_caregiver', 'caregiver'];
const ROLE_LABEL = { admin: 'Admin', head_caregiver: 'Head Caregiver', caregiver: 'Caregiver' };
const ITEMS_PER_PAGE = 10;

const getAccountStatus = (m) => {
    if (m.status === 'active') return 'active';
    if (m.isActive) return 'active';
    return 'inactive';
};

const ShiftModal = ({ shift, members, onClose }) => {
    if (!shift) return null;
    
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={onClose}>
            <div style={{
                background: 'white', borderRadius: 20, width: 500, maxHeight: '85vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ 
                    padding: '18px 24px', 
                    background: `linear-gradient(135deg, ${shift.color}, ${shift.color}dd)`,
                    color: '#fff',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                }}>
                    <div>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{shift.icon}</div>
                        <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{shift.label}</h3>
                        <div style={{ fontSize: 13, opacity: 0.9 }}>{shift.time}</div>
                    </div>
                    <button onClick={onClose} style={{ 
                        background: 'rgba(255,255,255,0.2)', 
                        border: 'none', 
                        width: 36, height: 36, 
                        borderRadius: '50%', 
                        cursor: 'pointer',
                        color: '#fff',
                        fontSize: 16
                    }}><FaTimes /></button>
                </div>
                <div style={{ padding: '20px', overflowY: 'auto' }}>
                    {members.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#7A5C4E' }}>
                            No staff assigned to this shift
                        </div>
                    ) : (
                        members.map(m => (
                            <div key={m._id} style={{ 
                                padding: '14px', 
                                borderBottom: '1px solid #E8D6CC',
                                transition: 'background 0.2s',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FFF8F3'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ fontSize: '1rem' }}>{m.firstName} {m.lastName}</strong>
                                        <div style={{ fontSize: 12, color: '#7A5C4E', marginTop: 4 }}>
                                            {m.role === 'head_caregiver' ? 'Head Caregiver' : m.role === 'admin' ? 'Admin' : 'Caregiver'}
                                        </div>
                                    </div>
                                    <span style={{ 
                                        background: shift.color + '20', 
                                        color: shift.color,
                                        padding: '4px 12px',
                                        borderRadius: 20,
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                    }}>
                                        {shift.label}
                                    </span>
                                </div>
                                {m.phone && (
                                    <div style={{ fontSize: 12, color: '#7A5C4E', marginTop: 8 }}>
                                        <FaPhone size={10} style={{ marginRight: 4 }} /> {m.phone}
                                        {m.email && <span style={{ marginLeft: 12 }}><FaEnvelope size={10} style={{ marginRight: 4 }} /> {m.email}</span>}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const StaffRosterTab = ({ staff = [], onRefresh, currentUser }) => {
    const [page, setPage] = useState(1);
    const [activeShift, setActiveShift] = useState(null);
    const [roleFilter, setRoleFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('shifts');
    const [refreshing, setRefreshing] = useState(false);
    const [refreshFeedback, setRefreshFeedback] = useState(null); // { type: 'success'|'error', message }
    
    // Filter staff by role and search
    const filteredStaff = useMemo(() => {
        let filtered = staff.filter(m => getAccountStatus(m) === 'active');
        
        if (roleFilter !== 'all') {
            filtered = filtered.filter(m => m.role === roleFilter);
        }
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(m => 
                `${m.firstName} ${m.lastName}`.toLowerCase().includes(query) ||
                (m.email || '').toLowerCase().includes(query) ||
                (m.phone || '').toLowerCase().includes(query) ||
                (m.role || '').toLowerCase().includes(query)
            );
        }
        
        return filtered;
    }, [staff, roleFilter, searchQuery]);
    
    // Assign each staff member to one of the 3 shift types, reusing the
    // existing staff/role data rather than introducing new fields:
    // - Admins are always FLEXIBLE, regardless of anything stored on the
    //   record — Flexible is Admin-only, so role wins.
    // - Everyone else uses their stored `shift` field (DAY/NIGHT) when it's
    //   present and valid; otherwise they're distributed evenly across
    //   DAY/NIGHT so the roster always has something to display.
    const DAY_NIGHT_SHIFTS = useMemo(() => SHIFTS.filter(s => s.key !== 'FLEXIBLE'), []);
    const FLEXIBLE_SHIFT = useMemo(() => SHIFTS.find(s => s.key === 'FLEXIBLE'), []);

    const staffWithShifts = useMemo(() => {
        let nonAdminIdx = 0;
        return filteredStaff.map((m) => {
            if (m.role === 'admin') {
                return { ...m, shift: FLEXIBLE_SHIFT, scheduleTime: FLEXIBLE_SHIFT.time };
            }
            const stored = (m.shift || '').toUpperCase();
            const matched = DAY_NIGHT_SHIFTS.find(s => s.key === stored);
            const shift = matched || DAY_NIGHT_SHIFTS[nonAdminIdx % DAY_NIGHT_SHIFTS.length];
            nonAdminIdx += 1;
            return { ...m, shift, scheduleTime: shift.time };
        });
    }, [filteredStaff, DAY_NIGHT_SHIFTS, FLEXIBLE_SHIFT]);
    
    // Shift counts
    const shiftCounts = useMemo(() => {
        return SHIFTS.map(s => ({
            ...s,
            count: staffWithShifts.filter(m => m.shift.key === s.key).length,
            members: staffWithShifts.filter(m => m.shift.key === s.key),
        }));
    }, [staffWithShifts]);
    
    // Pagination
    const paginatedStaff = staffWithShifts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const totalPages = Math.max(1, Math.ceil(staffWithShifts.length / ITEMS_PER_PAGE));
    
    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [roleFilter, searchQuery]);
    
    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        setRefreshFeedback(null);
        try {
            const result = await onRefresh?.();
            // fetchStaffList (passed as onRefresh) returns { success, staff } from the API.
            // Filters (roleFilter/searchQuery) and pagination (page) are local component
            // state and are untouched by this call, so they're preserved automatically.
            if (result && result.success === false) {
                setRefreshFeedback({ type: 'error', message: 'Could not refresh staff list. Please try again.' });
            } else {
                setRefreshFeedback({ type: 'success', message: 'Staff list refreshed.' });
            }
        } catch (err) {
            setRefreshFeedback({ type: 'error', message: 'Could not refresh staff list. Please try again.' });
        } finally {
            setRefreshing(false);
            setTimeout(() => setRefreshFeedback(null), 3000);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow pop-ups to print this report');
            return;
        }
        
        const getRoleDisplay = (role) => {
            if (role === 'head_caregiver') return 'Head Caregiver';
            if (role === 'admin') return 'Admin';
            return 'Caregiver';
        };
        
        const getShiftColor = (shiftKey) => {
            const shift = SHIFTS.find(s => s.key === shiftKey);
            return shift ? shift.color : '#b85c2d';
        };

        const generatedByName = currentUser
            ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || currentUser.username || 'Admin'
            : 'Admin';
        const generatedByRole = currentUser?.role || 'admin';
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Staff Roster - Kanang-Alalay Care Facility</title>
                    <meta charset="UTF-8">
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Segoe UI', 'DM Sans', Arial, sans-serif;
                            padding: 30px;
                            color: #1A0A00;
                            background: white;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                            padding-bottom: 20px;
                            border-bottom: 2px solid #b85c2d;
                        }
                        h1 {
                            color: #b85c2d;
                            font-family: 'Playfair Display', Georgia, serif;
                            font-size: 28px;
                            margin-bottom: 8px;
                        }
                        .subtitle {
                            color: #7A5C4E;
                            font-size: 12px;
                        }
                        .report-info {
                            display: flex;
                            justify-content: space-between;
                            margin: 20px 0;
                            padding: 12px 16px;
                            background: #FFF8F3;
                            border-radius: 8px;
                            font-size: 12px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 20px;
                        }
                        th {
                            background: #b85c2d;
                            color: white;
                            padding: 12px 16px;
                            text-align: left;
                            font-weight: 600;
                            font-size: 12px;
                        }
                        td {
                            padding: 10px 16px;
                            border-bottom: 1px solid #E8D6CC;
                            font-size: 13px;
                        }
                        tr:nth-child(even) {
                            background: #FFF8F3;
                        }
                        .shift-badge {
                            display: inline-block;
                            padding: 4px 12px;
                            border-radius: 20px;
                            font-size: 11px;
                            font-weight: 600;
                        }
                        .footer {
                            margin-top: 30px;
                            padding-top: 16px;
                            border-top: 1px solid #E8D6CC;
                            font-size: 10px;
                            color: #7A5C4E;
                            text-align: center;
                        }
                        @media print {
                            body {
                                padding: 15px;
                            }
                            .no-print {
                                display: none;
                            }
                            th {
                                background: #b85c2d !important;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            .shift-badge {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Kanang-Alalay Care Facility</h1>
                        <div class="subtitle">Staff Roster & Shift Schedule Report</div>
                    </div>
                    
                    <div class="report-info">
                        <span>Date: ${new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <span>Time: ${new Date().toLocaleTimeString('en-PH')}</span>
                        <span>Total Active Staff: ${staffWithShifts.length}</span>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Staff Name</th>
                                <th>Role</th>
                                <th>Shift</th>
                                <th>Schedule</th>
                                <th>Contact</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${staffWithShifts.map((m, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td><strong>${m.firstName} ${m.lastName}</strong><br><small style="color:#7A5C4E">ID: ${m.staffId || m._id?.slice(-6) || 'N/A'}</small></td>
                                    <td>${getRoleDisplay(m.role)}</td>
                                    <td><span class="shift-badge" style="background:${getShiftColor(m.shift.key)}20;color:${getShiftColor(m.shift.key)}">${m.shift.label}</span></td>
                                    <td style="font-size:11px">${m.shift.time}</td>
                                    <td style="font-size:11px">${m.email || '—'}${m.phone ? `<br>Tel: ${m.phone}` : ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <h2 style="font-size:18px;margin-top:30px;">Audit Trail</h2>
                    <table>
                        <tbody>
                            <tr><th style="width:180px">Generated By</th><td>${generatedByName}</td></tr>
                            <tr><th>Role</th><td>${generatedByRole}</td></tr>
                            <tr><th>Date</th><td>${new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                            <tr><th>Time</th><td>${new Date().toLocaleTimeString('en-PH')}</td></tr>
                            <tr><th>Action Performed</th><td>Staff Roster Report Generated</td></tr>
                            <tr><th>Report Type</th><td>Staff Roster &amp; Shift Schedule</td></tr>
                            <tr><th>Number of Records</th><td>${staffWithShifts.length}</td></tr>
                            <tr><th>System Version</th><td>Kanang-Alalay Admin Panel v1.0</td></tr>
                            <tr><th>Export Timestamp</th><td>${new Date().toISOString()}</td></tr>
                        </tbody>
                    </table>

                    <div class="footer">
                        <p>This is an official staff roster report generated from Kanang-Alalay Care Facility Management System.</p>
                        <p>Report ID: KA-${Date.now()} • Generated on ${new Date().toLocaleString('en-PH')}</p>
                        <p>System Status: Active • All shifts are subject to change based on operational needs.</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };
    
    return (
        <div>
            {/* View Toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'flex-end' }}>
                <button 
                    onClick={() => setViewMode('shifts')}
                    className={viewMode === 'shifts' ? 'btn-primary-sm' : 'btn-outline-sm'}
                    style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
                >
                    Shift Cards View
                </button>
                <button 
                    onClick={() => setViewMode('table')}
                    className={viewMode === 'table' ? 'btn-primary-sm' : 'btn-outline-sm'}
                    style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
                >
                    Table View
                </button>
            </div>
            
            {/* Search and Filters */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: 13 }} />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone, or role..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 36px',
                            border: '1.5px solid #E8D6CC',
                            borderRadius: 10,
                            fontSize: '.88rem',
                            background: '#FFF8F3',
                            outline: 'none',
                            fontFamily: "'DM Sans', sans-serif"
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ 
                            position: 'absolute', 
                            right: 10, 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer', 
                            color: '#7A5C4E' 
                        }}>
                            <FaTimes size={12} />
                        </button>
                    )}
                </div>
                
                <FaFilter style={{ color: '#7A5C4E', fontSize: 14 }} />
                
                <select 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{
                        padding: '9px 14px',
                        border: '1.5px solid #E8D6CC',
                        borderRadius: 10,
                        fontSize: '.85rem',
                        background: '#FFF8F3',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif"
                    }}
                >
                    {ROLES.map(r => (
                        <option key={r} value={r}>
                            {r === 'all' ? 'All Roles' : ROLE_LABEL[r]}
                        </option>
                    ))}
                </select>
                
                <button
                    onClick={handleRefresh}
                    className="btn-outline-sm"
                    disabled={refreshing}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.7 : 1 }}
                >
                    <FaSync style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <button onClick={handlePrint} className="btn-outline-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
                    <FaPrint /> Print Roster
                </button>

                {refreshFeedback && (
                    <span style={{
                        fontSize: '.8rem', fontWeight: 600, padding: '6px 12px', borderRadius: 8,
                        color: refreshFeedback.type === 'success' ? '#0d6b4f' : '#b71c1c',
                        background: refreshFeedback.type === 'success' ? '#e0faf4' : '#fdecea',
                    }}>
                        {refreshFeedback.message}
                    </span>
                )}
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
            
            {/* Shift Cards View */}
            {viewMode === 'shifts' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
                    {shiftCounts.map(shift => (
                        <div
                            key={shift.key}
                            onClick={() => setActiveShift(shift)}
                            style={{
                                background: 'linear-gradient(135deg, #fff, #FFF8F3)',
                                borderRadius: 20,
                                padding: 28,
                                textAlign: 'center',
                                cursor: 'pointer',
                                border: `2px solid ${shift.color}30`,
                                boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
                            }}
                        >
                            <div style={{ 
                                position: 'absolute', 
                                top: 0, 
                                left: 0, 
                                right: 0, 
                                height: 5, 
                                background: shift.color 
                            }} />
                            <div style={{ fontSize: 45, marginBottom: 12, color: shift.color }}>{shift.icon}</div>
                            <div style={{ fontSize: 48, fontWeight: 'bold', color: '#1A0A00', marginBottom: 8 }}>{shift.count}</div>
                            <div style={{ fontWeight: 700, color: shift.color, marginBottom: 6, fontSize: '1.1rem' }}>{shift.label}</div>
                            <div style={{ fontSize: 12, color: '#7A5C4E' }}>{shift.time}</div>
                            {isShiftActiveNow(shift.key) && (
                                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#28a745' }}>
                                    ● On duty now
                                </div>
                            )}
                            <div style={{ 
                                marginTop: 18, 
                                fontSize: 12, 
                                color: shift.color,
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6
                            }}>
                                <FaEye size={12} /> Click to view staff details
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Table View */}
            {viewMode === 'table' && (
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8D6CC', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', background: '#FFF8F3' }}>
                        <h5 style={{ margin: 0, fontFamily: "'Playfair Display', serif" }}>Staff Roster Details</h5>
                        <small style={{ color: '#7A5C4E' }}>
                            Showing {staffWithShifts.length} active staff member{staffWithShifts.length !== 1 ? 's' : ''}
                            {searchQuery && ` • Filtered by "${searchQuery}"`}
                            {roleFilter !== 'all' && ` • Role: ${ROLE_LABEL[roleFilter]}`}
                        </small>
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFF8F3', borderBottom: '1px solid #E8D6CC' }}>
                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>STAFF</th>
                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>ROLE</th>
                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>SHIFT</th>
                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>SCHEDULE</th>
                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#A38070', textTransform: 'uppercase' }}>CONTACT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedStaff.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#7A5C4E' }}>
                                            {searchQuery ? `No staff members match "${searchQuery}"` : 'No active staff members found'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedStaff.map(m => (
                                        <tr key={m._id} style={{ borderBottom: '1px solid #E8D6CC' }}>
                                            <td style={{ padding: '14px 16px' }}>
                                                <strong style={{ fontSize: '0.95rem' }}>{m.firstName} {m.lastName}</strong>
                                                <div style={{ fontSize: 11, color: '#7A5C4E', marginTop: 4 }}>{m.staffId || m._id?.slice(-6) || '—'}</div>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '4px 12px',
                                                    borderRadius: 20,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    background: m.role === 'admin' ? '#dc354520' : m.role === 'head_caregiver' ? '#b85c2d20' : '#28a74520',
                                                    color: m.role === 'admin' ? '#dc3545' : m.role === 'head_caregiver' ? '#b85c2d' : '#28a745'
                                                }}>
                                                    {m.role === 'head_caregiver' ? 'Head Caregiver' : m.role === 'admin' ? 'Admin' : 'Caregiver'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 18 }}>{m.shift.icon}</span>
                                                    <span style={{ fontWeight: 500 }}>{m.shift.label}</span>
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#7A5C4E' }}>{m.shift.time}</td>
                                            <td style={{ padding: '14px 16px' }}>
                                                {m.phone && <div style={{ fontSize: '0.85rem', marginBottom: 4 }}><FaPhone size={10} style={{ marginRight: 6, color: '#7A5C4E' }} />{m.phone}</div>}
                                                {m.email && <div style={{ fontSize: '0.8rem', color: '#7A5C4E' }}><FaEnvelope size={10} style={{ marginRight: 6 }} />{m.email}</div>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ 
                            padding: '14px 20px', 
                            borderTop: '1px solid #E8D6CC', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            background: '#FFF8F3'
                        }}>
                            <span style={{ fontSize: 12, color: '#7A5C4E' }}>
                                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, staffWithShifts.length)} of {staffWithShifts.length}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button 
                                    disabled={page === 1} 
                                    onClick={() => setPage(p => p - 1)} 
                                    style={{ 
                                        padding: '6px 16px', 
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
                                <span style={{ 
                                    padding: '6px 16px', 
                                    borderRadius: 8, 
                                    background: '#F96B38', 
                                    color: 'white', 
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                }}>
                                    {page} / {totalPages}
                                </span>
                                <button 
                                    disabled={page === totalPages} 
                                    onClick={() => setPage(p => p + 1)} 
                                    style={{ 
                                        padding: '6px 16px', 
                                        borderRadius: 8, 
                                        border: '1px solid #E8D6CC', 
                                        background: page === totalPages ? '#f5f5f5' : '#FFF8F3',
                                        cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                        opacity: page === totalPages ? 0.5 : 1,
                                        fontFamily: "'DM Sans', sans-serif"
                                    }}
                                >
                                    Next <FaChevronRight size={11} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Shift Modal */}
            {activeShift && (
                <ShiftModal shift={activeShift} members={activeShift.members} onClose={() => setActiveShift(null)} />
            )}
        </div>
    );
};

export default StaffRosterTab;