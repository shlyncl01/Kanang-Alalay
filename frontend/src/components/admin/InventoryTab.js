import React, { useState, useRef } from 'react';
import {
    FaBox, FaEdit, FaTrash, FaExclamationTriangle,
    FaClock, FaSearch, FaPrint, FaFilter,
    FaChevronLeft, FaChevronRight, FaTimes,
} from 'react-icons/fa';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const CATEGORIES = [
    'All', 'medication', 'medical_supplies', 'food', 'hygiene',
    'General', 'Cleaning', 'Equipment', 'Linens & Bedding',
];
const UNITS = ['pcs', 'box', 'bottle', 'pack', 'bag', 'kg', 'liters', 'set', 'roll', 'pair'];
const PER_PAGE = 10;

const getStatusStyle = (item) => {
    if (item.quantity === 0)
        return { label: 'Out of Stock', bg: '#fdecea', color: '#b71c1c' };
    if (item.quantity <= (item.minThreshold ?? 10))
        return { label: 'Low Stock', bg: '#fff8e1', color: '#7c5a00' };
    if (item.expirationDate && new Date(item.expirationDate) < new Date())
        return { label: 'Expired', bg: '#fdecea', color: '#b71c1c' };
    const daysLeft = item.expirationDate
        ? (new Date(item.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24)
        : Infinity;
    if (daysLeft <= 30) return { label: 'Expiring Soon', bg: '#fff8e1', color: '#7c5a00' };
    return { label: 'In Stock', bg: '#e0faf4', color: '#0d6b4f' };
};

// ── Edit Modal ─────────────────────────────────────────────────────────────────
const EditItemModal = ({ item, onSave, onClose }) => {
    const [form, setForm] = useState({
        name:           item.name || '',
        category:       item.category || 'General',
        quantity:       item.quantity ?? 0,
        unit:           item.unit || 'pcs',
        minThreshold:   item.minThreshold ?? 10,
        expirationDate: item.expirationDate ? item.expirationDate.slice(0, 10) : '',
        notes:          item.notes || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!form.name.trim()) { setError('Item name is required.'); return; }
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/admin/inventory/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                body: JSON.stringify({ ...form, quantity: Number(form.quantity), minThreshold: Number(form.minThreshold), expirationDate: form.expirationDate || undefined }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            onSave(data.data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E8D6CC', borderRadius: 8, fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', system-ui, sans-serif" };
    const lbl = { display: 'block', fontSize: '.75rem', fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 };

    return (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
            <div className="registration-modal" style={{ maxWidth: 480, padding: 0 }}>
                <div style={{ padding: '20px 26px', background: 'linear-gradient(135deg, #b85c2d, #7d3a06)', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FaEdit /> Edit Inventory Item
                    </h4>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.2)', color: '#fff', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaTimes />
                    </button>
                </div>
                <div style={{ padding: '22px 26px' }}>
                    {error && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '.85rem' }}>⚠️ {error}</div>}
                    <div style={{ marginBottom: 12 }}>
                        <label style={lbl}>Item Name *</label>
                        <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div><label style={lbl}>Category</label>
                            <select style={inp} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div><label style={lbl}>Unit</label>
                            <select style={inp} value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div><label style={lbl}>Quantity *</label><input type="number" min="0" style={inp} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} /></div>
                        <div><label style={lbl}>Min Threshold</label><input type="number" min="0" style={inp} value={form.minThreshold} onChange={e => setForm(p => ({ ...p, minThreshold: e.target.value }))} /></div>
                    </div>
                    <div style={{ marginBottom: 12 }}><label style={lbl}>Expiration Date (optional)</label><input type="date" style={inp} value={form.expirationDate} onChange={e => setForm(p => ({ ...p, expirationDate: e.target.value }))} /></div>
                    <div style={{ marginBottom: 18 }}><label style={lbl}>Notes</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E' }}>Cancel</button>
                        <button onClick={handleSave} disabled={loading} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: loading ? '#ccc' : 'linear-gradient(135deg, #F96B38, #D94E1B)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                            {loading ? 'Saving…' : '✓ Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
const DELETE_REASONS = ['Disposed / Expired', 'Used / Consumed', 'Lost or Damaged', 'Returned to supplier', 'Data entry error', 'Other'];

const DeleteInventoryModal = ({ item, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [err, setErr] = useState('');

    const confirm = () => {
        if (!reason.trim()) { setErr('Please provide a reason.'); return; }
        onConfirm(item, reason);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
            <div className="registration-modal" style={{ maxWidth: 440, padding: 0 }}>
                <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg, #dc3545, #a71d2a)', borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FaExclamationTriangle style={{ color: '#fff' }} />
                    <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.05rem' }}>Remove Inventory Item</h4>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.2)', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={11} /></button>
                </div>
                <div style={{ padding: '20px 24px' }}>
                    <p style={{ color: '#555', marginBottom: 14, fontSize: '.9rem' }}>Removing <strong>"{item.name}"</strong>. This cannot be undone.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                        {DELETE_REASONS.map(r => (
                            <button key={r} onClick={() => { setReason(r); setErr(''); }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: '.76rem', cursor: 'pointer', fontWeight: 600, border: `1.5px solid ${reason === r ? '#dc3545' : '#E8D6CC'}`, background: reason === r ? '#fdecea' : '#FFF8F3', color: reason === r ? '#dc3545' : '#7A5C4E' }}>{r}</button>
                        ))}
                    </div>
                    <textarea rows={2} value={reason} onChange={e => { setReason(e.target.value); setErr(''); }} placeholder="Reason for removal…" style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${err ? '#dc3545' : '#E8D6CC'}`, borderRadius: 9, fontSize: '.87rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                    {err && <small style={{ color: '#dc3545', fontSize: '.75rem' }}>{err}</small>}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, paddingTop: 14, borderTop: '1.5px solid #E8D6CC' }}>
                        <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E' }}>Cancel</button>
                        <button onClick={confirm} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #dc3545, #a71d2a)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Confirm Delete</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const InventoryTab = ({ inventory, setInventory, setShowAddInventory }) => {
    const [editItem, setEditItem]         = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting]         = useState(false);
    const [localSearch, setLocalSearch]   = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage]                 = useState(1);
    const printRef = useRef(null);

    const lowCount      = inventory.filter(i => i.quantity > 0 && i.quantity <= (i.minThreshold ?? 10)).length;
    const outCount      = inventory.filter(i => i.quantity === 0).length;
    const expiringCount = inventory.filter(i => {
        if (!i.expirationDate) return false;
        const days = (new Date(i.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 30;
    }).length;

    const filtered = inventory.filter(i => {
        const q = localSearch.toLowerCase();
        const nameMatch = !q || i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q);
        const catMatch  = categoryFilter === 'All' || i.category === categoryFilter;
        const st = getStatusStyle(i).label;
        const stMatch   = statusFilter === 'All' || st === statusFilter;
        return nameMatch && catMatch && stMatch;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    // Reset page when filters change
    React.useEffect(() => { setPage(1); }, [localSearch, categoryFilter, statusFilter]);

    const handleSaveEdit = (updated) => {
        setInventory(prev => prev.map(i => i._id === updated._id ? updated : i));
        setEditItem(null);
    };

    const handleDeleteConfirm = async (item, reason) => {
        setDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/admin/inventory/${item._id}`, {
                method: 'DELETE',
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
            });
            setInventory(prev => prev.filter(i => i._id !== item._id));
            setDeleteTarget(null);
        } catch (e) {
            console.error('Delete error:', e);
        } finally {
            setDeleting(false);
        }
    };

    const handlePrint = () => {
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Inventory Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #b85c2d; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
                    th { background: #b85c2d; color: #fff; padding: 10px 12px; text-align: left; font-weight: 700; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    .low { color: #7c5a00; } .out { color: #b71c1c; } .ok { color: #0d6b4f; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Inventory Report</h2>
                <p class="sub">Generated: ${new Date().toLocaleString('en-PH')} | Total items: ${filtered.length} | Low stock: ${lowCount} | Out of stock: ${outCount}</p>
                <table>
                    <thead>
                        <tr><th>Item Name</th><th>Category</th><th>Quantity</th><th>Unit</th><th>Min Threshold</th><th>Expiration</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${filtered.map(item => {
                            const s = getStatusStyle(item);
                            const cls = item.quantity === 0 ? 'out' : item.quantity <= (item.minThreshold ?? 10) ? 'low' : 'ok';
                            return `<tr>
                                <td><strong>${item.name}</strong>${item.notes ? `<br><small style="color:#7A5C4E">${item.notes}</small>` : ''}</td>
                                <td>${item.category || '—'}</td>
                                <td class="${cls}">${item.quantity}</td>
                                <td>${item.unit}</td>
                                <td>${item.minThreshold ?? 10} ${item.unit}</td>
                                <td>${item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : '—'}</td>
                                <td>${s.label}</td>
                            </tr>`;
                        }).join('')}
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
        <>
            <div className="card-white">
                <div className="card-header">
                    <h5>Inventory &amp; Stock Management</h5>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline-sm" onClick={handlePrint}><FaPrint /> Print Report</button>
                        <button className="btn-primary-sm" onClick={() => setShowAddInventory(true)}><FaBox /> Add Item</button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="stats-grid" style={{ marginBottom: 20 }}>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#dc3545' }}><FaExclamationTriangle /></div>
                        <div className="stat-info"><h3 style={{ color: '#dc3545' }}>{lowCount}</h3><p>Low Stock</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#6c757d' }}><FaBox /></div>
                        <div className="stat-info"><h3 style={{ color: '#6c757d' }}>{outCount}</h3><p>Out of Stock</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#17a2b8' }}><FaBox /></div>
                        <div className="stat-info"><h3>{inventory.length}</h3><p>Total Items</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#ffc107' }}><FaClock /></div>
                        <div className="stat-info"><h3 style={{ color: expiringCount > 0 ? '#ffc107' : undefined }}>{expiringCount}</h3><p>Expiring Soon</p></div>
                    </div>
                </div>

                {/* Filters row */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <FaSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.82rem' }} />
                        <input
                            value={localSearch}
                            onChange={e => setLocalSearch(e.target.value)}
                            placeholder="Search inventory by name or category…"
                            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {localSearch && (
                            <button onClick={() => setLocalSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E' }}>
                                <FaTimes size={11} />
                            </button>
                        )}
                    </div>

                    <FaFilter style={{ color: '#7A5C4E', fontSize: '.8rem' }} />

                    {/* Category */}
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        style={{ padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                    >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'Category: All' : c}</option>)}
                    </select>

                    {/* Status */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                    >
                        {['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Expiring Soon', 'Expired'].map(s => (
                            <option key={s} value={s}>{s === 'All' ? 'Status: All' : s}</option>
                        ))}
                    </select>
                </div>

                {paged.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: '#7A5C4E' }}>
                        <FaBox style={{ fontSize: '2.5rem', opacity: .3, display: 'block', margin: '0 auto 10px' }} />
                        <p style={{ margin: 0 }}>
                            {localSearch || categoryFilter !== 'All' || statusFilter !== 'All'
                                ? 'No items match your filters.'
                                : 'No inventory items yet. Click "Add Item" to begin.'}
                        </p>
                    </div>
                ) : (
                    <div ref={printRef}>
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Category</th>
                                    <th>Stock</th>
                                    <th>Min Threshold</th>
                                    <th>Expiration</th>
                                    <th>QR Code</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(item => {
                                    const s = getStatusStyle(item);
                                    return (
                                        <tr key={item._id}>
                                            <td>
                                                <strong>{item.name}</strong>
                                                {item.notes && <small style={{ display: 'block', color: '#7A5C4E', fontSize: '.75rem' }}>{item.notes}</small>}
                                            </td>
                                            <td><span className="badge-custom staff">{item.category}</span></td>
                                            <td>
                                                <strong style={{ color: item.quantity === 0 ? '#dc3545' : item.quantity <= (item.minThreshold ?? 10) ? '#ffc107' : 'inherit' }}>
                                                    {item.quantity}
                                                </strong>{' '}
                                                <small style={{ color: '#7A5C4E' }}>{item.unit}</small>
                                            </td>
                                            <td style={{ color: '#7A5C4E', fontSize: '.88rem' }}>{item.minThreshold ?? 10} {item.unit}</td>
                                            <td style={{ fontSize: '.82rem' }}>
                                                {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : <span style={{ color: '#ccc' }}>—</span>}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <img
                                                    src={`${API_BASE_URL}/inventory/${item._id}/qr`}
                                                    alt="QR"
                                                    style={{ width: 60, height: 60, border: '1px solid #E8D6CC', borderRadius: 4 }}
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            </td>
                                            <td>
                                                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: '.78rem', fontWeight: 700, background: s.bg, color: s.color, border: `1.5px solid ${s.color}30` }}>
                                                    {s.label}
                                                </span>
                                            </td>
                                            <td className="actions">
                                                <span title="Edit" className="edit" onClick={() => setEditItem(item)} style={{ cursor: 'pointer' }}><FaEdit /></span>
                                                <span title="Delete" className="delete" onClick={() => setDeleteTarget(item)} style={{ cursor: 'pointer' }}><FaTrash /></span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

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
            </div>

            {editItem && <EditItemModal item={editItem} onSave={handleSaveEdit} onClose={() => setEditItem(null)} />}
            {deleteTarget && <DeleteInventoryModal item={deleteTarget} onConfirm={handleDeleteConfirm} onClose={() => setDeleteTarget(null)} />}
        </>
    );
};

export default InventoryTab;