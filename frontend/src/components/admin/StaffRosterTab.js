import React, { useMemo, useState } from 'react';
import {
    FaUserCircle, FaSync, FaClock,
    FaPhone, FaEnvelope, FaPrint, FaTimes,
    FaSun, FaCloudSun, FaMoon
} from 'react-icons/fa';

const getAccountStatus = (m) => {
    if (m.status) return m.status;
    if (!m.isVerified && !m.isActive) return 'pending';
    if (m.isActive) return 'active';
    return 'deactivated';
};

const SHIFTS = [
    { key: 'morning',   label: 'Morning',   time: '6:00 AM – 2:00 PM',  icon: <FaSun /> },
    { key: 'afternoon', label: 'Afternoon', time: '2:00 PM – 10:00 PM', icon: <FaCloudSun /> },
    { key: 'night',     label: 'Night',     time: '10:00 PM – 6:00 AM', icon: <FaMoon /> },
];
const getShift = (index) => SHIFTS[index % 3];

const PAGE_SIZE = 10;

/* Shift Modal */
const ShiftModal = ({ shift, members, onClose }) => {
    if (!shift) return null;
    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(26,10,0,.45)',
                zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, backdropFilter: 'blur(4px)'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500,
                    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 24px 64px rgba(0,0,0,.15)',
                    border: '1px solid #E8D6CC',
                    overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', background: '#FFF8F3',
                    borderBottom: '1px solid #E8D6CC',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.2rem' }}>{shift.icon}</span>
                        <div>
                            <div style={{ fontWeight: 700 }}>{shift.label} Shift</div>
                            <div style={{ fontSize: '.72rem', color: '#7A5C4E' }}>{shift.time}</div>
                        </div>
                        <span style={{
                            marginLeft: 12, padding: '2px 10px', borderRadius: 20,
                            background: '#FFF3E0', color: '#D97706',
                            fontSize: '.7rem', fontWeight: 700,
                        }}>{members.length} staff</span>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#7A5C4E', fontSize: '1rem'
                    }}><FaTimes /></button>
                </div>

                <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
                    {members.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#7A5C4E', fontStyle: 'italic' }}>
                            No staff assigned to this shift.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #E8D6CC' }}>
                                    <th style={{ padding: '8px 6px', textAlign: 'left', color: '#A38070', fontSize: '0.7rem', fontWeight: 700 }}>Name</th>
                                    <th style={{ padding: '8px 6px', textAlign: 'left', color: '#A38070', fontSize: '0.7rem', fontWeight: 700 }}>Role</th>
                                    <th style={{ padding: '8px 6px', textAlign: 'left', color: '#A38070', fontSize: '0.7rem', fontWeight: 700 }}>Contact</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m) => (
                                    <tr key={m._id} style={{ borderBottom: '1px solid #E8D6CC' }}>
                                        <td style={{ padding: '10px 6px' }}>
                                            <div style={{ fontWeight: 600 }}>{m.firstName} {m.lastName}</div>
                                            <div style={{ fontSize: '.7rem', color: '#7A5C4E' }}>@{m.username || '—'}</div>
                                        </td>
                                        <td style={{ padding: '10px 6px', textTransform: 'capitalize' }}>{m.role || 'staff'}</td>
                                        <td style={{ padding: '10px 6px', fontSize: '.75rem', color: '#7A5C4E' }}>
                                            {m.phone && <div>{m.phone}</div>}
                                            {m.email && <div style={{ fontSize: '.7rem' }}>{m.email}</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

const StaffRosterTab = ({ staff = [], onRefresh }) => {
    const [page, setPage] = useState(1);
    const [activeShiftModal, setActiveShiftModal] = useState(null);

    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const activeStaff = useMemo(
        () => staff
            .filter(m => getAccountStatus(m) === 'active')
            .map((m, idx) => ({ ...m, shift: getShift(idx) })),
        [staff]
    );

    const shiftCounts = useMemo(
        () => SHIFTS.map(s => ({
            ...s,
            count: activeStaff.filter(m => m.shift.key === s.key).length,
            members: activeStaff.filter(m => m.shift.key === s.key),
        })),
        [activeStaff]
    );

    const totalPages = Math.max(1, Math.ceil(activeStaff.length / PAGE_SIZE));
    const paged = activeStaff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Staff Roster Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; }
                    h2 { color: #1A0A00; margin-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #FFF8F3; padding: 10px; text-align: left; border-bottom: 1px solid #E8D6CC; }
                    td { padding: 10px; border-bottom: 1px solid #E8D6CC; }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Staff Roster</h2>
                <p>Date: ${today} | Active staff: ${activeStaff.length}</p>
                <table>
                    <thead><tr><th>Name</th><th>Role</th><th>Shift</th><th>Email</th><th>Phone</th></tr></thead>
                    <tbody>
                        ${activeStaff.map(m => `
                            <tr>
                                <td>${m.firstName} ${m.lastName}</td>
                                <td>${m.role || 'staff'}</td>
                                <td>${m.shift.label} Shift</td>
                                <td>${m.email || '—'}</td>
                                <td>${m.phone || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        win.document.close();
        win.print();
        win.close();
    };

    return (
        <div>
            {/* Shift Cards - Clickable */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
                {shiftCounts.map(s => (
                    <div
                        key={s.key}
                        className="stat-card clickable"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setActiveShiftModal(s)}
                    >
                        <div className="stat-icon">{s.icon}</div>
                        <div className="stat-info">
                            <h3>{s.count}</h3>
                            <p>{s.label} Shift</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Shift Modal */}
            {activeShiftModal && (
                <ShiftModal
                    shift={activeShiftModal}
                    members={activeShiftModal.members}
                    onClose={() => setActiveShiftModal(null)}
                />
            )}

            {/* Simple Table - Just like Recent Bookings */}
            <div className="card-white">
                <div className="card-header">
                    <h5>Staff Roster — {today}</h5>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline-sm" onClick={handlePrint}>
                            <FaPrint /> Print
                        </button>
                        <button className="btn-outline-sm" onClick={onRefresh}>
                            <FaSync /> Refresh
                        </button>
                    </div>
                </div>

                {activeStaff.length === 0 ? (
                    <div className="no-data">No active staff members found.</div>
                ) : (
                    <>
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>NAME</th>
                                    <th>ROLE</th>
                                    <th>SHIFT</th>
                                    <th>CONTACT</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((m, i) => {
                                    const shift = m.shift;
                                    return (
                                        <tr key={m._id}>
                                            <td>
                                                <strong>{m.firstName} {m.lastName}</strong>
                                                <br />
                                                <small style={{ color: 'var(--d-muted)' }}>@{m.username || '—'}</small>
                                            </td>
                                            <td style={{ textTransform: 'capitalize' }}>{m.role || 'staff'}</td>
                                            <td>
                                                {shift.icon} {shift.label}
                                                <br />
                                                <small style={{ color: 'var(--d-muted)' }}>{shift.time}</small>
                                            </td>
                                            <td>
                                                {m.phone && <div><FaPhone size={10} style={{ marginRight: 5 }} />{m.phone}</div>}
                                                {m.email && <div><FaEnvelope size={10} style={{ marginRight: 5 }} />{m.email}</div>}
                                            </td>
                                            <td>
                                                <span className="status active">on duty</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination-container">
                                <span className="pagination-info">
                                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, activeStaff.length)} of {activeStaff.length}
                                </span>
                                <div className="pagination-controls">
                                    <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&laquo; Prev</button>
                                    <button className="page-btn active">{page}</button>
                                    <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next &raquo;</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StaffRosterTab;