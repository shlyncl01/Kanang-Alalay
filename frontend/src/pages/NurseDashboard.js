import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    FaUserCircle, FaSearch, FaHome, FaUsers, FaPills,
    FaQrcode, FaSignOutAlt, FaChevronDown,
    FaPlus, FaCheckCircle, FaExclamationTriangle,
    FaCog, FaQuestionCircle, FaMicrophone, FaTimes, FaCheck,
    FaSpinner, FaSync, FaEye, FaEdit, FaEllipsisV,
    FaExclamationCircle, FaHeartbeat, FaFileAlt,
    FaBoxOpen
} from 'react-icons/fa';
import '../styles/Dashboard.css';
import '../styles/NurseDashboard.css';

const API = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

// ─── Status maps ─────────────────────────────────────────────────────────────
const STATUS_COLOR = {
    completed:   '#1E7D56', administered: '#1E7D56',
    pending:     '#E65100', scheduled:    '#0277BD',
    upcoming:    '#0277BD', overdue:      '#C0392B',
    delayed:     '#856404', missed:       '#C0392B',
    skipped:     '#6B7280', alert:        '#C0392B',
    stable:      '#1E7D56', active:       '#1E7D56',
};
const STATUS_LABEL = {
    completed:'Completed', administered:'Administered', pending:'Pending',
    scheduled:'Upcoming',  upcoming:'Upcoming',          overdue:'Overdue',
    delayed:'Delayed',     missed:'Missed',              skipped:'Skipped',
    alert:'Alert',         stable:'Stable',              active:'Active',
};
const getStatus = s => (s||'pending').toLowerCase();

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
            ...opts,
            headers: { 'Content-Type':'application/json', ...(token && { Authorization:`Bearer ${token}` }), ...opts.headers },
        });
        return await r.json();
    } catch (e) { return { success:false, message:e.message }; }
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

// ─── Modal header ─────────────────────────────────────────────────────────────
const MHeader = ({ icon, title, onClose }) => (
    <div className="modal-header-nurse">
        <h4>{icon} {title}</h4>
        <button className="modal-close-btn" onClick={onClose} type="button"><FaTimes /></button>
    </div>
);

// ─── Form field ──────────────────────────────────────────────────────────────
const Field = ({ label, required, error, children }) => (
    <div className="form-field">
        <label>{label}{required && <span className="req"> *</span>}</label>
        {children}
        {error && <small className="field-error">{error}</small>}
    </div>
);

// ─── Modal save button ────────────────────────────────────────────────────────
const SaveBtn = ({ saving, label, onClick, disabled }) => (
    <button className="btn-modal-save" onClick={onClick} disabled={disabled || saving}>
        {saving ? 'Saving…' : label}
    </button>
);

// ════════════════════════════════════════════════════════════
//  MODAL: Add Resident
// ════════════════════════════════════════════════════════════
const AddResidentModal = ({ onClose, onSaved, doFetch, toast }) => {
    const [f, setF] = useState({
        firstName:'', lastName:'', middleName:'', age:'', gender:'male',
        roomNumber:'', floor:'', bed:'', conditions:'', primaryNurse:'',
        admissionDate: new Date().toISOString().slice(0,10),
        alertLevel: 'stable',
    });
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);
    const set = (k, v) => { setF(p=>({...p,[k]:v})); setErrs(p=>({...p,[k]:''})); };

    const FLOORS = ['1st Floor','2nd Floor','3rd Floor','4th Floor'];
    const BEDS   = ['Bed 1','Bed 2','Bed 3','Bed 4'];

    const submit = async () => {
        const e = {};
        if (!f.firstName.trim())  e.firstName  = 'Required';
        if (!f.lastName.trim())   e.lastName   = 'Required';
        if (!f.age || isNaN(f.age) || +f.age < 1 || +f.age > 130) e.age = 'Enter a valid age (1–130)';
        if (!f.roomNumber.trim()) e.roomNumber = 'Required';
        if (!f.floor)             e.floor      = 'Select a floor';
        if (Object.keys(e).length) { setErrs(e); return; }
        setSaving(true);
        const r = await doFetch('/nurse/residents', { method:'POST', body:JSON.stringify({
            firstName:     f.firstName.trim(),
            lastName:      f.lastName.trim(),
            middleName:    f.middleName.trim(),
            age:           +f.age,
            gender:        f.gender,
            roomNumber:    f.roomNumber.trim(),
            floor:         f.floor,
            bed:           f.bed,
            alertLevel:    f.alertLevel,
            admissionDate: f.admissionDate,
            conditions:    f.conditions ? f.conditions.split(',').map(c=>c.trim()).filter(Boolean) : [],
            primaryNurse:  f.primaryNurse.trim(),
        })});
        setSaving(false);
        if (r.success) { toast(`Resident ${f.firstName} ${f.lastName} added successfully.`); onSaved(r.data); onClose(); }
        else toast(r.message || 'Failed to add resident.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal add-resident-modal">
                <MHeader icon={<FaPlus />} title="Add New Resident" onClose={onClose} />
                <div className="modal-body add-resident-body">

                    {/* ── Personal Information ── */}
                    <div className="modal-section-label">Personal Information</div>
                    <div className="form-grid-2">
                        <Field label="First Name" required error={errs.firstName}>
                            <input className={`form-input${errs.firstName ? ' error' : ''}`}
                                value={f.firstName} onChange={e=>set('firstName',e.target.value)}
                                placeholder="Maria" />
                        </Field>
                        <Field label="Last Name" required error={errs.lastName}>
                            <input className={`form-input${errs.lastName ? ' error' : ''}`}
                                value={f.lastName} onChange={e=>set('lastName',e.target.value)}
                                placeholder="Santos" />
                        </Field>
                        <Field label="Middle Name">
                            <input className="form-input" value={f.middleName}
                                onChange={e=>set('middleName',e.target.value)} placeholder="Optional" />
                        </Field>
                        <Field label="Age" required error={errs.age}>
                            <input type="number" min="1" max="130"
                                className={`form-input${errs.age ? ' error' : ''}`}
                                value={f.age} onChange={e=>set('age',e.target.value)} placeholder="e.g. 75" />
                        </Field>
                        <Field label="Gender">
                            <select className="form-input" value={f.gender} onChange={e=>set('gender',e.target.value)}>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </Field>
                        <Field label="Admission Date">
                            <input type="date" className="form-input"
                                value={f.admissionDate} onChange={e=>set('admissionDate',e.target.value)} />
                        </Field>
                    </div>

                    {/* ── Room Assignment ── */}
                    <div className="modal-section-label">Room Assignment</div>
                    <div className="form-grid-2">
                        <Field label="Room Number" required error={errs.roomNumber}>
                            <input className={`form-input${errs.roomNumber ? ' error' : ''}`}
                                value={f.roomNumber} onChange={e=>set('roomNumber',e.target.value)}
                                placeholder="e.g. 201" />
                        </Field>
                        <Field label="Floor / Ward" required error={errs.floor}>
                            <select className={`form-input${errs.floor ? ' error' : ''}`}
                                value={f.floor} onChange={e=>set('floor',e.target.value)}>
                                <option value="">Select floor…</option>
                                {FLOORS.map(fl => <option key={fl} value={fl}>{fl}</option>)}
                            </select>
                        </Field>
                        <Field label="Bed">
                            <select className="form-input" value={f.bed} onChange={e=>set('bed',e.target.value)}>
                                <option value="">Select bed…</option>
                                {BEDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </Field>
                        <Field label="Alert Level">
                            <select className="form-input" value={f.alertLevel} onChange={e=>set('alertLevel',e.target.value)}>
                                <option value="stable">Stable</option>
                                <option value="alert">Alert</option>
                                <option value="critical">Critical</option>
                            </select>
                        </Field>
                    </div>

                    {/* ── Medical ── */}
                    <div className="modal-section-label">Medical Information</div>
                    <Field label="Medical Conditions (comma-separated)">
                        <input className="form-input" value={f.conditions}
                            onChange={e=>set('conditions',e.target.value)}
                            placeholder="e.g. Hypertension, Diabetes, Arthritis" />
                    </Field>
                    <Field label="Primary Nurse">
                        <input className="form-input" value={f.primaryNurse}
                            onChange={e=>set('primaryNurse',e.target.value)}
                            placeholder="Auto-assigned to you if blank" />
                    </Field>

                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
                        <SaveBtn saving={saving} label="✓ Add Resident" onClick={submit} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════
//  MODAL: Log Vital Signs
// ════════════════════════════════════════════════════════════
const VitalsModal = ({ resident, onClose, doFetch, toast }) => {
    const [f, setF] = useState({ bloodPressure:'', heartRate:'', temperature:'', oxygenSat:'', weight:'', notes:'' });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setF(p=>({...p,[k]:v}));

    const [vitalsErr, setVitalsErr] = useState('');

    const submit = async () => {
        // Validate at least one vital is filled
        const hasSome = f.bloodPressure.trim() || f.heartRate.trim() || f.temperature.trim() || f.oxygenSat.trim() || f.weight.trim();
        if (!hasSome) { setVitalsErr('Please fill in at least one vital sign before saving.'); return; }
        // Validate BP format if provided
        if (f.bloodPressure && !/^\d{2,3}\/\d{2,3}$/.test(f.bloodPressure.trim())) {
            setVitalsErr('Blood pressure must be in format 120/80.'); return;
        }
        // Validate numeric ranges
        if (f.heartRate && (+f.heartRate < 20 || +f.heartRate > 300)) { setVitalsErr('Heart rate must be between 20–300 bpm.'); return; }
        if (f.temperature && (+f.temperature < 30 || +f.temperature > 45)) { setVitalsErr('Temperature must be between 30–45 °C.'); return; }
        if (f.oxygenSat && (+f.oxygenSat < 50 || +f.oxygenSat > 100)) { setVitalsErr('Oxygen saturation must be between 50–100%.'); return; }
        if (f.weight && (+f.weight < 1 || +f.weight > 300)) { setVitalsErr('Weight must be between 1–300 kg.'); return; }
        setVitalsErr('');
        setSaving(true);
        const r = await doFetch(`/nurse/residents/${resident._id}/vitals`, { method:'POST', body:JSON.stringify(f) });
        setSaving(false);
        if (r.success) { toast(`Vitals logged for ${resident.name || resident.firstName || 'resident'}.`); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal modal-md">
                <MHeader icon={<FaHeartbeat />} title={`Log Vital Signs — ${resident.name || [resident.firstName, resident.lastName].filter(Boolean).join(' ') || 'Resident'}`} onClose={onClose} />
                <div className="modal-body">
                    {vitalsErr && (
                        <div className="validation-banner">
                            <FaExclamationTriangle /> {vitalsErr}
                        </div>
                    )}
                    <div className="form-grid-2">
                        <Field label="Blood Pressure (mmHg)">
                        <input
                            className="form-input"
                            value={f.bloodPressure}
                            placeholder="e.g. 120/80"
                            maxLength={7}
                            onChange={e => {
                                let val = e.target.value.replace(/[^0-9/]/g, '');
                                // Auto-insert slash after 3 digits if not already there
                                if (val.length === 3 && !val.includes('/') && f.bloodPressure.length < 3) {
                                    val = val + '/';
                                }
                                set('bloodPressure', val);
                            }}
                        />
                    </Field>
                        <Field label="Heart Rate (bpm)"><input type="number" className="form-input" value={f.heartRate} onChange={e=>set('heartRate',e.target.value)} placeholder="e.g. 72" /></Field>
                        <Field label="Temperature (°C)"><input type="number" step="0.1" className="form-input" value={f.temperature} onChange={e=>set('temperature',e.target.value)} placeholder="e.g. 36.5" /></Field>
                        <Field label="Oxygen Saturation (%)"><input type="number" className="form-input" value={f.oxygenSat} onChange={e=>set('oxygenSat',e.target.value)} placeholder="e.g. 98" /></Field>
                        <Field label="Weight (kg)"><input type="number" step="0.1" className="form-input" value={f.weight} onChange={e=>set('weight',e.target.value)} placeholder="e.g. 55" /></Field>
                    </div>
                    <Field label="Notes"><textarea rows={3} className="form-input" value={f.notes} onChange={e=>set('notes',e.target.value)} placeholder="Observations or remarks…" /></Field>
                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
                        <SaveBtn saving={saving} label="✓ Save Vitals" onClick={submit} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: View Full Profile
// ════════════════════════════════════════════════════════════
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
            <div className="registration-modal modal-lg">
                <MHeader icon={<FaUserCircle />} title={`Resident Profile — ${resName}`} onClose={onClose} />
                <div className="modal-body profile-modal-body">

                    {/* Header card */}
                    <div className="profile-header-card">
                        <div className="profile-avatar">
                            <FaUserCircle />
                        </div>
                        <div className="profile-header-info">
                            <h3 className="profile-full-name">{resName}</h3>
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
                        {/* Personal */}
                        <div className="profile-section">
                            <div className="profile-section-title">Personal Information</div>
                            <InfoRow label="First Name"      value={resident.firstName} />
                            <InfoRow label="Middle Name"     value={resident.middleName} />
                            <InfoRow label="Last Name"       value={resident.lastName} />
                            <InfoRow label="Age"             value={resident.age} />
                            <InfoRow label="Gender"          value={resident.gender} />
                            <InfoRow label="Admission Date"  value={resident.admissionDate ? new Date(resident.admissionDate).toLocaleDateString('en-PH', {year:'numeric',month:'long',day:'numeric'}) : null} />
                        </div>

                        {/* Room */}
                        <div className="profile-section">
                            <div className="profile-section-title">Room Assignment</div>
                            <InfoRow label="Room Number" value={resident.room} />
                            <InfoRow label="Floor / Ward" value={resident.floor} />
                            <InfoRow label="Bed"          value={resident.bed} />
                            <InfoRow label="Alert Level"  value={resident.alertLevel ? resident.alertLevel.charAt(0).toUpperCase() + resident.alertLevel.slice(1) : null} />
                        </div>

                        {/* Medical Conditions */}
                        <div className="profile-section profile-section-full">
                            <div className="profile-section-title">Medical Conditions</div>
                            {resident.conditions?.length > 0 ? (
                                <div className="conditions-wrap" style={{marginTop:6}}>
                                    {resident.conditions.map((c, i) => (
                                        <span key={i} className="condition-tag">{c?.name || c}</span>
                                    ))}
                                </div>
                            ) : (
                                <span className="profile-info-value" style={{color:'var(--d-muted)',fontStyle:'italic'}}>No conditions recorded.</span>
                            )}
                        </div>

                        {/* Assignment */}
                        <div className="profile-section profile-section-full">
                            <div className="profile-section-title">Assigned Personnel</div>
                            <InfoRow label="Primary Nurse"    value={resident.primaryNurse} />
                            <InfoRow label="Secondary Nurse"  value={resident.secondaryNurse} />
                        </div>
                    </div>

                    {/* Today's Medication */}
                    <div className="profile-section-title" style={{marginTop:16,marginBottom:10}}>Today&apos;s Medication Schedule</div>
                    {todayMeds.length === 0 ? (
                        <p style={{color:'var(--d-muted)',fontStyle:'italic',fontSize:'.88rem',margin:0}}>No medications scheduled today.</p>
                    ) : (
                        <table className="custom-table">
                            <thead>
                                <tr><th>Time</th><th>Medication</th><th>Dosage</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {todayMeds.map(m => (
                                    <tr key={m._id}>
                                        <td className="td-sm td-nowrap">
                                            {m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : '—'}
                                        </td>
                                        <td><strong>{m.medicationName || '—'}</strong>
                                            {m.condition && <div style={{fontSize:'.74rem',color:'var(--d-muted)'}}>For {m.condition}</div>}
                                        </td>
                                        <td className="td-sm">{m.dosage || '—'}</td>
                                        <td><Badge s={m.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Close</button>
                    </div>
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
        doFetch(`/nurse/residents/${resident._id}/history`).then(r => {
            if (r.success) setLogs(r.data || []);
            setLoading(false);
        });
    }, [resident._id]);

    return (
        <div className="modal-overlay">
            <div className="registration-modal modal-lg">
                <MHeader icon={<FaEye />} title={`Medication History — ${resident.name || [resident.firstName, resident.lastName].filter(Boolean).join(' ') || 'Resident'}`} onClose={onClose} />
                <div className="modal-body">
                    {loading
                        ? <div className="no-data-center"><FaSpinner className="spin" /> Loading…</div>
                        : logs.length === 0
                        ? <div className="no-data-center">No medication history found.</div>
                        : <div className="history-scroll">
                            <table className="custom-table">
                                <thead><tr><th>Date &amp; Time</th><th>Medication</th><th>Dosage</th><th>Status</th><th>Notes</th></tr></thead>
                                <tbody>
                                    {logs.map(l => (
                                        <tr key={l._id}>
                                            <td className="td-sm td-nowrap">{l.scheduledTime ? new Date(l.scheduledTime).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                                            <td><strong>{l.medicationName || l.medicationId?.name || '—'}</strong></td>
                                            <td className="td-sm">{l.dosage || '—'}</td>
                                            <td><Badge s={l.status} /></td>
                                            <td className="td-muted">{l.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                          </div>}
                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Add Medication to Schedule
// ════════════════════════════════════════════════════════════
const AddScheduleModal = ({ residents, medications, onClose, onSaved, doFetch, toast, defaultResident }) => {
    const [f, setF] = useState({ residentId:defaultResident?._id||'', medicationId:'', scheduledTime:'', dosage:'', notes:'' });
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);
    const set = (k, v) => { setF(p=>({...p,[k]:v})); setErrs(p=>({...p,[k]:''})); };

    const submit = async () => {
        const e = {};
        if (!f.residentId)    e.residentId    = 'Select a resident';
        if (!f.medicationId)  e.medicationId  = 'Select a medication';
        if (!f.scheduledTime) e.scheduledTime = 'Select date & time';
        if (f.scheduledTime && new Date(f.scheduledTime) < new Date(Date.now() - 60000)) {
            e.scheduledTime = 'Scheduled time cannot be in the past.';
        }
        if (f.dosage && f.dosage.trim().length < 1) e.dosage = 'Enter a valid dosage';
        if (Object.keys(e).length) { setErrs(e); return; }
        setSaving(true);
        const r = await doFetch('/nurse/schedule', { method:'POST', body:JSON.stringify(f) });
        setSaving(false);
        if (r.success) { toast('Medication scheduled.'); onSaved(r.data); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal modal-md">
                <MHeader icon={<FaPlus />} title="Add Medication to Schedule" onClose={onClose} />
                <div className="modal-body">
                    <Field label="Resident" required error={errs.residentId}>
                        <select className={`form-input${errs.residentId?' error':''}`} value={f.residentId} onChange={e=>set('residentId',e.target.value)}>
                            <option value="">Select resident…</option>
                            {residents.map(r=><option key={r._id} value={r._id}>{r.name} — Room {r.room}</option>)}
                        </select>
                    </Field>
                    <Field label="Medication" required error={errs.medicationId}>
                        <select className={`form-input${errs.medicationId?' error':''}`} value={f.medicationId} onChange={e=>set('medicationId',e.target.value)}>
                            <option value="">Select medication…</option>
                            {medications.map(m=><option key={m._id} value={m._id}>{m.name} {m.dosage?.value?`${m.dosage.value}${m.dosage.unit}`:''}</option>)}
                        </select>
                    </Field>
                    <div className="form-grid-2">
                        <Field label="Scheduled Date &amp; Time" required error={errs.scheduledTime}>
                            <input type="datetime-local" className={`form-input${errs.scheduledTime?' error':''}`} value={f.scheduledTime} onChange={e=>set('scheduledTime',e.target.value)} />
                        </Field>
                        <Field label="Dosage Override"><input className="form-input" value={f.dosage} onChange={e=>set('dosage',e.target.value)} placeholder="e.g. 1 tablet" /></Field>
                    </div>
                    <Field label="Notes"><textarea rows={3} className="form-input" value={f.notes} onChange={e=>set('notes',e.target.value)} placeholder="Special instructions…" /></Field>
                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
                        <SaveBtn saving={saving} label="✓ Schedule Medication" onClick={submit} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Edit Schedule
// ════════════════════════════════════════════════════════════
const EditScheduleModal = ({ log, onClose, onSaved, doFetch, toast }) => {
    const dt = log.scheduledTime ? new Date(log.scheduledTime).toISOString().slice(0,16) : '';
    const [f, setF] = useState({ scheduledTime:dt, dosage:log.dosage||'', notes:log.notes||'' });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setF(p=>({...p,[k]:v}));

    const [editErr, setEditErr] = useState('');

    const submit = async () => {
        setEditErr('');
        if (!f.scheduledTime) { setEditErr('Scheduled date & time is required.'); return; }
        if (!f.dosage.trim()) { setEditErr('Dosage is required.'); return; }
        setSaving(true);
        const r = await doFetch(`/nurse/schedule/${log._id}`, { method:'PUT', body:JSON.stringify(f) });
        setSaving(false);
        if (r.success) { toast('Schedule updated.'); onSaved(r.data); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal modal-sm">
                <MHeader icon={<FaEdit />} title="Edit Schedule" onClose={onClose} />
                <div className="modal-body">
                    {editErr && (
                        <div className="validation-banner">
                            <FaExclamationTriangle /> {editErr}
                        </div>
                    )}
                    <div className="edit-sched-info">
                        <strong>{log.residentName}</strong> — {log.medicationName}
                    </div>
                    <Field label="Scheduled Date &amp; Time"><input type="datetime-local" className="form-input" value={f.scheduledTime} onChange={e=>set('scheduledTime',e.target.value)} /></Field>
                    <Field label="Dosage"><input className="form-input" value={f.dosage} onChange={e=>set('dosage',e.target.value)} placeholder="e.g. 1 tablet" /></Field>
                    <Field label="Notes"><textarea rows={3} className="form-input" value={f.notes} onChange={e=>set('notes',e.target.value)} /></Field>
                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
                        <SaveBtn saving={saving} label="✓ Save Changes" onClick={submit} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Request Stock
// ════════════════════════════════════════════════════════════
const RequestStockModal = ({ items, onClose, doFetch, toast }) => {
    const [f, setF] = useState({ itemId:'', itemName:'', quantity:'', reason:'' });
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);
    const set = (k, v) => { setF(p=>({...p,[k]:v})); setErrs(p=>({...p,[k]:''})); };

    const pickItem = id => { const found = items.find(i=>i._id===id); setF(p=>({...p,itemId:id,itemName:found?.name||''})); };

    const submit = async () => {
        const e = {};
        if (!f.itemName.trim()) e.itemName = 'Select or enter item';
        if (!f.quantity || +f.quantity < 1) e.quantity = 'Enter valid quantity';
        if (Object.keys(e).length) { setErrs(e); return; }
        setSaving(true);
        const r = await doFetch('/nurse/inventory/request', { method:'POST', body:JSON.stringify(f) });
        setSaving(false);
        if (r.success) { toast('Stock request submitted.'); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal modal-sm">
                <MHeader icon={<FaBoxOpen />} title="Request Stock Replenishment" onClose={onClose} />
                <div className="modal-body">
                    <Field label="Select Item" error={errs.itemName}>
                        <select className={`form-input${errs.itemName?' error':''}`} value={f.itemId} onChange={e=>pickItem(e.target.value)}>
                            <option value="">Choose from inventory…</option>
                            {items.map(i=><option key={i._id} value={i._id}>{i.name} (Current: {i.quantity} {i.unit})</option>)}
                        </select>
                    </Field>
                    <Field label="Item Name (manual if not in list)">
                        <input className={`form-input${errs.itemName?' error':''}`} value={f.itemName} onChange={e=>set('itemName',e.target.value)} placeholder="e.g. Paracetamol 500mg" />
                    </Field>
                    <Field label="Quantity Needed" required error={errs.quantity}>
                        <input type="number" min="1" className={`form-input${errs.quantity?' error':''}`} value={f.quantity} onChange={e=>set('quantity',e.target.value)} />
                    </Field>
                    <Field label="Reason / Notes">
                        <textarea rows={3} className="form-input" value={f.reason} onChange={e=>set('reason',e.target.value)} placeholder="Why is this stock needed?" />
                    </Field>
                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
                        <SaveBtn saving={saving} label="✓ Submit Request" onClick={submit} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: Voice Note
// ════════════════════════════════════════════════════════════
const VoiceModal = ({ onClose, doFetch, toast, logId }) => {
    const [listening,  setListening]  = useState(false);
    const [transcript, setTranscript] = useState('');
    const [saving,     setSaving]     = useState(false);
    const supported = ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

    const startVoice = () => {
        if (!supported) { alert('Voice recognition not supported in this browser.'); return; }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const r = new SR(); r.lang = 'en-PH'; r.interimResults = false;
        setListening(true);
        r.start();
        r.onresult = e => { setTranscript(t=>(t+' '+e.results[0][0].transcript).trim()); setListening(false); };
        r.onerror  = () => setListening(false);
        r.onend    = () => setListening(false);
    };

    const handleSave = async () => {
        if (!transcript.trim()) return;
        setSaving(true);
        const r = await doFetch('/nurse/voice-note', { method:'POST', body:JSON.stringify({ note:transcript, logId:logId||null }) });
        setSaving(false);
        if (r.success) { toast('Voice note saved.'); onClose(); }
        else toast(r.message || 'Failed.', 'error');
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal modal-sm">
                <MHeader icon={<FaMicrophone />} title="Voice Reminder / Note" onClose={onClose} />
                <div className="modal-body">
                    <div className="voice-mic-center">
                        <button onClick={startVoice} className={`voice-mic-btn ${listening ? 'recording' : 'idle'}`}>
                            <FaMicrophone />
                        </button>
                        <p className={`voice-mic-label ${listening ? 'recording' : 'idle'}`}>
                            {listening ? '● Recording…' : supported ? 'Tap to record' : 'Not supported in this browser'}
                        </p>
                    </div>
                    <Field label="Note">
                        <textarea rows={4} className="form-input" placeholder="Voice transcript appears here, or type manually…" value={transcript} onChange={e=>setTranscript(e.target.value)} />
                    </Field>
                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
                        <SaveBtn saving={saving} label="✓ Save Note" onClick={handleSave} disabled={!transcript.trim()} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MODAL: QR Verify
// ════════════════════════════════════════════════════════════
const QrModal = ({ inventory, onClose }) => {
    const [input,  setInput]  = useState('');
    const [result, setResult] = useState(null);

    const verify = () => {
        const q = input.trim().toLowerCase();
        const match = inventory.find(i => i.itemId?.toLowerCase()===q || i.name?.toLowerCase()===q);
        setResult(match ? { found:true, item:match } : { found:false });
    };

    return (
        <div className="modal-overlay">
            <div className="registration-modal modal-sm">
                <MHeader icon={<FaQrcode />} title="QR / Barcode Verification" onClose={onClose} />
                <div className="modal-body">
                    <FaQrcode className="qr-modal-icon" />
                    <p className="qr-modal-hint">Scan a QR code or type the Item ID / medication name.</p>
                    <div className="qr-input-row">
                        <input type="text" autoFocus className="form-input" placeholder="Enter Item ID or scan…"
                            value={input}
                            onChange={e=>{ setInput(e.target.value); setResult(null); }}
                            onKeyDown={e=>e.key==='Enter'&&verify()} />
                        <button className="btn-primary-sm" onClick={verify} disabled={!input.trim()}>
                            <FaCheckCircle /> Verify
                        </button>
                    </div>
                    {result && (
                        <div className={`qr-result ${result.found ? 'found' : 'notfound'}`}>
                            {result.found ? (
                                <>
                                    <div className="qr-result-title found"><FaCheckCircle /> Item Verified</div>
                                    <div className="qr-result-grid">
                                        {[['Name',result.item.name],['Category',result.item.category],
                                          ['Stock',`${result.item.quantity} ${result.item.unit}`],
                                          ['Item ID',result.item.itemId||'—'],
                                          ['Expiry',result.item.expirationDate?new Date(result.item.expirationDate).toLocaleDateString():'—'],
                                          ['Status',result.item.quantity===0?'Out of Stock':result.item.quantity<=(result.item.minThreshold??10)?'Low Stock':'Available']
                                        ].map(([k,v])=>(
                                            <div key={k} className="qr-result-field"><small>{k}</small><div>{v}</div></div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="qr-result-title notfound">
                                    <FaExclamationTriangle /> Item not found — check the ID and try again.
                                </div>
                            )}
                        </div>
                    )}
                    <div className="modal-footer">
                        <button className="btn-outline-sm" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  ACTION DROPDOWN (⋮)
// ════════════════════════════════════════════════════════════
const ActionMenu = ({ onViewHistory, onAddMedication, onEditSchedule }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} className="action-menu-wrapper">
            <button className="action-menu-trigger" onClick={()=>setOpen(o=>!o)}><FaEllipsisV /></button>
            {open && (
                <div className="action-menu-dropdown">
                    {[
                        { icon:<FaEye />,  label:'View History',   action:onViewHistory   },
                        { icon:<FaPlus />, label:'Add Medication',  action:onAddMedication },
                        { icon:<FaEdit />, label:'Edit Schedule',   action:onEditSchedule  },
                    ].map(item => (
                        <button key={item.label} className="action-menu-item" onClick={()=>{ item.action?.(); setOpen(false); }}>
                            {item.icon} {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ════════════════════════════════════════════════════════════
const NurseDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const doFetch  = useFetch();

    const [activeSection, setSection]    = useState('home');
    const [searchQuery,   setSearch]     = useState('');
    const [accountMenuOpen, setAcctMenu] = useState(false);
    const [filterStatus,  setFStatus]    = useState('All');
    const [filterResident,setFRes]       = useState('All');
    const [sortTime,      setSort]       = useState('Asc');
    const [loading,       setLoading]    = useState(true);
    const [refreshing,    setRefreshing] = useState(false);

    const [residents,   setResidents]   = useState([]);
    const [schedule,    setSchedule]    = useState([]);
    const [medications, setMedications] = useState([]);
    const [inventory,   setInventory]   = useState([]);
    const [stats,       setStats]       = useState({ total:0, onTime:0, delayed:0, missed:0, pending:0, overdue:0, complianceRate:0, lowMedStock:0, totalResidents:0 });

    const [modal,  setModal]  = useState(null);
    const [toasts, setToasts] = useState([]);

    const [resPage,   setResPage]   = useState(1);
    const [schedPage, setSchedPage] = useState(1);
    const PER = 5;

    const shiftLabel = { morning:'Morning (6AM–2PM)', afternoon:'Afternoon (2PM–10PM)', night:'Night (10PM–6AM)', flexible:'Flexible', rotating:'Rotating' }[user?.shift] || 'Morning (6AM–2PM)';

    const toast = useCallback((msg, type='success') => {
        const id = Date.now();
        setToasts(t=>[...t,{id,msg,type}]);
    }, []);

    const loadAll = useCallback(async () => {
        const [resR, schR, medR, invR, stR] = await Promise.all([
            doFetch('/nurse/residents'),
            doFetch('/nurse/schedule'),
            doFetch('/nurse/medications'),
            doFetch('/nurse/inventory'),
            doFetch('/nurse/stats'),
        ]);
        if (resR.success) setResidents(resR.data || []);
        if (schR.success) setSchedule(schR.data || []);
        if (medR.success) setMedications(medR.data || []);
        if (invR.success) setInventory(invR.data || []);
        if (stR.success)  setStats(s=>({...s,...stR.data}));
    }, [doFetch]);

    useEffect(() => { (async()=>{ setLoading(true); await loadAll(); setLoading(false); })(); }, [loadAll]);
    useEffect(() => { setResPage(1); setSchedPage(1); }, [searchQuery, filterStatus, filterResident, activeSection]);

    const handleRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const handleLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => { logout(); navigate('/login'); };

    const markStatus = async (id, status, method='manual') => {
        // Find the log for context in the confirm message
        const log = schedule.find(l => l._id === id);
        const resName  = log?.residentName || 'this resident';
        const medName  = log?.medicationName || 'this medication';

        // Confirm before any irreversible medication action
        const actionLabels = {
            completed:    { label:'Mark as Administered', msg:`Confirm: Mark ${medName} as administered for ${resName}?`, color:'#1E7D56' },
            administered: { label:'Mark as Administered', msg:`Confirm: Mark ${medName} as administered for ${resName}?`, color:'#1E7D56' },
            missed:       { label:'Mark as Missed',       msg:`Mark ${medName} as MISSED for ${resName}? This cannot be undone.`, color:'#C0392B' },
            skipped:      { label:'Mark as Skipped',      msg:`Mark ${medName} as skipped for ${resName}?`, color:'#E65100' },
        };

        if (actionLabels[status]) {
            const confirmed = window.confirm(actionLabels[status].msg);
            if (!confirmed) return;
        }

        const r = await doFetch(`/nurse/schedule/${id}/status`, { method:'PUT', body:JSON.stringify({ status, verificationMethod:method }) });
        if (r.success) {
            setSchedule(prev => prev.map(l => l._id===id ? { ...l, status, ...(status==='completed'||status==='administered' ? { administeredTime:new Date().toISOString() } : {}) } : l));
            setStats(s => ({ ...s, onTime:s.onTime+(status==='completed'?1:0), pending:Math.max(0,s.pending-1) }));
            toast(`${medName} marked as ${status} for ${resName}.`);
        } else toast(r.message || 'Update failed.', 'error');
    };

    const filteredSched = useMemo(() => {
        const q = searchQuery.toLowerCase();
        let arr = schedule.filter(l => {
            const mQ  = !q || l.residentName?.toLowerCase().includes(q) || l.medicationName?.toLowerCase().includes(q) || l.room?.toLowerCase().includes(q);
            const mSt = filterStatus==='All' || l.status===filterStatus.toLowerCase();
            const mR  = filterResident==='All' || l.residentName===filterResident;
            return mQ && mSt && mR;
        });
        return [...arr].sort((a,b) => {
            const ta = new Date(a.scheduledTime||a.createdAt).getTime();
            const tb = new Date(b.scheduledTime||b.createdAt).getTime();
            return sortTime==='Asc' ? ta-tb : tb-ta;
        });
    }, [schedule, searchQuery, filterStatus, filterResident, sortTime]);

    const filteredRes = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let arr = residents.filter(r => !q || r.name?.toLowerCase().includes(q) || r.room?.toLowerCase().includes(q) || r.conditions?.some(c=>c.toLowerCase().includes(q)));
        if (filterStatus !== 'All') arr = arr.filter(r => (r.alertLevel||'stable').toLowerCase() === filterStatus.toLowerCase());
        return arr;
    }, [residents, searchQuery, filterStatus]);

    const residentNames = useMemo(() => ['All', ...new Set(schedule.map(l=>l.residentName).filter(Boolean))], [schedule]);
    const groupedByResident = useMemo(() => {
        const g = {};
        schedule.forEach(l => {
            const key = l.residentName || 'Unknown';
            if (!g[key]) g[key] = { name:key, room:l.room, floor:l.floor, residentId:l.residentId, meds:[] };
            g[key].meds.push(l);
        });
        return Object.values(g);
    }, [schedule]);

    const getMinutesSince = iso => iso ? Math.round((Date.now()-new Date(iso).getTime())/60000) : null;

    const SchedActionBtn = ({ item }) => {
        if (item.status==='overdue')
            return <button className="sched-btn-verify" onClick={()=>markStatus(item._id,'completed','manual')}>Verify Now</button>;
        if (item.status==='scheduled'||item.status==='upcoming')
            return <button className="sched-btn-prepare" onClick={()=>markStatus(item._id,'completed','manual')}>Prepare</button>;
        if (item.status==='completed'||item.status==='administered')
            return <button className="sched-btn-view" onClick={()=>setModal({type:'history',data:residents.find(r=>r.name===item.residentName)||{_id:item.residentId,name:item.residentName}})}>View</button>;
        return <button className="btn-success-sm sched-btn-administer" onClick={()=>markStatus(item._id,'completed')}>Administer</button>;
    };

    // ── SCREEN 1: HOME ────────────────────────────────────────
    const renderHome = () => (
        <div>
            <div className="nurse-header">
                <h2>Dashboard</h2>
                <p className="last-login">
                    Welcome back, <strong>{user?.firstName} {user?.lastName}</strong> &nbsp;|&nbsp;
                    Last login: {new Date().toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})} at {new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}
                </p>
                <div className="badge-row">
                    <span className="nurse-info-pill">Shift: {shiftLabel}</span>
                    {user?.ward && <span className="nurse-info-pill">{user.ward}</span>}
                    <span className="nurse-info-pill on-duty">Status: On Duty</span>
                    <button className="btn-outline-sm ml-auto" onClick={handleRefresh} disabled={refreshing}>
                        <FaSync className={refreshing?'spin':''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="home-top-grid">
                {/* Today's Schedule */}
                <div className="card-white home-card">
                    <h6>Today's Schedule</h6>
                    {schedule.length === 0
                        ? <div className="no-data-center"><FaPills /> No medications scheduled today.</div>
                        : <div className="sched-list">
                            {schedule.slice(0,3).map(item => {
                                const mins    = item.status==='overdue' ? getMinutesSince(item.scheduledTime) : null;
                                const timeStr = item.scheduledTime ? new Date(item.scheduledTime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : '—';
                                const done    = item.status==='completed'||item.status==='administered';
                                return (
                                    <div key={item._id} className="sched-item">
                                        <span className={`sched-time ${done?'done':item.status==='overdue'?'overdue':'pending'}`}>{timeStr}</span>
                                        <div className="sched-body">
                                            <div className="sched-name">
                                                {done && <span className="done-check">✓</span>}
                                                {item.status==='overdue' && <FaExclamationTriangle className="overdue-icon" />}
                                                {item.residentName || '—'}
                                            </div>
                                            <div className="sched-med">{item.medicationName} {item.dosage && `— ${item.dosage}`}</div>
                                            {item.status==='overdue' && mins!==null && <div className="sched-overdue-tag">OVERDUE: {mins} mins</div>}
                                        </div>
                                    </div>
                                );
                            })}
                          </div>}
                    <button className="btn-primary-sm home-full-width-btn" onClick={()=>setSection('medicines')}>View Full Schedule</button>
                </div>

                {/* Today's Status */}
                <div className="card-white home-card">
                    <h6>Today's Status</h6>
                    <div className="nurse-stat-row">
                        {[{label:'Total',val:stats.total,sub:'Meds',cls:''},{label:'On Time',val:stats.onTime,cls:'success'},{label:'Delayed',val:stats.delayed,cls:'warn'},{label:'Missed',val:stats.missed,cls:'danger'},{label:'Pending',val:stats.pending,cls:'muted'}].map(s => (
                            <div key={s.label} className={`nurse-stat-box ${s.cls}`}>
                                <strong>{s.val}</strong>
                                <span>{s.label}</span>
                                {s.sub && <span className="stat-sub">{s.sub}</span>}
                            </div>
                        ))}
                    </div>
                    <p className="compliance-text">
                        Your Compliance Rate:&nbsp;
                        <strong className={`compliance-rate-value ${stats.complianceRate>=90?'excellent':stats.complianceRate>=70?'good':'poor'}`}>
                            {stats.complianceRate}% ({stats.complianceRate===0?'No data yet':stats.complianceRate>=90?'Excellent':stats.complianceRate>=70?'Good':'Needs Improvement'})
                        </strong>
                    </p>
                    <div className="compliance-bar">
                        <div className="compliance-progress" style={{ width:`${stats.complianceRate}%` }} />
                    </div>
                    <button className="btn-outline-sm home-full-width-btn" onClick={()=>setSection('medicines')}>View Full Status</button>
                </div>

                {/* Voice Reminder */}
                <div className="card-white home-card voice-card">
                    <h6><FaMicrophone /> Voice Reminder</h6>
                    <div className="voice-current-label">Current:</div>
                    <div className="voice-current-box">No active voice reminder.</div>
                    <div className="voice-lang">Language: Filipino / English</div>
                    <div className="voice-btn-col">
                        <button className="btn-outline-sm voice-btn" onClick={()=>setModal({type:'voice'})}>Test Voice System</button>
                        <button className="btn-outline-sm voice-btn">Adjust Volume</button>
                    </div>
                </div>
            </div>

            <div className="home-bottom-grid">
                {/* My Assigned Residents */}
                <div className="card-white home-card">
                    <h6>My Assigned Residents</h6>
                    {residents.length === 0
                        ? <div className="no-data-center">No assigned residents yet.</div>
                        : <div>
                            {residents.slice(0,3).map((r,i) => (
                                <div key={i} className="resident-list-item">
                                    <div className="resident-list-name">{r.name||`${r.firstName||''} ${r.lastName||''}`.trim()||'Unknown'} {r.room && `(Room ${r.room})`}</div>
                                    <div className="resident-list-meta">Age: {r.age||'—'}{r.conditions?.length>0 && ` | ${r.conditions.slice(0,2).join(', ')}`}</div>
                                    {r.medicationOverdue
                                        ? <div className="resident-list-overdue">Current: OVERDUE</div>
                                        : <div className="resident-list-nextmed">Next Med: {r.nextMed||'—'}</div>}
                                </div>
                            ))}
                          </div>}
                    <button className="btn-primary-sm home-full-width-btn" onClick={()=>setSection('residents')}>View All Residents</button>
                </div>

                {/* Quick Actions */}
                <div className="card-white home-card">
                    <h6>Quick Actions</h6>
                    <div className="quick-actions-grid">
                        {[
                            { icon:<FaPlus />,            label:'Add Medication',    action:()=>setModal({type:'addSchedule'}) },
                            { icon:<FaSearch />,           label:'Search Residents',  action:()=>setSection('residents') },
                            { icon:<FaHeartbeat />,        label:'Log Vitals',        action:()=>setSection('residents') },
                            { icon:<FaQrcode />,           label:'Check Scanner',     action:()=>setModal({type:'qr'}) },
                            { icon:<FaExclamationCircle />,label:'Report Incidents',  action:()=>toast('Incident reporting coming soon.','warn') },
                            { icon:<FaSync />,             label:'Sync App',          action:handleRefresh },
                            { icon:<FaFileAlt />,          label:'View Report',       action:()=>setSection('medicines') },
                        ].map((a,i) => (
                            <button key={i} className="quick-action-btn" onClick={a.action}>{a.icon} {a.label}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    // ── SCREEN 2: RESIDENTS ───────────────────────────────────
    const renderResidents = () => {
        const paged = filteredRes.slice((resPage-1)*PER, resPage*PER);
        const pages = Math.ceil(filteredRes.length / PER);
        return (
            <div>
                <div className="res-page-header">
                    <span className="res-page-label">MY ASSIGNED RESIDENTS ({residents.length})</span>
                    <div className="res-page-controls">
                        <select className="filter-select" value={filterStatus} onChange={e=>setFStatus(e.target.value)}>
                            <option value="All">Filter: All</option>
                            <option value="alert">Alert</option>
                            <option value="stable">Stable</option>
                        </select>
                        <select className="filter-select" value={sortTime} onChange={e=>setSort(e.target.value)}>
                            <option value="Asc">Sort: A–Z</option>
                            <option value="Desc">Sort: Z–A</option>
                        </select>
                        <button className="btn-primary-sm" onClick={()=>setModal({type:'addResident'})}><FaPlus /> Add Resident</button>
                    </div>
                </div>

                <div className="res-col-header">
                    <span>Room|Bed</span><span>Name|Age</span><span>Conditions</span><span>Status</span><span>Today's Medication</span><span>Actions</span>
                </div>

                {paged.length === 0
                    ? <div className="res-row-empty">{searchQuery ? `No residents match "${searchQuery}".` : 'No residents yet.'}</div>
                    : paged.map((r, i) => {
                        const isLast   = i === paged.length - 1;
                        const todayMeds = schedule.filter(l=>l.residentName===(r.name||`${r.firstName||''} ${r.lastName||''}`.trim()) || l.residentId?.toString()===r._id?.toString());
                        const allDone  = todayMeds.length>0 && todayMeds.every(l=>l.status==='completed'||l.status==='administered');
                        return (
                            <div key={r._id||i} className={`res-row${r.medicationOverdue?' overdue-row':''}${isLast?' last-row':''}`}>
                                <div className="res-row-grid">
                                    <div className="res-room">{r.room||'—'} | {r.bed||'—'}<br/><small style={{fontSize:'.72rem',color:'var(--d-muted)'}}>{r.floor||''}</small></div>
                                    <div className="res-name-block">
                                        <div className="name">{r.name || `${r.firstName||''} ${r.lastName||''}`.trim() || 'Unknown'}</div>
                                        <div className="age">Age: {r.age||'—'} &nbsp;·&nbsp; {r.gender||''}</div>
                                        <div className="primary">Primary Nurse: <span>{r.primaryNurse||`${user?.firstName} ${user?.lastName}`}</span></div>
                                        {r.secondaryNurse && <div className="secondary">Secondary: <strong>{r.secondaryNurse}</strong></div>}
                                    </div>
                                    <div className="conditions-wrap">
                                        {r.conditions?.length>0 
                                            ? r.conditions.map((c,ci)=><span key={ci} className="condition-tag">{c?.name||c}</span>) 
                                            : <span className="no-conditions">—</span>}
                                    </div>
                                    <div><Badge s={r.medicationOverdue?'overdue':r.alertLevel||'stable'} /></div>
                                    <div className="res-meds-cell">
                                        {todayMeds.length===0
                                            ? <span className="res-no-meds">No meds today</span>
                                            : todayMeds.slice(0,3).map((m,mi)=>(
                                                <div key={mi} className={`res-med-item ${m.status==='completed'||m.status==='administered'?'done':'active'}`}>
                                                    {m.scheduledTime?new Date(m.scheduledTime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}):'—'} - {m.medicationName}
                                                    {(m.status==='completed'||m.status==='administered')&&<span className="res-med-done">✓</span>}
                                                    {m.status==='pending'&&<span className="res-med-pend">Pending</span>}
                                                </div>
                                            ))}
                                    </div>
                                    <div>
                                        {allDone
                                            ? <span className="res-completed-label">(Completed)</span>
                                            : <div className="res-action-btns">
                                                <button className="btn-outline-sm res-btn" onClick={()=>setModal({type:'profile',data:r})}>View Full Profile</button>
                                                <button className="btn-success-sm res-btn" onClick={()=>setModal({type:'vitals',data:r})}>Log Vital Signs</button>
                                                <button className="btn-primary-sm res-btn" onClick={()=>setModal({type:'history',data:r})}>Medication History</button>
                                              </div>}
                                    </div>
                                </div>
                                {r.medicationOverdue && (
                                    <div className="res-overdue-alert">
                                        <FaExclamationCircle /> Medication Overdue ({getMinutesSince(r.overdueAt)||'—'} mins) — {r.overdueMed||''}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                <div className="res-page-footer">
                    <span className="res-page-label">MY ASSIGNED RESIDENTS ({residents.length})</span>
                    <div className="res-pagination">
                        <span className="preview-label">Preview</span>
                        {Array.from({length:pages},(_,i)=>i+1).map(n=>(
                            <button key={n} className={`page-num-btn${resPage===n?' active':''}`} onClick={()=>setResPage(n)}>{n}</button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // ── SCREEN 3+4: MEDICINES ─────────────────────────────────
    const renderMedicines = () => {
        const pagedSched = filteredSched.slice((schedPage-1)*PER, schedPage*PER);
        const remaining  = filteredSched.length - schedPage*PER;

        return (
            <div>
                <div className="med-pills-row">
                    <span className="nurse-info-pill">Nurse: {user?.firstName} {user?.lastName}</span>
                    {user?.ward && <span className="nurse-info-pill">{user.ward}</span>}
                    <span className="nurse-info-pill">Shift: {shiftLabel.split(' ')[0]}</span>
                </div>

                <div className="med-filters-row">
                    <span className="filters-label">FILTERS:</span>
                    <select className="filter-select" value={filterStatus} onChange={e=>setFStatus(e.target.value)}>
                        <option value="All">Status: All</option>
                        <option value="overdue">Overdue</option>
                        <option value="scheduled">Upcoming</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="missed">Missed</option>
                    </select>
                    <select className="filter-select" value={filterResident} onChange={e=>setFRes(e.target.value)}>
                        {residentNames.map(r=><option key={r} value={r}>{r==='All'?'Residents: All':r}</option>)}
                    </select>
                    <select className="filter-select" value={sortTime} onChange={e=>setSort(e.target.value)}>
                        <option value="Asc">Sort: Time ↑</option>
                        <option value="Desc">Sort: Time ↓</option>
                    </select>
                    <select className="filter-select"><option>Today</option><option>Tomorrow</option><option>This Week</option></select>
                    <div className="med-action-btns">
                        <button className="btn-primary-sm" onClick={()=>setModal({type:'addSchedule'})}><FaPlus /> Add Medication</button>
                        <button className="btn-outline-sm" onClick={()=>setModal({type:'voice'})}><FaMicrophone /> Voice Document</button>
                        <button className="btn-outline-sm" onClick={()=>setModal({type:'qr'})}><FaQrcode /> QR Verify</button>
                    </div>
                </div>

                <div className="card-white mb-18">
                    <div className="sched-table-header">
                        TODAY'S MEDICATION SCHEDULE ({filteredSched.length} Medication{filteredSched.length!==1?'s':''})
                    </div>
                    <div className="table-scroll">
                        <table className="custom-table">
                            <thead><tr><th>Status</th><th>Time</th><th>Residents</th><th>Room</th><th>Medication</th><th>Dosage</th><th>Action</th></tr></thead>
                            <tbody>
                                {pagedSched.length===0
                                    ? <tr><td colSpan="7" className="text-center no-data-italic">No medication schedule for today.</td></tr>
                                    : pagedSched.map(item=>{
                                        const mins = item.status==='overdue' ? getMinutesSince(item.scheduledTime) : null;
                                        const tStr = item.scheduledTime ? new Date(item.scheduledTime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : '—';
                                        return(
                                            <tr key={item._id}>
                                                <td><Badge s={item.status} /></td>
                                                <td className="sched-time-cell">
                                                    {tStr}
                                                    {mins!==null && <div className="sched-overdue-min">({mins} min)</div>}
                                                </td>
                                                <td><strong>{item.residentName||'—'}</strong></td>
                                                <td className="td-sm">{item.floor&&`${item.floor},`} {item.room||'—'}</td>
                                                <td>
                                                    <strong className="td-sm">{item.medicationName||'—'}</strong>
                                                    {item.condition && <div className="sched-med-condition">For {item.condition}</div>}
                                                </td>
                                                <td className="td-sm">{item.dosage||'—'}</td>
                                                <td><SchedActionBtn item={item} /></td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    {remaining>0 && (
                        <div className="sched-show-more">
                            <button onClick={()=>setSchedPage(p=>p+1)}>Show {remaining} more medications….</button>
                        </div>
                    )}
                </div>

                <div className="card-white mb-18">
                    <div className="card-header"><h5>Active Medication By Residents</h5></div>
                    <div className="table-scroll">
                        <table className="custom-table">
                            <thead><tr><th>Residents</th><th>Medication</th><th>Dosage</th><th>Time</th><th>Next Dose</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                {groupedByResident.length===0
                                    ? <tr><td colSpan="7" className="text-center no-data-italic">No active medication records yet.</td></tr>
                                    : groupedByResident.map(grp =>
                                        grp.meds.map((m,mi)=>(
                                            <tr key={m._id}>
                                                {mi===0 && (
                                                    <td rowSpan={grp.meds.length} className="active-med-resident-cell">
                                                        <div className="active-med-res-name">{grp.name}</div>
                                                        {grp.room && <div className="active-med-res-room">Room {grp.room}</div>}
                                                        {grp.meds.some(x=>x.status==='overdue') && <div className="active-med-overdue-tag">OVERDUE</div>}
                                                    </td>
                                                )}
                                                <td className="td-sm">{m.medicationName||'—'}</td>
                                                <td className="td-sm">{m.dosage||'—'}</td>
                                                <td className="td-xs td-nowrap">
                                                    {m.scheduledTime?new Date(m.scheduledTime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}):'—'}
                                                    {m.frequency && <div className="med-frequency">{m.frequency}</div>}
                                                </td>
                                                <td className="td-xs">{m.nextDose||'—'}</td>
                                                <td><DotBadge s={m.status} /></td>
                                                <td>
                                                    <ActionMenu
                                                        onViewHistory={()=>setModal({type:'history',data:residents.find(r=>r.name===grp.name)||{_id:m.residentId,name:grp.name}})}
                                                        onAddMedication={()=>setModal({type:'addSchedule',data:{residentId:m.residentId}})}
                                                        onEditSchedule={()=>setModal({type:'editSchedule',data:m})}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                            </tbody>
                        </table>
                    </div>

                    <div className="inv-status-section">
                        <h5>Medication Inventory Status</h5>
                        <div className="table-scroll">
                            <table className="custom-table">
                                <thead><tr><th>Medication</th><th>Ward</th><th>Stock Level</th></tr></thead>
                                <tbody>
                                    {inventory.length===0
                                        ? <tr><td colSpan="3" className="text-center no-data-italic">No inventory data available.</td></tr>
                                        : inventory.slice(0,8).map(item=>{
                                            const daysLeft = item.expirationDate ? Math.ceil((new Date(item.expirationDate)-Date.now())/86400000) : null;
                                            const isOut = item.quantity===0;
                                            const isLow = !isOut && item.quantity<=(item.minThreshold??10);
                                            const isExp = daysLeft!==null && daysLeft<=30;
                                            const txt   = isOut?'Out of Stock':isLow?`Low — ${item.quantity} ${item.unit}`:isExp?`${daysLeft} Days Remaining`:`${item.quantity} ${item.unit}`;
                                            const cls   = isOut||(daysLeft<0)?'inv-stock-out':isLow||isExp?'inv-stock-low':'inv-stock-ok';
                                            return (
                                                <tr key={item._id}>
                                                    <td><strong>{item.name}</strong></td>
                                                    <td className="inv-ward-cell">{user?.ward||'—'} Cabinet</td>
                                                    <td className={cls}>{txt}</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                        <div className="inv-action-row">
                            <button className="btn-primary-sm" onClick={()=>setModal({type:'requestStock'})}>Request Stock</button>
                            <button className="btn-primary-sm" onClick={()=>setSection('verify')}>View Full History</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ── SCREEN: VERIFY ────────────────────────────────────────
    const renderVerify = () => (
        <div className="card-white">
            <div className="card-header"><h5><FaQrcode className="mr-8" />QR / Barcode Verification</h5></div>
            <div className="verify-wrapper">
                <div className="verify-scan-box">
                    <FaQrcode />
                    <p>Scan a medication QR code or enter Item ID to verify before administration.</p>
                    <button className="btn-primary-sm verify-scan-btn" onClick={()=>setModal({type:'qr'})}><FaQrcode /> Open QR Scanner</button>
                </div>
                <div className="verify-voice-box">
                    <h6>Voice Documentation</h6>
                    <p>Record verbal notes for medication administration or observations.</p>
                    <button className="btn-primary-sm" onClick={()=>setModal({type:'voice'})}><FaMicrophone /> Open Voice Documentation</button>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        if (loading) return <div className="nurse-loading"><FaSpinner className="spin" /> Loading dashboard…</div>;
        switch (activeSection) {
            case 'home':      return renderHome();
            case 'residents': return renderResidents();
            case 'medicines': return renderMedicines();
            case 'verify':    return renderVerify();
            default:          return renderHome();
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="dashboard-body">

                <div className="sidebar nurse-sidebar">
                    <div className="sidebar-header">
                        <div className="brand-section">
                            <div className="logo-circle" />
                            <div className="brand-text"><h4>Kanang-Alalay</h4><h5>NURSE / CAREGIVER</h5></div>
                        </div>
                    </div>
                    <ul className="sidebar-menu">
                        {[
                            { key:'home',      icon:<FaHome />,   label:'Home' },
                            { key:'residents', icon:<FaUsers />,  label:'Residents' },
                            { key:'medicines', icon:<FaPills />,  label:'Medicines', badge:stats.overdue },
                            { key:'verify',    icon:<FaQrcode />, label:'Verify' },
                        ].map(({ key, icon, label, badge }) => (
                            <li key={key} className={activeSection===key?'active':''} onClick={()=>setSection(key)}>
                                {icon} {label}
                                {badge > 0 && <span className="sidebar-badge">{badge}</span>}
                            </li>
                        ))}
                    </ul>
                    <div className="sidebar-footer" onClick={handleLogout}><FaSignOutAlt /> <span>LOGOUT</span></div>
                </div>

                <div className="main-content-wrapper">
                    <div className="admin-topbar nurse-topbar">
                        <div className="topbar-left">
                            <div className="topbar-search-wrapper">
                                <FaSearch className="topbar-search-icon" />
                                <input type="text" className="topbar-search-input"
                                    placeholder={activeSection==='residents'?'Search residents, rooms, conditions…':activeSection==='medicines'?'Search medications, residents…':'Search…'}
                                    value={searchQuery}
                                    onChange={e=>setSearch(e.target.value)} />
                                {searchQuery && <button className="search-clear-btn" onClick={()=>setSearch('')}><FaTimes /> Clear</button>}
                            </div>
                        </div>
                        <div className="topbar-right">
                            <button className="topbar-icon-btn" title="Voice Note" onClick={()=>setModal({type:'voice'})}><FaMicrophone /></button>
                            <button className="topbar-icon-btn" title="QR Scan"    onClick={()=>setModal({type:'qr'})}><FaQrcode /></button>
                            <div className="topbar-user-menu">
                                <div className={`topbar-user-trigger ${accountMenuOpen?'active':''}`} onClick={()=>setAcctMenu(o=>!o)}>
                                    <FaUserCircle className="topbar-user-avatar" />
                                    <div className="topbar-user-info">
                                        <span className="topbar-user-name">{user?.firstName} {user?.lastName}</span>
                                        <span className="topbar-user-role">{user?.role?.toUpperCase()}</span>
                                    </div>
                                    <FaChevronDown className={`topbar-arrow ${accountMenuOpen?'rotate':''}`} />
                                </div>
                                {accountMenuOpen && (
                                    <ul className="topbar-dropdown">
                                        <li onClick={()=>{ navigate('/profile');  setAcctMenu(false); }}><FaUserCircle /> View Profile</li>
                                        <li onClick={()=>{ navigate('/settings'); setAcctMenu(false); }}><FaCog /> Account Settings</li>
                                        <li onClick={()=>{ navigate('/help');     setAcctMenu(false); }}><FaQuestionCircle /> Help Center</li>
                                        <li className="dropdown-divider" onClick={handleLogout}><FaSignOutAlt /> Sign Out</li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="main-content">{renderContent()}</div>
                </div>
            </div>

            {modal?.type==='addResident'  && <AddResidentModal  onClose={()=>setModal(null)} onSaved={r=>{ setResidents(p=>[...p,r]); }} doFetch={doFetch} toast={toast} />}
            {modal?.type==='profile'      && <ProfileModal      onClose={()=>setModal(null)} resident={modal.data} schedule={schedule} />}
            {modal?.type==='vitals'       && <VitalsModal       onClose={()=>setModal(null)} resident={modal.data} doFetch={doFetch} toast={toast} />}
            {modal?.type==='history'      && <HistoryModal      onClose={()=>setModal(null)} resident={modal.data} doFetch={doFetch} />}
            {modal?.type==='addSchedule'  && <AddScheduleModal  onClose={()=>setModal(null)} residents={residents} medications={medications} onSaved={l=>setSchedule(p=>[...p,l])} doFetch={doFetch} toast={toast} defaultResident={modal.data?{_id:modal.data.residentId}:null} />}
            {modal?.type==='editSchedule' && <EditScheduleModal onClose={()=>setModal(null)} log={modal.data} onSaved={u=>setSchedule(p=>p.map(l=>l._id===u._id?{...l,...u}:l))} doFetch={doFetch} toast={toast} />}
            {modal?.type==='requestStock' && <RequestStockModal onClose={()=>setModal(null)} items={inventory} doFetch={doFetch} toast={toast} />}
            {modal?.type==='voice'        && <VoiceModal        onClose={()=>setModal(null)} doFetch={doFetch} toast={toast} logId={modal.data?.logId} />}
            {modal?.type==='qr'           && <QrModal           onClose={()=>setModal(null)} inventory={inventory} />}

            {/* Logout Confirm */}
            {showLogoutConfirm && (
                <div className="modal-overlay" style={{zIndex:10002}}>
                    <div className="registration-modal" style={{maxWidth:380,padding:28}}>
                        <div className="logout-confirm-header">
                            <FaSignOutAlt className="logout-confirm-icon" />
                            <h4>Sign Out</h4>
                        </div>
                        <p className="logout-confirm-msg">Are you sure you want to sign out? Any unsaved changes will be lost.</p>
                        <div className="modal-footer">
                            <button className="btn-outline-sm" onClick={()=>setShowLogoutConfirm(false)}>Cancel</button>
                            <button className="btn-logout-confirm" onClick={confirmLogout}>
                                <FaSignOutAlt /> Yes, Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="toast-container">
                {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onDone={()=>setToasts(p=>p.filter(x=>x.id!==t.id))} />)}
            </div>
        </div>
    );
};

export default NurseDashboard;