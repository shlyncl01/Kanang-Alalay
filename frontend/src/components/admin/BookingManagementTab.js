import React, { useState, useRef } from 'react';
import {
    FaEnvelope, FaPhone, FaCalendarAlt, FaEye, FaEdit,
    FaDownload, FaSearch, FaFilter, FaPrint,
    FaChevronLeft, FaChevronRight, FaTimes,
} from 'react-icons/fa';

const PER_PAGE = 10;
const STATUSES = ['all', 'pending', 'approved', 'rejected', 'completed'];
const PURPOSES = ['All', 'Outreach Program', 'Food Donation', 'Medical Mission', 'Facility Visit'];

const STATUS_COLORS = {
    pending:   { bg: '#FFF8E1', color: '#E65100', dot: '#ffc107' },
    approved:  { bg: '#E8F5E9', color: '#1E7D56', dot: '#28a745' },
    rejected:  { bg: '#FFF0F0', color: '#C0392B', dot: '#dc3545' },
    completed: { bg: '#E3F2FD', color: '#0277BD', dot: '#17a2b8' },
    urgent:    { bg: '#FFE0E0', color: '#B71C1C', dot: '#dc3545' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Calendar Component ───────────────────────────────────────────────────────
const BookingCalendar = ({ bookings, onSelectBooking }) => {
    const today = new Date();
    const [calYear,  setCalYear]  = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());

    const prevMonth = () => {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
    };
    const goToToday = () => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); };

    // Build calendar grid
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    // Map bookings to dates
    const bookingMap = {};
    bookings.forEach(b => {
        if (!b.visitDate) return;
        const d = new Date(b.visitDate);
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
            const key = d.getDate();
            if (!bookingMap[key]) bookingMap[key] = [];
            bookingMap[key].push(b);
        }
    });

    const isToday = (day) =>
        day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    // Status legend counts for this month
    const monthBookings = bookings.filter(b => {
        if (!b.visitDate) return false;
        const d = new Date(b.visitDate);
        return d.getFullYear() === calYear && d.getMonth() === calMonth;
    });

    const legendCounts = STATUSES.filter(s => s !== 'all').map(s => ({
        status: s,
        count: monthBookings.filter(b => b.status === s).length,
    }));

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #E8D6CC', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>

                {/* Calendar header */}
                <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #E8D6CC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FaCalendarAlt style={{ color: '#b85c2d', fontSize: '1rem' }} />
                        <h5 style={{ margin: 0, fontFamily: "'Playfair Display', serif", color: '#1A0A00', fontSize: '1rem' }}>
                            Admission &amp; Booking — {MONTH_NAMES[calMonth]} {calYear}
                        </h5>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Legend */}
                        {legendCounts.map(({ status, count }) => count > 0 && (
                            <span key={status} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '3px 10px', borderRadius: 99,
                                background: STATUS_COLORS[status]?.bg || '#f5f5f5',
                                color: STATUS_COLORS[status]?.color || '#555',
                                fontSize: '.72rem', fontWeight: 700,
                            }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[status]?.dot || '#999', display: 'inline-block' }} />
                                {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                            </span>
                        ))}
                    </div>
                </div>

                {/* Month nav */}
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #E8D6CC' }}>
                    <button onClick={prevMonth} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: '#FFF8F3', cursor: 'pointer', color: '#7A5C4E', display: 'flex', alignItems: 'center' }}>
                        <FaChevronLeft size={12} />
                    </button>
                    <button onClick={goToToday} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #b85c2d', background: '#FFF8F3', cursor: 'pointer', color: '#b85c2d', fontWeight: 700, fontSize: '.8rem' }}>
                        Today
                    </button>
                    {/* Year quick-select */}
                    <select
                        value={calYear}
                        onChange={e => setCalYear(Number(e.target.value))}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: '#FFF8F3', color: '#1A0A00', fontSize: '.82rem', cursor: 'pointer' }}
                    >
                        {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    {/* Month quick-select */}
                    <select
                        value={calMonth}
                        onChange={e => setCalMonth(Number(e.target.value))}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: '#FFF8F3', color: '#1A0A00', fontSize: '.82rem', cursor: 'pointer' }}
                    >
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <button onClick={nextMonth} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: '#FFF8F3', cursor: 'pointer', color: '#7A5C4E', display: 'flex', alignItems: 'center' }}>
                        <FaChevronRight size={12} />
                    </button>
                    <span style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#7A5C4E' }}>
                        {monthBookings.length} booking{monthBookings.length !== 1 ? 's' : ''} this month
                    </span>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E8D6CC' }}>
                    {DAY_NAMES.map(d => (
                        <div key={d} style={{ padding: '8px 6px', textAlign: 'center', fontSize: '.72rem', fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.05em', background: '#FFF8F3' }}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {cells.map((day, idx) => {
                        const dayBookings = day ? (bookingMap[day] || []) : [];
                        const isTodayCell = isToday(day);
                        return (
                            <div
                                key={idx}
                                style={{
                                    minHeight: 84,
                                    padding: '6px',
                                    borderRight: '1px solid #F0E6DE',
                                    borderBottom: '1px solid #F0E6DE',
                                    background: !day ? '#FAFAFA' : isTodayCell ? '#FFF3EC' : '#fff',
                                    position: 'relative',
                                    verticalAlign: 'top',
                                }}
                            >
                                {day && (
                                    <>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: '50%',
                                            background: isTodayCell ? '#b85c2d' : 'transparent',
                                            color: isTodayCell ? '#fff' : '#1A0A00',
                                            fontWeight: isTodayCell ? 700 : 500,
                                            fontSize: '.82rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: 3,
                                        }}>
                                            {day}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {dayBookings.slice(0, 3).map((b, bi) => {
                                                const sc = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
                                                return (
                                                    <div
                                                        key={bi}
                                                        onClick={() => onSelectBooking && onSelectBooking(b)}
                                                        title={`${b.name} — ${b.purpose} (${b.status})`}
                                                        style={{
                                                            padding: '2px 6px',
                                                            borderRadius: 5,
                                                            background: sc.bg,
                                                            color: sc.color,
                                                            fontSize: '.65rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            maxWidth: '100%',
                                                            borderLeft: `3px solid ${sc.dot}`,
                                                        }}
                                                    >
                                                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                                    </div>
                                                );
                                            })}
                                            {dayBookings.length > 3 && (
                                                <div style={{ fontSize: '.62rem', color: '#7A5C4E', fontWeight: 600, paddingLeft: 2 }}>
                                                    +{dayBookings.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const BookingManagementTab = ({ bookings, handleRejectWithReason, handleApproveWithDetails, handleViewDetails, handleEditBooking, handleExportPDF }) => {
    const [search, setSearch]         = useState('');
    const [statusFilter, setStatus]   = useState('all');
    const [purposeFilter, setPurpose] = useState('All');
    const [page, setPage]             = useState(1);
    const printRef = useRef(null);

    // Reset page when filters change
    React.useEffect(() => { setPage(1); }, [search, statusFilter, purposeFilter]);

    const filtered = bookings.filter(b => {
        const q = search.toLowerCase();
        const nameMatch = !q ||
            (b.name || '').toLowerCase().includes(q) ||
            (b.email || '').toLowerCase().includes(q) ||
            (b.phone || '').includes(q);
        const stMatch  = statusFilter === 'all' || b.status === statusFilter;
        const pMatch   = purposeFilter === 'All' || b.purpose === purposeFilter;
        return nameMatch && stMatch && pMatch;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Booking Management Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #b85c2d; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .84rem; }
                    th { background: #b85c2d; color: #fff; padding: 10px 12px; text-align: left; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; vertical-align: top; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    .pending { color: #E65100; } .approved { color: #1E7D56; }
                    .rejected { color: #C0392B; } .completed { color: #0277BD; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Booking Management Report</h2>
                <p class="sub">Generated: ${new Date().toLocaleString('en-PH')} | Showing ${filtered.length} bookings</p>
                <table>
                    <thead>
                        <tr><th>Visitor</th><th>Email</th><th>Phone</th><th>Visit Date</th><th>Time</th><th>Purpose</th><th>Pax</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${filtered.map(b => `
                            <tr>
                                <td><strong>${b.name || ''}</strong></td>
                                <td>${b.email || '—'}</td>
                                <td>${b.phone || '—'}</td>
                                <td>${new Date(b.visitDate).toLocaleDateString()}</td>
                                <td>${b.visitTime || '—'}</td>
                                <td>${b.purpose || '—'}</td>
                                <td>${b.numberOfVisitors || '—'}</td>
                                <td class="${b.status}">${b.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        win.document.close();

        // Wait for the report to finish loading before printing, and only
        // auto-close once the print dialog has actually been dismissed —
        // closing immediately after print() can cause the window to flash
        // shut before the print dialog renders.
        let printed = false;
        const triggerPrint = () => {
            if (printed) return;
            printed = true;
            win.focus();
            win.print();
        };
        win.onload = triggerPrint;
        setTimeout(triggerPrint, 300);
        win.onafterprint = () => win.close();
    };

    const inp = { padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif" };

    return (
        <div>
            {/* ── Full Calendar ── */}
            <BookingCalendar
                bookings={bookings}
                onSelectBooking={(b) => handleViewDetails && handleViewDetails('booking', b)}
            />

            <div className="card-white">
                <div className="card-header">
                    <h5>All Bookings</h5>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline-sm" onClick={handlePrint}><FaPrint /> Print</button>
                        <button className="btn-primary-sm" onClick={() => handleExportPDF && handleExportPDF('bookings')}><FaDownload /> Export PDF</button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <FaSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.8rem' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, email, or phone…"
                            style={{ ...inp, width: '100%', paddingLeft: 34, boxSizing: 'border-box' }}
                        />
                        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E' }}><FaTimes size={11} /></button>}
                    </div>

                    <FaFilter style={{ color: '#7A5C4E', fontSize: '.8rem' }} />

                    <select value={statusFilter} onChange={e => setStatus(e.target.value)} style={inp}>
                        {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'Status: All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>

                    <select value={purposeFilter} onChange={e => setPurpose(e.target.value)} style={inp}>
                        {PURPOSES.map(p => <option key={p} value={p}>{p === 'All' ? 'Purpose: All' : p}</option>)}
                    </select>
                </div>

                {filtered.length === 0 ? (
                    <p className="no-data" style={{ textAlign: 'center', padding: '2rem', color: '#7A5C4E', fontStyle: 'italic' }}>No bookings match your filters.</p>
                ) : (
                    <>
                        <div ref={printRef}>
                            <table className="custom-table">
                                <thead>
                                    <tr><th>Visitor</th><th>Details</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {paged.map(booking => (
                                        <tr key={booking._id}>
                                            <td>
                                                <strong>{booking.name}</strong><br />
                                                <small><FaEnvelope /> {booking.email} | <FaPhone /> {booking.phone}</small>
                                            </td>
                                            <td>
                                                <FaCalendarAlt /> {new Date(booking.visitDate).toLocaleDateString()} at {booking.visitTime}<br />
                                                <small>Purpose: {booking.purpose} ({booking.numberOfVisitors} pax)</small>
                                            </td>
                                            <td><span className={`status ${booking.status}`}>{booking.status}</span></td>
                                            <td className="actions">
                                                {booking.status === 'pending' && (
                                                    <>
                                                        <button className="btn-success-sm" onClick={() => handleApproveWithDetails(booking._id)} style={{ marginRight: '5px' }}>Approve</button>
                                                        <button className="btn-outline-sm" onClick={() => handleRejectWithReason(booking._id)} style={{ color: '#dc3545', borderColor: '#dc3545' }}>Reject</button>
                                                    </>
                                                )}
                                                {/* Approved/Completed: no manual "Complete" action — status auto-flips
                                                    to "completed" server-side once the booked visiting window passes. */}
                                                <span className="view" onClick={() => handleViewDetails && handleViewDetails('booking', booking)} title="View Details"><FaEye /></span>
                                                <span className="edit" onClick={() => handleEditBooking && handleEditBooking(booking)} title="Edit Status"><FaEdit /></span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderTop: '1.5px solid #E8D6CC', marginTop: 8, background: '#FFF8F3' }}>
                                <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>
                                    Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
                                </small>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: page === 1 ? '#f5f5f5' : '#FFF8F3', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#7A5C4E' }}>
                                        <FaChevronLeft size={11} />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                        <button key={n} onClick={() => setPage(n)} style={{ padding: '5px 11px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, border: `1.5px solid ${page === n ? '#b85c2d' : '#E8D6CC'}`, background: page === n ? '#b85c2d' : '#FFF8F3', color: page === n ? '#fff' : '#7A5C4E', cursor: 'pointer' }}>{n}</button>
                                    ))}
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: page === totalPages ? '#f5f5f5' : '#FFF8F3', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: '#7A5C4E' }}>
                                        <FaChevronRight size={11} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default BookingManagementTab;