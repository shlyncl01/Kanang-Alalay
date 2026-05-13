import React, { useMemo, useRef } from 'react';
import {
    FaUserCircle, FaUserMd, FaSync, FaClock,
    FaPhone, FaEnvelope, FaPrint,
    FaSun, FaCloudSun, FaMoon,
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

const StaffRosterTab = ({ staff = [], onRefresh }) => {
    const printRef = useRef(null);

    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const activeStaff = useMemo(
        () => staff
            .filter(m => getAccountStatus(m) === 'active')
            .map((m, idx) => ({ ...m, shift: getShift(idx) })),
        [staff]
    );

    const byRole = useMemo(() =>
        activeStaff.reduce((acc, m) => {
            const r = m.role || 'staff';
            if (!acc[r]) acc[r] = [];
            acc[r].push(m);
            return acc;
        }, {}),
    [activeStaff]);

    const shiftCounts = useMemo(() =>
        SHIFTS.map(s => ({ ...s, count: activeStaff.filter(m => m.shift.key === s.key).length })),
    [activeStaff]);

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Staff Roster Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #b85c2d; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .84rem; }
                    th { background: #b85c2d; color: #fff; padding: 10px 12px; text-align: left; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    h3 { color: #555; font-size: .9rem; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .06em; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Staff Roster</h2>
                <p class="sub">Date: ${today} | Active staff on duty: ${activeStaff.length}</p>
                <p class="sub">Morning: ${shiftCounts[0].count} | Afternoon: ${shiftCounts[1].count} | Night: ${shiftCounts[2].count}</p>
                ${Object.entries(byRole).map(([role, members]) => `
                    <h3>${role} (${members.length})</h3>
                    <table>
                        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Shift</th></tr></thead>
                        <tbody>
                            ${members.map(m => `
                                <tr>
                                    <td><strong>${m.firstName} ${m.lastName}</strong><br><small>@${m.username || '—'}</small></td>
                                    <td>${m.email || '—'}</td>
                                    <td>${m.phone || '—'}</td>
                                    <td>${m.shift.label} (${m.shift.time})</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `).join('')}
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
            {/* Shift summary cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
                {shiftCounts.map(s => (
                    <div key={s.key} className="stat-card" style={{ borderLeft: `4px solid ${s.border}` }}>
                        <div className="stat-icon" style={{ background: s.border }}>{s.icon}</div>
                        <div className="stat-info">
                            <h3 style={{ color: s.text }}>{s.count}</h3>
                            <p style={{ fontSize: '.75rem' }}>{s.label} Shift</p>
                        </div>
                    </div>
                ))}
                <div className="stat-card" style={{ borderLeft: '4px solid var(--d-orange)' }}>
                    <div className="stat-icon" style={{ background: 'var(--d-orange)' }}><FaUserMd /></div>
                    <div className="stat-info">
                        <h3>{activeStaff.length}</h3>
                        <p style={{ fontSize: '.75rem' }}>Total On Duty</p>
                    </div>
                </div>
            </div>

            {/* Main roster card */}
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

                {/* Shift legend pills */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    {SHIFTS.map(s => (
                        <div key={s.key} style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '5px 14px', borderRadius: 20,
                            background: s.bg, border: `1.5px solid ${s.border}`,
                            fontSize: '.76rem', fontWeight: 600, color: s.text,
                        }}>
                            <span style={{ fontSize: '.75rem' }}>{s.icon}</span>
                            {s.label} &nbsp;·&nbsp; {s.time}
                        </div>
                    ))}
                </div>

                {activeStaff.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <FaUserMd style={{ fontSize: '2.5rem', color: 'var(--d-border)', display: 'block', margin: '0 auto 14px' }} />
                        <p style={{ color: 'var(--d-muted)', margin: 0 }}>
                            No active staff on duty. Activate staff members in <strong>User Management</strong>.
                        </p>
                    </div>
                ) : (
                    <div ref={printRef}>
                        {Object.entries(byRole).map(([role, members]) => (
                            <div key={role} style={{ marginBottom: 28 }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    marginBottom: 12, paddingBottom: 8,
                                    borderBottom: '1.5px solid var(--d-border)',
                                }}>
                                    <span style={{
                                        padding: '3px 12px', borderRadius: 20,
                                        fontSize: '.74rem', fontWeight: 700, textTransform: 'capitalize',
                                        background: roleStyle(role).bg, color: roleStyle(role).color,
                                    }}>{role}</span>
                                    <small style={{ color: 'var(--d-muted)' }}>
                                        {members.length} member{members.length !== 1 ? 's' : ''}
                                    </small>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
                                    {members.map(m => {
                                        const sc = m.shift;
                                        return (
                                            <div key={m._id} style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '13px 15px', borderRadius: 12,
                                                border: `1.5px solid ${sc.border}`,
                                                background: sc.bg,
                                            }}>
                                                <div style={{
                                                    width: 44, height: 44, borderRadius: '50%',
                                                    background: '#fff', border: `2px solid ${sc.border}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    <FaUserCircle size={28} color={sc.border} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '.87rem', color: 'var(--d-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {m.firstName} {m.lastName}
                                                    </div>
                                                    <div style={{ fontSize: '.73rem', color: sc.text, fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <FaClock style={{ fontSize: '.65rem' }} />
                                                        {sc.label} · {sc.time}
                                                    </div>
                                                    {m.phone && (
                                                        <div style={{ fontSize: '.71rem', color: 'var(--d-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <FaPhone style={{ fontSize: '.65rem' }} /> {m.phone}
                                                        </div>
                                                    )}
                                                    {m.email && (
                                                        <div style={{ fontSize: '.71rem', color: 'var(--d-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            <FaEnvelope style={{ fontSize: '.65rem', flexShrink: 0 }} /> {m.email}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28a745', flexShrink: 0, boxShadow: '0 0 0 3px rgba(40,167,69,.22)' }} title="On Duty" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffRosterTab;