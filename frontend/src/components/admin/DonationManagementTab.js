import React, { useState, useRef } from 'react';
import {
    FaEye, FaDownload, FaSearch, FaFilter, FaPrint,
    FaChevronLeft, FaChevronRight, FaTimes,
} from 'react-icons/fa';

const PER_PAGE = 10;
const STATUSES = ['all', 'pending', 'processing', 'paid'];
const TYPES    = ['All', 'Cash', 'In-kind', 'Online Transfer', 'Check'];

const DonationManagementTab = ({ donations, updateDonationStatus, handleViewDetails, handleExportPDF }) => {
    const [search, setSearch]       = useState('');
    const [statusFilter, setStatus] = useState('all');
    const [typeFilter, setType]     = useState('All');
    const [page, setPage]           = useState(1);
    const printRef = useRef(null);

    React.useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter]);

    const filtered = donations.filter(d => {
        const q = search.toLowerCase();
        const nameMatch = !q || (d.donorName || '').toLowerCase().includes(q) || (d.email || '').toLowerCase().includes(q);
        const stMatch   = statusFilter === 'all' || d.paymentStatus === statusFilter;
        const tMatch    = typeFilter === 'All' || d.donationType === typeFilter;
        return nameMatch && stMatch && tMatch;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const totalConfirmed = filtered
        .filter(d => d.paymentStatus === 'paid')
        .reduce((s, d) => s + (d.amount || 0), 0);

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Donation Management Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #28a745; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .84rem; }
                    th { background: #28a745; color: #fff; padding: 10px 12px; text-align: left; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; }
                    tr:nth-child(even) td { background: #f0fff4; }
                    .paid { color: #1E7D56; } .pending { color: #E65100; } .processing { color: #0277BD; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Donation Management Report</h2>
                <p class="sub">Generated: ${new Date().toLocaleString('en-PH')} | ${filtered.length} donations | Confirmed total: ₱${totalConfirmed.toLocaleString()}</p>
                <table>
                    <thead><tr><th>Donor</th><th>Email</th><th>Amount</th><th>Type</th><th>Status</th><th>Receipt #</th></tr></thead>
                    <tbody>
                        ${filtered.map(d => `
                            <tr>
                                <td><strong>${d.donorName || '—'}</strong></td>
                                <td>${d.email || '—'}</td>
                                <td>₱${(d.amount || 0).toLocaleString()}</td>
                                <td>${d.donationType || '—'}</td>
                                <td class="${d.paymentStatus}">${d.paymentStatus}</td>
                                <td>${d.receiptNumber || '—'}</td>
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
                <h5>Donation Management</h5>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-outline-sm" onClick={handlePrint}><FaPrint /> Print</button>
                    <button className="btn-primary-sm" onClick={() => handleExportPDF('donations')}><FaDownload /> Export PDF</button>
                </div>
            </div>

            {/* Summary strip */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, padding: '12px 16px', background: '#f0fff4', borderRadius: 10, border: '1.5px solid #c3e6cb' }}>
                <div style={{ fontSize: '.82rem', color: '#555' }}>
                    Showing <strong style={{ color: '#28a745' }}>{filtered.length}</strong> donations
                </div>
                <div style={{ fontSize: '.82rem', color: '#555', marginLeft: 'auto' }}>
                    Confirmed total: <strong style={{ color: '#28a745', fontSize: '.95rem' }}>₱{totalConfirmed.toLocaleString()}</strong>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <FaSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.8rem' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by donor name or email…"
                        style={{ ...inp, width: '100%', paddingLeft: 34, boxSizing: 'border-box' }}
                    />
                    {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E' }}><FaTimes size={11} /></button>}
                </div>

                <FaFilter style={{ color: '#7A5C4E', fontSize: '.8rem' }} />

                <select value={statusFilter} onChange={e => setStatus(e.target.value)} style={inp}>
                    {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'Status: All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>

                <select value={typeFilter} onChange={e => setType(e.target.value)} style={inp}>
                    {TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'Type: All' : t}</option>)}
                </select>
            </div>

            {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#7A5C4E', fontStyle: 'italic' }}>No donations match your filters.</p>
            ) : (
                <>
                    <div ref={printRef}>
                        <table className="custom-table">
                            <thead>
                                <tr><th>Donor Info</th><th>Amount / Type</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {paged.map(donation => (
                                    <tr key={donation._id}>
                                        <td>
                                            <strong>{donation.donorName}</strong><br />
                                            <small>{donation.email}</small>
                                        </td>
                                        <td>
                                            <strong style={{ color: '#28a745' }}>₱{donation.amount?.toLocaleString()}</strong><br />
                                            <small>{donation.donationType}</small>
                                        </td>
                                        <td><span className={`status ${donation.paymentStatus}`}>{donation.paymentStatus}</span></td>
                                        <td className="actions">
                                            {donation.paymentStatus === 'pending' && (
                                                <button className="btn-success-sm" onClick={() => updateDonationStatus(donation._id, 'paid')}>Mark Paid</button>
                                            )}
                                            {donation.paymentStatus === 'processing' && (
                                                <button className="btn-primary-sm" onClick={() => updateDonationStatus(donation._id, 'paid')}>Confirm</button>
                                            )}
                                            <span className="view" onClick={() => handleViewDetails('donation', donation)} title="View Details"><FaEye /></span>
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
                                    <button key={n} onClick={() => setPage(n)} style={{ padding: '5px 11px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, border: `1.5px solid ${page === n ? '#28a745' : '#E8D6CC'}`, background: page === n ? '#28a745' : '#FFF8F3', color: page === n ? '#fff' : '#7A5C4E', cursor: 'pointer' }}>{n}</button>
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

export default DonationManagementTab;