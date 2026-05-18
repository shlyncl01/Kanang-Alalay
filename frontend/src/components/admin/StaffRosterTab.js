import React, { useMemo, useRef, useState } from 'react';
import {
    FaUserCircle, FaUserMd, FaSync, FaClock,
    FaPhone, FaEnvelope, FaPrint, FaTimes,
    FaSun, FaCloudSun, FaMoon, FaChevronLeft, FaChevronRight,
} from 'react-icons/fa';

const getAccountStatus = (m) => {
    if (m.status) return m.status;
    if (!m.isVerified && !m.isActive) return 'pending';
    if (m.isActive) return 'active';
    return 'deactivated';
};

const SHIFTS = [
    { key: 'morning',   label: 'Morning',   time: '6:00 AM – 2:00 PM',  icon: <FaSun />,       bg: '#fff8e1', border: '#ffc107', text: '#7c5a00' },
    { key: 'afternoon', label: 'Afternoon', time: '2:00 PM – 10:00 PM', icon: <FaCloudSun />,  bg: '#e8f5e9', border: '#28a745', text: '#155e27' },
    { key: 'night',     label: 'Night',     time: '10:00 PM – 6:00 AM', icon: <FaMoon />,      bg: '#e8eaf6', border: '#5c6bc0', text: '#2c3494' },
];
const getShift = (index) => SHIFTS[index % 3];

const ROLE_COLORS = {
    admin:     { bg: '#fdecea', color: '#b71c1c' },
    nurse:     { bg: '#e3f2fd', color: '#0d47a1' },
    caregiver: { bg: '#f3e5f5', color: '#6a1b9a' },
    staff:     { bg: '#e0f2f1', color: '#00695c' },
};
const roleStyle = (role) => ROLE_COLORS[role?.toLowerCase()] || { bg: '#f5f5f5', color: '#555' };

const PAGE_SIZE = 10;

/* ── Shift Modal ── */
const ShiftModal = ({ shift, members, onClose }) => {
    if (!shift) return null;
    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
                zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, animation: 'fadeIn .18s ease',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
                    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 24px 64px rgba(0,0,0,.22)',
                    border: `2px solid ${shift.border}`,
                    overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 22px', background: shift.bg,
                    borderBottom: `1.5px solid ${shift.border}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.3rem', color: shift.text }}>{shift.icon}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: shift.text }}>{shift.label} Shift</div>
                            <div style={{ fontSize: '.75rem', color: shift.text, opacity: .75 }}>{shift.time}</div>
                        </div>
                        <span style={{
                            marginLeft: 8, padding: '2px 10px', borderRadius: 99,
                            background: shift.border, color: '#fff',
                            fontSize: '.72rem', fontWeight: 700,
                        }}>{members.length} staff</span>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: shift.text, fontSize: '1rem', padding: 6, borderRadius: 8,
                        transition: 'background .15s',
                    }}><FaTimes /></button>
                </div>

                {/* List */}
                <div style={{ overflowY: 'auto', padding: '14px 22px', flex: 1 }}>
                    {members.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--d-muted)' }}>
                            No staff assigned to this shift.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
                            <thead>
                                <tr style={{ borderBottom: `2px solid ${shift.border}` }}>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', color: shift.text, fontWeight: 700 }}>Name</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', color: shift.text, fontWeight: 700 }}>Role</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', color: shift.text, fontWeight: 700 }}>Contact</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m, i) => {
                                    const rs = roleStyle(m.role);
                                    return (
                                        <tr key={m._id} style={{ borderBottom: '1px solid #f0e8e0', background: i % 2 === 0 ? '#fff' : shift.bg }}>
                                            <td style={{ padding: '10px 10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FaUserCircle size={22} color={shift.border} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--d-ink)' }}>{m.firstName} {m.lastName}</div>
                                                        <div style={{ fontSize: '.7rem', color: 'var(--d-muted)' }}>@{m.username || '—'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 10px' }}>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 99,
                                                    background: rs.bg, color: rs.color,
                                                    fontSize: '.71rem', fontWeight: 700, textTransform: 'capitalize',
                                                }}>{m.role || 'staff'}</span>
                                            </td>
                                            <td style={{ padding: '10px 10px' }}>
                                                {m.phone && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.73rem', color: 'var(--d-muted)', marginBottom: 2 }}>
                                                        <FaPhone style={{ fontSize: '.62rem' }} /> {m.phone}
                                                    </div>
                                                )}
                                                {m.email && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.73rem', color: 'var(--d-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                                        <FaEnvelope style={{ fontSize: '.62rem', flexShrink: 0 }} /> {m.email}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
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
    const printRef = useRef(null);
    const [page, setPage] = useState(1);
    const [activeShiftModal, setActiveShiftModal] = useState(null); // shift key or null

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

    // Pagination
    const totalPages = Math.max(1, Math.ceil(activeStaff.length / PAGE_SIZE));
    const paged = activeStaff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Staff Roster Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #b85c2d; margin-bottom: 4px; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .84rem; }
                    th { background: #b85c2d; color: #fff; padding: 10px 12px; text-align: left; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Staff Roster</h2>
                <p class="sub">Date: ${today} | Active staff: ${activeStaff.length}</p>
                <table>
                    <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Shift</th></tr></thead>
                    <tbody>
                        ${activeStaff.map((m, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>${m.firstName} ${m.lastName}</strong><br><small>@${m.username || '—'}</small></td>
                                <td>${m.role || 'staff'}</td>
                                <td>${m.email || '—'}</td>
                                <td>${m.phone || '—'}</td>
                                <td>${m.shift.label} (${m.shift.time})</td>
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

    const openShift = (shiftKey) => {
        const found = shiftCounts.find(s => s.key === shiftKey);
        setActiveShiftModal(found || null);
    };

    return (
        <div>
            {/* Shift summary cards — only 3 shifts, no Total on Duty */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
                {shiftCounts.map(s => (
                    <div
                        key={s.key}
                        className="stat-card clickable"
                        style={{ borderLeft: `4px solid ${s.border}`, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => openShift(s.key)}
                        title={`View ${s.label} Shift staff`}
                    >
                        <div className="stat-icon" style={{ background: s.border }}>{s.icon}</div>
                        <div className="stat-info">
                            <h3 style={{ color: s.text }}>{s.count}</h3>
                            <p style={{ fontSize: '.75rem' }}>{s.label} Shift</p>
                        </div>
                        {/* subtle "click" hint */}
                        <div style={{ marginLeft: 'auto', fontSize: '.68rem', color: s.text, opacity: .6, paddingRight: 4, fontWeight: 600 }}>
                            View ›
                        </div>
                    </div>
                ))}
            </div>

            {/* Shift modal */}
            {activeShiftModal && (
                <ShiftModal
                    shift={activeShiftModal}
                    members={activeShiftModal.members}
                    onClose={() => setActiveShiftModal(null)}
                />
            )}

            {/* Main roster table card */}
            <div className="card-white">
                <div className="card-header">
                    <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FaUserMd color="var(--d-orange)" />
                        Staff Roster
                        <small style={{ fontWeight: 400, color: 'var(--d-muted)', fontSize: '.78rem' }}>
                            — {today}
                        </small>
                    </h5>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline-sm" onClick={handlePrint}><FaPrint /> Print Roster</button>
                        <button className="btn-outline-sm" onClick={onRefresh}><FaSync /> Refresh</button>
                    </div>
                </div>

                {activeStaff.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <FaUserMd style={{ fontSize: '2.5rem', color: 'var(--d-border)', display: 'block', margin: '0 auto 14px' }} />
                        <p style={{ color: 'var(--d-muted)', margin: 0 }}>
                            No active staff on duty. Activate staff members in <strong>User Management</strong>.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--d-cream)', borderBottom: '2px solid var(--d-border)' }}>
                                        <th style={th}>#</th>
                                        <th style={th}>Name</th>
                                        <th style={th}>Role</th>
                                        <th style={th}>Shift</th>
                                        <th style={th}>Phone</th>
                                        <th style={th}>Email</th>
                                        <th style={{ ...th, textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map((m, i) => {
                                        const rs = roleStyle(m.role);
                                        const sc = m.shift;
                                        const rowNum = (page - 1) * PAGE_SIZE + i + 1;
                                        return (
                                            <tr
                                                key={m._id}
                                                style={{
                                                    borderBottom: '1px solid var(--d-border)',
                                                    background: i % 2 === 0 ? '#fff' : 'var(--d-cream)',
                                                    transition: 'background .15s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--d-orange-lt)'}
                                                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : 'var(--d-cream)'}
                                            >
                                                <td style={td}><span style={{ color: 'var(--d-muted)', fontSize: '.78rem' }}>{rowNum}</span></td>
                                                <td style={td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                        <FaUserCircle size={24} color={sc.border} style={{ flexShrink: 0 }} />
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: 'var(--d-ink)', whiteSpace: 'nowrap' }}>
                                                                {m.firstName} {m.lastName}
                                                            </div>
                                                            <div style={{ fontSize: '.7rem', color: 'var(--d-muted)' }}>@{m.username || '—'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={td}>
                                                    <span style={{
                                                        padding: '3px 11px', borderRadius: 99,
                                                        background: rs.bg, color: rs.color,
                                                        fontSize: '.72rem', fontWeight: 700, textTransform: 'capitalize',
                                                    }}>{m.role || 'staff'}</span>
                                                </td>
                                                <td style={td}>
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                                        padding: '4px 11px', borderRadius: 20,
                                                        background: sc.bg, border: `1.5px solid ${sc.border}`,
                                                        fontSize: '.73rem', fontWeight: 600, color: sc.text,
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        <span style={{ fontSize: '.68rem' }}>{sc.icon}</span>
                                                        {sc.label}
                                                    </div>
                                                    <div style={{ fontSize: '.69rem', color: 'var(--d-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <FaClock style={{ fontSize: '.6rem' }} /> {sc.time}
                                                    </div>
                                                </td>
                                                <td style={td}>
                                                    {m.phone ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.8rem', color: 'var(--d-ink)' }}>
                                                            <FaPhone style={{ fontSize: '.65rem', color: 'var(--d-muted)' }} /> {m.phone}
                                                        </div>
                                                    ) : <span style={{ color: 'var(--d-muted)' }}>—</span>}
                                                </td>
                                                <td style={{ ...td, maxWidth: 180 }}>
                                                    {m.email ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.8rem', color: 'var(--d-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            <FaEnvelope style={{ fontSize: '.65rem', color: 'var(--d-muted)', flexShrink: 0 }} /> {m.email}
                                                        </div>
                                                    ) : <span style={{ color: 'var(--d-muted)' }}>—</span>}
                                                </td>
                                                <td style={{ ...td, textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28a745', boxShadow: '0 0 0 3px rgba(40,167,69,.2)' }} />
                                                        <span style={{ fontSize: '.73rem', color: '#28a745', fontWeight: 600 }}>On Duty</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 4px 4px', flexWrap: 'wrap', gap: 10,
                        }}>
                            <span style={{ fontSize: '.8rem', color: 'var(--d-muted)' }}>
                                Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, activeStaff.length)}</strong> of <strong>{activeStaff.length}</strong> staff
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    style={pagBtn(page === 1)}
                                >
                                    <FaChevronLeft style={{ fontSize: '.7rem' }} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setPage(n)}
                                        style={{
                                            ...pagBtn(false),
                                            background: n === page ? 'var(--d-orange)' : 'transparent',
                                            color: n === page ? '#fff' : 'var(--d-ink)',
                                            borderColor: n === page ? 'var(--d-orange)' : 'var(--d-border)',
                                            fontWeight: n === page ? 700 : 400,
                                            minWidth: 34,
                                        }}
                                    >{n}</button>
                                ))}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    style={pagBtn(page === totalPages)}
                                >
                                    <FaChevronRight style={{ fontSize: '.7rem' }} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/* ── Style helpers ── */
const th = {
    padding: '11px 14px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '.78rem',
    color: 'var(--d-muted)',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    whiteSpace: 'nowrap',
};

const td = {
    padding: '11px 14px',
    verticalAlign: 'middle',
};

const pagBtn = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 34, padding: '0 10px',
    border: '1.5px solid var(--d-border)',
    borderRadius: 8,
    background: 'transparent',
    color: disabled ? 'var(--d-border)' : 'var(--d-ink)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--d-font-body)',
    fontSize: '.82rem',
    transition: 'all .15s',
    opacity: disabled ? .5 : 1,
});

export default StaffRosterTab;