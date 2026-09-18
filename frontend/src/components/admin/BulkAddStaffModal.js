/**
 * BulkAddStaffModal.js
 *
 * "Add Multiple Staff" — CSV bulk import for the User Management page.
 *
 * PART 16
 * ───────
 * Mirrors the established Inventory bulk-import pattern (see the
 * BulkImportModal component in InventoryTab.js): upload → parse/validate →
 * preview (valid vs invalid rows, reasons shown) → confirm → import →
 * result summary. Same modal chrome, same step indicator, same color
 * language, so it reads as the same feature applied to a different form.
 *
 * Unlike Inventory's bulk import (which currently posts once per row to
 * POST /admin/inventory from the frontend), this one calls the dedicated
 * backend bulk endpoint, POST /admin/staff/bulk-import, in a single
 * request. That endpoint runs every row through the exact same
 * createEnhancedStaffAccount() logic that POST /admin/create-user-enhanced
 * (the single "Add New Staff" flow) uses — same password/username/staffId
 * generation, same welcome email, same pending/first-login state — so
 * bulk-created accounts behave identically to individually-created ones,
 * and the two paths can never validate a row differently. It also means
 * exactly one audit record is written for the whole batch, not one per
 * CSV row parsed.
 *
 * Required CSV columns mirror the existing 3-step "Add New Staff" form
 * exactly (see AddStaffModal.js): firstName, lastName, email, phone, role,
 * shift. Phone is optional there, so it stays optional here too.
 */

import React, { useState, useRef } from 'react';
import {
    FaTimes, FaCloudUploadAlt, FaFileAlt, FaDownload,
    FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaUpload, FaUsers,
} from 'react-icons/fa';
import { API_URL } from '../../config/api';

// ─── constants (kept in lockstep with AddStaffModal.js / User.js) ────────────

const VALID_ROLES = ['admin', 'head_caregiver', 'caregiver'];
const ROLE_LABEL = { admin: 'Admin', head_caregiver: 'Head Caregiver', caregiver: 'Caregiver' };

// Mirrors getAvailableShifts() in AddStaffModal.js and the shift/role
// validator on the User schema (User.js): Admins must be FLEXIBLE,
// everyone else must be DAY or NIGHT.
const shiftsAllowedForRole = (role) => (role === 'admin' ? ['FLEXIBLE'] : ['DAY', 'NIGHT']);

const CSV_TEMPLATE_HEADERS = 'firstName,lastName,email,phone,role,shift';
const CSV_TEMPLATE_EXAMPLE = [
    'Juan,Dela Cruz,juan.delacruz@example.com,09171234567,caregiver,DAY',
    'Maria,Santos,maria.santos@example.com,09181234567,caregiver,NIGHT',
    'Rosa,Reyes,rosa.reyes@example.com,,head_caregiver,DAY',
    'Ana,Lopez,ana.lopez@example.com,09201234567,admin,FLEXIBLE',
].join('\n');

// ─── CSV parsing + validation ─────────────────────────────────────────────────
// Deliberately the same hand-rolled parser style as InventoryTab.js's
// parseCSV (quoted-field handling, lower-cased header lookup) rather than a
// second parsing approach.

const parseStaffCSV = (text, existingEmails = [], existingPhones = []) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['firstname', 'lastname', 'email', 'role', 'shift'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) return { rows: [], error: `Missing required columns: ${missing.join(', ')}` };

    const existingEmailSet = new Set(existingEmails.map(e => (e || '').toLowerCase()));
    const seenEmails = new Set();
    const seenPhones = new Set();

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        // Handle quoted fields, same as InventoryTab.js's parser.
        const cols = [];
        let cur = '', inQ = false;
        for (const ch of lines[i]) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        cols.push(cur.trim());

        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });

        const firstName = row.firstname || '';
        const lastName  = row.lastname || '';
        const middleName = row.middlename || '';
        const email = (row.email || '').trim();
        const phone = (row.phone || '').trim();
        const roleRaw = (row.role || '').trim();
        const shiftRaw = (row.shift || '').trim().toUpperCase();

        const errors = [];
        const nameRegex = /^[a-zA-Z\s\-']*$/;

        if (!firstName.trim()) errors.push('First name is required');
        else if (!nameRegex.test(firstName)) errors.push('First name cannot contain numbers');

        if (!lastName.trim()) errors.push('Last name is required');
        else if (!nameRegex.test(lastName)) errors.push('Last name cannot contain numbers');
        else if (lastName.trim().length < 2) errors.push('Surname must be at least 2 characters');

        if (!email) errors.push('Email is required');
        else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Invalid email address');
        else {
            const lower = email.toLowerCase();
            if (seenEmails.has(lower)) errors.push('Duplicate email within this file');
            else if (existingEmailSet.has(lower)) errors.push('Email already exists');
            seenEmails.add(lower);
        }

        if (phone) {
            if (!/^09\d{9}$/.test(phone)) errors.push('Phone must start with 09 and be exactly 11 digits');
            else if (existingPhones.includes(phone) || seenPhones.has(phone)) errors.push('Phone number already in use');
            seenPhones.add(phone);
        }

        const role = roleRaw.toLowerCase();
        if (!roleRaw) errors.push('Role is required');
        else if (!VALID_ROLES.includes(role)) errors.push(`Invalid role: ${roleRaw}`);

        const allowedShifts = shiftsAllowedForRole(role);
        if (!shiftRaw) errors.push('Assigned Shift is required');
        else if (!['DAY', 'NIGHT', 'FLEXIBLE'].includes(shiftRaw)) errors.push(`Invalid shift: ${shiftRaw}`);
        else if (VALID_ROLES.includes(role) && !allowedShifts.includes(shiftRaw)) {
            errors.push(
                role === 'admin'
                    ? 'Admin accounts must use the FLEXIBLE shift'
                    : `${ROLE_LABEL[role]} accounts must use DAY or NIGHT shift`
            );
        }

        rows.push({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim(),
            email,
            phone,
            role,
            roleRaw,
            shift: shiftRaw,
            errors,
            valid: errors.length === 0,
        });
    }
    return { rows, error: null };
};

// ─── modal ─────────────────────────────────────────────────────────────────

const BulkAddStaffModal = ({ onClose, onImported, existingEmails = [], existingPhones = [] }) => {
    const [step, setStep]             = useState('upload'); // 'upload' | 'preview' | 'importing' | 'done'
    const [dragOver, setDragOver]     = useState(false);
    const [rows, setRows]             = useState([]);
    const [parseError, setParseError] = useState('');
    const [fileName, setFileName]     = useState('');
    const [results, setResults]       = useState({ success: 0, failed: 0, failedRows: [] });
    const [importError, setImportError] = useState('');
    const fileRef = useRef(null);

    const handleFile = (file) => {
        if (!file) return;
        if (!file.name.endsWith('.csv')) { setParseError('Please upload a .csv file.'); return; }
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const { rows: parsed, error } = parseStaffCSV(e.target.result, existingEmails, existingPhones);
            if (error) { setParseError(error); return; }
            setParseError('');
            setRows(parsed);
            setStep('preview');
        };
        reader.readAsText(file);
    };

    const handleDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const downloadCSVTemplate = () => {
        const blob = new Blob([CSV_TEMPLATE_HEADERS + '\n' + CSV_TEMPLATE_EXAMPLE], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'staff_import_template.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = async () => {
        const valid = rows.filter(r => r.valid);
        if (!valid.length) return;
        setStep('importing');
        setImportError('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/staff/bulk-import`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    staff: valid.map(r => ({
                        firstName: r.firstName,
                        lastName: r.lastName,
                        middleName: r.middleName,
                        email: r.email,
                        phone: r.phone,
                        role: r.role,
                        shift: r.shift,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Bulk import failed.');

            const failedRows = (data.results || []).filter(r => !r.success);
            const createdUsers = (data.results || []).filter(r => r.success && r.user).map(r => r.user);

            setResults({ success: data.count || 0, failed: data.failed || 0, failedRows });
            onImported && onImported(createdUsers);
            setStep('done');
        } catch (e) {
            setImportError(e.message || 'Bulk import failed.');
            setStep('preview'); // stay on preview so the admin can retry
        }
    };

    const validCount   = rows.filter(r => r.valid).length;
    const invalidCount = rows.filter(r => !r.valid).length;

    // ── Styles — matches BulkImportModal in InventoryTab.js ──────────────────
    const overlay = { position: 'fixed', inset: 0, background: 'rgba(20,8,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
    const modal   = { background: '#fff', borderRadius: 20, width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' };
    const header  = { padding: '18px 24px', background: 'linear-gradient(135deg, #b85c2d, #7d3a06)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 };
    const body    = { padding: '24px', overflowY: 'auto', flex: 1 };
    const footer  = { padding: '16px 24px', borderTop: '1.5px solid #E8D6CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF8F3', flexShrink: 0 };
    const pill    = (color, bg) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: '.74rem', fontWeight: 700, color, background: bg, border: `1.5px solid ${color}30` });

    return (
        <div style={overlay}>
            <div style={modal}>
                {/* Header */}
                <div style={header}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaUsers style={{ color: '#fff', fontSize: '1.05rem' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.05rem' }}>Add Multiple Staff</h4>
                        <small style={{ color: 'rgba(255,255,255,.7)', fontSize: '.76rem' }}>
                            {step === 'upload' && 'Upload a .csv file to add multiple staff accounts at once'}
                            {step === 'preview' && `Previewing ${rows.length} row${rows.length !== 1 ? 's' : ''} from ${fileName}`}
                            {step === 'importing' && 'Creating accounts, please wait…'}
                            {step === 'done' && 'Import complete'}
                        </small>
                    </div>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {['upload', 'preview', 'done'].map((s, idx) => (
                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 700, background: step === s ? '#fff' : 'rgba(255,255,255,.25)', color: step === s ? '#b85c2d' : 'rgba(255,255,255,.8)' }}>
                                    {idx + 1}
                                </div>
                                {idx < 2 && <div style={{ width: 18, height: 2, background: 'rgba(255,255,255,.3)' }} />}
                            </div>
                        ))}
                    </div>
                    <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.25)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                        <FaTimes size={12} />
                    </button>
                </div>

                {/* Body */}
                <div style={body}>

                    {/* ── STEP 1: Upload ── */}
                    {step === 'upload' && (<>
                        {/* Template download */}
                        <div style={{ background: 'linear-gradient(135deg, #FFF8F3, #fef3ec)', border: '1.5px solid #F3D5C0', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #F96B38, #D94E1B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FaFileAlt style={{ color: '#fff' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: 700, color: '#1A0A00', fontSize: '.9rem' }}>Download Staff Import Template</p>
                                <p style={{ margin: '4px 0 10px', color: '#7A5C4E', fontSize: '.82rem', lineHeight: 1.5 }}>
                                    Required columns: <strong>firstName, lastName, email, role, shift</strong>. Optional: phone.
                                </p>
                                <button onClick={downloadCSVTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: '1.5px solid #F96B38', background: 'transparent', color: '#D94E1B', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                                    <FaDownload size={11} /> Download CSV Template
                                </button>
                            </div>
                        </div>

                        {/* Drop zone */}
                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileRef.current?.click()}
                            style={{
                                border: `2.5px dashed ${dragOver ? '#b85c2d' : '#E8D6CC'}`,
                                borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                                cursor: 'pointer', transition: 'all .25s',
                                background: dragOver ? '#FFF0E8' : '#FAFAFA',
                            }}
                        >
                            <div style={{ width: 60, height: 60, borderRadius: '50%', background: dragOver ? 'linear-gradient(135deg, #F96B38, #D94E1B)' : '#F0E8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', transition: 'all .25s' }}>
                                <FaCloudUploadAlt style={{ fontSize: '1.6rem', color: dragOver ? '#fff' : '#b85c2d' }} />
                            </div>
                            <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#1A0A00', fontSize: '1rem', fontFamily: "'Playfair Display', serif" }}>
                                {dragOver ? 'Release to upload' : 'Drag & drop your CSV here'}
                            </p>
                            <p style={{ margin: 0, color: '#7A5C4E', fontSize: '.83rem' }}>or <span style={{ color: '#b85c2d', fontWeight: 700 }}>click to browse</span> — .csv files only</p>
                            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                        </div>

                        {parseError && (
                            <div style={{ marginTop: 14, padding: '10px 14px', background: '#fdecea', border: '1.5px solid #f5c6cb', borderRadius: 10, color: '#721c24', fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FaTimesCircle /> {parseError}
                            </div>
                        )}

                        {/* Format guide */}
                        <div style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #E8D6CC' }}>
                            <div style={{ background: '#E8D6CC', padding: '8px 16px' }}>
                                <small style={{ fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', fontSize: '.7rem', letterSpacing: '.06em' }}>Expected Format</small>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                                    <thead>
                                        <tr style={{ background: '#FFF8F3' }}>
                                            {['firstName *', 'lastName *', 'email *', 'phone', 'role *', 'shift *'].map(h => (
                                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#7A5C4E', fontWeight: 700, borderBottom: '1px solid #E8D6CC', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>Juan</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>Dela Cruz</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>juan.delacruz@example.com</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#7A5C4E', fontStyle: 'italic' }}>optional</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>caregiver</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>DAY</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '10px 14px', background: '#FFF8F3', borderTop: '1.5px solid #E8D6CC' }}>
                                <small style={{ color: '#7A5C4E', fontSize: '.75rem', display: 'block', marginBottom: 6 }}>
                                    Required fields: firstName, lastName, email, role, shift. Valid roles:{' '}
                                    <code style={{ background: '#E8D6CC', padding: '1px 5px', borderRadius: 4 }}>{VALID_ROLES.join(', ')}</code>
                                </small>
                                <small style={{ color: '#7A5C4E', fontSize: '.75rem', display: 'block' }}>
                                    Shift depends on role: <code style={{ background: '#E8D6CC', padding: '1px 5px', borderRadius: 4 }}>admin</code> → FLEXIBLE only;{' '}
                                    <code style={{ background: '#E8D6CC', padding: '1px 5px', borderRadius: 4 }}>head_caregiver</code> / <code style={{ background: '#E8D6CC', padding: '1px 5px', borderRadius: 4 }}>caregiver</code> → DAY or NIGHT.
                                </small>
                                <small style={{ color: '#7A5C4E', fontSize: '.75rem', display: 'block', marginTop: 6 }}>
                                    Username, temporary password, and Staff ID are generated automatically — do not include them in the CSV.
                                </small>
                            </div>
                        </div>
                    </>)}

                    {/* ── STEP 2: Preview ── */}
                    {step === 'preview' && (<>
                        {/* Summary bar */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 130, background: '#e0faf4', border: '1.5px solid #0d6b4f30', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <FaCheckCircle style={{ color: '#0d6b4f', fontSize: '1.2rem' }} />
                                <div><div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0d6b4f' }}>{validCount}</div><div style={{ fontSize: '.74rem', color: '#0d6b4f', fontWeight: 600 }}>Ready to Import</div></div>
                            </div>
                            {invalidCount > 0 && (
                                <div style={{ flex: 1, minWidth: 130, background: '#fdecea', border: '1.5px solid #b71c1c30', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <FaTimesCircle style={{ color: '#b71c1c', fontSize: '1.2rem' }} />
                                    <div><div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#b71c1c' }}>{invalidCount}</div><div style={{ fontSize: '.74rem', color: '#b71c1c', fontWeight: 600 }}>Has Errors</div></div>
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 130, background: '#FFF8F3', border: '1.5px solid #E8D6CC', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <FaFileAlt style={{ color: '#b85c2d', fontSize: '1.2rem' }} />
                                <div><div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1A0A00' }}>{rows.length}</div><div style={{ fontSize: '.74rem', color: '#7A5C4E', fontWeight: 600 }}>Total Rows</div></div>
                            </div>
                        </div>

                        {invalidCount > 0 && (
                            <div style={{ background: '#fff8e1', border: '1.5px solid #ffc10740', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '.82rem', color: '#7c5a00', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <FaExclamationTriangle style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>Rows with errors will be <strong>skipped</strong>. Fix the CSV and re-upload to import all rows.</span>
                            </div>
                        )}

                        {importError && (
                            <div style={{ background: '#fdecea', border: '1.5px solid #f5c6cb', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '.82rem', color: '#721c24', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <FaTimesCircle style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>{importError}</span>
                            </div>
                        )}

                        {/* Preview table */}
                        <div style={{ borderRadius: 12, border: '1.5px solid #E8D6CC', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto', maxHeight: 340 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', background: '#b85c2d', position: 'sticky', top: 0, zIndex: 1 }}>#</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, background: '#b85c2d', position: 'sticky', top: 0, zIndex: 1 }}>Name</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, background: '#b85c2d', position: 'sticky', top: 0, zIndex: 1 }}>Email</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, background: '#b85c2d', position: 'sticky', top: 0, zIndex: 1 }}>Phone</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, background: '#b85c2d', position: 'sticky', top: 0, zIndex: 1 }}>Role</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, background: '#b85c2d', position: 'sticky', top: 0, zIndex: 1 }}>Shift</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, background: '#b85c2d', position: 'sticky', top: 0, zIndex: 1 }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => (
                                            <tr key={i} style={{ background: row.valid ? (i % 2 === 0 ? '#fff' : '#FAFAFA') : '#fff5f5', borderBottom: '1px solid #F0E8E0' }}>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E', fontWeight: 600 }}>{i + 1}</td>
                                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1A0A00' }}>{(row.firstName || row.lastName) ? `${row.firstName} ${row.lastName}`.trim() : <span style={{ color: '#ccc' }}>—</span>}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E' }}>{row.email || '—'}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E' }}>{row.phone || <span style={{ fontStyle: 'italic' }}>none</span>}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E' }}>{ROLE_LABEL[row.role] || row.roleRaw || '—'}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E' }}>{row.shift || '—'}</td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    {row.valid
                                                        ? <span style={pill('#0d6b4f', '#e0faf4')}><FaCheckCircle size={9} /> Valid</span>
                                                        : (
                                                            <span title={row.errors.join('; ')} style={{ ...pill('#b71c1c', '#fdecea'), cursor: 'help' }}>
                                                                <FaTimesCircle size={9} /> {row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1})` : ''}
                                                            </span>
                                                        )
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>)}

                    {/* ── STEP: Importing ── */}
                    {step === 'importing' && (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #F96B38, #D94E1B)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }}>
                                <FaCloudUploadAlt style={{ color: '#fff', fontSize: '1.8rem' }} />
                            </div>
                            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#1A0A00', margin: '0 0 6px', fontFamily: "'Playfair Display', serif" }}>Creating {validCount} account{validCount !== 1 ? 's' : ''}…</p>
                            <p style={{ color: '#7A5C4E', fontSize: '.85rem', margin: 0 }}>Please wait, do not close this window.</p>
                            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    {/* ── STEP: Done ── */}
                    {step === 'done' && (
                        <div style={{ textAlign: 'center', padding: '40px 20px 20px' }}>
                            <div style={{ width: 70, height: 70, borderRadius: '50%', background: results.success > 0 ? 'linear-gradient(135deg, #28a745, #1e7e34)' : '#dc3545', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                {results.success > 0 ? <FaCheckCircle style={{ color: '#fff', fontSize: '2rem' }} /> : <FaTimesCircle style={{ color: '#fff', fontSize: '2rem' }} />}
                            </div>
                            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1A0A00', margin: '0 0 10px', fontFamily: "'Playfair Display', serif" }}>Import Complete!</p>
                            <div style={{ display: 'inline-flex', gap: 12, background: '#FFF8F3', borderRadius: 14, padding: '14px 24px', border: '1.5px solid #E8D6CC', marginBottom: 14 }}>
                                <div><div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#28a745' }}>{results.success}</div><div style={{ fontSize: '.75rem', color: '#7A5C4E' }}>Successfully Added</div></div>
                                <div style={{ width: 1, background: '#E8D6CC' }} />
                                <div><div style={{ fontWeight: 800, fontSize: '1.4rem', color: results.failed > 0 ? '#dc3545' : '#ccc' }}>{results.failed}</div><div style={{ fontSize: '.75rem', color: '#7A5C4E' }}>Failed</div></div>
                            </div>

                            {results.failedRows.length > 0 && (
                                <div style={{ textAlign: 'left', marginTop: 6, borderRadius: 12, border: '1.5px solid #f5c6cb', overflow: 'hidden' }}>
                                    <div style={{ background: '#fdecea', padding: '8px 16px' }}>
                                        <small style={{ fontWeight: 700, color: '#b71c1c', textTransform: 'uppercase', fontSize: '.7rem', letterSpacing: '.06em' }}>Failed Rows</small>
                                    </div>
                                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                        {results.failedRows.map((r, idx) => (
                                            <div key={idx} style={{ padding: '8px 16px', borderBottom: idx < results.failedRows.length - 1 ? '1px solid #f5e0e0' : 'none', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '.82rem' }}>
                                                <span style={{ color: '#1A0A00', fontWeight: 600 }}>Row {r.row}{r.name ? ` — ${r.name}` : ''}</span>
                                                <span style={{ color: '#b71c1c' }}>{r.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={footer}>
                    <div>
                        {step === 'preview' && (
                            <button onClick={() => { setStep('upload'); setRows([]); setFileName(''); setImportError(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', color: '#7A5C4E', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem', fontFamily: "'DM Sans', sans-serif" }}>
                                ← Re-upload
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {step !== 'importing' && (
                            <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#7A5C4E', fontFamily: "'DM Sans', sans-serif" }}>
                                {step === 'done' ? 'Close' : 'Cancel'}
                            </button>
                        )}
                        {step === 'preview' && (
                            <button onClick={handleImport} disabled={validCount === 0} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: validCount === 0 ? '#ccc' : 'linear-gradient(135deg, #F96B38, #D94E1B)', color: '#fff', cursor: validCount === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 7 }}>
                                <FaUpload size={12} /> Import {validCount} Staff Account{validCount !== 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkAddStaffModal;