import React, { useState, useRef } from 'react';
import {
    FaEnvelope, FaPhone, FaCalendarAlt, FaEye, FaEdit,
    FaDownload, FaSearch, FaFilter, FaPrint,
    FaChevronLeft, FaChevronRight, FaTimes,
} from 'react-icons/fa';

const PER_PAGE = 10;
const STATUSES = ['all', 'pending', 'approved', 'rejected', 'completed'];
const PURPOSES = ['All', 'Outreach Program', 'Food Donation', 'Medical Mission', 'Facility Visit'];

const BookingManagementTab = ({ bookings, updateBookingStatus, handleViewDetails, handleEditBooking, handleExportPDF }) => {
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
                    <thead><tr><th>Visitor</th><th>Email</th><th>Phone</th><th>Visit Date</th><th>Time</th><th>Purpose</th><th>Pax</th><th>Status</th></tr></thead>
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
        win.focus();
        win.print();
        win.close();
    };

    const inp = { padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif" };

    return (
        <div className="card-white">
            <div className="card-header">
                <h5>Booking Management</h5>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-outline-sm" onClick={handlePrint}><FaPrint /> Print</button>
                    <button className="btn-primary-sm" onClick={() => handleExportPDF('bookings')}><FaDownload /> Export PDF</button>
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
                                                    <button className="btn-success-sm" onClick={() => updateBookingStatus(booking._id, 'approved')} style={{ marginRight: '5px' }}>Approve</button>
                                                    <button className="btn-outline-sm" onClick={() => updateBookingStatus(booking._id, 'rejected')} style={{ color: '#dc3545', borderColor: '#dc3545' }}>Reject</button>
                                                </>
                                            )}
                                            {booking.status === 'approved' && (
                                                <button className="btn-primary-sm" onClick={() => updateBookingStatus(booking._id, 'completed')}>Complete</button>
                                            )}
                                            <span className="view" onClick={() => handleViewDetails('booking', booking)} title="View Details"><FaEye /></span>
                                            <span className="edit" onClick={() => handleEditBooking(booking)} title="Edit Status"><FaEdit /></span>
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
    );
};

export default BookingManagementTab;