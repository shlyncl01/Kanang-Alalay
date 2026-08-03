import React, { useState } from 'react';
import { FaTimes, FaBox } from 'react-icons/fa';

const CATEGORIES = ['Medicine', 'Food & Nutrition', 'Linens & Bedding', 'Hygiene', 'Medical Supplies', 'Cleaning', 'Equipment', 'General'];
const UNITS      = ['pcs', 'box', 'bottle', 'pack', 'bag', 'kg', 'liters', 'set', 'roll', 'pair'];

const EMPTY_FORM = {
    name: '', category: '', quantity: '', unit: 'pcs',
    minThreshold: '', expirationDate: '', supplier: '', notes: '',
};

const inputStyle = (hasError) => ({
    width: '100%', padding: '11px 14px',
    border: `1.5px solid ${hasError ? '#dc3545' : '#E8D6CC'}`,
    borderRadius: 10, fontSize: '.9rem',
    background: '#FFF8F3', color: '#1A0A00',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: "'DM Sans', system-ui, sans-serif",
});

const labelStyle = {
    display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50',
    marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em',
};

const AddInventoryModal = ({ isOpen, onClose, onSave }) => {
    const [form, setForm]       = useState(EMPTY_FORM);
    const [errors, setErrors]   = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState('');

    if (!isOpen) return null;

    const validate = (f) => {
        const e = {};
        if (!f.name.trim()) e.name = 'Item name is required.';
        if (f.quantity === '' || isNaN(f.quantity) || Number(f.quantity) < 0)
            e.quantity = 'Enter a valid, non-negative quantity.';
        if (f.minThreshold !== '' && (isNaN(f.minThreshold) || Number(f.minThreshold) < 0))
            e.minThreshold = 'Minimum stock level cannot be negative.';
        if (f.expirationDate && isNaN(Date.parse(f.expirationDate)))
            e.expirationDate = 'Enter a valid date.';
        return e;
    };

    const currentErrors = validate(form);
    const hasRequiredFields = form.name.trim() !== '' && form.quantity !== '' && !isNaN(form.quantity) && Number(form.quantity) >= 0;
    const canSubmit = hasRequiredFields && Object.keys(currentErrors).length === 0 && !submitting;

    const handleChange = (field, val) => {
        setForm(p => ({ ...p, [field]: val }));
        if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
        if (serverError) setServerError('');
    };

    const resetAndClose = () => {
        setForm(EMPTY_FORM);
        setErrors({});
        setServerError('');
        onClose();
    };

    const handleSubmit = async () => {
        const e = validate(form);
        if (Object.keys(e).length) { setErrors(e); return; }

        setSubmitting(true);
        setServerError('');
        try {
            const result = await onSave({
                name: form.name.trim(),
                category: form.category,
                quantity: Number(form.quantity),
                unit: form.unit,
                minThreshold: form.minThreshold !== '' ? Number(form.minThreshold) : undefined,
                expirationDate: form.expirationDate || undefined,
                supplier: form.supplier.trim() || undefined,
                notes: form.notes.trim() || undefined,
            });
            // onSave may return {success:false, message} on failure. If it returns
            // nothing (undefined) we assume the caller already handled success/failure itself.
            if (result && result.success === false) {
                setServerError(result.message || 'Failed to save item. Please try again.');
                setSubmitting(false);
                return;
            }
            setSubmitting(false);
            resetAndClose();
        } catch (err) {
            setServerError(err?.message || 'Failed to save item. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={{ maxWidth: 520, padding: 0 }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '22px 28px', background: 'linear-gradient(135deg, #b85c2d, #7d3a06)',
                    borderRadius: '20px 20px 0 0',
                }}>
                    <h3 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', Georgia, serif", display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.2rem' }}>
                        <FaBox /> Add Inventory Item
                    </h3>
                    <button onClick={resetAndClose} type="button" style={{
                        background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.2)',
                        color: '#fff', width: 36, height: 36, borderRadius: '50%',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background .2s', flexShrink: 0,
                    }}>
                        <FaTimes />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '26px 28px', maxHeight: '70vh', overflowY: 'auto' }}>

                    {serverError && (
                        <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: '.85rem' }}>
                            {serverError}
                        </div>
                    )}

                    {/* Item Name */}
                    <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>
                            Item Name <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Paracetamol 500mg"
                            value={form.name}
                            onChange={e => handleChange('name', e.target.value)}
                            style={inputStyle(errors.name)}
                        />
                        {errors.name && <small style={{ color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{errors.name}</small>}
                    </div>

                    {/* Category */}
                    <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>Category</label>
                        <select
                            value={form.category}
                            onChange={e => handleChange('category', e.target.value)}
                            style={inputStyle(false)}
                        >
                            <option value="">Select category…</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Quantity + Unit */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                        <div>
                            <label style={labelStyle}>
                                Quantity <span style={{ color: '#dc3545' }}>*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={form.quantity}
                                onChange={e => handleChange('quantity', e.target.value)}
                                style={inputStyle(errors.quantity)}
                            />
                            {errors.quantity && <small style={{ color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{errors.quantity}</small>}
                        </div>
                        <div>
                            <label style={labelStyle}>Unit</label>
                            <select
                                value={form.unit}
                                onChange={e => handleChange('unit', e.target.value)}
                                style={inputStyle(false)}
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Minimum Stock Level + Expiration Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                        <div>
                            <label style={labelStyle}>Minimum Stock Level</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="10"
                                value={form.minThreshold}
                                onChange={e => handleChange('minThreshold', e.target.value)}
                                style={inputStyle(errors.minThreshold)}
                            />
                            {errors.minThreshold && <small style={{ color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{errors.minThreshold}</small>}
                        </div>
                        <div>
                            <label style={labelStyle}>Expiration Date <span style={{ color: '#A38070', fontWeight: 500, textTransform: 'none' }}>(optional)</span></label>
                            <input
                                type="date"
                                value={form.expirationDate}
                                onChange={e => handleChange('expirationDate', e.target.value)}
                                style={inputStyle(errors.expirationDate)}
                            />
                            {errors.expirationDate && <small style={{ color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{errors.expirationDate}</small>}
                        </div>
                    </div>

                    {/* Supplier */}
                    <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>Supplier <span style={{ color: '#A38070', fontWeight: 500, textTransform: 'none' }}>(optional)</span></label>
                        <input
                            type="text"
                            placeholder="e.g., Metro Pharma Supply Co."
                            value={form.supplier}
                            onChange={e => handleChange('supplier', e.target.value)}
                            style={inputStyle(false)}
                        />
                    </div>

                    {/* Description / Notes */}
                    <div style={{ marginBottom: 6 }}>
                        <label style={labelStyle}>Description / Notes <span style={{ color: '#A38070', fontWeight: 500, textTransform: 'none' }}>(optional)</span></label>
                        <textarea
                            placeholder="Storage instructions, brand notes, etc."
                            value={form.notes}
                            onChange={e => handleChange('notes', e.target.value)}
                            rows={3}
                            style={{ ...inputStyle(false), resize: 'vertical', minHeight: 70, fontFamily: "'DM Sans', system-ui, sans-serif" }}
                        />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 22, paddingTop: 20, borderTop: '1.5px solid #E8D6CC' }}>
                        <button onClick={resetAndClose} type="button" disabled={submitting} style={{
                            flex: 1, padding: '11px', background: '#fff', color: '#7A5C4E',
                            border: '1.5px solid #E8D6CC', borderRadius: 10, cursor: submitting ? 'not-allowed' : 'pointer',
                            fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600, fontSize: '.9rem',
                            transition: 'all .2s', opacity: submitting ? 0.6 : 1,
                        }}>
                            Cancel
                        </button>
                        <button onClick={handleSubmit} type="button" disabled={!canSubmit} style={{
                            flex: 2, padding: '11px',
                            background: !canSubmit ? '#ccc' : 'linear-gradient(135deg, #F96B38, #D94E1B)',
                            color: '#fff', border: 'none', borderRadius: 10, cursor: !canSubmit ? 'not-allowed' : 'pointer',
                            fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 700, fontSize: '.9rem',
                            boxShadow: !canSubmit ? 'none' : '0 4px 14px rgba(249,107,56,.3)', transition: 'all .22s',
                        }}>
                            {submitting ? 'Saving…' : 'Add to Inventory'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddInventoryModal;