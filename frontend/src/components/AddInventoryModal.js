import React, { useState } from 'react';
import { FaTimes, FaBox } from 'react-icons/fa';

// Aligning items closely with the backend Schema category parameters
const CATEGORIES = [
    { label: 'Medicine', value: 'medication' },
    { label: 'Medical Supplies', value: 'medical_supplies' },
    { label: 'Food & Nutrition', value: 'food' },
    { label: 'Hygiene', value: 'hygiene' },
    { label: 'General', value: 'General' }
];
const UNITS = ['pcs', 'box', 'bottle', 'pack', 'bag', 'kg', 'liters', 'set', 'roll', 'pair'];

const AddInventoryModal = ({ isOpen, onClose, onSave }) => {
    const [form, setForm] = useState({ 
        name: '', 
        category: '', 
        quantity: '', 
        unit: 'pcs',
        brand: '',
        dosage: '',
        batchNumber: '',
        dateOfManufacture: '',
        dateOfPurchase: '',
        expirationDate: ''
    });
    const [errors, setErrors] = useState({});

    if (!isOpen) return null;

    const validate = () => {
        const e = {};
        if (!form.name.trim()) e.name = 'Item name is required.';
        if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) < 0)
            e.quantity = 'Enter a valid quantity.';
        
        if (form.category === 'medication') {
            if (!form.brand.trim()) e.brand = 'Brand name is required.';
            if (!form.dosage.trim()) e.dosage = 'Dosage specification is required.';
            if (!form.batchNumber.trim()) e.batchNumber = 'Batch number is required.';
            if (!form.expirationDate) e.expirationDate = 'Expiration date is required.';
        }
        return e;
    };

    const handleSubmit = () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        onSave(form);
        setForm({ 
            name: '', category: '', quantity: '', unit: 'pcs',
            brand: '', dosage: '', batchNumber: '', 
            dateOfManufacture: '', dateOfPurchase: '', expirationDate: '' 
        });
        setErrors({});
        onClose();
    };

    const handleChange = (field, val) => {
        setForm(p => ({ ...p, [field]: val }));
        if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
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
                    {/* Category Selection First */}
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
                            }}
                        >
                            <option value="">Select category…</option>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>

                    {/* Generic Item / Generic Medicine Name */}
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            {form.category === 'medication' ? 'Generic Name' : 'Item Name'} <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <input
                            type="text"
                            placeholder={form.category === 'medication' ? "e.g., Paracetamol" : "e.g., Linens"}
                            value={form.name}
                            onChange={e => handleChange('name', e.target.value)}
                            style={{
                                width: '100%', padding: '11px 14px',
                                border: `1.5px solid ${errors.name ? '#dc3545' : '#E8D6CC'}`,
                                borderRadius: 10, fontSize: '.9rem', background: '#FFF8F3', color: '#1A0A00',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                        {errors.name && <small style={{ color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{errors.name}</small>}
                    </div>

                    {/* Conditional Fields For Medications */}
                    {form.category === 'medication' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase' }}>Brand *</label>
                                    <input type="text" placeholder="e.g., Biogesic" value={form.brand} onChange={e => handleChange('brand', e.target.value)} style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${errors.brand ? '#dc3545' : '#E8D6CC'}`, borderRadius: 10, background: '#FFF8F3' }}/>
                                    {errors.brand && <small style={{ color: '#dc3545', fontSize: '.78rem' }}>{errors.brand}</small>}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase' }}>Dosage *</label>
                                    <input type="text" placeholder="e.g., 500mg" value={form.dosage} onChange={e => handleChange('dosage', e.target.value)} style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${errors.dosage ? '#dc3545' : '#E8D6CC'}`, borderRadius: 10, background: '#FFF8F3' }}/>
                                    {errors.dosage && <small style={{ color: '#dc3545', fontSize: '.78rem' }}>{errors.dosage}</small>}
                                </div>
                            </div>

                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase' }}>Batch Number *</label>
                                <input type="text" placeholder="e.g., BAT-10293" value={form.batchNumber} onChange={e => handleChange('batchNumber', e.target.value)} style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${errors.batchNumber ? '#dc3545' : '#E8D6CC'}`, borderRadius: 10, background: '#FFF8F3' }}/>
                                {errors.batchNumber && <small style={{ color: '#dc3545', fontSize: '.78rem' }}>{errors.batchNumber}</small>}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase' }}>Date Manufactured</label>
                                    <input type="date" value={form.dateOfManufacture} onChange={e => handleChange('dateOfManufacture', e.target.value)} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10, background: '#FFF8F3' }}/>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase' }}>Date Purchased</label>
                                    <input type="date" value={form.dateOfPurchase} onChange={e => handleChange('dateOfPurchase', e.target.value)} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8D6CC', borderRadius: 10, background: '#FFF8F3' }}/>
                                </div>
                            </div>

                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50', marginBottom: 7, textTransform: 'uppercase' }}>Expiration Date *</label>
                                <input type="date" value={form.expirationDate} onChange={e => handleChange('expirationDate', e.target.value)} style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${errors.expirationDate ? '#dc3545' : '#E8D6CC'}`, borderRadius: 10, background: '#FFF8F3' }}/>
                                {errors.expirationDate && <small style={{ color: '#dc3545', fontSize: '.78rem' }}>{errors.expirationDate}</small>}
                            </div>
                        </>
                    )}

                    {/* Quantity + Unit Fields */}
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
                                    borderRadius: 10, fontSize: '.9rem', background: '#FFF8F3', color: '#1A0A00',
                                    outline: 'none', boxSizing: 'border-box',
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
                            fontWeight: 600, fontSize: '.9rem'
                        }}>
                            Cancel
                        </button>
                        <button onClick={handleSubmit} style={{
                            flex: 2, padding: '11px',
                            background: 'linear-gradient(135deg, #F96B38, #D94E1B)',
                            color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                            fontWeight: 700, fontSize: '.9rem',
                            boxShadow: '0 4px 14px rgba(249,107,56,.3)',
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