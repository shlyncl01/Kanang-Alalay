import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../styles/MedicationFlagRegister.css';

const GRID_FIELDS = [
    { key: 'name', label: 'Name', required: true },
    { key: 'genericName', label: 'Generic Name' },
    { key: 'brand', label: 'Brand' },
    { key: 'dosage', label: 'Dosage (e.g. 500mg)' },
    { key: 'strength', label: 'Strength' },
    { key: 'form', label: 'Form (e.g. Tablet)' },
    { key: 'route', label: 'Route (e.g. Oral)' },
    { key: 'manufacturer', label: 'Manufacturer' },
];

const LONG_FIELDS = [
    { key: 'purpose', label: 'Purpose' },
    { key: 'instructions', label: 'Instructions' },
    { key: 'warnings', label: 'Warnings' },
    { key: 'sideEffects', label: 'Side Effects' },
    { key: 'contraindications', label: 'Contraindications' },
    { key: 'drugInteractions', label: 'Drug Interactions' },
    { key: 'pregnancy', label: 'Pregnancy Notes' },
    { key: 'storage', label: 'Storage' },
];

// Every form field the photo reading can fill in.
const READ_KEYS = [...GRID_FIELDS.map(f => f.key), ...LONG_FIELDS.map(f => f.key), 'expiryDate'];

const fromRead = (read) => {
    const out = {};
    READ_KEYS.forEach(k => { out[k] = (read && typeof read[k] === 'string') ? read[k] : ''; });
    return out;
};

const Arrow = ({ direction }) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={direction === 'right' ? 'M5 12h14M13 6l6 6-6 6' : 'M19 12H5M11 6l-6 6 6 6'} />
    </svg>
);

// The caregiver's photos as a horizontal strip; arrows appear only when
// there are more photos than fit. Clicking a photo opens it full size.
const PhotoStrip = ({ photos }) => {
    const ref = useRef(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);

    const update = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 4);
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [update, photos.length]);

    const scroll = (direction) => {
        const el = ref.current;
        if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
    };

    return (
        <div className="mfr-strip-wrap">
            <div className="mfr-strip" ref={ref} onScroll={update}>
                {photos.map((p, i) => (
                    <img
                        key={i}
                        className="mfr-thumb"
                        src={p.url}
                        alt={`Packaging view ${i + 1} of ${photos.length}`}
                        title="Click to open full size"
                        onClick={() => window.open(p.url, '_blank')}
                    />
                ))}
            </div>
            {canLeft && (
                <button type="button" className="mfr-arrow mfr-arrow-left" onClick={() => scroll(-1)} aria-label="Show earlier photos">
                    <Arrow direction="left" />
                </button>
            )}
            {canRight && (
                <button type="button" className="mfr-arrow mfr-arrow-right" onClick={() => scroll(1)} aria-label="Show more photos">
                    <Arrow direction="right" />
                </button>
            )}
        </div>
    );
};

// Admin's final step for a caregiver-flagged medication: review the details
// read from the photos (pre-filled where possible), add what the photos can't
// show, and register it into the catalog + Inventory.
const MedicationFlagRegisterModal = ({ flag, apiBaseUrl, onClose, onSaved, onReread }) => {
    const [read, setRead] = useState(flag.extractedData || null);
    const [readError, setReadError] = useState(flag.extractionError || null);
    const [rereading, setRereading] = useState(false);
    const [f, setF] = useState({
        ...fromRead(flag.extractedData),
        category: 'medication', unit: 'pcs',
        stockCurrent: '', stockMinimum: '', stockMaximum: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const setField = (k, v) => setF(p => ({ ...p, [k]: v }));
    const photos = flag.photos || [];

    const authHeaders = () => {
        const token = localStorage.getItem('token');
        return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
    };

    // Runs the photo reading again on the server and fills in only the fields
    // that are still empty, so nothing Admin has typed or corrected is lost.
    const rereadPhotos = async () => {
        setRereading(true);
        setError('');
        try {
            const res = await fetch(`${apiBaseUrl}/admin/medication-flags/${flag._id}/reread`, { method: 'POST', headers: authHeaders() });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Failed to re-read the photos.');

            const { extractedData, extractionError } = data.data;
            setRead(extractedData || null);
            setReadError(extractionError || null);
            const fresh = fromRead(extractedData);
            setF(prev => {
                const next = { ...prev };
                READ_KEYS.forEach(k => { if (!prev[k] && fresh[k]) next[k] = fresh[k]; });
                return next;
            });
            if (onReread) onReread({ extractedData, extractionError });
        } catch (e) {
            setError(e.message || 'Failed to re-read the photos.');
        } finally {
            setRereading(false);
        }
    };

    const submit = async () => {
        if (!f.name.trim()) return setError('Medication name is required.');
        if (!f.expiryDate) return setError('Expiry date is required.');
        if (f.stockCurrent === '' || Number(f.stockCurrent) < 0) return setError('Current stock quantity is required.');

        setSaving(true);
        setError('');
        try {
            const res = await fetch(`${apiBaseUrl}/admin/medication-flags/${flag._id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({
                    status: 'registered',
                    name: f.name, genericName: f.genericName, brand: f.brand,
                    dosage: f.dosage, strength: f.strength, form: f.form, route: f.route,
                    manufacturer: f.manufacturer,
                    purpose: f.purpose, instructions: f.instructions, warnings: f.warnings,
                    sideEffects: f.sideEffects, contraindications: f.contraindications,
                    drugInteractions: f.drugInteractions, pregnancy: f.pregnancy, storage: f.storage,
                    category: f.category, unit: f.unit,
                    expiryDate: f.expiryDate,
                    stock: {
                        current: Number(f.stockCurrent),
                        minimum: f.stockMinimum !== '' ? Number(f.stockMinimum) : undefined,
                        maximum: f.stockMaximum !== '' ? Number(f.stockMaximum) : undefined,
                        unit: f.unit,
                    },
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Failed to register medication.');
            onSaved();
        } catch (e) {
            setError(e.message || 'Failed to register medication.');
        } finally {
            setSaving(false);
        }
    };

    // What the reading notice says: it failed, it found nothing to name the
    // medication by, or it filled things in (which still need checking).
    let notice = null;
    if (readError) {
        notice = { tone: 'warn', text: `The photos couldn't be auto-read (${String(readError).slice(0, 120)}). Please fill in the fields manually using the photos as reference. Photos of the front of the box (name and strength) work best.` };
    } else if (!read?.name) {
        notice = { tone: 'warn', text: 'No product name could be read from the photos. Please fill in the fields manually using the photos as reference. Photos of the front of the box (name and strength) work best.' };
    } else {
        notice = { tone: 'info', text: 'Details were read automatically from the photos. Please check them against the packaging, especially the dosage, warnings and expiry date, before registering. Anything the photos didn’t clearly show is left blank.' };
    }

    const label = (key, text, required) => (
        <label className="mfr-label" htmlFor={`mfr-${key}`}>{text}{required && ' *'}</label>
    );

    return (
        <div className="modal-overlay">
            <div className="mfr-modal" role="dialog" aria-modal="true" aria-label="Register medication">
                <div className="mfr-header">
                    <h5 className="mfr-title">Register Medication — Barcode {flag.barcode}</h5>
                    <button type="button" className="mfr-close" onClick={onClose} aria-label="Close">&times;</button>
                </div>

                {photos.length > 0 && <PhotoStrip photos={photos} />}

                <div className="mfr-body">
                    <div className={`mfr-banner mfr-banner-${notice.tone}`}>
                        <span className="mfr-banner-text">{notice.text}</span>
                        {photos.length > 0 && (
                            <button type="button" className="mfr-banner-btn" onClick={rereadPhotos} disabled={rereading || saving}>
                                {rereading ? 'Reading…' : 'Re-read photos'}
                            </button>
                        )}
                    </div>
                    {error && <div className="mfr-banner mfr-banner-error"><span className="mfr-banner-text">{error}</span></div>}

                    <div className="mfr-grid">
                        {GRID_FIELDS.map(({ key, label: text, required }) => (
                            <div className="mfr-field" key={key}>
                                {label(key, text, required)}
                                <input id={`mfr-${key}`} className="mfr-input" type="text" value={f[key]} onChange={e => setField(key, e.target.value)} />
                            </div>
                        ))}
                        <div className="mfr-field">
                            {label('expiryDate', 'Expiry Date', true)}
                            <input id="mfr-expiryDate" className="mfr-input" type="date" value={f.expiryDate} onChange={e => setField('expiryDate', e.target.value)} />
                        </div>
                        <div className="mfr-field">
                            {label('stockCurrent', 'Current Stock', true)}
                            <input id="mfr-stockCurrent" className="mfr-input" type="number" min="0" value={f.stockCurrent} onChange={e => setField('stockCurrent', e.target.value)} />
                        </div>
                    </div>

                    {LONG_FIELDS.map(({ key, label: text }) => (
                        <div className="mfr-field mfr-field-full" key={key}>
                            {label(key, text)}
                            <textarea
                                id={`mfr-${key}`}
                                className="mfr-input"
                                rows={Math.min(8, Math.max(2, Math.ceil(f[key].length / 80)))}
                                value={f[key]}
                                onChange={e => setField(key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>

                <div className="mfr-footer">
                    <button type="button" className="mfr-btn mfr-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="button" className="mfr-btn mfr-btn-primary" onClick={submit} disabled={saving || rereading}>
                        {saving ? 'Registering…' : '✓ Register & Add to Inventory'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MedicationFlagRegisterModal;
