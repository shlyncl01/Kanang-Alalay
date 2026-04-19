import React, { useState } from 'react';
import {
    FaBox, FaEdit, FaTrash, FaCheck, FaTimes, FaExclamationTriangle,
    FaClock, FaSearch
} from 'react-icons/fa';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const CATEGORIES = [
    'medication', 'medical_supplies', 'food', 'hygiene', 'General',
    'Cleaning', 'Equipment', 'Linens & Bedding',
];
const UNITS = ['pcs', 'box', 'bottle', 'pack', 'bag', 'kg', 'liters', 'set', 'roll', 'pair'];

const getStatusStyle = (item) => {
    if (item.quantity === 0)                           return { label: 'Out of Stock', cls: 'inactive',  bg: '#fdecea', color: '#b71c1c' };
    if (item.quantity <= (item.minThreshold ?? 10))    return { label: 'Low Stock',    cls: 'warning',   bg: '#fff8e1', color: '#7c5a00' };
    if (item.expirationDate && new Date(item.expirationDate) < new Date())
        return { label: 'Expired', cls: 'danger', bg: '#fdecea', color: '#b71c1c' };
    const daysLeft = item.expirationDate
        ? (new Date(item.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24)
        : Infinity;
    if (daysLeft <= 30)  return { label: 'Expiring Soon', cls: 'warning', bg: '#fff8e1', color: '#7c5a00' };
    return { label: 'In Stock', cls: 'active', bg: '#e0faf4', color: '#0d6b4f' };
};

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
    const [error, setError]     = useState('');

    const handleSave = async () => {
        if (!form.name.trim()) { setError('Item name is required.'); return; }
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/admin/inventory/${item._id}`, {
                method:  'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    ...form,
                    quantity:      Number(form.quantity),
                    minThreshold:  Number(form.minThreshold),
                    expirationDate: form.expirationDate || undefined,
                }),
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

    const inp = {
        width: '100%', padding: '9px 12px', border: '1.5px solid #E8D6CC',
        borderRadius: 8, fontSize: '.88rem', background: '#FFF8F3',
        color: '#1A0A00', outline: 'none', boxSizing: 'border-box',
        fontFamily: "'DM Sans', system-ui, sans-serif",
    };
    const lbl = {
        display: 'block', fontSize: '.75rem', fontWeight: 700,
        color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4,
    };

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
                        <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Item name" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={lbl}>Category</label>
                            <select style={inp} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={lbl}>Unit</label>
                            <select style={inp} value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={lbl}>Quantity *</label>
                            <input type="number" min="0" style={inp} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
                        </div>
                        <div>
                            <label style={lbl}>Min Threshold</label>
                            <input type="number" min="0" style={inp} value={form.minThreshold} onChange={e => setForm(p => ({ ...p, minThreshold: e.target.value }))} />
                        </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={lbl}>Expiration Date (optional)</label>
                        <input type="date" style={inp} value={form.expirationDate} onChange={e => setForm(p => ({ ...p, expirationDate: e.target.value }))} />
                    </div>

                    <div style={{ marginBottom: 18 }}>
                        <label style={lbl}>Notes</label>
                        <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." />
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E' }}>
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={loading} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: loading ? '#ccc' : 'linear-gradient(135deg, #F96B38, #D94E1B)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                            {loading ? 'Saving…' : '✓ Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InventoryTab = ({ inventory, setInventory, stats, setShowAddInventory }) => {
    const [editItem, setEditItem]         = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting]         = useState(false);
    const [localSearch, setLocalSearch]   = useState('');

    const filtered = localSearch.trim()
        ? inventory.filter(i =>
            i.name?.toLowerCase().includes(localSearch.toLowerCase()) ||
            i.category?.toLowerCase().includes(localSearch.toLowerCase()) ||
            i.status?.toLowerCase().includes(localSearch.toLowerCase())
        )
        : inventory;

    // Real computed counts
    const lowCount      = inventory.filter(i => i.quantity > 0 && i.quantity <= (i.minThreshold ?? 10)).length;
    const outCount      = inventory.filter(i => i.quantity === 0).length;
    const expiringCount = inventory.filter(i => {
        if (!i.expirationDate) return false;
        const days = (new Date(i.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 30;
    }).length;

    const handleSaveEdit = (updated) => {
        setInventory(prev => prev.map(i => i._id === updated._id ? updated : i));
        setEditItem(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/admin/inventory/${deleteTarget._id}`, {
                method:  'DELETE',
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
            });
            setInventory(prev => prev.filter(i => i._id !== deleteTarget._id));
            setDeleteTarget(null);
        } catch (e) {
            console.error('Delete error:', e);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <div className="card-white">
                <div className="card-header">
                    <h5>Inventory &amp; Stock Management</h5>
                    <button className="btn-primary-sm" onClick={() => setShowAddInventory(true)}>
                        <FaBox /> Add Item
                    </button>
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

                {/* Search within inventory */}
                <div style={{ marginBottom: 14, position: 'relative' }}>
                    <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.85rem' }} />
                    <input
                        value={localSearch}
                        onChange={e => setLocalSearch(e.target.value)}
                        placeholder="Search inventory by name, category, or status…"
                        style={{
                            width: '100%', padding: '9px 12px 9px 36px',
                            border: '1.5px solid #E8D6CC', borderRadius: 9,
                            fontFamily: "'DM Sans', system-ui, sans-serif",
                            fontSize: '.88rem', background: '#FFF8F3',
                            color: '#1A0A00', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                    {localSearch && (
                        <button onClick={() => setLocalSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E', fontSize: '.8rem' }}>
                            ✕
                        </button>
                    )}
                </div>

                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: '#7A5C4E' }}>
                        <FaBox style={{ fontSize: '2.5rem', opacity: .3, display: 'block', margin: '0 auto 10px' }} />
                        <p style={{ margin: 0 }}>
                            {localSearch ? `No items match "${localSearch}".` : 'No inventory items yet. Click "Add Item" to begin.'}
                        </p>
                    </div>
                ) : (
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Min Threshold</th>
                                <th>Expiration</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => {
                                const s = getStatusStyle(item);
                                return (
                                    <tr key={item._id}>
                                        <td>
                                            <strong>{item.name}</strong>
                                            {item.notes && <small style={{ display: 'block', color: '#7A5C4E', fontSize: '.75rem' }}>{item.notes}</small>}
                                        </td>
                                        <td>
                                            <span className="badge-custom staff">{item.category}</span>
                                        </td>
                                        <td>
                                            <strong style={{ color: item.quantity === 0 ? '#dc3545' : item.quantity <= (item.minThreshold ?? 10) ? '#ffc107' : 'inherit' }}>
                                                {item.quantity}
                                            </strong>{' '}
                                            <small style={{ color: '#7A5C4E' }}>{item.unit}</small>
                                        </td>
                                        <td style={{ color: '#7A5C4E', fontSize: '.88rem' }}>
                                            {item.minThreshold ?? 10} {item.unit}
                                        </td>
                                        <td style={{ fontSize: '.82rem' }}>
                                            {item.expirationDate
                                                ? new Date(item.expirationDate).toLocaleDateString()
                                                : <span style={{ color: '#ccc' }}>—</span>}
                                        </td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block', padding: '3px 10px',
                                                borderRadius: 12, fontSize: '.78rem', fontWeight: 700,
                                                background: s.bg, color: s.color,
                                                border: `1.5px solid ${s.color}30`,
                                            }}>
                                                {s.label}
                                            </span>
                                        </td>
                                        <td className="actions">
                                            <span
                                                title="Edit"
                                                className="edit"
                                                onClick={() => setEditItem(item)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <FaEdit />
                                            </span>
                                            <span
                                                title="Delete"
                                                className="delete"
                                                onClick={() => setDeleteTarget(item)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <FaTrash />
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Modal */}
            {editItem && (
                <EditItemModal
                    item={editItem}
                    onSave={handleSaveEdit}
                    onClose={() => setEditItem(null)}
                />
            )}

            {/* Delete Confirm Modal */}
            {deleteTarget && (
                <div className="modal-overlay" style={{ zIndex: 10001 }}>
                    <div className="registration-modal" style={{ maxWidth: 420, padding: 30 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <FaExclamationTriangle color="#dc3545" size={22} />
                            <h4 style={{ margin: 0 }}>Delete Item</h4>
                        </div>
                        <p style={{ color: '#7A5C4E', marginBottom: 22 }}>
                            Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={() => setDeleteTarget(null)} style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E' }}>
                                Cancel
                            </button>
                            <button onClick={handleDeleteConfirm} disabled={deleting} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: '#dc3545', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default InventoryTab;