import React, { useMemo, useState } from 'react';
import {
    FaUserCircle, FaUserMd, FaSync, FaClock,
    FaPhone, FaEnvelope, FaPrint, FaTimes,
    FaSun, FaCloudSun, FaMoon, FaChevronLeft, FaChevronRight
} from 'react-icons/fa';

const getAccountStatus = (m) => {
    if (m.status) return m.status;
    if (!m.isVerified && !m.isActive) return 'pending';
    if (m.isActive) return 'active';
    return 'deactivated';
};

const SHIFTS = [
    { key: 'morning',   label: 'Morning',   time: '6:00 AM – 2:00 PM',  icon: <FaSun />,       bg: '#FFF8F3', border: '#E8D6CC', text: '#7A5C4E' },
    { key: 'afternoon', label: 'Afternoon', time: '2:00 PM – 10:00 PM', icon: <FaCloudSun />,  bg: '#FFF8F3', border: '#E8D6CC', text: '#7A5C4E' },
    { key: 'night',     label: 'Night',     time: '10:00 PM – 6:00 AM', icon: <FaMoon />,      bg: '#FFF8F3', border: '#E8D6CC', text: '#7A5C4E' },
];
const getShift = (index) => SHIFTS[index % 3];

const PAGE_SIZE = 10;

/* ── Simple Shift Modal ── */
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
                    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
                    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 24px 64px rgba(0,0,0,.15)',
                    border: '1px solid #E8D6CC',
                    overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifycontent: 'space-between',
                    padding: '18px 22px', background: '#FFF8F3',
                    borderBottom: '1px solid #E8D6CC',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        <span style={{ fontSize: '1.2rem', color: '#1A0A00' }}>{shift.icon}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A0A00' }}>{shift.label} Shift</div>
                            <div style={{ fontSize: '.75rem', color: '#7A5C4E' }}>{shift.time}</div>
                        </div>
                        <span style={{
                            marginLeft: 'auto', marginRight: 12, padding: '4px 12px', borderRadius: 20,
                            background: '#FFF3E0', color: '#D97706',
                            fontSize: '.75rem', fontWeight: 700,
                        }}>{members.length} staff</span>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#7A5C4E', fontSize: '1.1rem', padding: 4, display: 'flex'
                    }}><FaTimes /></button>
                </div>

                {/* List inside Modal */}
                <div style={{ overflowY: 'auto', padding: '14px 22px', flex: 1, background: '#FFF8F3' }}>
                    {members.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#7A5C4E', fontStyle: 'italic' }}>
                            No staff assigned to this shift.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #E8D6CC' }}>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#A38070', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>Name</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#A38070', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m) => (
                                    <tr key={m._id} style={{ borderBottom: '1px solid #E8D6CC' }}>
                                        <td style={{ padding: '12px 10px' }}>
                                            <div style={{ fontWeight: 600, color: '#1A0A00' }}>{m.firstName} {m.lastName}</div>
                                            <div style={{ fontSize: '.72rem', color: '#7A5C4E' }}>@{m.username || '—'}</div>
                                        </td>
                                        <td style={{ padding: '12px 10px' }}>
                                            <span style={{ fontSize: '0.84rem', color: '#1A0A00', textTransform: 'capitalize' }}>{m.role || 'staff'}</span>
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

/* ── Main Component ── */
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

    // Pagination Calculation
    const totalPages = Math.max(1, Math.ceil(activeStaff.length / PAGE_SIZE));
    const paged = activeStaff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Staff Roster Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; background: #FFF8F3; }
                    h2 { color: #1A0A00; margin-bottom: 4px; font-weight: 700; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .84rem; }
                    th { background: #FFF8F3; color: #A38070; padding: 10px 12px; text-align: left; text-transform: uppercase; border-bottom: 1px solid #E8D6CC; }
                    td { padding: 12px 12px; border-bottom: 1px solid #E8D6CC; color: #1A0A00; }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Staff Roster</h2>
                <p class="sub">Date: ${today} | Active staff: ${activeStaff.length}</p>
                <table>
                    <thead><tr><th>Name</th><th>Role</th><th>Shift</th><th>Email</th><th>Phone</th></tr></thead>
                    <tbody>
                        ${activeStaff.map((m) => `
                            <tr>
                                <td><strong>${m.firstName} ${m.lastName}</strong><br><small>@${m.username || '—'}</small></td>
                                <td style="text-transform: capitalize;">${m.role || 'staff'}</td>
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
        win.focus();
        win.print();
        win.close();
    };

    return (
        <div>
            {/* Minimalist Shift Cards Layout */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
                {shiftCounts.map(s => (
                    <div
                        key={s.key}
                        className="stat-card clickable"
                        style={{ borderLeft: `none`, background: '#FFF8F3', border: '1px solid #E8D6CC', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setActiveShiftModal(s)}
                        title={`View ${s.label} Shift staff`}
                    >
                        <div className="stat-icon" style={{ background: '#FFFFFF', border: '1px solid #E8D6CC', color: '#1A0A00' }}>{s.icon}</div>
                        <div className="stat-info">
                            <h3 style={{ color: '#1A0A00', fontWeight: 700 }}>{s.count}</h3>
                            <p style={{ fontSize: '.75rem', color: '#7A5C4E', textTransform: 'none', letterSpacing: 'normal' }}>{s.label} Shift</p>
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: '.72rem', color: '#A38070', fontWeight: 600 }}>
                            View ›
                        </div>
                    </div>
                ))}
            </div>

            {/* Shift Modal Popup */}
            {activeShiftModal && (
                <ShiftModal
                    shift={activeShiftModal}
                    members={activeShiftModal.members}
                    onClose={() => setActiveShiftModal(null)}
                />
            )}

            {/* Simple Roster Table Card matching All Bookings */}
            <div className="card-white" style={{ border: 'none', boxShadow: 'none', padding: 0 }}>
                <div className="card-header" style={{ borderBottom: 'none', marginBottom: 10, paddingLeft: 0 }}>
                    <h5 style={{ fontFamily: "var(--d-font-head)", fontSize: "1.35rem", fontWeight: 700, color: "var(--d-ink)" }}>
                        Staff Roster
                        <small style={{ fontWeight: 400, color: '#7A5C4E', fontSize: '.84rem', marginLeft: 8 }}>
                            — {today}
                        </small>
                    </h5>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline-sm" style={{ background: '#fff', border: '1px solid #E8D6CC', color: '#1A0A00' }} onClick={handlePrint}><FaPrint /> Print Roster</button>
                        <button className="btn-outline-sm" style={{ background: '#fff', border: '1px solid #E8D6CC', color: '#1A0A00' }} onClick={onRefresh}><FaSync /> Refresh</button>
                    </div>
                </div>

                {activeStaff.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--d-muted)', margin: 0, fontStyle: 'italic' }}>
                            No active staff members found on duty.
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "var(--d-font-body)" }}>
                                <thead>
                                    <tr style={{ background: '#FFF8F3', borderBottom: '1px solid #E8D6CC' }}>
                                        <th style={{ ...thSimple, width: '5%' }}>#</th>
                                        <th style={{ ...thSimple, width: '35%' }}>Personnel</th>
                                        <th style={{ ...thSimple, width: '20%' }}>Role</th>
                                        <th style={{ ...thSimple, width: '20%' }}>Assigned Shift</th>
                                        <th style={{ ...thSimple, width: '20%' }}>Contact Info</th>
                                        <th style={{ ...thSimple, width: '10%', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map((m, i) => {
                                        const sc = m.shift;
                                        const rowNum = (page - 1) * PAGE_SIZE + i + 1;
                                        return (
                                            <tr key={m._id} style={{ borderBottom: '1px solid #E8D6CC', background: '#FFF8F3' }}>
                                                <td style={tdSimple}>
                                                    <span style={{ color: '#7A5C4E', fontSize: '.84rem' }}>{rowNum}</span>
                                                </td>
                                                <td style={tdSimple}>
                                                    <div style={{ fontWeight: 700, color: '#1A0A00', fontSize: '0.92rem', marginBottom: 2 }}>
                                                        {m.firstName} {m.lastName}
                                                    </div>
                                                    <div style={{ fontSize: '.75rem', color: '#7A5C4E' }}>@{m.username || '—'}</div>
                                                </td>
                                                <td style={tdSimple}>
                                                    <span style={{ fontSize: '0.88rem', color: '#1A0A00', textTransform: 'capitalize', fontWeight: 500 }}>
                                                        {m.role || 'staff'}
                                                    </span>
                                                </td>
                                                <td style={tdSimple}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1A0A00', fontSize: '0.88rem', fontWeight: 600 }}>
                                                        {sc.icon} {sc.label}
                                                    </div>
                                                    <div style={{ fontSize: '.75rem', color: '#7A5C4E', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <FaClock size={10} /> {sc.time}
                                                    </div>
                                                </td>
                                                <td style={tdSimple}>
                                                    {m.phone && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#1A0A00', marginBottom: 2 }}>
                                                            <FaPhone size={10} style={{ color: '#7A5C4E' }} /> {m.phone}
                                                        </div>
                                                    )}
                                                    {m.email && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#1A0A00' }}>
                                                            <FaEnvelope size={10} style={{ color: '#7A5C4E' }} /> {m.email}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ ...tdSimple, textAlign: 'center' }}>
                                                    <span style={{ background: '#E6F4EA', color: '#1E7D56', padding: '5px 14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-block' }}>
                                                        on duty
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Classic Paginator Layout */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifycontent: 'space-between',
                            padding: '16px 4px', flexWrap: 'wrap', gap: 10,
                        }}>
                            <span style={{ fontSize: '.82rem', color: '#7A5C4E', background: '#FFF8F3', padding: '6px 14px', borderRadius: 20, border: '1px solid #E8D6CC' }}>
                                Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, activeStaff.length)}</strong> of <strong>{activeStaff.length}</strong> staff
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <button
                                    className="page-btn"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    &laquo; Prev
                                </button>
                                <button className="page-btn active">{page}</button>
                                <button
                                    className="page-btn"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Next &raquo;
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/* ── Layout Constants matching Simple Table Spec ── */
const thSimple = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#A38070',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
};

const tdSimple = {
    padding: '16px 16px',
    verticalAlign: 'middle',
};

export default StaffRosterTab;