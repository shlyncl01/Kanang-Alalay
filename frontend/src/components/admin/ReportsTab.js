import React, { useState } from 'react';
import {
    FaDownload, FaUsers, FaCalendarCheck, FaBox,
    FaMoneyBillWave, FaExclamationTriangle, FaFileAlt,
    FaChartBar, FaFilter
} from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DATE_FILTERS = [
    { label: 'Today',       value: 'today' },
    { label: 'This Week',   value: 'week' },
    { label: 'This Month',  value: 'month' },
    { label: 'All Time',    value: 'all' },
];

function filterByDate(arr, field, range) {
    if (range === 'all') return arr;
    const now  = new Date();
    const from = new Date();
    if (range === 'today') { from.setHours(0, 0, 0, 0); }
    else if (range === 'week') { from.setDate(now.getDate() - 7); }
    else if (range === 'month') { from.setDate(1); from.setHours(0, 0, 0, 0); }
    return arr.filter(item => {
        const d = new Date(item[field]);
        return d >= from && d <= now;
    });
}

const ReportsTab = ({ stats, bookings = [], donations = [], staff = [], inventory = [] }) => {
    const [dateRange, setDateRange]     = useState('month');
    const [exporting, setExporting]     = useState('');

    const filteredBookings  = filterByDate(bookings,  'createdAt', dateRange);
    const filteredDonations = filterByDate(donations, 'createdAt', dateRange);
    const filteredStaff     = filterByDate(staff,     'createdAt', dateRange);

    const totalDonationAmount = filteredDonations
        .filter(d => d.paymentStatus === 'paid')
        .reduce((s, d) => s + (d.amount || 0), 0);

    const pendingBookings  = filteredBookings.filter(b => b.status === 'pending').length;
    const approvedBookings = filteredBookings.filter(b => b.status === 'approved').length;
    const rejectedBookings = filteredBookings.filter(b => b.status === 'rejected').length;
    const lowStockCount    = inventory.filter(i => i.quantity <= (i.minThreshold ?? 10)).length;
    const activeStaff      = staff.filter(s => s.isActive).length;

    const exportPDF = (type) => {
        setExporting(type);
        const doc = new jsPDF();
        const now = new Date().toLocaleString('en-PH');
        const rangeLabel = DATE_FILTERS.find(f => f.value === dateRange)?.label || 'All Time';

        doc.setFontSize(18);
        doc.setTextColor('#b85c2d');
        doc.text('Kanang-Alalay', 14, 16);
        doc.setFontSize(12);
        doc.setTextColor('#333');
        doc.text(`${type} Report — ${rangeLabel}`, 14, 24);
        doc.setFontSize(9);
        doc.setTextColor('#999');
        doc.text(`Generated: ${now}`, 14, 30);

        let startY = 36;

        if (type === 'Bookings Summary') {
            autoTable(doc, {
                head: [['Visitor', 'Email', 'Visit Date', 'Purpose', 'Visitors', 'Status']],
                body: filteredBookings.map(b => [
                    b.name || `${b.firstName} ${b.lastName}`,
                    b.email,
                    new Date(b.visitDate).toLocaleDateString(),
                    b.purpose || '—',
                    b.numberOfVisitors || '—',
                    b.status,
                ]),
                startY,
                headStyles: { fillColor: [184, 92, 45] },
            });
        } else if (type === 'Donations Summary') {
            autoTable(doc, {
                head: [['Donor', 'Email', 'Amount', 'Type', 'Status', 'Receipt #']],
                body: filteredDonations.map(d => [
                    d.donorName,
                    d.email,
                    `₱${(d.amount || 0).toLocaleString()}`,
                    d.donationType,
                    d.paymentStatus,
                    d.receiptNumber || '—',
                ]),
                startY,
                headStyles: { fillColor: [40, 167, 69] },
            });
        } else if (type === 'Staff Report') {
            autoTable(doc, {
                head: [['Staff ID', 'Name', 'Role', 'Email', 'Status', 'Ward']],
                body: staff.map(s => [
                    s.staffId,
                    `${s.firstName} ${s.lastName}`,
                    s.role,
                    s.email,
                    s.isActive ? 'Active' : 'Inactive',
                    s.ward || '—',
                ]),
                startY,
                headStyles: { fillColor: [23, 162, 184] },
            });
        } else if (type === 'Inventory Report') {
            autoTable(doc, {
                head: [['Item', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Status']],
                body: inventory.map(i => {
                    const isLow = i.quantity <= (i.minThreshold ?? 10);
                    return [
                        i.name,
                        i.category,
                        i.quantity,
                        i.unit,
                        i.minThreshold ?? 10,
                        i.quantity === 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock',
                    ];
                }),
                startY,
                headStyles: { fillColor: [220, 53, 69] },
            });
        } else {
            // Full summary
            autoTable(doc, {
                head: [['Metric', 'Value']],
                body: [
                    ['Total Residents',       '71'],
                    ['Active Staff',          activeStaff],
                    ['Total Bookings',        filteredBookings.length],
                    ['Pending Bookings',      pendingBookings],
                    ['Approved Bookings',     approvedBookings],
                    ['Total Donations',       filteredDonations.length],
                    ['Confirmed Donations',   `₱${totalDonationAmount.toLocaleString()}`],
                    ['Inventory Items',       inventory.length],
                    ['Low Stock Items',       lowStockCount],
                ],
                startY,
                headStyles: { fillColor: [184, 92, 45] },
            });
        }

        doc.save(`KA_${type.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
        setTimeout(() => setExporting(''), 600);
    };

    const exportCSV = (type) => {
        let csv = '';
        if (type === 'bookings') {
            csv = 'Name,Email,Visit Date,Purpose,# Visitors,Status\n';
            csv += filteredBookings.map(b =>
                `"${b.name || `${b.firstName} ${b.lastName}`}","${b.email}","${new Date(b.visitDate).toLocaleDateString()}","${b.purpose || ''}","${b.numberOfVisitors || ''}","${b.status}"`
            ).join('\n');
        } else if (type === 'donations') {
            csv = 'Donor,Email,Amount,Type,Status,Receipt #\n';
            csv += filteredDonations.map(d =>
                `"${d.donorName}","${d.email}","${d.amount}","${d.donationType}","${d.paymentStatus}","${d.receiptNumber || ''}"`
            ).join('\n');
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
        a.href     = url;
        a.download = `KA_${type}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const cards = [
        {
            icon:     <FaUsers />,
            bg:       '#b85c2d',
            title:    'Staff Overview',
            value:    activeStaff,
            subtext:  `${staff.length} total registered`,
            actions:  [
                { label: 'PDF', fn: () => exportPDF('Staff Report') },
                { label: 'CSV', fn: () => exportCSV('staff') },
            ],
        },
        {
            icon:     <FaCalendarCheck />,
            bg:       '#ffc107',
            title:    'Bookings Summary',
            value:    filteredBookings.length,
            subtext:  `${pendingBookings} pending · ${approvedBookings} approved`,
            actions:  [
                { label: 'PDF', fn: () => exportPDF('Bookings Summary') },
                { label: 'CSV', fn: () => exportCSV('bookings') },
            ],
        },
        {
            icon:     <FaMoneyBillWave />,
            bg:       '#28a745',
            title:    'Donations Summary',
            value:    `₱${totalDonationAmount.toLocaleString()}`,
            subtext:  `${filteredDonations.length} total donations`,
            actions:  [
                { label: 'PDF', fn: () => exportPDF('Donations Summary') },
                { label: 'CSV', fn: () => exportCSV('donations') },
            ],
        },
        {
            icon:     <FaBox />,
            bg:       lowStockCount > 0 ? '#dc3545' : '#17a2b8',
            title:    'Inventory Status',
            value:    inventory.length,
            subtext:  `${lowStockCount} low stock · ${inventory.filter(i => i.quantity === 0).length} out of stock`,
            actions:  [
                { label: 'PDF', fn: () => exportPDF('Inventory Report') },
                { label: 'CSV', fn: () => exportCSV('inventory') },
            ],
        },
        {
            icon:     <FaExclamationTriangle />,
            bg:       '#6c757d',
            title:    'Pending Approvals',
            value:    pendingBookings,
            subtext:  `Bookings awaiting review`,
            actions:  [
                { label: 'PDF', fn: () => exportPDF('Bookings Summary') },
            ],
        },
        {
            icon:     <FaChartBar />,
            bg:       '#6f42c1',
            title:    'Compliance Rate',
            value:    `${stats.complianceRate || 92}%`,
            subtext:  `Medication adherence`,
            actions:  [
                { label: 'PDF', fn: () => exportPDF('Compliance Report') },
            ],
        },
    ];

    return (
        <div className="card-white">
            <div className="card-header">
                <h5>Reports &amp; Analytics</h5>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FaFilter style={{ color: 'var(--d-muted)', fontSize: '.85rem' }} />
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
                    <button
                        className="btn-primary-sm"
                        onClick={() => exportPDF('Full Summary')}
                        style={{ marginLeft: 8 }}
                    >
                        <FaDownload /> Full Report PDF
                    </button>
                </div>
            </div>

            {/* Summary strip */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22, padding: '14px 18px', background: '#FFF8F3', borderRadius: 12, border: '1.5px solid #E8D6CC' }}>
                {[
                    ['Residents',   '71',                               '#b85c2d'],
                    ['Active Staff', activeStaff,                       '#28a745'],
                    ['Bookings',    filteredBookings.length,            '#17a2b8'],
                    ['Donations',   `₱${totalDonationAmount.toLocaleString()}`, '#6f42c1'],
                    ['Low Stock',   lowStockCount,                      lowStockCount > 0 ? '#dc3545' : '#28a745'],
                ].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign: 'center', minWidth: 90, flex: 1 }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color, fontFamily: "'Playfair Display', serif" }}>{val}</div>
                        <div style={{ fontSize: '.72rem', color: '#7A5C4E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Report cards */}
            <div className="reports-grid">
                {cards.map((card, i) => (
                    <div key={i} className="report-card" style={{ borderTop: `4px solid ${card.bg}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${card.bg}20`, color: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                                {card.icon}
                            </div>
                            <h6 style={{ margin: 0, color: '#555', fontSize: '.88rem' }}>{card.title}</h6>
                        </div>
                        <h3 style={{ margin: '0 0 4px', color: card.bg, fontSize: '1.6rem', fontFamily: "'Playfair Display', serif" }}>{card.value}</h3>
                        <p style={{ fontSize: '.8rem', color: '#7A5C4E', margin: '0 0 14px' }}>{card.subtext}</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {card.actions.map((a, j) => (
                                <button
                                    key={j}
                                    className="btn-outline-sm"
                                    onClick={a.fn}
                                    style={{ flex: 1, fontSize: '.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                >
                                    <FaDownload /> {a.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Monthly trend mini-chart */}
            <div style={{ marginTop: 22, padding: '20px', background: '#FFF8F3', borderRadius: 14, border: '1.5px solid #E8D6CC' }}>
                <h6 style={{ margin: '0 0 14px', color: '#555', textTransform: 'uppercase', fontSize: '.78rem', letterSpacing: '.06em' }}>
                    Monthly Booking Trend
                </h6>
                {(() => {
                    const months = Array.from({ length: 6 }, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - (5 - i));
                        return {
                            label: d.toLocaleDateString('en-PH', { month: 'short' }),
                            year:  d.getFullYear(),
                            month: d.getMonth(),
                        };
                    });
                    const maxCount = Math.max(1, ...months.map(m =>
                        bookings.filter(b => {
                            const d = new Date(b.createdAt);
                            return d.getMonth() === m.month && d.getFullYear() === m.year;
                        }).length
                    ));
                    return (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 90 }}>
                            {months.map((m, i) => {
                                const count = bookings.filter(b => {
                                    const d = new Date(b.createdAt);
                                    return d.getMonth() === m.month && d.getFullYear() === m.year;
                                }).length;
                                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                                const isLast = i === months.length - 1;
                                return (
                                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <small style={{ fontSize: '.68rem', color: '#7A5C4E', fontWeight: 600 }}>{count}</small>
                                        <div
                                            title={`${m.label}: ${count} bookings`}
                                            style={{
                                                width: '100%', minHeight: 4,
                                                height: `${Math.max(4, pct)}%`,
                                                borderRadius: '6px 6px 0 0',
                                                background: isLast
                                                    ? 'linear-gradient(180deg, #F96B38, #D94E1B)'
                                                    : 'linear-gradient(180deg, #E8D6CC, #c4b0a6)',
                                                transition: 'height .4s ease',
                                            }}
                                        />
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

export default ReportsTab;