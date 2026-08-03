import React, { useState } from 'react';
import {
    FaUsers, FaCalendarCheck, FaExclamationTriangle,
    FaDownload, FaUserMd, FaBox, FaMoneyBillWave, FaChartBar,
    FaFilter,
} from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Date helpers ────────────────────────────────────────────────────────────
const DATE_FILTERS = [
    { label: 'Today',      value: 'today' },
    { label: 'This Week',  value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'All Time',   value: 'all' },
];

function filterByDate(arr, field, range) {
    if (range === 'all') return arr;
    const now  = new Date();
    const from = new Date();
    if (range === 'today')       { from.setHours(0, 0, 0, 0); }
    else if (range === 'week')   { from.setDate(now.getDate() - 7); }
    else if (range === 'month')  { from.setDate(1); from.setHours(0, 0, 0, 0); }
    return arr.filter(item => { const d = new Date(item[field]); return d >= from && d <= now; });
}

const STAFF_STATUS_LABEL = {
    active: 'Active', pending: 'Pending', restricted: 'Restricted',
    suspended: 'Suspended', deactivated: 'Deactivated', on_leave: 'On Leave', terminated: 'Terminated',
};
const getStaffStatus = (s) => {
    if (s.status) return s.status;
    if (!s.isVerified && !s.isActive) return 'pending';
    if (s.isActive) return 'active';
    return 'deactivated';
};

// ─── Embedded Reports Section ─────────────────────────────────────────────────
const ReportsSection = ({ stats = {}, bookings = [], donations = [], staff = [], inventory = [] }) => {
    const [dateRange, setDateRange] = useState('month');
    const [exporting, setExporting] = useState('');

    const filteredBookings  = filterByDate(bookings,  'createdAt', dateRange);
    const filteredDonations = filterByDate(donations, 'createdAt', dateRange);

    const totalDonationAmount = filteredDonations
        .filter(d => d.paymentStatus === 'paid')
        .reduce((s, d) => s + (d.amount || 0), 0);

    const pendingBookings  = filteredBookings.filter(b => b.status === 'pending').length;
    const approvedBookings = filteredBookings.filter(b => b.status === 'approved').length;
    const lowStockCount    = inventory.filter(i => i.quantity <= (i.minThreshold ?? 10)).length;
    const activeStaff      = staff.filter(s => getStaffStatus(s) === 'active').length;

    const exportPDF = (type) => {
        setExporting(type);
        const doc = new jsPDF();
        const now = new Date().toLocaleString('en-PH');
        const rangeLabel = DATE_FILTERS.find(f => f.value === dateRange)?.label || 'All Time';

        doc.setFontSize(18); doc.setTextColor('#b85c2d');
        doc.text('Kanang-Alalay', 14, 16);
        doc.setFontSize(12); doc.setTextColor('#333');
        doc.text(`${type} Report — ${rangeLabel}`, 14, 24);
        doc.setFontSize(9); doc.setTextColor('#999');
        doc.text(`Generated: ${now}`, 14, 30);

        let startY = 36;

        if (type === 'Bookings Summary') {
            autoTable(doc, {
                head: [['Visitor', 'Email', 'Visit Date', 'Purpose', 'Visitors', 'Status']],
                body: filteredBookings.map(b => [b.name || `${b.firstName} ${b.lastName}`, b.email, new Date(b.visitDate).toLocaleDateString(), b.purpose || '—', b.numberOfVisitors || '—', b.status]),
                startY, headStyles: { fillColor: [184, 92, 45] },
            });
        } else if (type === 'Donations Summary') {
            autoTable(doc, {
                head: [['Donor', 'Email', 'Amount', 'Type', 'Status', 'Receipt #']],
                body: filteredDonations.map(d => [d.donorName, d.email, `₱${(d.amount || 0).toLocaleString()}`, d.donationType, d.paymentStatus, d.receiptNumber || '—']),
                startY, headStyles: { fillColor: [40, 167, 69] },
            });
        } else if (type === 'Staff Report') {
            autoTable(doc, {
                head: [['Staff ID', 'Name', 'Role', 'Email', 'Status', 'Ward']],
                body: staff.map(s => [s.staffId, `${s.firstName} ${s.lastName}`, s.role, s.email, STAFF_STATUS_LABEL[getStaffStatus(s)] ?? getStaffStatus(s), s.ward || '—']),
                startY, headStyles: { fillColor: [23, 162, 184] },
            });
        } else if (type === 'Inventory Report') {
            autoTable(doc, {
                head: [['Item', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Status']],
                body: inventory.map(i => {
                    const isLow = i.quantity <= (i.minThreshold ?? 10);
                    return [i.name, i.category, i.quantity, i.unit, i.minThreshold ?? 10, i.quantity === 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'];
                }),
                startY, headStyles: { fillColor: [220, 53, 69] },
            });
        } else {
            autoTable(doc, {
                head: [['Metric', 'Value']],
                body: [
                    ['Total Residents', '71'], ['Active Staff', activeStaff],
                    ['Total Bookings', filteredBookings.length], ['Pending Bookings', pendingBookings],
                    ['Approved Bookings', approvedBookings], ['Total Donations', filteredDonations.length],
                    ['Confirmed Donations', `₱${totalDonationAmount.toLocaleString()}`],
                    ['Inventory Items', inventory.length], ['Low Stock Items', lowStockCount],
                ],
                startY, headStyles: { fillColor: [184, 92, 45] },
            });
        }
        doc.save(`KA_${type.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
        setTimeout(() => setExporting(''), 600);
    };

    const exportCSV = (type) => {
        let csv = '';
        if (type === 'bookings') {
            csv = 'Name,Email,Visit Date,Purpose,# Visitors,Status\n';
            csv += filteredBookings.map(b => `"${b.name || `${b.firstName} ${b.lastName}`}","${b.email}","${new Date(b.visitDate).toLocaleDateString()}","${b.purpose || ''}","${b.numberOfVisitors || ''}","${b.status}"`).join('\n');
        } else if (type === 'donations') {
            csv = 'Donor,Email,Amount,Type,Status,Receipt #\n';
            csv += filteredDonations.map(d => `"${d.donorName}","${d.email}","${d.amount}","${d.donationType}","${d.paymentStatus}","${d.receiptNumber || ''}"`).join('\n');
        } else if (type === 'staff') {
            csv = 'Staff ID,Name,Role,Email,Status,Ward\n';
            csv += staff.map(s => `"${s.staffId}","${s.firstName} ${s.lastName}","${s.role}","${s.email}","${STAFF_STATUS_LABEL[getStaffStatus(s)] ?? getStaffStatus(s)}","${s.ward || ''}"`).join('\n');
        } else if (type === 'inventory') {
            csv = 'Item,Category,Quantity,Unit,Min Threshold,Status\n';
            csv += inventory.map(i => {
                const isLow = i.quantity <= (i.minThreshold ?? 10);
                return `"${i.name}","${i.category}","${i.quantity}","${i.unit}","${i.minThreshold ?? 10}","${i.quantity === 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}"`;
            }).join('\n');
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `KA_${type}_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const cards = [
        { icon: <FaUserMd />, bg: '#b85c2d', title: 'Staff Overview',    value: activeStaff, subtext: `${staff.length} total registered`, actions: [{ label: 'PDF', fn: () => exportPDF('Staff Report') }, { label: 'CSV', fn: () => exportCSV('staff') }] },
        { icon: <FaCalendarCheck />, bg: '#ffc107', title: 'Bookings Summary', value: filteredBookings.length, subtext: `${pendingBookings} pending · ${approvedBookings} approved`, actions: [{ label: 'PDF', fn: () => exportPDF('Bookings Summary') }, { label: 'CSV', fn: () => exportCSV('bookings') }] },
        { icon: <FaMoneyBillWave />, bg: '#28a745', title: 'Donations Summary', value: `₱${totalDonationAmount.toLocaleString()}`, subtext: `${filteredDonations.length} total donations`, actions: [{ label: 'PDF', fn: () => exportPDF('Donations Summary') }, { label: 'CSV', fn: () => exportCSV('donations') }] },
        { icon: <FaBox />, bg: lowStockCount > 0 ? '#dc3545' : '#17a2b8', title: 'Inventory Status', value: inventory.length, subtext: `${lowStockCount} low stock · ${inventory.filter(i => i.quantity === 0).length} out of stock`, actions: [{ label: 'PDF', fn: () => exportPDF('Inventory Report') }, { label: 'CSV', fn: () => exportCSV('inventory') }] },
        { icon: <FaExclamationTriangle />, bg: '#6c757d', title: 'Pending Approvals', value: pendingBookings, subtext: 'Bookings awaiting review', actions: [{ label: 'PDF', fn: () => exportPDF('Bookings Summary') }] },
        { icon: <FaChartBar />, bg: '#6f42c1', title: 'Compliance Rate', value: `${stats.complianceRate || 92}%`, subtext: 'Medication adherence', actions: [{ label: 'PDF', fn: () => exportPDF('Compliance Report') }] },
    ];

    return (
        <div className="card-white" style={{ marginTop: 24 }}>
            {/* Header */}
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                <h5>Reports &amp; Analytics</h5>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FaFilter style={{ color: '#7A5C4E', fontSize: '.8rem' }} />
                    {DATE_FILTERS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setDateRange(f.value)}
                            className={dateRange === f.value ? 'btn-primary-sm' : 'btn-outline-sm'}
                            style={{ padding: '5px 12px', fontSize: '.78rem' }}
                        >
                            {f.label}
                        </button>
                    ))}
                    <button className="btn-primary-sm" onClick={() => exportPDF('Full Summary')} style={{ marginLeft: 8 }}>
                        <FaDownload /> Full Report PDF
                    </button>
                </div>
            </div>

            {/* Summary strip */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22, padding: '14px 18px', background: '#FFF8F3', borderRadius: 12, border: '1.5px solid #E8D6CC' }}>
                {[
                    ['Residents',   '71',                                     '#b85c2d'],
                    ['Active Staff', activeStaff,                             '#28a745'],
                    ['Bookings',    filteredBookings.length,                  '#17a2b8'],
                    ['Donations',   `₱${totalDonationAmount.toLocaleString()}`, '#6f42c1'],
                    ['Low Stock',   lowStockCount,                            lowStockCount > 0 ? '#dc3545' : '#28a745'],
                ].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign: 'center', minWidth: 90, flex: 1 }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color, fontFamily: "'Playfair Display', serif" }}>{val}</div>
                        <div style={{ fontSize: '.72rem', color: '#7A5C4E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Report cards — 3-column grid matching screenshot */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 22 }}>
                {cards.map((card, i) => (
                    <div key={i} style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: '1.5px solid #E8D6CC',
                        borderTop: `4px solid ${card.bg}`,
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}>
                        {/* Icon + Title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: `${card.bg}18`, color: card.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', flexShrink: 0,
                            }}>
                                {card.icon}
                            </div>
                            <span style={{
                                fontWeight: 700, fontSize: '.78rem', color: '#555',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                                {card.title}
                            </span>
                        </div>

                        {/* Value */}
                        <div style={{
                            fontSize: typeof card.value === 'string' && card.value.length > 10 ? '1.2rem' : '1.75rem',
                            fontWeight: 700, color: card.bg,
                            fontFamily: "'Playfair Display', serif", marginBottom: 4, lineHeight: 1.2,
                            overflowWrap: 'break-word', wordBreak: 'break-word',
                        }}>
                            {card.value}
                        </div>

                        {/* Subtext */}
                        <p style={{ fontSize: '.8rem', color: '#7A5C4E', margin: '0 0 16px' }}>
                            {card.subtext}
                        </p>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                            {card.actions.map((a, j) => (
                                <button
                                    key={j}
                                    onClick={a.fn}
                                    style={{
                                        flex: 1,
                                        padding: '7px 10px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${card.bg}`,
                                        background: 'transparent',
                                        color: card.bg,
                                        fontWeight: 600,
                                        fontSize: '.78rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        fontFamily: "'DM Sans', sans-serif",
                                        transition: 'background 0.15s, color 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = card.bg; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = card.bg; }}
                                >
                                    <FaDownload size={11} /> {a.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Monthly trend */}
            <div style={{ marginTop: 22, padding: '20px', background: '#FFF8F3', borderRadius: 14, border: '1.5px solid #E8D6CC' }}>
                <h6 style={{ margin: '0 0 14px', color: '#555', textTransform: 'uppercase', fontSize: '.78rem', letterSpacing: '.06em' }}>
                    Monthly Booking Trend
                </h6>
                {(() => {
                    const months = Array.from({ length: 6 }, (_, i) => {
                        const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
                        return { label: d.toLocaleDateString('en-PH', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
                    });
                    const maxCount = Math.max(1, ...months.map(m => bookings.filter(b => { const d = new Date(b.createdAt); return d.getMonth() === m.month && d.getFullYear() === m.year; }).length));
                    return (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 90 }}>
                            {months.map((m, i) => {
                                const count = bookings.filter(b => { const d = new Date(b.createdAt); return d.getMonth() === m.month && d.getFullYear() === m.year; }).length;
                                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                                const isLast = i === months.length - 1;
                                return (
                                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <small style={{ fontSize: '.68rem', color: '#7A5C4E', fontWeight: 600 }}>{count}</small>
                                        <div title={`${m.label}: ${count} bookings`} style={{ width: '100%', minHeight: 4, height: `${Math.max(4, pct)}%`, borderRadius: '6px 6px 0 0', background: isLast ? 'linear-gradient(180deg, #F96B38, #D94E1B)' : 'linear-gradient(180deg, #E8D6CC, #c4b0a6)', transition: 'height .4s ease' }} />
                                        <small style={{ fontSize: '.68rem', color: '#7A5C4E' }}>{m.label}</small>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

// ─── Main OverviewTab ─────────────────────────────────────────────────────────
const OverviewTab = ({ stats, activities, setActiveSection, bookings = [], donations = [], staff = [], inventory = [] }) => {
    const totalDonationAmount = donations
        .filter(d => d.paymentStatus === 'paid')
        .reduce((s, d) => s + (d.amount || 0), 0);

    const activeStaffCount = staff.filter(s => {
        const st = s.status || (s.isActive ? 'active' : 'pending');
        return st === 'active';
    }).length;

    const statCards = [
        {
            bg: '#b85c2d',
            icon: <FaUsers />,
            val: stats.totalResidents || 71,
            label: 'Total Residents',
            section: null,
        },
        {
            bg: '#28a745',
            icon: <FaUserMd />,
            val: activeStaffCount,
            label: 'Active Staff',
            section: 'roster',
        },
        {
            bg: '#17a2b8',
            icon: <FaCalendarCheck />,
            val: stats.pendingBookings,
            label: 'Pending Bookings',
            section: 'booking',
        },
        {
            bg: '#6f42c1',
            icon: <FaMoneyBillWave />,
            val: `₱${totalDonationAmount.toLocaleString()}`,
            label: 'Total Donations',
            section: 'donation',
        },
        {
            bg: '#dc3545',
            icon: <FaExclamationTriangle />,
            val: stats.lowStockItems || inventory.filter(i => i.quantity <= (i.minThreshold ?? 10)).length,
            label: 'Low Stock Items',
            section: 'inventory',
        },
        {
            bg: '#ffc107',
            icon: <FaChartBar />,
            val: `${stats.complianceRate || 92}%`,
            label: 'Compliance Rate',
            section: null,
        },
    ];

    return (
        <div className="overview-content">

            {/* ── 6 Stat Cards ── */}
            <div className="stats-grid">
                {statCards.map((s, i) => (
                    <div
                        key={i}
                        className={`stat-card ${s.section ? 'clickable' : ''}`}
                        onClick={() => s.section && setActiveSection(s.section)}
                        style={{ cursor: s.section ? 'pointer' : 'default' }}
                    >
                        <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                        <div className="stat-info">
                            <h3>{s.val}</h3><p>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Recent Bookings + Recent Donations ── */}
            <div className="content-row" style={{ marginBottom: 20 }}>
                {/* Recent Bookings */}
                <div className="card-white" style={{ background: '#fff', borderRadius: 16, padding: 0, overflowX: 'auto' }}>
                    <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h5 style={{ margin: 0 }}>Recent Bookings</h5>
                        <button
                            className="btn-view-all"
                            onClick={() => setActiveSection('booking')}
                            style={{ background: 'none', border: 'none', color: '#F96B38', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem' }}
                        >
                            View All →
                        </button>
                    </div>
                    {bookings.length === 0 ? (
                        <div className="no-data" style={{ padding: '40px', textAlign: 'center', color: '#7A5C4E', fontStyle: 'italic' }}>No bookings yet.</div>
                    ) : (
                        <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFF8F3' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.78rem', color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em' }}>Name</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.78rem', color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em' }}>Date</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.78rem', color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.slice(0, 5).map(b => (
                                    <tr key={b._id} style={{ borderBottom: '1px solid #E8D6CC' }}>
                                        <td style={{ padding: '10px 16px', fontWeight: 500 }}>{b.name}</td>
                                        <td style={{ padding: '10px 16px', color: '#7A5C4E', fontSize: '.84rem' }}>{new Date(b.visitDate).toLocaleDateString()}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span className={`status ${b.status}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: '.72rem', fontWeight: 600 }}>{b.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Recent Donations */}
                <div className="card-white" style={{ background: '#fff', borderRadius: 16, padding: 0, overflowX: 'auto' }}>
                    <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h5 style={{ margin: 0 }}>Recent Donations</h5>
                        <button
                            className="btn-view-all"
                            onClick={() => setActiveSection('donation')}
                            style={{ background: 'none', border: 'none', color: '#F96B38', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem' }}
                        >
                            View All →
                        </button>
                    </div>
                    {donations.length === 0 ? (
                        <div className="no-data" style={{ padding: '40px', textAlign: 'center', color: '#7A5C4E', fontStyle: 'italic' }}>No donations yet.</div>
                    ) : (
                        <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFF8F3' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.78rem', color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em' }}>Donor</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.78rem', color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em' }}>Amount</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.78rem', color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {donations.slice(0, 5).map(d => (
                                    <tr key={d._id} style={{ borderBottom: '1px solid #E8D6CC' }}>
                                        <td style={{ padding: '10px 16px', fontWeight: 500 }}>{d.donorName}</td>
                                        <td style={{ padding: '10px 16px', color: '#28a745', fontWeight: 600 }}>₱{d.amount?.toLocaleString()}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span className={`status ${d.paymentStatus}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: '.72rem', fontWeight: 600 }}>{d.paymentStatus}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Recent Activity Feed ── */}
            <div className="card-white">
                <div className="card-header">
                    <h5>Recent Activity Feed</h5>
                </div>
                <div className="activity-feed">
                    {activities.length === 0 ? (
                        <div className="no-data">No recent activities</div>
                    ) : (
                        <ul className="activity-list">
                            {activities.map((activity, index) => (
                                <li key={index}>
                                    <span className="time">{activity.time}</span>
                                    <span className="details">{activity.details}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* ── Reports & Analytics ── */}
            <ReportsSection
                stats={stats}
                bookings={bookings}
                donations={donations}
                staff={staff}
                inventory={inventory}
            />
        </div>
    );
};

export default OverviewTab;