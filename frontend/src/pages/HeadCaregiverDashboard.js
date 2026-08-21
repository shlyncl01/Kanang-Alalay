import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaUserCircle, FaSearch, FaHome, FaUsers, FaPills,
    FaQrcode, FaSignOutAlt, FaChevronDown,
    FaPlus, FaExclamationTriangle,
    FaCog, FaQuestionCircle, FaMicrophone, FaTimes, FaCheck,
    FaSpinner, FaSync, FaEye, FaEdit, FaEllipsisV, FaTrashAlt,
    FaExclamationCircle, FaFileAlt,
    FaBoxOpen, FaClock, FaFilter, FaBars,
    FaBell, FaUserMd, FaUserPlus, FaStethoscope, FaUserMinus,
} from 'react-icons/fa';
import '../styles/Dashboard.css';
import '../styles/NurseDashboard.css';
import mainLogo from '../assets/mainLogo.png';

const getApiUrl = () => {
    const fallback = process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api';
    const raw = process.env.REACT_APP_API_URL || fallback;
    const trimmed = raw.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API = getApiUrl();

// ─── Status maps ─────────────────────────────────────────────────────────────
const STATUS_COLOR = {
    completed: '#1E7D56', administered: '#1E7D56',
    pending: '#E65100', scheduled: '#0277BD',
    upcoming: '#0277BD', overdue: '#C0392B',
    delayed: '#856404', missed: '#C0392B',
    skipped: '#6B7280', alert: '#D94E1B',
    critical: '#C0392B', stable: '#1E7D56', active: '#1E7D56',
};
const STATUS_LABEL = {
    completed: 'Completed', administered: 'Administered', pending: 'Pending',
    scheduled: 'Upcoming', upcoming: 'Upcoming', overdue: 'Overdue',
    delayed: 'Delayed', missed: 'Missed', skipped: 'Skipped',
    alert: 'Alert', critical: 'Critical', stable: 'Stable', active: 'Active',
};
const getStatus = s => (s || 'pending').toLowerCase();

const Badge = ({ s }) => (
    <span className={`status-badge ${getStatus(s)}`}>
        {STATUS_LABEL[getStatus(s)] || s}
    </span>
);

const DotBadge = ({ s }) => {
    const key = getStatus(s);
    return (
        <span className="dot-badge" style={{ color: STATUS_COLOR[key] || '#E65100' }}>
            <span className="dot" style={{ background: STATUS_COLOR[key] || '#E65100' }} />
            {STATUS_LABEL[key] || s}
        </span>
    );
};

// ─── Shared fetch ─────────────────────────────────────────────────────────────
const useFetch = () => useCallback(async (endpoint, opts = {}) => {
    const token = localStorage.getItem('token');
    try {
        const r = await fetch(`${API}${endpoint}`, {
            credentials: 'include',
            ...opts,
            headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...opts.headers },
        });
        const text = await r.text();
        const data = text ? JSON.parse(text) : {};
        return r.ok ? data : { success: false, message: data.message || data.error || `Request failed (${r.status})` };
    } catch (e) { return { success: false, message: e.message }; }
}, []);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
    return (
        <div className={`toast ${type || 'success'}`}>
            {type === 'error' ? <FaTimes /> : <FaCheck />} {msg}
        </div>
    );
};

// ─── Shared inline-style system (matches Add Inventory Item exactly) ─────────
// Used only by AddResidentModal, AddScheduleModal, RequestStockModal — fully
// self-contained inline styles, independent of any external CSS classes.
// NOTE: hcModalStyle is now a flex column (header / scrollable body / footer)
// so the header + footer stay pinned in place and only the middle content
// scrolls — this is what keeps the close button and Save/Cancel buttons
// reachable no matter how tall the form gets. Side padding uses clamp()
// so every modal automatically tightens its gutters on narrow screens
// instead of needing separate mobile breakpoints.
const hcModalStyle = {
    maxWidth: 560, width: '100%', padding: 0,
    display: 'flex', flexDirection: 'column',
    maxHeight: 'min(92vh, 780px)', overflow: 'hidden', boxSizing: 'border-box',
};
const hcHeaderStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 'clamp(16px,4vw,22px) clamp(18px,5vw,28px)', background: 'linear-gradient(135deg, #b85c2d, #7d3a06)',
    borderRadius: '20px 20px 0 0', flexShrink: 0, boxSizing: 'border-box', gap: 12,
};
const hcHeaderTitleStyle = {
    margin: 0, color: '#fff', fontFamily: "'Playfair Display', Georgia, serif",
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 'clamp(1.02rem, 3vw, 1.2rem)',
    minWidth: 0, wordBreak: 'break-word',
};
const hcCloseBtnStyle = {
    background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.2)',
    color: '#fff', width: 36, height: 36, borderRadius: '50%',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background .2s', flexShrink: 0,
};
const hcBodyStyle = {
    padding: 'clamp(18px,4vw,26px) clamp(18px,5vw,28px)',
    flex: '1 1 auto', minHeight: 0, overflowY: 'auto', boxSizing: 'border-box',
};
const hcSectionLabel = {
    fontSize: '.78rem', fontWeight: 700, color: '#b85c2d', textTransform: 'uppercase',
    letterSpacing: '.05em', margin: '22px 0 14px', paddingBottom: 8,
    borderBottom: '1.5px solid #F3D9C4', display: 'flex', alignItems: 'center',
};
const hcFieldWrap = { marginBottom: 18 };
const hcGrid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 };
// The facility has 3 floors, 6 rooms per floor, 4 beds per room. Room numbers
// (1-6) repeat per floor, so a room is only unique combined with its floor.
const FLOORS = ['2nd Floor', '3rd Floor', '4th Floor'];
const ROOM_NUMBERS = ['1', '2', '3', '4', '5', '6'];
const BEDS = ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4'];
// Exactly the medication.form values present in the database — each is its
// own unit rather than being collapsed into a generic bucket, so the value
// shown always matches what's on file.
const DOSAGE_UNITS = [
    'Tablet', 'Film-Coated Tablet', 'Caplet', 'Delayed-Release Tablet',
    'Delayed-Release Capsule', 'Enteric-Coated Tablet',
    'Capsule', 'Syrup', 'Chewable Tablet', 'Liquid Gel Capsule',
    'Controlled-Release Tablet', 'Oral Solution',
];
const guessDosageUnit = (form) => (DOSAGE_UNITS.includes(form) ? form : '');
const hcLabelStyle = {
    display: 'block', fontSize: '.82rem', fontWeight: 700, color: '#2c3e50',
    marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em',
};
const hcInputStyle = (hasError) => ({
    width: '100%', padding: '11px 14px',
    border: `1.5px solid ${hasError ? '#dc3545' : '#E8D6CC'}`,
    borderRadius: 10, fontSize: '.9rem',
    background: '#FFF8F3', color: '#1A0A00',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: "'DM Sans', system-ui, sans-serif",
});
const hcErrorText = { color: '#dc3545', fontSize: '.78rem', marginTop: 4, display: 'block' };
const hcHintText = { fontSize: '.74rem', color: '#A38070', marginTop: 4, display: 'block' };
const hcFooter = {
    display: 'flex', flexWrap: 'wrap', gap: 12,
    padding: '18px clamp(18px,5vw,28px)', borderTop: '1.5px solid #E8D6CC',
    flexShrink: 0, boxSizing: 'border-box', background: '#fff',
};
const hcCancelBtn = (disabled) => ({
    flex: '1 1 120px', padding: '11px', background: '#fff', color: '#7A5C4E',
    border: '1.5px solid #E8D6CC', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600, fontSize: '.9rem',
    transition: 'all .2s', opacity: disabled ? 0.6 : 1,
});
const hcSaveBtn = (disabled) => ({
    flex: '2 1 160px', padding: '11px',
    background: disabled ? '#ccc' : 'linear-gradient(135deg, #F96B38, #D94E1B)',
    color: '#fff', border: 'none', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 700, fontSize: '.9rem',
    boxShadow: disabled ? 'none' : '0 4px 14px rgba(249,107,56,.3)', transition: 'all .22s',
});
// Reusable field wrapper so every modal renders label/input/error identically
const HCField = ({ label, required, error, hint, style, children }) => (
    <div style={style || hcFieldWrap}>
        <label style={hcLabelStyle}>
            {label} {required && <span style={{ color: '#dc3545' }}>*</span>}
        </label>
        {children}
        {error && <small style={hcErrorText}>{error}</small>}
        {!error && hint && <small style={hcHintText}>{hint}</small>}
    </div>
);
const HCHeader = ({ icon, title, onClose }) => (
    <div style={hcHeaderStyle}>
        <h3 style={hcHeaderTitleStyle}>{icon} {title}</h3>
        <button onClick={onClose} type="button" style={hcCloseBtnStyle}><FaTimes /></button>
    </div>
);

// ─── Medical condition options (Add Resident modal) ──────────────────────────
const MEDICAL_CONDITIONS = [
    'Hypertension',
    'Type 2 Diabetes',
    'High Cholesterol',
    'Atrial Fibrillation / Stroke Prevention',
    'Cardiovascular Disease',
    'Arthritis',
    'Osteoporosis',
    'Gout',
    "Alzheimer's Disease / Dementia",
    "Parkinson's Disease",
    'Depression',
    'Anxiety',
    'Insomnia',
    'GERD / Heartburn',
    'Constipation',
    'Hypothyroidism',
    'Urinary Incontinence / Overactive Bladder',
    'Allergies',
    'Cold',
];

// Multi-select dropdown (checkbox list) for Medical Conditions — styled to
// match the rest of the Add Resident form inputs.
const ConditionsMultiSelect = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        const onDocClick = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const toggleCondition = (condition) => {
        if (value.includes(condition)) {
            onChange(value.filter(c => c !== condition));
        } else {
            onChange([...value, condition]);
        }
    };

    return (
        <div ref={wrapRef} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    ...hcInputStyle(false),
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', textAlign: 'left', gap: 10,
                }}
            >
                <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: value.length ? '#1A0A00' : '#A38070',
                }}>
                    {value.length ? value.join(', ') : 'Select medical condition(s)…'}
                </span>
                <FaChevronDown style={{ flexShrink: 0, fontSize: '.75rem', color: '#A38070', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
                    background: '#fff', border: '1.5px solid #E8D6CC', borderRadius: 10,
                    boxShadow: '0 10px 28px rgba(0,0,0,.14)', maxHeight: 240, overflowY: 'auto',
                    padding: 8,
                }}>
                    {MEDICAL_CONDITIONS.map(condition => (
                        <label
                            key={condition}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                                fontSize: '.87rem', color: '#1A0A00',
                                fontFamily: "'DM Sans', system-ui, sans-serif",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FFF8F3'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <input
                                type="checkbox"
                                checked={value.includes(condition)}
                                onChange={() => toggleCondition(condition)}
                                style={{ width: 16, height: 16, accentColor: '#F96B38', cursor: 'pointer', flexShrink: 0 }}
                            />
                            {condition}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

/// ════════════════════════════════════════════════════════════
//  MODAL: Add Resident (UPDATED with better UI and caregivers dropdown - NO EMOJIS)
// ════════════════════════════════════════════════════════════
// AddResidentModal - now doubles as the Edit modal when a `resident` prop is passed
const AddResidentModal = ({ resident, onClose, onSaved, doFetch, toast, caregivers, fetchCaregivers }) => {
    const isEdit = !!resident;
    const [f, setF] = useState(() => isEdit ? {
        firstName: resident.firstName || '',
        lastName: resident.lastName || '',
        middleName: resident.middleName || '',
        nickname: resident.nickname || '',
        age: resident.age ?? '',
        gender: resident.gender || 'female',
        roomNumber: resident.room || resident.roomNumber || '',
        floor: resident.floor || '',
        bed: resident.bed || '',
        conditions: (resident.conditions || []).map(c => c?.name || c),
        primaryCaregiverId: (typeof resident.primaryCaregiverId === 'object'
            ? resident.primaryCaregiverId?._id
            : resident.primaryCaregiverId) || '',
        admissionDate: resident.admissionDate
            ? new Date(resident.admissionDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        alertLevel: resident.alertLevel || 'stable',
    } : {
        firstName: '',
        lastName: '',
        middleName: '',
        nickname: '',
        age: '',
        gender: 'female',
        roomNumber: '',
        floor: '',
        bed: '',
        conditions: [],
        primaryCaregiverId: '',
        admissionDate: new Date().toISOString().slice(0, 10),
        alertLevel: 'stable',
    });
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);
    const [occupiedBeds, setOccupiedBeds] = useState([]);
    const setField = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrs(p => ({ ...p, [k]: '' })); };

    // Fetch caregivers when modal opens
    useEffect(() => {
        if (fetchCaregivers) fetchCaregivers();
    }, [fetchCaregivers]);

    // Fetch occupied beds when room or floor changes
    useEffect(() => {
        if (!f.roomNumber) { setOccupiedBeds([]); return; }
        const params = new URLSearchParams({ roomNumber: f.roomNumber });
        if (f.floor) params.append('floor', f.floor);
        doFetch(`/head-caregiver/residents/occupied-beds?${params}`).then(r => {
            if (r.success) {
                // When editing, don't count this resident's own current bed as "occupied".
                const beds = isEdit
                    ? (r.data || []).filter(o => String(o.residentId) !== String(resident._id))
                    : (r.data || []);
                setOccupiedBeds(beds);
            }
        });
    }, [f.roomNumber, f.floor, doFetch, isEdit, resident]);

    const submit = async () => {
        const e = {};
        if (!f.firstName.trim()) e.firstName = 'First name is required';
        if (!f.age || isNaN(f.age) || +f.age < 1 || +f.age > 130) e.age = 'Enter a valid age (1–130)';
        if (!f.roomNumber.trim()) e.roomNumber = 'Room number is required';
        if (!f.floor) e.floor = 'Please select a floor';
        if (Object.keys(e).length) { setErrs(e); return; }

        setSaving(true);

        // Find selected caregiver to get their name
        const selectedCaregiver = caregivers.find(c => String(c._id) === String(f.primaryCaregiverId));

        const payload = {
            firstName: f.firstName.trim(),
            lastName: f.lastName.trim(),
            middleName: f.middleName.trim(),
            nickname: f.nickname.trim(),
            age: +f.age,
            gender: f.gender,
            roomNumber: f.roomNumber.trim(),
            floor: f.floor,
            bed: f.bed,
            alertLevel: f.alertLevel,
            admissionDate: f.admissionDate,
            conditions: f.conditions.map(c => ({ name: c })),
            primaryCaregiverId: f.primaryCaregiverId || '',  // Send as ObjectId reference
            primaryCaregiver: selectedCaregiver ? `${selectedCaregiver.firstName} ${selectedCaregiver.lastName}` : '',  // Store name for display
            primaryCaregiverName: selectedCaregiver ? `${selectedCaregiver.firstName} ${selectedCaregiver.lastName}` : '',
        };

        const r = isEdit
            ? await doFetch(`/head-caregiver/residents/${resident._id}`, { method: 'PUT', body: JSON.stringify(payload) })
            : await doFetch('/head-caregiver/residents', { method: 'POST', body: JSON.stringify(payload) });

        setSaving(false);
        if (r.success) {
            toast(isEdit
                ? `Resident ${f.firstName} ${f.lastName} updated successfully.`
                : `Resident ${f.firstName} ${f.lastName} added successfully.`);
            onSaved(r.data);
            onClose();
        } else {
            toast(r.message || (isEdit ? 'Failed to update resident.' : 'Failed to add resident.'), 'error');
        }
    };

    // Find selected caregiver
    const selectedCaregiver = caregivers.find(c => String(c._id) === String(f.primaryCaregiverId));
    const selectedCaregiverName = selectedCaregiver ? `${selectedCaregiver.firstName} ${selectedCaregiver.lastName}` : '';

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={hcModalStyle}>
                <HCHeader icon={<FaUserPlus />} title={isEdit ? `Edit Resident — ${resident.firstName} ${resident.lastName}`.trim() : 'Add New Resident'} onClose={onClose} />
                <div style={hcBodyStyle}>

                    {/* Personal Information Section */}
                    <div style={{ ...hcSectionLabel, marginTop: 0 }}>
                        <FaUserCircle style={{ marginRight: 6 }} /> Personal Information
                    </div>
                    <div style={hcGrid2}>
                        <HCField label="First Name" required error={errs.firstName}>
                            <input
                                style={hcInputStyle(errs.firstName)}
                                value={f.firstName}
                                onChange={e => setField('firstName', e.target.value)}
                                placeholder="Enter first name"
                            />
                        </HCField>
                        <HCField label="Last Name">
                            <input
                                style={hcInputStyle(false)}
                                value={f.lastName}
                                onChange={e => setField('lastName', e.target.value)}
                                placeholder="Enter last name (optional)"
                            />
                        </HCField>
                        <HCField label="Middle Name">
                            <input
                                style={hcInputStyle(false)}
                                value={f.middleName}
                                onChange={e => setField('middleName', e.target.value)}
                                placeholder="Optional"
                            />
                        </HCField>
                        <HCField label="Nickname">
                            <input
                                style={hcInputStyle(false)}
                                value={f.nickname}
                                onChange={e => setField('nickname', e.target.value)}
                                placeholder="What they prefer to be called"
                            />
                        </HCField>
                        <HCField label="Age" required error={errs.age}>
                            <input
                                type="number"
                                min="1"
                                max="130"
                                style={hcInputStyle(errs.age)}
                                value={f.age}
                                onChange={e => setField('age', e.target.value)}
                                placeholder="e.g. 75"
                            />
                        </HCField>
                        <HCField label="Gender">
                            <select style={hcInputStyle(false)} value={f.gender} onChange={e => setField('gender', e.target.value)}>
                                <option value="female">Female</option>
                                <option value="other">Other / Prefer not to say</option>
                            </select>
                        </HCField>
                        <HCField label="Admission Date" style={{ ...hcFieldWrap, gridColumn: '1 / -1' }}>
                            <input
                                type="date"
                                style={hcInputStyle(false)}
                                value={f.admissionDate}
                                onChange={e => setField('admissionDate', e.target.value)}
                            />
                        </HCField>
                    </div>

                    {/* Room Assignment Section */}
                    <div style={hcSectionLabel}>
                        <FaHome style={{ marginRight: 6 }} /> Room Assignment
                    </div>
                    <div style={hcGrid2}>
                        <HCField label="Room Number" required error={errs.roomNumber}>
                            <select
                                style={hcInputStyle(errs.roomNumber)}
                                value={f.roomNumber}
                                onChange={e => setField('roomNumber', e.target.value)}>
                                <option value="">Select room…</option>
                                {ROOM_NUMBERS.map(rn => <option key={rn} value={rn}>Room {rn}</option>)}
                            </select>
                        </HCField>
                        <HCField label="Floor / Ward" required error={errs.floor}>
                            <select
                                style={hcInputStyle(errs.floor)}
                                value={f.floor}
                                onChange={e => setField('floor', e.target.value)}>
                                <option value="">Select floor…</option>
                                {FLOORS.map(fl => <option key={fl} value={fl}>{fl}</option>)}
                            </select>
                        </HCField>
                        <HCField
                            label="Bed"
                            error={errs.bed}
                            hint={f.roomNumber && occupiedBeds.length > 0
                                ? `${occupiedBeds.length} of ${BEDS.length} bed${occupiedBeds.length !== 1 ? 's' : ''} occupied in Room ${f.roomNumber}`
                                : null}
                        >
                            <select style={hcInputStyle(errs.bed)} value={f.bed} onChange={e => setField('bed', e.target.value)}>
                                <option value="">Select bed…</option>
                                {BEDS.map(b => {
                                    const occ = occupiedBeds.find(o => o.bed === b);
                                    return (
                                        <option key={b} value={b} disabled={!!occ}>
                                            {b}{occ ? ` — Occupied (${occ.residentName})` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </HCField>
                        <HCField label="Alert Level">
                            <select style={hcInputStyle(false)} value={f.alertLevel} onChange={e => setField('alertLevel', e.target.value)}>
                                <option value="stable">Stable</option>
                                <option value="alert">Alert - Monitor closely</option>
                                <option value="critical">Critical - Immediate attention</option>
                            </select>
                        </HCField>
                    </div>

                    {/* Medical Information Section */}
                    <div style={hcSectionLabel}>
                        <FaStethoscope style={{ marginRight: 6 }} /> Medical Information
                    </div>
                    <HCField label="Medical Conditions" hint="Select one or more conditions">
                        <ConditionsMultiSelect
                            value={f.conditions}
                            onChange={vals => setField('conditions', vals)}
                        />
                    </HCField>

                    {/* Assignment Section with Caregivers Dropdown */}
                    <div style={hcSectionLabel}>
                        <FaUserMd style={{ marginRight: 6 }} /> Assignment
                    </div>
                    <HCField
                        label="Primary Caregiver"
                        style={{ marginBottom: 6 }}
                        hint={
                            selectedCaregiverName ? `Assigned to: ${selectedCaregiverName}`
                            : caregivers.filter(c => String(c.role || '').toLowerCase() === 'caregiver').length === 0
                                ? 'No caregiver accounts found. Please register a caregiver first in User Management.'
                                : 'Optional — can be assigned later.'
                        }
                    >
                        <select
                            style={hcInputStyle(false)}
                            value={f.primaryCaregiverId}
                            onChange={e => setField('primaryCaregiverId', e.target.value)}>
                            <option value="">— Select a caregiver —</option>
                            {caregivers
                                .filter(c => String(c.role || '').toLowerCase() === 'caregiver')
                                .map(c => (
                                    <option key={c._id} value={c._id}>
                                        {c.firstName} {c.lastName} (Caregiver)
                                    </option>
                                ))}
                        </select>
                    </HCField>
                </div>
                <div style={hcFooter}>
                    <button onClick={onClose} type="button" disabled={saving} style={hcCancelBtn(saving)}>
                        Cancel
                    </button>
                    <button onClick={submit} type="button" disabled={saving} style={hcSaveBtn(saving)}>
                        {saving ? 'Saving…' : isEdit ? '✓ Save Changes' : '✓ Add Resident'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Discharge / Remove Resident
// ════════════════════════════════════════════════════════════
const DISCHARGE_REASON_OPTIONS = [
    { value: '', label: 'Select a reason…' },
    { value: 'deceased', label: 'Death' },
    { value: 'legal_guardianship', label: 'Legal Guardianship Change' },
    { value: 'adopted', label: 'Adopted' },
    { value: 'reunited_with_family', label: 'Reunited with Family' },
    { value: 'transferred_hospital', label: 'Transferred to Hospital (end-of-life care)' },
    { value: 'other', label: 'Other' },
];

const DischargeResidentModal = ({ resident, onClose, onSaved, doFetch, toast }) => {
    const [reason, setReason] = useState('');
    const [causeOfDeath, setCauseOfDeath] = useState('');
    const [destination, setDestination] = useState('');
    const [notes, setNotes] = useState('');
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);

    const resName = resident.name || [resident.firstName, resident.lastName].filter(Boolean).join(' ') || 'this resident';

    // Reasons where a "destination" (hospital / guardian / family) makes sense.
    const showDestination = ['legal_guardianship', 'adopted', 'reunited_with_family', 'transferred_hospital'].includes(reason);
    const destinationLabel = {
        legal_guardianship: 'New Legal Guardian',
        adopted: 'Adoptive Family / Guardian',
        reunited_with_family: 'Receiving Family Member',
        transferred_hospital: 'Hospital Name',
    }[reason] || 'Destination';

    const submit = async () => {
        const e = {};
        if (!reason) e.reason = 'Please select a reason.';
        if (reason === 'deceased' && !causeOfDeath.trim()) e.causeOfDeath = 'Cause of death is required.';
        if (Object.keys(e).length) { setErrs(e); return; }

        setSaving(true);
        const r = await doFetch(`/head-caregiver/residents/${resident._id}/discharge`, {
            method: 'PUT',
            body: JSON.stringify({
                reason,
                causeOfDeath: reason === 'deceased' ? causeOfDeath.trim() : undefined,
                destination: showDestination ? destination.trim() : undefined,
                notes: notes.trim(),
            })
        });
        setSaving(false);
        if (r.success) {
            toast(r.message || `${resName} has been removed from active residents.`);
            onSaved(resident._id);
            onClose();
        } else {
            toast(r.message || 'Failed to remove resident.', 'error');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={hcModalStyle}>
                <HCHeader icon={<FaExclamationCircle />} title={`Remove Resident — ${resName}`} onClose={onClose} />
                <div style={hcBodyStyle}>
                    <p style={{ color: 'var(--d-muted)', fontSize: '.85rem', marginTop: 0 }}>
                        This does not delete {resName}'s record — it keeps their medication and care
                        history on file and moves them out of the active resident list.
                    </p>

                    <HCField label="Reason for removal" required error={errs.reason}>
                        <select
                            style={hcInputStyle(errs.reason)}
                            value={reason}
                            onChange={e => { setReason(e.target.value); setErrs(p => ({ ...p, reason: '' })); }}
                        >
                            {DISCHARGE_REASON_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </HCField>

                    {reason === 'deceased' && (
                        <HCField label="Cause of Death" required error={errs.causeOfDeath}>
                            <input
                                style={hcInputStyle(errs.causeOfDeath)}
                                value={causeOfDeath}
                                onChange={e => { setCauseOfDeath(e.target.value); setErrs(p => ({ ...p, causeOfDeath: '' })); }}
                                placeholder="e.g. Cardiac arrest, natural causes, etc."
                            />
                        </HCField>
                    )}

                    {showDestination && (
                        <HCField label={destinationLabel}>
                            <input
                                style={hcInputStyle(false)}
                                value={destination}
                                onChange={e => setDestination(e.target.value)}
                                placeholder={`Enter ${destinationLabel.toLowerCase()}`}
                            />
                        </HCField>
                    )}

                    <HCField label="Additional Notes">
                        <textarea
                            style={{ ...hcInputStyle(false), minHeight: 70, resize: 'vertical' }}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Optional — any additional details for the record"
                        />
                    </HCField>
                </div>
                <div style={hcFooter}>
                    <button onClick={onClose} type="button" disabled={saving} style={hcCancelBtn(saving)}>
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        type="button"
                        disabled={saving}
                        style={{ ...hcSaveBtn(saving), background: saving ? undefined : '#C0392B' }}
                    >
                        {saving ? 'Removing…' : 'Confirm Removal'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  DELETE MEDICATION (schedule/log entry) CONFIRM MODAL
// ════════════════════════════════════════════════════════════
const DeleteMedicationModal = ({ log, onClose, onSaved, doFetch, toast }) => {
    const [saving, setSaving] = useState(false);
    const medName = log?.medicationName || 'this medication';
    const resName = log?.residentName || 'this resident';

    const submit = async () => {
        setSaving(true);
        const r = await doFetch(`/head-caregiver/schedule/${log._id}`, { method: 'DELETE' });
        setSaving(false);
        if (r.success) {
            toast(r.message || `${medName} removed for ${resName}.`);
            onSaved(log._id);
            onClose();
        } else {
            toast(r.message || 'Failed to delete medication.', 'error');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={{ ...hcModalStyle, maxWidth: 440 }}>
                <HCHeader icon={<FaTrashAlt />} title="Delete Medication" onClose={onClose} />
                <div style={hcBodyStyle}>
                    <p style={{ color: 'var(--d-muted)', fontSize: '.88rem', marginTop: 0 }}>
                        Are you sure you want to delete <strong>{medName}</strong> for <strong>{resName}</strong>?
                        This removes it from the schedule and medication history and cannot be undone.
                    </p>
                </div>
                <div style={hcFooter}>
                    <button onClick={onClose} type="button" disabled={saving} style={hcCancelBtn(saving)}>
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        type="button"
                        disabled={saving}
                        style={{ ...hcSaveBtn(saving), background: saving ? undefined : '#C0392B' }}
                    >
                        {saving ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: View Full Profile
// ════════════════════════════════════════════════════════════
const AssignCaregiverModal = ({ resident, caregivers, onClose, onSaved, doFetch, toast, fetchCaregivers }) => {
    const currentCaregiverId = typeof resident.primaryCaregiverId === 'object'
        ? resident.primaryCaregiverId?._id
        : resident.primaryCaregiverId;
    const [caregiverId, setCaregiverId] = useState(currentCaregiverId || '');
    const [saving, setSaving] = useState(false);
    const residentName = resident.name || [resident.firstName, resident.lastName].filter(Boolean).join(' ') || 'Resident';
    const availableCaregivers = caregivers.filter(c => String(c.role || '').toLowerCase() === 'caregiver');

    useEffect(() => {
        if (fetchCaregivers) fetchCaregivers();
    }, [fetchCaregivers]);

    const submit = async () => {
        if (!caregiverId) {
            toast('Please select a caregiver.', 'error');
            return;
        }

        setSaving(true);
        const r = await doFetch(`/head-caregiver/residents/${resident._id}/assign-caregiver`, {
            method: 'PUT',
            body: JSON.stringify({ caregiverId })
        });
        setSaving(false);

        if (r.success) {
            onSaved(r.data);
            toast(r.message || `Caregiver assigned to ${residentName}.`);
            onClose();
        } else {
            toast(r.message || 'Failed to assign caregiver.', 'error');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={hcModalStyle}>
                <HCHeader icon={<FaUserMd />} title={`Assign Caregiver - ${residentName}`} onClose={onClose} />
                <div style={hcBodyStyle}>
                    <HCField label="Current Caregiver">
                        <input
                            style={hcInputStyle(false)}
                            value={resident.primaryCaregiverName || resident.primaryCaregiver || 'Unassigned'}
                            disabled
                        />
                    </HCField>
                    <HCField label="Caregiver" required
                        hint={availableCaregivers.length === 0 ? 'No caregiver accounts found. Add a caregiver in admin first.' : undefined}>
                        <select style={hcInputStyle(false)} value={caregiverId} onChange={e => setCaregiverId(e.target.value)}>
                            <option value="">Select a caregiver</option>
                            {availableCaregivers.map(c => (
                                <option key={c._id} value={c._id}>
                                    {c.firstName} {c.lastName} ({c.staffId || 'Caregiver'})
                                </option>
                            ))}
                        </select>
                    </HCField>
                </div>
                <div style={hcFooter}>
                    <button onClick={onClose} type="button" disabled={saving} style={hcCancelBtn(saving)}>Cancel</button>
                    <button
                        onClick={submit}
                        type="button"
                        disabled={saving || !caregiverId || availableCaregivers.length === 0}
                        style={hcSaveBtn(saving || !caregiverId || availableCaregivers.length === 0)}
                    >
                        {saving ? 'Saving…' : 'Assign Caregiver'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProfileModal = ({ resident, schedule, onClose }) => {
    const resName = resident.name || [resident.firstName, resident.lastName].filter(Boolean).join(' ') || 'Resident';
    const todayMeds = (schedule || []).filter(l =>
        l.residentName === resName || l.residentId?.toString() === resident._id?.toString()
    );

    const InfoRow = ({ label, value }) => value ? (
        <div className="profile-info-row">
            <span className="profile-info-label">{label}</span>
            <span className="profile-info-value">{value}</span>
        </div>
    ) : null;

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={hcModalStyle}>
                <HCHeader icon={<FaUserCircle />} title={`Resident Profile — ${resName}`} onClose={onClose} />
                <div style={{ ...hcBodyStyle, padding: 0 }}>
                    <div className="profile-header-card">
                        <div className="profile-avatar"><FaUserCircle /></div>
                        <div className="profile-header-info">
                            <h3 className="profile-full-name">{resName}</h3>
                            {resident.nickname && (
                                <div className="profile-nickname">aka "{resident.nickname}"</div>
                            )}
                            <div className="profile-header-meta">
                                <span>Age: {resident.age || '—'}</span>
                                <span>·</span>
                                <span>{resident.gender ? resident.gender.charAt(0).toUpperCase() + resident.gender.slice(1) : '—'}</span>
                                <span>·</span>
                                <span>Room {resident.room || '—'}</span>
                            </div>
                            <Badge s={resident.alertLevel || 'stable'} />
                        </div>
                    </div>

                    <div className="profile-grid">
                        <div className="profile-section">
                            <div className="profile-section-title">Personal Information</div>
                            <InfoRow label="First Name" value={resident.firstName} />
                            <InfoRow label="Middle Name" value={resident.middleName} />
                            <InfoRow label="Last Name" value={resident.lastName} />
                            <InfoRow label="Nickname" value={resident.nickname} />
                            <InfoRow label="Age" value={resident.age} />
                            <InfoRow label="Gender" value={resident.gender} />
                            <InfoRow label="Admission Date" value={resident.admissionDate ? new Date(resident.admissionDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
                        </div>

                        <div className="profile-section">
                            <div className="profile-section-title">Room Assignment</div>
                            <InfoRow label="Room Number" value={resident.room} />
                            <InfoRow label="Floor / Ward" value={resident.floor} />
                            <InfoRow label="Bed" value={resident.bed} />
                            <InfoRow label="Alert Level" value={resident.alertLevel ? resident.alertLevel.charAt(0).toUpperCase() + resident.alertLevel.slice(1) : null} />
                        </div>

                        <div className="profile-section profile-section-full">
                            <div className="profile-section-title">Medical Conditions</div>
                            {resident.conditions?.length > 0 ? (
                                <div className="conditions-wrap" style={{ marginTop: 6 }}>
                                    {resident.conditions.map((c, i) => (
                                        <span key={i} className="condition-tag">{c?.name || c}</span>
                                    ))}
                                </div>
                            ) : (
                                <span className="profile-info-value" style={{ color: 'var(--d-muted)', fontStyle: 'italic' }}>No conditions recorded.</span>
                            )}
                        </div>

                        <div className="profile-section profile-section-full">
                            <div className="profile-section-title">Assigned Personnel</div>
                            <InfoRow label="Primary Caregiver" value={resident.primaryCaregiverName || resident.primaryCaregiver || '—'} />
                        </div>
                    </div>

                    <div className="profile-meds-section">
                        <div className="profile-section-title" style={{ marginTop: 16, marginBottom: 10 }}>Today's Medication Schedule</div>
                        {todayMeds.length === 0 ? (
                            <p style={{ color: 'var(--d-muted)', fontStyle: 'italic', fontSize: '.88rem', margin: 0 }}>No medications scheduled today.</p>
                        ) : (
                            <div className="table-scroll">
                                <table className="custom-table">
                                    <thead>
                                        <tr><th>Time</th><th>Medication</th><th>Dosage</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {todayMeds.map(m => (
                                            <tr key={m._id}>
                                                <td>{m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                                <td><strong>{m.medicationName || '—'}</strong></td>
                                                <td>{m.dosage || '—'}</td>
                                                <td><Badge s={m.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ ...hcFooter, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} type="button" style={{ ...hcCancelBtn(false), flex: '0 1 140px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Medication History
// ════════════════════════════════════════════════════════════
const HistoryModal = ({ resident, onClose, doFetch }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            const r = await doFetch(`/head-caregiver/residents/${resident._id}/medication-history`);
            setLogs(r.success ? (r.data || []) : []);
            setLoading(false);
        })();
    }, [resident._id, doFetch]);

    const resName = resident.name || [resident.firstName, resident.lastName].filter(Boolean).join(' ') || 'Resident';

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={hcModalStyle}>
                <HCHeader icon={<FaEye />} title={`Medication History — ${resName}`} onClose={onClose} />
                <div style={hcBodyStyle}>
                    {loading ? <div className="no-data-center"><FaSpinner className="spin" /> Loading…</div>
                        : logs.length === 0 ? <div className="no-data-center">No medication history found.</div>
                            : <div className="history-scroll">
                                <table className="custom-table">
                                    <thead><tr><th>Date &amp; Time</th><th>Medication</th><th>Dosage</th><th>Status</th><th>Notes</th></tr></thead>
                                    <tbody>
                                        {logs.map(l => (
                                            <tr key={l._id}>
                                                <td>{l.scheduledTime ? new Date(l.scheduledTime).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                                <td><strong>{l.medicationName || '—'}</strong></td>
                                                <td>{l.dosage || '—'}</td>
                                                <td><Badge s={l.status} /></td>
                                                <td className="td-muted">{l.notes || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>}
                </div>
                <div style={{ ...hcFooter, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} type="button" style={{ ...hcCancelBtn(false), flex: '0 1 140px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Add Medication to Schedule
// ════════════════════════════════════════════════════════════
const AddScheduleModal = ({ residents, medications, onClose, onSaved, doFetch, toast, defaultResident }) => {
    const [f, setF] = useState({ residentId: defaultResident?._id || '', medicationId: '', scheduledTime: '', dosageAmount: '', dosageUnit: '', notes: '' });
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);
    const setField = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrs(p => ({ ...p, [k]: '' })); };

    const pickMedication = (medicationId) => {
        const med = medications.find(m => m._id === medicationId);
        setF(p => ({ ...p, medicationId, dosageUnit: guessDosageUnit(med?.form) || p.dosageUnit }));
        setErrs(p => ({ ...p, medicationId: '' }));
    };

    const submit = async () => {
        const e = {};
        if (!f.residentId) e.residentId = 'Select a resident';
        if (!f.medicationId) e.medicationId = 'Select a medication';
        if (!f.scheduledTime) e.scheduledTime = 'Select date & time';
        if (f.scheduledTime && new Date(f.scheduledTime) < new Date(Date.now() - 60000)) {
            e.scheduledTime = 'Scheduled time cannot be in the past.';
        }
        // Dosage Override is required
        if (!f.dosageAmount) e.dosageAmount = 'Enter an amount';
        if (!f.dosageUnit) e.dosageUnit = 'Select a unit';
        if (Object.keys(e).length) { setErrs(e); return; }
        setSaving(true);
        const payload = {
            ...f,
            dosageAmount: f.dosageAmount ? Number(f.dosageAmount) : undefined,
            dosageUnit: f.dosageUnit || undefined,
            // Combined string kept for backward compatibility with tables/views
            // that still read a single `dosage` field (e.g. "1 Tablet").
            dosage: f.dosageAmount && f.dosageUnit ? `${f.dosageAmount} ${f.dosageUnit}` : ''
        };
        const r = await doFetch('/head-caregiver/schedule', { method: 'POST', body: JSON.stringify(payload) });
        setSaving(false);
        if (r.success) { toast('Medication scheduled.'); onSaved(r.data); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={{ ...hcModalStyle, maxWidth: 660 }}>
                <HCHeader icon={<FaPlus />} title="Add Medication to Schedule" onClose={onClose} />
                <div style={hcBodyStyle}>
                    <HCField label="Resident" required error={errs.residentId}>
                        <select style={hcInputStyle(errs.residentId)} value={f.residentId} onChange={e => setField('residentId', e.target.value)}>
                            <option value="">Select resident…</option>
                            {residents.map(r => {
                                const displayName = r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim();
                                return <option key={r._id} value={r._id}>{displayName} — Room {r.room || '?'}</option>;
                            })}
                        </select>
                    </HCField>
                    <HCField label="Medication" required error={errs.medicationId}>
                        <select style={hcInputStyle(errs.medicationId)} value={f.medicationId} onChange={e => pickMedication(e.target.value)}>
                            <option value="">Select medication…</option>
                            {medications.map(m => <option key={m._id} value={m._id}>{m.name} {m.dosage?.value ? `${m.dosage.value}${m.dosage.unit}` : ''}</option>)}
                        </select>
                    </HCField>
                    <div style={hcGrid2}>
                        <HCField label="Scheduled Date & Time" required error={errs.scheduledTime}>
                            <input type="datetime-local" style={hcInputStyle(errs.scheduledTime)} value={f.scheduledTime} onChange={e => setField('scheduledTime', e.target.value)} />
                        </HCField>
                        <HCField label="Dosage Override" required error={errs.dosageAmount || errs.dosageUnit}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="any"
                                    style={{ ...hcInputStyle(errs.dosageAmount), flex: '0 0 35%' }}
                                    value={f.dosageAmount}
                                    onChange={e => setField('dosageAmount', e.target.value)}
                                    placeholder="1" />
                                <div
                                    title="Detected automatically from the selected medication's form — not editable"
                                    style={{
                                        ...hcInputStyle(errs.dosageUnit),
                                        flex: '1 1 65%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        background: '#F0EAE4',
                                        color: f.dosageUnit ? '#1A0A00' : '#A38070',
                                        cursor: 'not-allowed',
                                    }}>
                                    {f.dosageUnit || (f.medicationId ? 'Form not recognized — contact admin' : 'Select a medication first')}
                                </div>
                            </div>
                        </HCField>
                    </div>
                    <HCField label="Notes" style={{ marginBottom: 6 }}>
                        <textarea rows={3} maxLength="500" style={{ ...hcInputStyle(false), resize: 'vertical', minHeight: 70 }} value={f.notes} onChange={e => setField('notes', e.target.value)} placeholder="Special instructions…" />
                    </HCField>
                </div>
                <div style={hcFooter}>
                    <button onClick={onClose} type="button" disabled={saving} style={hcCancelBtn(saving)}>
                        Cancel
                    </button>
                    <button onClick={submit} type="button" disabled={saving} style={hcSaveBtn(saving)}>
                        {saving ? 'Saving…' : '✓ Schedule Medication'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Edit Schedule
// ════════════════════════════════════════════════════════════
const EditScheduleModal = ({ log, onClose, onSaved, doFetch, toast }) => {
    const dt = log.scheduledTime ? new Date(log.scheduledTime).toISOString().slice(0, 16) : '';
    const [f, setF] = useState({ scheduledTime: dt, dosage: log.dosage || '', notes: log.notes || '' });
    const [saving, setSaving] = useState(false);
    const [editErr, setEditErr] = useState('');
    const setField = (k, v) => setF(p => ({ ...p, [k]: v }));

    const submit = async () => {
        setEditErr('');
        if (!f.scheduledTime) { setEditErr('Scheduled date & time is required.'); return; }
        if (!f.dosage.trim()) { setEditErr('Dosage is required.'); return; }
        setSaving(true);
        const r = await doFetch(`/head-caregiver/schedule/${log._id}`, { method: 'PUT', body: JSON.stringify(f) });
        setSaving(false);
        if (r.success) { toast('Schedule updated.'); onSaved(r.data); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={hcModalStyle}>
                <HCHeader icon={<FaEdit />} title="Edit Schedule" onClose={onClose} />
                <div style={hcBodyStyle}>
                    {editErr && (<div className="validation-banner"><FaExclamationTriangle /> {editErr}</div>)}
                    <div className="edit-sched-info"><strong>{log.residentName}</strong> — {log.medicationName}</div>
                    <HCField label="Scheduled Date & Time">
                        <input type="datetime-local" style={hcInputStyle(false)} value={f.scheduledTime} onChange={e => setField('scheduledTime', e.target.value)} />
                    </HCField>
                    <HCField label="Dosage">
                        <input style={hcInputStyle(false)} value={f.dosage} onChange={e => setField('dosage', e.target.value)} placeholder="e.g. 1 tablet" />
                    </HCField>
                    <HCField label="Notes">
                        <textarea rows={3} maxLength="500" style={{ ...hcInputStyle(false), minHeight: 70, resize: 'vertical' }} value={f.notes} onChange={e => setField('notes', e.target.value)} />
                    </HCField>
                </div>
                <div style={hcFooter}>
                    <button onClick={onClose} type="button" disabled={saving} style={hcCancelBtn(saving)}>Cancel</button>
                    <button onClick={submit} type="button" disabled={saving} style={hcSaveBtn(saving)}>
                        {saving ? 'Saving…' : '✓ Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Request Stock
// ════════════════════════════════════════════════════════════
const RequestStockModal = ({ items, onClose, doFetch, toast }) => {
    const [f, setF] = useState({ itemId: '', itemName: '', quantity: '', reason: '' });
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);
    const setField = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrs(p => ({ ...p, [k]: '' })); };

    const pickItem = id => { const found = items.find(i => i._id === id); setF(p => ({ ...p, itemId: id, itemName: found?.name || '' })); };

    const submit = async () => {
        const e = {};
        if (!f.itemName.trim()) e.itemName = 'Select or enter item';
        if (!f.quantity || +f.quantity < 1) e.quantity = 'Enter valid quantity';
        if (Object.keys(e).length) { setErrs(e); return; }
        setSaving(true);
        const r = await doFetch('/head-caregiver/inventory/request', { method: 'POST', body: JSON.stringify(f) });
        setSaving(false);
        if (r.success) { toast('Stock request submitted.'); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal" style={hcModalStyle}>
                <HCHeader icon={<FaBoxOpen />} title="Request Stock Replenishment" onClose={onClose} />
                <div style={hcBodyStyle}>
                    <HCField label="Select Item" error={errs.itemName}>
                        <select style={hcInputStyle(errs.itemName)} value={f.itemId} onChange={e => pickItem(e.target.value)}>
                            <option value="">Choose from inventory…</option>
                            {items.map(i => <option key={i._id} value={i._id}>{i.name} (Current: {i.quantity} {i.unit})</option>)}
                        </select>
                    </HCField>
                    <HCField label="Item Name (manual if not in list)">
                        <input style={hcInputStyle(errs.itemName)} value={f.itemName} onChange={e => setField('itemName', e.target.value)} placeholder="e.g. Paracetamol 500mg" />
                    </HCField>
                    <HCField label="Quantity Needed" required error={errs.quantity}>
                        <input type="number" min="1" style={hcInputStyle(errs.quantity)} value={f.quantity} onChange={e => setField('quantity', e.target.value)} />
                    </HCField>
                    <HCField label="Reason / Notes" style={{ marginBottom: 6 }}>
                        <textarea rows={3} style={{ ...hcInputStyle(false), resize: 'vertical', minHeight: 70 }} value={f.reason} onChange={e => setField('reason', e.target.value)} placeholder="Why is this stock needed?" />
                    </HCField>
                </div>
                <div style={hcFooter}>
                    <button onClick={onClose} type="button" disabled={saving} style={hcCancelBtn(saving)}>
                        Cancel
                    </button>
                    <button onClick={submit} type="button" disabled={saving} style={hcSaveBtn(saving)}>
                        {saving ? 'Saving…' : '✓ Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  ACTION DROPDOWN (⋮) - UPDATED to icon-only buttons
// ════════════════════════════════════════════════════════════
const ActionMenu = ({ onViewHistory, onAddMedication, onEditSchedule, onDelete }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} className="action-menu-wrapper">
            <button className="action-menu-trigger" onClick={() => setOpen(o => !o)}><FaEllipsisV /></button>
            {open && (
                <div className="action-menu-dropdown">
                    <button className="action-menu-item" onClick={() => { onViewHistory?.(); setOpen(false); }}>
                        <FaEye /> View History
                    </button>
                    <button className="action-menu-item" onClick={() => { onAddMedication?.(); setOpen(false); }}>
                        <FaPlus /> Add Medication
                    </button>
                    <button className="action-menu-item" onClick={() => { onEditSchedule?.(); setOpen(false); }}>
                        <FaEdit /> Edit Schedule
                    </button>
                    {onDelete && (
                        <button className="action-menu-item action-menu-item-danger" onClick={() => { onDelete(); setOpen(false); }}>
                            <FaTrashAlt /> Delete Medication
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ════════════════════════════════════════════════════════════
const HeadCaregiverDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const doFetch = useFetch();

    // Support deep-linking into a specific tab, e.g. navigate('/head-caregiver', { state: { section: 'residents' } })
    // from Help Center's Quick Navigation cards.
    const [activeSection, setSection] = useState(location.state?.section || 'home');
    const [searchQuery, setSearch] = useState('');
    const [accountMenuOpen, setAcctMenu] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [filterStatus, setFStatus] = useState('All');
    const [filterResident, setFRes] = useState('All');
    const [filterCaregiver, setFCaregiver] = useState('All');
    const [sortTime, setSort] = useState('Asc');
    const [resSort, setResSort] = useState('AZ');
    const [resFloor, setResFloor] = useState('All');
    const [resRoom, setResRoom] = useState('All');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [residents, setResidents] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [medications, setMedications] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [stats, setStats] = useState({
        total: 0, onTime: 0, delayed: 0, missed: 0,
        pending: 0, overdue: 0, complianceRate: 0,
        lowMedStock: 0, totalResidents: 0
    });

    const [modal, setModal] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [resPage, setResPage] = useState(1);
    const [schedPage, setSchedPage] = useState(1);
    const [activeMedsPage, setActiveMedsPage] = useState(1);
    const [invPage, setInvPage] = useState(1);
    const PER = 5; // rows per page, applied to every paginated table

    const shiftLabel = {
        morning: 'Morning (6AM–2PM)',
        afternoon: 'Afternoon (2PM–10PM)',
        night: 'Night (10PM–6AM)',
        flexible: 'Flexible',
        rotating: 'Rotating'
    }[user?.shift] || 'Morning (6AM–2PM)';

    const toast = useCallback((msg, type = 'success') => {
        const id = Date.now();
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
    }, []);

    const fetchCaregivers = useCallback(async () => {
        const r = await doFetch('/head-caregiver/caregivers');
        if (r.success) {
            const caregiverList = r.data || [];
            if (caregiverList.length > 0) {
                setCaregivers(caregiverList);
                return;
            }
        }

        const staffR = await doFetch('/admin/staff');
        if (staffR.success) {
            const staff = staffR.staff || staffR.data || [];
            setCaregivers(staff
                .filter(member =>
                    String(member.role || '').toLowerCase() === 'caregiver' &&
                    !['terminated', 'deactivated'].includes(String(member.status || '').toLowerCase())
                )
                .map(member => ({
                    _id: member._id,
                    name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
                    firstName: member.firstName || '',
                    lastName: member.lastName || '',
                    role: member.role,
                    email: member.email,
                    staffId: member.staffId,
                    status: member.status
                })));
        }
    }, [doFetch]);

    const loadAll = useCallback(async () => {
        const [resR, schR, medR, invR, stR] = await Promise.all([
            doFetch('/head-caregiver/residents'),
            doFetch('/head-caregiver/schedule'),
            doFetch('/head-caregiver/medications'),
            doFetch('/head-caregiver/inventory'),
            doFetch('/head-caregiver/stats'),
        ]);
        if (resR.success) setResidents(resR.data || []);
        if (schR.success) setSchedule(schR.data || []);
        if (medR.success) setMedications(medR.data || []);
        if (invR.success) setInventory(invR.data || []);
        if (stR.success) setStats(s => ({ ...s, ...stR.data }));
        await fetchCaregivers();
    }, [doFetch, fetchCaregivers]);

    // The summary cards (Total Meds/On Time/Delayed/Missed/Pending) are server-
    // computed, so any local edit to `schedule` (add/edit/delete/mark status)
    // needs this too, or the cards silently drift out of sync with the list.
    const refreshStats = useCallback(async () => {
        const r = await doFetch('/head-caregiver/stats');
        if (r.success) setStats(s => ({ ...s, ...r.data }));
    }, [doFetch]);

    useEffect(() => {
        (async () => { setLoading(true); await loadAll(); setLoading(false); })();
    }, [loadAll]);

    // Real-time sync: any resident create/update/discharge/assign-caregiver
    // (from this session, another admin, or the mobile app) refreshes the
    // residents list and stats immediately instead of requiring a manual reload.
    const { on, off } = useSocket();
    useEffect(() => {
        const handleResidentsUpdated = () => { loadAll(); };
        on('residentsUpdated', handleResidentsUpdated);
        return () => off('residentsUpdated', handleResidentsUpdated);
    }, [on, off, loadAll]);

    useEffect(() => {
        setResPage(1);
        setSchedPage(1);
        setActiveMedsPage(1);
        setInvPage(1);
    }, [searchQuery, filterStatus, filterResident, filterCaregiver, activeSection, resFloor, resRoom, resSort]);

    // Re-apply a deep-linked section if we navigate here again while already mounted
    // (e.g. clicking a Help Center Quick Navigation card while already on /head-caregiver).
    useEffect(() => {
        if (location.state?.section) {
            setSection(location.state.section);
            // Clear the state so a manual refresh doesn't keep forcing this tab.
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state?.section]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    };

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const handleLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => { logout(); navigate('/'); };

    const markStatus = async (id, status, method = 'manual') => {
        const log = schedule.find(l => l._id === id);
        const resName = log?.residentName || 'this resident';
        const medName = log?.medicationName || 'this medication';

        const actionLabels = {
            completed: { msg: `Confirm: Mark ${medName} as administered for ${resName}?` },
            administered: { msg: `Confirm: Mark ${medName} as administered for ${resName}?` },
            missed: { msg: `Mark ${medName} as MISSED for ${resName}? This cannot be undone.` },
            skipped: { msg: `Mark ${medName} as skipped for ${resName}?` },
        };

        if (actionLabels[status]) {
            const confirmed = window.confirm(actionLabels[status].msg);
            if (!confirmed) return;
        }

        const r = await doFetch(`/head-caregiver/schedule/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, verificationMethod: method })
        });

        if (r.success) {
            setSchedule(prev => prev.map(l => l._id === id ? {
                ...l,
                status,
                ...(status === 'completed' || status === 'administered' ? { administeredTime: new Date().toISOString() } : {})
            } : l));
            refreshStats();
            toast(`${medName} marked as ${status} for ${resName}.`);
        } else {
            toast(r.message || 'Update failed.', 'error');
        }
    };

    const filteredSched = useMemo(() => {
        const q = searchQuery.toLowerCase();
        let arr = schedule.filter(l => {
            const mQ = !q || l.residentName?.toLowerCase().includes(q) || l.medicationName?.toLowerCase().includes(q) || l.room?.toLowerCase().includes(q);
            const mSt = filterStatus === 'All' || l.status === filterStatus.toLowerCase();
            const mR = filterResident === 'All' || l.residentName === filterResident;
            const mC = filterCaregiver === 'All' || String(l.caregiverId || '') === filterCaregiver;
            return mQ && mSt && mR && mC;
        });
        return [...arr].sort((a, b) => {
            const ta = new Date(a.scheduledTime || a.createdAt).getTime();
            const tb = new Date(b.scheduledTime || b.createdAt).getTime();
            return sortTime === 'Asc' ? ta - tb : tb - ta;
        });
    }, [schedule, searchQuery, filterStatus, filterResident, filterCaregiver, sortTime]);

    const filteredRes = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let arr = residents.filter(r => {
            if (!q) return true;
            const name = (r.name || `${r.firstName || ''} ${r.lastName || ''}`).toLowerCase();
            const nickname = (r.nickname || '').toLowerCase();
            const room = (r.room || '').toLowerCase();
            const condMatch = (r.conditions || []).some(c =>
                (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes(q)
            );
            return name.includes(q) || nickname.includes(q) || room.includes(q) || condMatch;
        });
        if (filterStatus !== 'All') {
            arr = arr.filter(r => (r.alertLevel || 'stable').toLowerCase() === filterStatus.toLowerCase());
        }
        if (filterCaregiver !== 'All') {
            arr = arr.filter(r => String(r.primaryCaregiverId?._id || r.primaryCaregiverId || '') === filterCaregiver);
        }
        if (resFloor !== 'All') {
            arr = arr.filter(r => r.floor === resFloor);
            if (resRoom !== 'All') {
                arr = arr.filter(r => (r.room || '') === resRoom);
            }
        }
        arr = [...arr].sort((a, b) => {
            const an = (a.name || `${a.firstName || ''} ${a.lastName || ''}`).trim().toLowerCase();
            const bn = (b.name || `${b.firstName || ''} ${b.lastName || ''}`).trim().toLowerCase();
            return resSort === 'AZ' ? an.localeCompare(bn) : bn.localeCompare(an);
        });
        return arr;
    }, [residents, searchQuery, filterStatus, filterCaregiver, resFloor, resRoom, resSort]);

    const residentNames = useMemo(() => ['All', ...new Set(schedule.map(l => l.residentName).filter(Boolean))], [schedule]);

    const groupedByResident = useMemo(() => {
        const g = {};
        schedule.forEach(l => {
            const key = l.residentName || 'Unknown';
            if (!g[key]) g[key] = { name: key, room: l.room, floor: l.floor, residentId: l.residentId, meds: [] };
            g[key].meds.push(l);
        });
        return Object.values(g);
    }, [schedule]);

    const filteredGroupedByResident = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return groupedByResident;
        return groupedByResident
            .map(grp => ({
                ...grp,
                meds: grp.meds.filter(m =>
                    grp.name?.toLowerCase().includes(q) ||
                    m.medicationName?.toLowerCase().includes(q) ||
                    grp.room?.toLowerCase().includes(q)
                )
            }))
            .filter(grp => grp.meds.length > 0);
    }, [groupedByResident, searchQuery]);

    const filteredInventory = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return inventory;
        return inventory.filter(item => item.name?.toLowerCase().includes(q));
    }, [inventory, searchQuery]);

    const getMinutesSince = iso => iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60000) : null;

    const SchedActionBtn = ({ item }) => {
        if (item.status === 'overdue')
            return <button className="sched-btn-verify" onClick={() => markStatus(item._id, 'completed', 'manual')}>Verify Now</button>;
        if (item.status === 'scheduled' || item.status === 'upcoming')
            return <button className="sched-btn-prepare" onClick={() => markStatus(item._id, 'pending', 'manual')}>Prepare</button>;
        if (item.status === 'pending')
            return <button className="sched-btn-view" disabled style={{ opacity: 0.7 }}>Prepared — Awaiting Caregiver</button>;
        if (item.status === 'completed' || item.status === 'administered')
            return <button className="sched-btn-view" onClick={() => setModal({ type: 'history', data: residents.find(r => r.name === item.residentName) || { _id: item.residentId, name: item.residentName } })}>View</button>;
        return <button className="btn-success-sm sched-btn-administer" onClick={() => markStatus(item._id, 'completed')}>Administer</button>;
    };

    // ── SCREEN 1: HOME DASHBOARD ────────────────────────────────────────
    const renderHome = () => (
        <div>
            <div className="nurse-header">
                <h2>Home Dashboard</h2>
                <p className="last-login">
                    Welcome back, <strong>{user?.firstName} {user?.lastName}</strong> &nbsp;|&nbsp;
                    {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="badge-row">
                    <span className="nurse-info-pill">Shift: {shiftLabel}</span>
                    {user?.ward && <span className="nurse-info-pill">{user.ward}</span>}
                    <span className="nurse-info-pill on-duty">● On Duty</span>
                    <button className="btn-outline-sm ml-auto" onClick={handleRefresh} disabled={refreshing}>
                        <FaSync className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh Data'}
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="nurse-stat-row">
                {[
                    { label: 'Total Meds', val: stats.total, cls: '' },
                    { label: 'On Time', val: stats.onTime, cls: 'success' },
                    { label: 'Delayed', val: stats.delayed, cls: 'warn' },
                    { label: 'Missed', val: stats.missed, cls: 'danger' },
                    { label: 'Pending', val: stats.pending, cls: 'muted' },
                    { label: 'Residents', val: stats.totalResidents || residents.length, cls: '' },
                ].map(s => (
                    <div key={s.label} className={`nurse-stat-box ${s.cls}`}>
                        <strong>{s.val}</strong>
                        <span>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Compliance Rate */}
            <div className="card-white mb-18">
                <div className="compliance-text">
                    <span>Compliance Rate &nbsp;</span>
                    <strong className={`compliance-rate-value ${stats.complianceRate >= 90 ? 'excellent' : stats.complianceRate >= 70 ? 'good' : 'poor'}`}>
                        {stats.complianceRate}%
                        <span className="compliance-sub"> — {stats.complianceRate === 0 ? 'No data yet' : stats.complianceRate >= 90 ? 'Excellent' : stats.complianceRate >= 70 ? 'Good' : 'Needs Improvement'}</span>
                    </strong>
                </div>
                <div className="compliance-bar">
                    <div className="compliance-progress" style={{ width: `${stats.complianceRate}%` }} />
                </div>
            </div>

            <div className="home-top-grid">
                {/* Today's Schedule Preview */}
                <div className="card-white home-card">
                    <h6><FaClock style={{ marginRight: 7, color: 'var(--d-orange)' }} />Today's Schedule</h6>
                    {schedule.length === 0 ? (
                        <div className="no-data-center"><FaPills /> No medications scheduled today.</div>
                    ) : (
                        <div className="sched-list">
                            {schedule.slice(0, 3).map(item => {
                                const mins = item.status === 'overdue' ? getMinutesSince(item.scheduledTime) : null;
                                const timeStr = item.scheduledTime ? new Date(item.scheduledTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';
                                const done = item.status === 'completed' || item.status === 'administered';
                                return (
                                    <div key={item._id} className="sched-item">
                                        <span className={`sched-time ${done ? 'done' : item.status === 'overdue' ? 'overdue' : 'pending'}`}>{timeStr}</span>
                                        <div className="sched-body">
                                            <div className="sched-name">
                                                {done && <span className="done-check">✓</span>}
                                                {item.status === 'overdue' && <FaExclamationTriangle className="overdue-icon" />}
                                                {item.residentName || '—'}
                                            </div>
                                            <div className="sched-med">{item.medicationName} {item.dosage && `— ${item.dosage}`}</div>
                                            {item.status === 'overdue' && mins !== null && <div className="sched-overdue-tag">OVERDUE: {mins} min ago</div>}
                                        </div>
                                        <Badge s={item.status} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <button className="btn-primary-sm home-full-width-btn" onClick={() => setSection('medicines')}>View Full Schedule →</button>
                </div>

                {/* My Assigned Residents Preview */}
                <div className="card-white home-card">
                    <h6><FaUsers style={{ marginRight: 7, color: 'var(--d-orange)' }} />My Assigned Residents</h6>
                    {residents.length === 0 ? (
                        <div className="no-data-center">No assigned residents yet.</div>
                    ) : (
                        <div>
                            {residents.slice(0, 3).map((r, i) => (
                                <div key={i} className="resident-list-item">
                                    <div className="resident-list-name">
                                        {r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Unknown'}
                                        {r.nickname && <span className="nickname-tag">"{r.nickname}"</span>}
                                        {r.room && <span className="condition-tag" style={{ marginLeft: 6 }}>Room {r.room}</span>}
                                    </div>
                                    <div className="resident-list-meta">Age: {r.age || '—'} {r.conditions?.length > 0 && `· ${r.conditions.slice(0, 2).map(c => c?.name || c).join(', ')}`}</div>
                                    {r.medicationOverdue ? (
                                        <div className="resident-list-overdue"><FaExclamationCircle /> Medication Overdue</div>
                                    ) : (
                                        <div className="resident-list-nextmed">Next Med: {r.nextMed || '—'}</div>
                                    )}
                                </div>
                            ))}
                            {residents.length > 3 && <div className="list-more-label">+{residents.length - 3} more residents</div>}
                        </div>
                    )}
                    <button className="btn-primary-sm home-full-width-btn" onClick={() => setSection('residents')}>View All Residents →</button>
                </div>

                {/* Quick Actions */}
                <div className="card-white home-card">
                    <h6>Quick Actions</h6>
                    <div className="quick-actions-grid">
                        {[
                            { icon: <FaPlus />, label: 'Add Medication', action: () => setModal({ type: 'addSchedule' }) },
                            { icon: <FaUsers />, label: 'Add Resident', action: () => setModal({ type: 'addResident' }) },
                            { icon: <FaBoxOpen />, label: 'Request Stock', action: () => setModal({ type: 'requestStock' }) },
                            { icon: <FaFileAlt />, label: 'Med Reports', action: () => setSection('medicines') },
                            { icon: <FaSync />, label: 'Refresh Data', action: handleRefresh },
                        ].map((a, i) => (
                            <button key={i} className="quick-action-btn" onClick={a.action}>{a.icon} {a.label}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    // ── SCREEN 2: RESIDENTS MANAGEMENT (UPDATED with icon-only actions) ──
    const renderResidents = () => {
        const RES_PER = 10;
        const pages = Math.max(1, Math.ceil(filteredRes.length / RES_PER));
        const safeResPage = Math.min(resPage, pages);
        const paged = filteredRes.slice((safeResPage - 1) * RES_PER, safeResPage * RES_PER);

        // Helper to get resident's full name for display
        const getResidentName = (r) => {
            if (r.name) return r.name;
            const first = r.firstName || '';
            const last = r.lastName || '';
            const nickname = r.nickname ? ` "${r.nickname}"` : '';
            return `${first} ${last}`.trim() + nickname || 'Unnamed Resident';
        };

        return (
            <div>
                <div className="res-page-header">
                    <span className="res-page-label">MY ASSIGNED RESIDENTS ({residents.length})</span>
                    <div className="res-page-controls">
                        <select className="filter-select" value={filterStatus} onChange={e => setFStatus(e.target.value)}>
                            <option value="All">Filter: All</option>
                            <option value="alert">Alert</option>
                            <option value="stable">Stable</option>
                            <option value="critical">Critical</option>
                        </select>
                        <select className="filter-select" value={resSort} onChange={e => setResSort(e.target.value)}>
                            <option value="AZ">Sort: A–Z</option>
                            <option value="ZA">Sort: Z–A</option>
                        </select>
                        <select
                            className="filter-select"
                            value={resFloor}
                            onChange={e => { setResFloor(e.target.value); setResRoom('All'); }}>
                            <option value="All">Floor: All</option>
                            {FLOORS.map(fl => <option key={fl} value={fl}>{fl}</option>)}
                        </select>
                        <select
                            className="filter-select"
                            value={resRoom}
                            disabled={resFloor === 'All'}
                            title={resFloor === 'All' ? 'Select a floor first' : undefined}
                            style={resFloor === 'All' ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                            onChange={e => setResRoom(e.target.value)}>
                            <option value="All">Room: All</option>
                            {ROOM_NUMBERS.map(rn => <option key={rn} value={rn}>Room {rn}</option>)}
                        </select>
                        <select className="filter-select" value={filterCaregiver} onChange={e => setFCaregiver(e.target.value)}>
                            <option value="All">Caregiver: All</option>
                            {caregivers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                        <button className="btn-primary-sm" onClick={() => setModal({ type: 'addResident' })}><FaPlus /> Add Resident</button>
                    </div>
                </div>

                <div className="residents-table-scroll">
                    <div className="res-col-header">
                        <span>Room | Bed</span><span>Name / Age</span><span>Conditions</span><span>Status</span><span>Today's Medication</span><span>Actions</span>
                    </div>

                    {paged.length === 0 ? (
                        <div className="res-row-empty">{searchQuery ? `No residents match "${searchQuery}".` : 'No residents yet.'}</div>
                    ) : (
                        paged.map((r, i) => {
                        const isLast = i === paged.length - 1;
                        const todayMeds = schedule.filter(l =>
                            l.residentName === getResidentName(r) ||
                            l.residentId?.toString() === r._id?.toString()
                        );
                        const displayName = getResidentName(r);
                        return (
                            <div key={r._id || i} className={`res-row${r.medicationOverdue ? ' overdue-row' : ''}${isLast ? ' last-row' : ''}`}>
                                <div className="res-row-grid">
                                    <div className="res-room">
                                        {r.room || '—'} | {r.bed || '—'}
                                        <br /><small style={{ fontSize: '.72rem', color: 'var(--d-muted)' }}>{r.floor || ''}</small>
                                    </div>
                                    <div className="res-name-block">
                                        <div className="name">{displayName}</div>
                                        <div className="age">Age: {r.age || '—'} &nbsp;·&nbsp; {r.gender || ''}</div>
                                        <div className="primary">Caregiver: <span>{r.primaryCaregiverName || r.primaryCaregiver || 'Unassigned'}</span></div>
                                    </div>
                                    <div className="conditions-wrap">
                                        {r.conditions?.length > 0
                                            ? r.conditions.map((c, ci) => <span key={ci} className="condition-tag">{c?.name || c}</span>)
                                            : <span className="no-conditions">—</span>}
                                    </div>
                                    <div><Badge s={r.medicationOverdue ? 'overdue' : r.alertLevel || 'stable'} /></div>
                                    <div className="res-meds-cell">
                                        {todayMeds.length === 0 ? (
                                            <span className="res-no-meds">No meds today</span>
                                        ) : (
                                            todayMeds.slice(0, 3).map((m, mi) => (
                                                <div key={mi} className={`res-med-item ${m.status === 'completed' || m.status === 'administered' ? 'done' : 'active'}`}>
                                                    {m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'} — {m.medicationName}
                                                    {(m.status === 'completed' || m.status === 'administered') && <span className="res-med-done">✓</span>}
                                                    {m.status === 'pending' && <span className="res-med-pend">Pending</span>}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="res-action-icons">
                                        <div className="res-action-icons-group">
                                            <button
                                                className="res-action-icon"
                                                onClick={() => setModal({type:'profile',data:r})}
                                                title="View Profile"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                className="res-action-icon"
                                                onClick={() => setModal({type:'history',data:r})}
                                                title="Medication History"
                                            >
                                                <FaPills />
                                            </button>
                                            <button
                                                className="res-action-icon"
                                                onClick={() => setModal({type:'assignCaregiver',data:r})}
                                                title="Assign Caregiver"
                                            >
                                                <FaUserMd />
                                            </button>
                                            <button
                                                className="res-action-icon"
                                                onClick={() => setModal({type:'editResident',data:r})}
                                                title="Edit Resident"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                className="res-action-icon res-action-icon-danger"
                                                onClick={() => setModal({type:'discharge',data:r})}
                                                title="Remove Resident"
                                                style={{ color: '#C0392B' }}
                                            >
                                                <FaUserMinus />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {r.medicationOverdue && (
                                    <div className="res-overdue-alert">
                                        <FaExclamationCircle /> Medication Overdue ({getMinutesSince(r.overdueAt) || '—'} mins) — {r.overdueMed || ''}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                </div>

                {pages > 1 && (
                    <div className="res-page-footer">
                        <span className="res-page-label">Showing {(safeResPage - 1) * RES_PER + 1}–{Math.min(safeResPage * RES_PER, filteredRes.length)} of {filteredRes.length}</span>
                        <div className="res-pagination">
                            <button
                                className="page-num-btn"
                                disabled={safeResPage === 1}
                                onClick={() => setResPage(p => Math.max(1, p - 1))}
                            >‹</button>
                            {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                                <button key={n} className={`page-num-btn${safeResPage === n ? ' active' : ''}`} onClick={() => setResPage(n)}>{n}</button>
                            ))}
                            <button
                                className="page-num-btn"
                                disabled={safeResPage === pages}
                                onClick={() => setResPage(p => Math.min(pages, p + 1))}
                            >›</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── SCREEN 3: MEDICATION MANAGEMENT ─────────────────────────────────
    const renderMedicines = () => {
        const schedPages = Math.max(1, Math.ceil(filteredSched.length / PER));
        const safeSchedPage = Math.min(schedPage, schedPages);
        const pagedSched = filteredSched.slice((safeSchedPage - 1) * PER, safeSchedPage * PER);

        const activeMedsPages = Math.max(1, Math.ceil(filteredGroupedByResident.length / PER));
        const safeActiveMedsPage = Math.min(activeMedsPage, activeMedsPages);
        const pagedActiveMeds = filteredGroupedByResident.slice((safeActiveMedsPage - 1) * PER, safeActiveMedsPage * PER);

        const invPages = Math.max(1, Math.ceil(filteredInventory.length / PER));
        const safeInvPage = Math.min(invPage, invPages);
        const pagedInventory = filteredInventory.slice((safeInvPage - 1) * PER, safeInvPage * PER);

        return (
            <div>
                <div className="med-pills-row">
                    <span className="nurse-info-pill">{user?.firstName} {user?.lastName}</span>
                    {user?.ward && <span className="nurse-info-pill">{user.ward}</span>}
                    <span className="nurse-info-pill">Shift: {shiftLabel.split(' ')[0]}</span>
                </div>

                {/* Filters + Action Row */}
                <div className="med-filters-row">
                    <span className="filters-label"><FaFilter /> Filters:</span>
                    <select className="filter-select" value={filterStatus} onChange={e => setFStatus(e.target.value)}>
                        <option value="All">Status: All</option>
                        <option value="overdue">Overdue</option>
                        <option value="scheduled">Upcoming</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="missed">Missed</option>
                    </select>
                    <select className="filter-select" value={filterResident} onChange={e => setFRes(e.target.value)}>
                        {residentNames.map(r => <option key={r} value={r}>{r === 'All' ? 'Residents: All' : r}</option>)}
                    </select>
                    <select className="filter-select" value={filterCaregiver} onChange={e => setFCaregiver(e.target.value)}>
                        <option value="All">Caregiver: All</option>
                        {caregivers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <select className="filter-select" value={sortTime} onChange={e => setSort(e.target.value)}>
                        <option value="Asc">Sort: Time ↑</option>
                        <option value="Desc">Sort: Time ↓</option>
                    </select>
                    <div className="med-action-btns">
                        <button className="btn-primary-sm" onClick={() => setModal({ type: 'addSchedule' })}><FaPlus /> Add Medication</button>
                    </div>
                </div>

                {/* Today's Medication Schedule Table */}
                <div className="card-white mb-18">
                    <div className="card-header"><h5><FaClock className="mr-8" />Today's Medication Schedule</h5></div>
                    <div className="table-scroll">
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>Status</th><th>Time</th><th>Resident</th>
                                    <th>Room</th><th>Medication</th><th>Dosage</th><th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedSched.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center no-data-italic">
                                        {searchQuery ? `No results for "${searchQuery}".` : 'No medication records found.'}
                                    </td></tr>
                                ) : (
                                    pagedSched.map(item => {
                                        const tStr = item.scheduledTime ? new Date(item.scheduledTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';
                                        const mins = item.status === 'overdue' ? getMinutesSince(item.scheduledTime) : null;
                                        return (
                                            <tr key={item._id}>
                                                <td><Badge s={item.status} /></td>
                                                <td className="sched-time-cell">
                                                    {tStr}
                                                    {mins !== null && <div className="sched-overdue-min">({mins} min ago)</div>}
                                                </td>
                                                <td><strong>{item.residentName || '—'}</strong></td>
                                                <td>{item.floor && `${item.floor},`} {item.room || '—'}</td>
                                                <td>
                                                    <strong className="td-sm">{item.medicationName || '—'}</strong>
                                                    {item.condition && <div className="sched-med-condition">For: {item.condition}</div>}
                                                </td>
                                                <td className="td-sm">{item.dosage || '—'}</td>
                                                <td><SchedActionBtn item={item} /></td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {schedPages > 1 && (
                        <div className="res-page-footer">
                            <span className="res-page-label">Showing {(safeSchedPage - 1) * PER + 1}–{Math.min(safeSchedPage * PER, filteredSched.length)} of {filteredSched.length}</span>
                            <div className="res-pagination">
                                {Array.from({ length: schedPages }, (_, i) => i + 1).map(n => (
                                    <button key={n} className={`page-num-btn${safeSchedPage === n ? ' active' : ''}`} onClick={() => setSchedPage(n)}>{n}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Active Medications by Resident */}
                <div className="card-white mb-18">
                    <div className="card-header"><h5>Active Medications by Resident</h5></div>
                    <div className="table-scroll">
                        <table className="custom-table">
                            <thead>
                                <tr><th>Resident</th><th>Medication</th><th>Dosage</th><th>Time</th><th>Next Dose</th><th>Status</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                {filteredGroupedByResident.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center no-data-italic">
                                        {searchQuery ? `No results for "${searchQuery}".` : 'No active medication records yet.'}
                                    </td></tr>
                                ) : (
                                    pagedActiveMeds.map(grp =>
                                        grp.meds.map((m, mi) => (
                                            <tr key={m._id}>
                                                {mi === 0 && (
                                                    <td rowSpan={grp.meds.length} className="active-med-resident-cell">
                                                        <div className="active-med-res-name">{grp.name}</div>
                                                        {grp.room && <div className="active-med-res-room">Room {grp.room}</div>}
                                                        {grp.meds.some(x => x.status === 'overdue') && <div className="active-med-overdue-tag">OVERDUE</div>}
                                                    </td>
                                                )}
                                                <td className="td-sm">{m.medicationName || '—'}</td>
                                                <td className="td-sm">{m.dosage || '—'}</td>
                                                <td className="td-xs td-nowrap">
                                                    {m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    {m.frequency && <div className="med-frequency">{m.frequency}</div>}
                                                </td>
                                                <td className="td-xs">{m.nextDose || '—'}</td>
                                                <td><DotBadge s={m.status} /></td>
                                                <td>
                                                    <ActionMenu
                                                        onViewHistory={() => setModal({ type: 'history', data: residents.find(r => r.name === grp.name) || { _id: m.residentId, name: grp.name } })}
                                                        onAddMedication={() => setModal({ type: 'addSchedule', data: { residentId: m.residentId } })}
                                                        onEditSchedule={() => setModal({ type: 'editSchedule', data: m })}
                                                        onDelete={() => setModal({ type: 'deleteMedication', data: m })}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                    {activeMedsPages > 1 && (
                        <div className="res-page-footer">
                            <span className="res-page-label">Showing {(safeActiveMedsPage - 1) * PER + 1}–{Math.min(safeActiveMedsPage * PER, filteredGroupedByResident.length)} of {filteredGroupedByResident.length} residents</span>
                            <div className="res-pagination">
                                {Array.from({ length: activeMedsPages }, (_, i) => i + 1).map(n => (
                                    <button key={n} className={`page-num-btn${safeActiveMedsPage === n ? ' active' : ''}`} onClick={() => setActiveMedsPage(n)}>{n}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Medication Inventory Status */}
                <div className="card-white mb-18">
                    <div className="card-header">
                        <h5>Medication Inventory Status</h5>
                        <button className="btn-primary-sm" onClick={() => setModal({ type: 'requestStock' })}>
                            <FaBoxOpen /> Request Stock
                        </button>
                    </div>
                    <div className="table-scroll">
                        <table className="custom-table">
                            <thead>
                                <tr><th>Medication</th><th>Ward / Cabinet</th><th>Stock Level</th><th>Expiry</th></tr>
                            </thead>
                            <tbody>
                                {filteredInventory.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center no-data-italic">
                                        {searchQuery ? `No results for "${searchQuery}".` : 'No inventory data available.'}
                                    </td></tr>
                                ) : (
                                    pagedInventory.map(item => {
                                        const daysLeft = item.expirationDate ? Math.ceil((new Date(item.expirationDate) - Date.now()) / 86400000) : null;
                                        const isOut = item.quantity === 0;
                                        const isLow = !isOut && item.quantity <= (item.minThreshold ?? 10);
                                        const isExp = daysLeft !== null && daysLeft <= 30;
                                        const stockTxt = isOut ? 'Out of Stock' : isLow ? `Low — ${item.quantity} ${item.unit}` : `${item.quantity} ${item.unit}`;
                                        const stockCls = isOut || (daysLeft !== null && daysLeft < 0) ? 'inv-stock-out' : isLow || isExp ? 'inv-stock-low' : 'inv-stock-ok';
                                        const expiryTxt = daysLeft === null ? '—' : daysLeft < 0 ? 'Expired' : `${daysLeft} days`;
                                        return (
                                            <tr key={item._id}>
                                                <td><strong>{item.name}</strong></td>
                                                <td className="inv-ward-cell">{user?.ward || '—'} Cabinet</td>
                                                <td className={stockCls}>{stockTxt}</td>
                                                <td className={daysLeft !== null && daysLeft <= 30 ? 'inv-stock-low' : ''}>{expiryTxt}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {invPages > 1 && (
                        <div className="res-page-footer">
                            <span className="res-page-label">Showing {(safeInvPage - 1) * PER + 1}–{Math.min(safeInvPage * PER, filteredInventory.length)} of {filteredInventory.length}</span>
                            <div className="res-pagination">
                                {Array.from({ length: invPages }, (_, i) => i + 1).map(n => (
                                    <button key={n} className={`page-num-btn${safeInvPage === n ? ' active' : ''}`} onClick={() => setInvPage(n)}>{n}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (loading) return <div className="nurse-loading"><FaSpinner className="spin" /> Loading dashboard…</div>;
        switch (activeSection) {
            case 'home': return renderHome();
            case 'residents': return renderResidents();
            case 'medicines': return renderMedicines();
            default: return renderHome();
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">

                <div className={`sidebar nurse-sidebar${mobileMenuOpen ? ' mobile-open' : ''}`}>
                    <div className="sidebar-header">
                        <div className="brand-section">
                            <img src={mainLogo} alt="Kanang-Alalay logo" className="logo-circle" />
                            <div className="brand-text"><h4>Kanang-Alalay</h4><h5>HEAD CAREGIVER</h5></div>
                        </div>
                    </div>
                    <ul className="sidebar-menu">
                        {[
                            { key: 'home', icon: <FaHome />, label: 'Home' },
                            { key: 'residents', icon: <FaUsers />, label: 'Residents' },
                            { key: 'medicines', icon: <FaPills />, label: 'Medicines', badge: stats.overdue },
                        ].map(({ key, icon, label, badge }) => (
                            <li key={key} className={activeSection === key ? 'active' : ''} onClick={() => { setSection(key); setMobileMenuOpen(false); }}>
                                {icon} {label}
                                {badge > 0 && <span className="sidebar-badge">{badge}</span>}
                            </li>
                        ))}
                    </ul>
                    <div className="sidebar-footer" onClick={handleLogout}><FaSignOutAlt /> <span>LOGOUT</span></div>
                </div>
                {mobileMenuOpen && <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />}

                <div className="main-content-wrapper">
                    <div className="admin-topbar nurse-topbar">
                        <div className="topbar-left">
                            <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(o => !o)} aria-label="Toggle menu">
                                <FaBars />
                            </button>
                            {activeSection !== 'home' && (
                                <div className="topbar-search-wrapper">
                                    <FaSearch className="topbar-search-icon" />
                                    <input type="text" className="topbar-search-input"
                                        placeholder={
                                            activeSection === 'residents' ? 'Search residents, rooms, nickname, conditions…' :
                                                activeSection === 'medicines' ? 'Search medications, residents…' :
                                                    'Search…'
                                        }
                                        value={searchQuery}
                                        onChange={e => setSearch(e.target.value)} />
                                    {searchQuery && <button className="search-clear-btn" onClick={() => setSearch('')}><FaTimes /> Clear</button>}
                                </div>
                            )}
                        </div>
                        <div className="topbar-right">
                            <div className="topbar-user-menu">
                                <div className={`topbar-user-trigger ${accountMenuOpen ? 'active' : ''}`} onClick={() => setAcctMenu(o => !o)}>
                                    <FaUserCircle className="topbar-user-avatar" />
                                    <div className="topbar-user-info">
                                        <span className="topbar-user-name">{user?.firstName} {user?.lastName}</span>
                                        <span className="topbar-user-role">HEAD CAREGIVER</span>
                                    </div>
                                    <FaChevronDown className={`topbar-arrow ${accountMenuOpen ? 'rotate' : ''}`} />
                                </div>
                                {accountMenuOpen && (
                                    <ul className="topbar-dropdown">
                                        <li onClick={() => { navigate('/profile'); setAcctMenu(false); }}><FaUserCircle /> View Profile</li>
                                        <li onClick={() => { navigate('/settings'); setAcctMenu(false); }}><FaCog /> Account Settings</li>
                                        <li onClick={() => { navigate('/help'); setAcctMenu(false); }}><FaQuestionCircle /> Help Center</li>
                                        <li className="dropdown-divider" onClick={handleLogout}><FaSignOutAlt /> Sign Out</li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="main-content">{renderContent()}</div>
                </div>
            </div>

            {/* Modals */}
            {modal?.type === 'addResident' && <AddResidentModal
                onClose={() => setModal(null)}
                onSaved={r => { setResidents(p => [...p, r]); loadAll(); }}
                doFetch={doFetch}
                toast={toast}
                caregivers={caregivers}
                fetchCaregivers={fetchCaregivers}
            />}
            {modal?.type === 'editResident' && <AddResidentModal
                resident={modal.data}
                onClose={() => setModal(null)}
                onSaved={updated => { setResidents(p => p.map(r => r._id === updated._id ? { ...r, ...updated } : r)); loadAll(); }}
                doFetch={doFetch}
                toast={toast}
                caregivers={caregivers}
                fetchCaregivers={fetchCaregivers}
            />}
            {modal?.type === 'discharge' && <DischargeResidentModal
                resident={modal.data}
                onClose={() => setModal(null)}
                onSaved={removedId => { setResidents(p => p.filter(r => r._id !== removedId)); loadAll(); }}
                doFetch={doFetch}
                toast={toast}
            />}
            {modal?.type === 'profile' && <ProfileModal onClose={() => setModal(null)} resident={modal.data} schedule={schedule} />}
            {modal?.type === 'assignCaregiver' && <AssignCaregiverModal
                onClose={() => setModal(null)}
                resident={modal.data}
                caregivers={caregivers}
                fetchCaregivers={fetchCaregivers}
                doFetch={doFetch}
                toast={toast}
                onSaved={updated => { setResidents(p => p.map(r => r._id === updated._id ? updated : r)); loadAll(); }}
            />}
            {modal?.type === 'history' && <HistoryModal onClose={() => setModal(null)} resident={modal.data} doFetch={doFetch} />}
            {modal?.type === 'addSchedule' && <AddScheduleModal onClose={() => setModal(null)} residents={residents} medications={medications} onSaved={l => { setSchedule(p => [...p, l]); refreshStats(); }} doFetch={doFetch} toast={toast} defaultResident={modal.data ? { _id: modal.data.residentId } : null} />}
            {modal?.type === 'editSchedule' && <EditScheduleModal onClose={() => setModal(null)} log={modal.data} onSaved={u => { setSchedule(p => p.map(l => l._id === u._id ? { ...l, ...u } : l)); refreshStats(); }} doFetch={doFetch} toast={toast} />}
            {modal?.type === 'deleteMedication' && <DeleteMedicationModal onClose={() => setModal(null)} log={modal.data} onSaved={id => { setSchedule(p => p.filter(l => l._id !== id)); refreshStats(); }} doFetch={doFetch} toast={toast} />}
            {modal?.type === 'requestStock' && <RequestStockModal onClose={() => setModal(null)} items={inventory} doFetch={doFetch} toast={toast} />}

            {/* Logout Confirm */}
            {showLogoutConfirm && (
                <div className="modal-overlay" style={{ zIndex: 10002 }}>
                    <div className="registration-modal" style={{ maxWidth: 380, width: '100%', padding: 'clamp(20px,6vw,28px)', boxSizing: 'border-box' }}>
                        <div className="logout-confirm-header">
                            <FaSignOutAlt className="logout-confirm-icon" />
                            <h4>Sign Out</h4>
                        </div>
                        <p className="logout-confirm-msg">Are you sure you want to sign out? Any unsaved changes will be lost.</p>
                        <div className="modal-footer" style={{ padding: '14px 0 0', margin: 0 }}>
                            <button className="btn-outline-sm" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
                            <button className="btn-logout-confirm" onClick={confirmLogout}>
                                <FaSignOutAlt /> Yes, Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="toast-container">
                {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}
            </div>
        </div>
    );
};

export default HeadCaregiverDashboard;