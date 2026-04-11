import React, { useState } from 'react';
import { FaTimes, FaBox } from 'react-icons/fa';

const CATEGORIES = ['Medicine', 'Food & Nutrition', 'Linens & Bedding', 'Hygiene', 'Medical Supplies', 'Cleaning', 'Equipment', 'General'];
const UNITS      = ['pcs', 'box', 'bottle', 'pack', 'bag', 'kg', 'liters', 'set', 'roll', 'pair'];

const AddInventoryModal = ({ isOpen, onClose, onSave }) => {
    const [form, setForm]   = useState({ name: '', category: '', quantity: '', unit: 'pcs' });
    const [errors, setErrors] = useState({});

    if (!isOpen) return null;

    const validate = () => {
        const e = {};
        if (!form.name.trim())       e.name = 'Item name is required.';
        if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) < 0)
            e.quantity = 'Enter a valid quantity.';
        return e;
    };

    const handleSubmit = () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        onSave(form);
        setForm({ name: '', category: '', quantity: '', unit: 'pcs' });
        setErrors({});
        onClose();
    };

    const handleChange = (field, val) => {
        setForm(p => ({ ...p, [field]: val }));
        if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={{ maxWidth: 480 }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '22px 28px', background: 'linear-gradient(135deg, #b85c2d, #7d3a06)',
                    borderRadius: '20px 20px 0 0',
                }}>
                    <h3 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', Georgia, serif", display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FaBox /> Add Inventory Item
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.2)',
                        color: '#fff', width: 36, height: 36, borderRadius: '50%',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background .2s',
                    }}>
                        <FaTimes />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '28px' }}>
                    {/* Item Name */}
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            Item Name <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Paracetamol 500mg"
                            value={form.name}
                            onChange={e => handleChange('name', e.target.value)}
                            style={{
                                width: '100%', padding: '11px 14px',
                                border: `1.5px solid ${errors.name ? '#dc3545' : '#E8D6CC'}`,
                                borderRadius: 10, fontSize: '.9rem',
                                background: '#FFF8F3', color: '#1A0A00',
                                outline: 'none', boxSizing: 'border-box',
                                fontFamily: "'DM Sans', system-ui, sans-serif",
                            }}
                        />
                        {errors.name && <small style={{ color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{errors.name}</small>}
                    </div>

                    {/* Category */}
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            Category
                        </label>
                        <select
                            value={form.category}
                            onChange={e => handleChange('category', e.target.value)}
                            style={{
                                width: '100%', padding: '11px 14px',
                                border: '1.5px solid #E8D6CC', borderRadius: 10,
                                fontSize: '.9rem', background: '#FFF8F3', color: '#1A0A00',
                                outline: 'none', boxSizing: 'border-box',
                                fontFamily: "'DM Sans', system-ui, sans-serif",
                            }}
                        >
                            <option value="">Select category…</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Quantity + Unit */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                Quantity <span style={{ color: '#dc3545' }}>*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={form.quantity}
                                onChange={e => handleChange('quantity', e.target.value)}
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    border: `1.5px solid ${errors.quantity ? '#dc3545' : '#E8D6CC'}`,
                                    borderRadius: 10, fontSize: '.9rem',
                                    background: '#FFF8F3', color: '#1A0A00',
                                    outline: 'none', boxSizing: 'border-box',
                                    fontFamily: "'DM Sans', system-ui, sans-serif",
                                }}
                            />
                            {errors.quantity && <small style={{ color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{errors.quantity}</small>}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                Unit
                            </label>
                            <select
                                value={form.unit}
                                onChange={e => handleChange('unit', e.target.value)}
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    border: '1.5px solid #E8D6CC', borderRadius: 10,
                                    fontSize: '.9rem', background: '#FFF8F3', color: '#1A0A00',
                                    outline: 'none', boxSizing: 'border-box',
                                    fontFamily: "'DM Sans', system-ui, sans-serif",
                                }}
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 20, borderTop: '1.5px solid #E8D6CC' }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: '11px', background: '#fff', color: '#7A5C4E',
                            border: '1.5px solid #E8D6CC', borderRadius: 10, cursor: 'pointer',
                            fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600, fontSize: '.9rem',
                            transition: 'all .2s',
                        }}>
                            Cancel
                        </button>
                        <button onClick={handleSubmit} style={{
                            flex: 2, padding: '11px',
                            background: 'linear-gradient(135deg, #F96B38, #D94E1B)',
                            color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                            fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 700, fontSize: '.9rem',
                            boxShadow: '0 4px 14px rgba(249,107,56,.3)', transition: 'all .22s',
                        }}>
                            Add to Inventory
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddInventoryModal;