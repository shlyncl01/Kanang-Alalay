import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    FaBox, FaEdit, FaTrash, FaExclamationTriangle,
    FaClock, FaSearch, FaPrint, FaFilter,
    FaChevronLeft, FaChevronRight, FaTimes,
    FaUpload, FaFileAlt, FaCheckCircle, FaTimesCircle,
    FaDownload, FaCloudUploadAlt, FaBoxOpen, FaSyncAlt,
    FaEye, FaLayerGroup,
} from 'react-icons/fa';
import { CATEGORY_OPTIONS, CATEGORY_UNITS, getUnitsForCategory } from '../../constants/inventoryOptions';
import {
    groupInventoryByProduct, summarizeProductRows, EXPIRING_SOON_DAYS,
} from '../../utils/inventoryGrouping';

const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://kanang-alalay-backend.onrender.com/api'
        : 'http://localhost:5000/api');

const CATEGORIES = [
    'All', 'medication', 'medical_supplies', 'food', 'hygiene',
    'General', 'Cleaning', 'Equipment', 'Linens & Bedding',
];
// Backend category value -> the same friendly label used in the Add/Edit
// form dropdown (CATEGORY_OPTIONS), so the table/filter show "Medicine"
// instead of the raw enum value "medication".
const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((m, c) => ({ ...m, [c.value]: c.label }), {});
const getCategoryLabel = (value) => CATEGORY_LABELS[value] || value || '—';

const UNITS = ['pcs', 'box', 'bottle', 'pack', 'bag', 'kg', 'liters', 'set', 'roll', 'pair'];
const PER_PAGE = 10;
// Product-monitoring table filters (Part 3). "In Stock" / "Low Stock" /
// "Out of Stock" mirror the Status column exactly; "Expiring Soon" and
// "Expired" are separate, orthogonal concerns (a product can be In Stock
// overall while still having one batch that's expiring soon or expired).
const STATUS_FILTERS = ['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Expiring Soon', 'Expired'];

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

// Product-level status pill styling (main monitoring table), matching the
// same color language as getStatusStyle above.
const PRODUCT_STATUS_STYLE = {
    'In Stock':     { bg: '#e0faf4', color: '#0d6b4f' },
    'Low Stock':    { bg: '#fff8e1', color: '#7c5a00' },
    'Out of Stock': { bg: '#fdecea', color: '#b71c1c' },
};

// Per-batch status pill styling (Batch Details view).
const BATCH_STATUS_STYLE = {
    Active:   { bg: '#e0faf4', color: '#0d6b4f' },
    Depleted: { bg: '#f1f1f1', color: '#666' },
    Expired:  { bg: '#fdecea', color: '#b71c1c' },
};

// ── Bulk CSV Import Modal ──────────────────────────────────────────────────────
// Category/unit values below come from constants/inventoryOptions.js — the
// SAME source of truth used by the Add/Edit Inventory form — so the bulk
// importer can never drift out of sync with what the backend actually
// accepts (see inventoryFormValidation.js / inventoryCategoryUnits.js).
const VALID_CATEGORIES = CATEGORY_OPTIONS.map(c => c.value);

// `doesNotExpire` is included because the backend's shared
// validateInventoryInput (used by both the single-item Add/Edit form and,
// after this fix, bulk import) already requires an expirationDate for
// EVERY category unless doesNotExpire is explicitly true — that's the
// app's real, existing rule (see inventoryFormValidation.js), not just a
// medication-only rule. Without this column, any non-medication row with
// no expiration date would silently fail on import.
const CSV_TEMPLATE_HEADERS = 'name,category,quantity,unit,minThreshold,expirationDate,doesNotExpire,notes';
const CSV_TEMPLATE_EXAMPLE = [
    'Paracetamol 500mg,medication,100,tablet,20,2026-12-31,FALSE,Keep in cool dry place',
    'Face Masks,medical_supplies,500,pcs,50,,TRUE,Surgical grade',
    'Rice (5kg bag),food,30,bag,10,2026-06-30,FALSE,Store away from moisture',
    'Hand Sanitizer,hygiene,50,bottle,15,,TRUE,70% alcohol',
].join('\n');

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const isTruthyFlag = (v) => ['true', 'yes', '1'].includes(String(v).trim().toLowerCase());

const parseCSV = (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    // name, category, quantity, and unit are all required — this matches
    // the Add/Edit Inventory form, which requires all four (see
    // AddInventoryModal.js validate()).
    const required = ['name', 'category', 'quantity', 'unit'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) return { rows: [], error: `Missing required columns: ${missing.join(', ')}` };

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        // Handle quoted fields
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

        const errors = [];
        if (!row.name) errors.push('Name is required');

        const categoryValid = VALID_CATEGORIES.includes(row.category);
        if (!row.category) errors.push('Category is required');
        else if (!categoryValid) errors.push(`Category "${row.category}" is not valid. Valid categories: ${VALID_CATEGORIES.join(', ')}`);
        // Fall back to 'General' only so we have SOME category to check the
        // unit against below and to render in the preview table — rows
        // with an invalid/missing category are still marked invalid above
        // and will never be imported.
        const resolvedCategory = categoryValid ? row.category : 'General';
        const allowedUnits = getUnitsForCategory(resolvedCategory);

        const qty = Number(row.quantity);
        if (row.quantity === '' || isNaN(qty) || qty < 0) errors.push('Quantity must be a non-negative number');

        if (!row.unit) errors.push('Unit is required');
        else if (!allowedUnits.includes(row.unit)) {
            errors.push(`Unit "${row.unit}" is not valid for category "${resolvedCategory}". Valid units: ${allowedUnits.join(', ')}`);
        }

        const hasMinThreshold = row.minthreshold !== undefined && row.minthreshold !== '';
        if (hasMinThreshold && (isNaN(Number(row.minthreshold)) || Number(row.minthreshold) < 0)) {
            errors.push('minThreshold must be a non-negative number');
        }

        const doesNotExpire = isTruthyFlag(row.doesnotexpire);
        const expirationDate = row.expirationdate || '';
        if (expirationDate && !YYYY_MM_DD.test(expirationDate)) {
            errors.push('Expiration date must be in YYYY-MM-DD format');
        } else if (expirationDate && isNaN(Date.parse(expirationDate))) {
            errors.push('Expiration date is not a valid date');
        } else if (!expirationDate && !doesNotExpire) {
            // Mirrors validateInventoryInput on the backend: every category
            // needs an expiration date unless explicitly marked as not
            // expiring.
            errors.push('Expiration date is required, or set doesNotExpire to TRUE');
        }

        rows.push({
            _raw: row,
            name: row.name,
            category: resolvedCategory,
            quantity: isNaN(qty) ? 0 : qty,
            unit: row.unit || '',
            minThreshold: hasMinThreshold ? Number(row.minthreshold) : 10,
            expirationDate,
            doesNotExpire,
            notes: row.notes || '',
            errors,
            valid: errors.length === 0,
        });
    }
    return { rows, error: null };
};

const BulkImportModal = ({ onClose, onImported }) => {
    const [step, setStep]           = useState('upload'); // 'upload' | 'preview' | 'importing' | 'done'
    const [dragOver, setDragOver]   = useState(false);
    const [rows, setRows]           = useState([]);
    const [parseError, setParseError] = useState('');
    const [fileName, setFileName]   = useState('');
    const [results, setResults]     = useState({ success: 0, failed: 0 });
    const fileRef = useRef(null);

    const handleFile = (file) => {
        if (!file) return;
        if (!file.name.endsWith('.csv')) { setParseError('Please upload a .csv file.'); return; }
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const { rows: parsed, error } = parseCSV(e.target.result);
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
        const a = document.createElement('a'); a.href = url; a.download = 'inventory_template.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const [excelError, setExcelError] = useState('');
    const [excelBusy, setExcelBusy]   = useState(false);

    // A normal .csv file can't carry real dropdown/data-validation, so this
    // builds an .xlsx template where Category is a dropdown (from
    // CATEGORY_OPTIONS) and Unit is a dropdown that's dependent on
    // whichever Category is selected on that row (from CATEGORY_UNITS) —
    // both driven by the exact same constants/inventoryOptions.js values
    // used everywhere else, so the dropdowns can never offer a
    // category/unit combination the backend would reject.
    const downloadExcelTemplate = async () => {
        setExcelError('');
        setExcelBusy(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();

            // Sanitizes a category value into a valid Excel defined-name
            // fragment (letters/digits/underscore only) — used both when
            // creating the named range and in the row-level INDIRECT()
            // formula below, so the two always agree.
            const rangeKey = (category) =>
                'Units_' + category.replace(/&/g, 'and').replace(/[^a-zA-Z0-9]+/g, '_');

            // Hidden "Lists" sheet: column A holds every category value
            // (for the Category dropdown); one further column per
            // category holds that category's valid units (for the
            // dependent Unit dropdown).
            const lists = workbook.addWorksheet('Lists', { state: 'veryHidden' });
            lists.getColumn(1).values = ['Category', ...VALID_CATEGORIES];
            workbook.definedNames.add(`Lists!$A$2:$A$${VALID_CATEGORIES.length + 1}`, 'Category_List');

            VALID_CATEGORIES.forEach((category, idx) => {
                const col = idx + 2; // column B, C, D, ...
                const units = CATEGORY_UNITS[category] || [];
                lists.getColumn(col).values = [category, ...units];
                if (units.length) {
                    const colLetter = lists.getColumn(col).letter;
                    workbook.definedNames.add(
                        `Lists!$${colLetter}$2:$${colLetter}$${units.length + 1}`,
                        rangeKey(category)
                    );
                }
            });

            const sheet = workbook.addWorksheet('Inventory Import');
            const headers = ['name *', 'category *', 'quantity *', 'unit *', 'minThreshold', 'expirationDate', 'doesNotExpire', 'notes'];
            sheet.columns = headers.map((h) => ({ header: h, width: h === 'notes' ? 30 : 18 }));
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8D6CC' } };
            });
            sheet.getCell('B1').note = `Must be one of: ${VALID_CATEGORIES.join(', ')}`;
            sheet.getCell('D1').note = 'Valid options depend on the Category chosen in this row.';
            sheet.getCell('F1').note = 'Format: YYYY-MM-DD. Required unless doesNotExpire is TRUE.';
            sheet.getCell('G1').note = 'TRUE if this item has no expiration date, otherwise FALSE.';

            // A couple of example rows so the format is obvious, styled
            // distinctly and called out as examples to delete.
            const exampleRows = [
                ['Paracetamol 500mg', 'medication', 100, 'tablet', 20, '2026-12-31', false, 'Keep in cool dry place'],
                ['Face Masks', 'medical_supplies', 500, 'pcs', 50, '', true, 'Surgical grade — example row, delete before importing'],
            ];
            exampleRows.forEach((r) => {
                const row = sheet.addRow(r);
                row.eachCell((cell) => { cell.font = { italic: true, color: { argb: 'FF7A5C4E' } }; });
            });

            // Apply dropdown validation down through row 300 so pasted-in
            // data keeps working, not just the two example rows.
            const LAST_ROW = 300;
            for (let r = 2; r <= LAST_ROW; r++) {
                sheet.getCell(`B${r}`).dataValidation = {
                    type: 'list', allowBlank: true, formulae: ['=Category_List'],
                    showErrorMessage: true, errorTitle: 'Invalid category',
                    error: 'Please choose a category from the dropdown.',
                };
                sheet.getCell(`D${r}`).dataValidation = {
                    type: 'list', allowBlank: true,
                    formulae: [`=INDIRECT("Units_" & SUBSTITUTE(SUBSTITUTE($B${r},"&","and")," ","_"))`],
                    showErrorMessage: true, errorTitle: 'Invalid unit',
                    error: 'Choose a Category first, then pick one of the units valid for it.',
                };
                sheet.getCell(`G${r}`).dataValidation = {
                    type: 'list', allowBlank: true, formulae: ['"TRUE,FALSE"'],
                };
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'inventory_template.xlsx'; a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Excel template generation failed:', err);
            setExcelError('Could not generate the Excel template. Please try the CSV template instead.');
        } finally {
            setExcelBusy(false);
        }
    };

    const handleImport = async () => {
        const valid = rows.filter(r => r.valid);
        if (!valid.length) return;
        setStep('importing');
        const token = localStorage.getItem('token');
        let success = 0, failed = 0;
        const imported = [];
        for (const row of valid) {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/inventory`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                    body: JSON.stringify({
                        name: row.name, category: row.category, quantity: row.quantity,
                        unit: row.unit, minThreshold: row.minThreshold,
                        expirationDate: row.doesNotExpire ? undefined : (row.expirationDate || undefined),
                        doesNotExpire: row.doesNotExpire,
                        notes: row.notes,
                    }),
                });
                const data = await res.json();
                if (data.success) { success++; imported.push(data.data); }
                else failed++;
            } catch { failed++; }
        }
        setResults({ success, failed });
        onImported(imported);
        setStep('done');
    };

    const validCount   = rows.filter(r => r.valid).length;
    const invalidCount = rows.filter(r => !r.valid).length;

    // ── Styles ──────────────────────────────────────────────────────────────────
    const overlay = { position: 'fixed', inset: 0, background: 'rgba(20,8,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
    const modal   = { background: '#fff', borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' };
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
                        <FaCloudUploadAlt style={{ color: '#fff', fontSize: '1.1rem' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.05rem' }}>Bulk Import Inventory</h4>
                        <small style={{ color: 'rgba(255,255,255,.7)', fontSize: '.76rem' }}>
                            {step === 'upload' && 'Upload a .csv file to add multiple items at once'}
                            {step === 'preview' && `Previewing ${rows.length} row${rows.length !== 1 ? 's' : ''} from ${fileName}`}
                            {step === 'importing' && 'Importing items, please wait…'}
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
                                <p style={{ margin: 0, fontWeight: 700, color: '#1A0A00', fontSize: '.9rem' }}>Download Inventory Template</p>
                                <p style={{ margin: '4px 0 10px', color: '#7A5C4E', fontSize: '.82rem', lineHeight: 1.5 }}>
                                    Required columns: <strong>name, category, quantity, unit</strong>. Optional: minThreshold, expirationDate (YYYY-MM-DD), doesNotExpire, notes.
                                </p>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    <div>
                                        <button onClick={downloadCSVTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: '1.5px solid #F96B38', background: 'transparent', color: '#D94E1B', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                                            <FaDownload size={11} /> Download CSV Template
                                        </button>
                                        <p style={{ margin: '4px 0 0', color: '#7A5C4E', fontSize: '.72rem', maxWidth: 220 }}>For standard CSV imports.</p>
                                    </div>
                                    <div>
                                        <button onClick={downloadExcelTemplate} disabled={excelBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: '1.5px solid #F96B38', background: 'transparent', color: '#D94E1B', fontWeight: 700, fontSize: '.82rem', cursor: excelBusy ? 'wait' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: excelBusy ? 0.6 : 1 }}>
                                            <FaDownload size={11} /> {excelBusy ? 'Preparing…' : 'Download Excel Template'}
                                        </button>
                                        <p style={{ margin: '4px 0 0', color: '#7A5C4E', fontSize: '.72rem', maxWidth: 220 }}>
                                            Recommended — has Category/Unit dropdowns. Save as CSV before uploading here.
                                        </p>
                                    </div>
                                </div>
                                {excelError && (
                                    <p style={{ margin: '10px 0 0', color: '#b71c1c', fontSize: '.78rem' }}>{excelError}</p>
                                )}
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
                                            {['name *', 'category *', 'quantity *', 'unit *', 'minThreshold', 'expirationDate', 'doesNotExpire', 'notes'].map(h => (
                                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#7A5C4E', fontWeight: 700, borderBottom: '1px solid #E8D6CC', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>Paracetamol</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>medication</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>100</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>tablet</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>20</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>2026-12-31</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#1A0A00' }}>FALSE</td>
                                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0E8E0', color: '#7A5C4E', fontStyle: 'italic' }}>optional</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '10px 14px', background: '#FFF8F3', borderTop: '1.5px solid #E8D6CC' }}>
                                <small style={{ color: '#7A5C4E', fontSize: '.75rem', display: 'block', marginBottom: 6 }}>
                                    Required fields: name, category, quantity, unit. Valid categories:{' '}
                                    <code style={{ background: '#E8D6CC', padding: '1px 5px', borderRadius: 4 }}>{VALID_CATEGORIES.join(', ')}</code>
                                </small>
                                <small style={{ color: '#7A5C4E', fontSize: '.75rem', display: 'block', marginBottom: 6 }}>
                                    Unit depends on the category chosen for that row:
                                </small>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                                    {VALID_CATEGORIES.map(cat => (
                                        <small key={cat} style={{ color: '#7A5C4E', fontSize: '.72rem' }}>
                                            <code style={{ background: '#E8D6CC', padding: '1px 5px', borderRadius: 4 }}>{cat}</code>: {CATEGORY_UNITS[cat]?.join(', ')}
                                        </small>
                                    ))}
                                </div>
                                <small style={{ color: '#7A5C4E', fontSize: '.75rem', display: 'block', marginTop: 6 }}>
                                    Expiration date format: <code style={{ background: '#E8D6CC', padding: '1px 5px', borderRadius: 4 }}>YYYY-MM-DD</code>. Required unless doesNotExpire is TRUE.
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

                        {/* Preview table */}
                        <div style={{ borderRadius: 12, border: '1.5px solid #E8D6CC', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto', maxHeight: 340 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                                    <thead>
                                        <tr style={{ background: '#b85c2d', position: 'sticky', top: 0 }}>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>#</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>Name</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>Category</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>Qty</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>Unit</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>Min</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Expiry</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => (
                                            <tr key={i} style={{ background: row.valid ? (i % 2 === 0 ? '#fff' : '#FAFAFA') : '#fff5f5', borderBottom: '1px solid #F0E8E0' }}>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E', fontWeight: 600 }}>{i + 1}</td>
                                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1A0A00' }}>{row.name || <span style={{ color: '#ccc' }}>—</span>}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E' }}>{row.category}</td>
                                                <td style={{ padding: '8px 12px', fontWeight: 700, color: row.quantity === 0 ? '#dc3545' : '#1A0A00' }}>{row.quantity}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E' }}>{row.unit}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E' }}>{row.minThreshold}</td>
                                                <td style={{ padding: '8px 12px', color: '#7A5C4E', whiteSpace: 'nowrap', fontSize: '.74rem' }}>{row.expirationDate || (row.doesNotExpire ? 'No Expiry' : '—')}</td>
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
                            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#1A0A00', margin: '0 0 6px', fontFamily: "'Playfair Display', serif" }}>Importing {validCount} item{validCount !== 1 ? 's' : ''}…</p>
                            <p style={{ color: '#7A5C4E', fontSize: '.85rem', margin: 0 }}>Please wait, do not close this window.</p>
                            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    {/* ── STEP: Done ── */}
                    {step === 'done' && (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <div style={{ width: 70, height: 70, borderRadius: '50%', background: results.success > 0 ? 'linear-gradient(135deg, #28a745, #1e7e34)' : '#dc3545', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                {results.success > 0 ? <FaCheckCircle style={{ color: '#fff', fontSize: '2rem' }} /> : <FaTimesCircle style={{ color: '#fff', fontSize: '2rem' }} />}
                            </div>
                            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1A0A00', margin: '0 0 10px', fontFamily: "'Playfair Display', serif" }}>Import Complete!</p>
                            <div style={{ display: 'inline-flex', gap: 12, background: '#FFF8F3', borderRadius: 14, padding: '14px 24px', border: '1.5px solid #E8D6CC', marginBottom: 14 }}>
                                <div><div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#28a745' }}>{results.success}</div><div style={{ fontSize: '.75rem', color: '#7A5C4E' }}>Imported</div></div>
                                <div style={{ width: 1, background: '#E8D6CC' }} />
                                <div><div style={{ fontWeight: 800, fontSize: '1.4rem', color: results.failed > 0 ? '#dc3545' : '#ccc' }}>{results.failed}</div><div style={{ fontSize: '.75rem', color: '#7A5C4E' }}>Failed</div></div>
                            </div>
                            {results.failed > 0 && <p style={{ color: '#7A5C4E', fontSize: '.83rem', margin: 0 }}>Some items could not be saved. Check for duplicate names or server errors.</p>}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={footer}>
                    <div>
                        {step === 'preview' && (
                            <button onClick={() => { setStep('upload'); setRows([]); setFileName(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1.5px solid #E8D6CC', background: 'transparent', color: '#7A5C4E', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem', fontFamily: "'DM Sans', sans-serif" }}>
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
                                <FaUpload size={12} /> Import {validCount} Item{validCount !== 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Edit Modal ─────────────────────────────────────────────────────────────────
const EditItemModal = ({ item, onSave, onClose }) => {
    const [form, setForm] = useState({
        name:           item.name || '',
        category:       item.category || '',
        quantity:       item.quantity ?? 0,
        unit:           item.unit || '',
        minThreshold:   item.minThreshold ?? '',
        expirationDate: item.expirationDate ? item.expirationDate.slice(0, 10) : '',
        doesNotExpire:  item.doesNotExpire || false,
        brand:          item.brand || '',
        dosage:         item.dosage || '',
        notes:          item.notes || '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const validate = (f) => {
        const e = {};
        if (!f.name.trim()) e.name = 'Item name is required.';
        if (!f.category) e.category = 'Category is required.';

        if (f.quantity === '' || isNaN(f.quantity) || Number(f.quantity) < 0)
            e.quantity = 'Enter a valid, non-negative quantity.';

        if (!f.category) {
            e.unit = 'Select a category first.';
        } else if (!f.unit) {
            e.unit = 'Unit is required.';
        } else if (!getUnitsForCategory(f.category).includes(f.unit)) {
            e.unit = 'Selected unit is not valid for this category.';
        }

        if (f.minThreshold === '')
            e.minThreshold = 'Minimum stock level is required.';
        else if (isNaN(f.minThreshold) || Number(f.minThreshold) < 0)
            e.minThreshold = 'Minimum stock level cannot be negative.';

        if (!f.doesNotExpire) {
            if (!f.expirationDate) {
                e.expirationDate = 'Expiration date is required, or check "Does not expire".';
            } else if (isNaN(Date.parse(f.expirationDate))) {
                e.expirationDate = 'Enter a valid date.';
            } else {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                if (new Date(f.expirationDate) < today) {
                    e.expirationDate = 'Expiration date cannot be in the past.';
                }
            }
        }

        // Brand and Dosage are only required when Category is Medicine
        // ('medication') — mirrors AddInventoryModal.js and the model-level
        // requiredness in models/Inventory.js.
        if (f.category === 'medication') {
            if (!f.brand.trim()) e.brand = 'Brand is required for Medicine items.';
            if (!f.dosage.trim()) e.dosage = 'Dosage is required for Medicine items.';
        }

        return e;
    };

    const handleChange = (field, val) => {
        setForm(p => {
            const next = { ...p, [field]: val };
            if (field === 'category') {
                const validUnits = getUnitsForCategory(val);
                if (!validUnits.includes(p.unit)) next.unit = '';
            }
            if (field === 'doesNotExpire' && val === true) {
                next.expirationDate = '';
            }
            return next;
        });
        if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
        if (field === 'category' && errors.unit) setErrors(p => ({ ...p, unit: '' }));
        if (field === 'category' && val !== 'medication' && (errors.brand || errors.dosage)) {
            setErrors(p => ({ ...p, brand: '', dosage: '' }));
        }
        if (field === 'doesNotExpire' && errors.expirationDate) setErrors(p => ({ ...p, expirationDate: '' }));
        if (error) setError('');
    };

    const handleSave = async () => {
        const e = validate(form);
        if (Object.keys(e).length) { setErrors(e); return; }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/admin/inventory/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                body: JSON.stringify({
                    ...form,
                    quantity: Number(form.quantity),
                    minThreshold: Number(form.minThreshold),
                    expirationDate: form.doesNotExpire ? null : (form.expirationDate || undefined),
                    doesNotExpire: form.doesNotExpire,
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

    const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E8D6CC', borderRadius: 8, fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', system-ui, sans-serif" };
    const inpErr = { ...inp, borderColor: '#dc3545' };
    const lbl = { display: 'block', fontSize: '.75rem', fontWeight: 700, color: '#7A5C4E', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 };
    const errTxt = { color: '#dc3545', fontSize: '.74rem', marginTop: 3, display: 'block' };

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
                        <input style={errors.name ? inpErr : inp} value={form.name} onChange={e => handleChange('name', e.target.value)} />
                        {errors.name && <small style={errTxt}>{errors.name}</small>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div><label style={lbl}>Category *</label>
                            <select style={errors.category ? inpErr : inp} value={form.category} onChange={e => handleChange('category', e.target.value)}>
                                <option value="">Select category…</option>
                                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            {errors.category && <small style={errTxt}>{errors.category}</small>}
                        </div>
                        <div><label style={lbl}>Unit *</label>
                            <select
                                style={{ ...(errors.unit ? inpErr : inp), opacity: form.category ? 1 : 0.6, cursor: form.category ? 'pointer' : 'not-allowed' }}
                                value={form.unit}
                                onChange={e => handleChange('unit', e.target.value)}
                                disabled={!form.category}
                            >
                                <option value="">{form.category ? 'Select unit…' : 'Select category first'}</option>
                                {getUnitsForCategory(form.category).map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            {errors.unit && <small style={errTxt}>{errors.unit}</small>}
                        </div>
                    </div>

                    {/* Brand + Dosage — only shown/required when Category is Medicine */}
                    {form.category === 'medication' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div><label style={lbl}>Brand *</label>
                                <input style={errors.brand ? inpErr : inp} value={form.brand} onChange={e => handleChange('brand', e.target.value)} placeholder="e.g., Unilab" />
                                {errors.brand && <small style={errTxt}>{errors.brand}</small>}
                            </div>
                            <div><label style={lbl}>Dosage *</label>
                                <input style={errors.dosage ? inpErr : inp} value={form.dosage} onChange={e => handleChange('dosage', e.target.value)} placeholder="e.g., 500 mg" />
                                {errors.dosage && <small style={errTxt}>{errors.dosage}</small>}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div><label style={lbl}>Quantity *</label>
                            <input type="number" min="0" style={errors.quantity ? inpErr : inp} value={form.quantity} onChange={e => handleChange('quantity', e.target.value)} />
                            {errors.quantity && <small style={errTxt}>{errors.quantity}</small>}
                        </div>
                        <div><label style={lbl}>Min Stock Level *</label>
                            <input type="number" min="0" style={errors.minThreshold ? inpErr : inp} value={form.minThreshold} onChange={e => handleChange('minThreshold', e.target.value)} />
                            {errors.minThreshold && <small style={errTxt}>{errors.minThreshold}</small>}
                        </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                        <label style={lbl}>Expiration Date {!form.doesNotExpire && '*'}</label>
                        <input
                            type="date"
                            style={{ ...(errors.expirationDate ? inpErr : inp), opacity: form.doesNotExpire ? 0.6 : 1 }}
                            value={form.expirationDate}
                            onChange={e => handleChange('expirationDate', e.target.value)}
                            disabled={form.doesNotExpire}
                        />
                        {errors.expirationDate && <small style={errTxt}>{errors.expirationDate}</small>}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.83rem', color: '#2c3e50', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.doesNotExpire} onChange={e => handleChange('doesNotExpire', e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                            This item does not expire
                        </label>
                    </div>
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

// ── Batch Details Modal ("View/Manage" action, Part 3) ──────────────────────────
// Shows every batch belonging to one product. The product row on the main
// table stays a single row no matter how many batches exist — this modal is
// where individual batches are actually inspected/edited/deleted.
const BatchDetailsModal = ({ product, onClose, onEditBatch, onDeleteBatch }) => {
    if (!product) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
            <div className="registration-modal" style={{ maxWidth: 720, padding: 0 }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '20px 26px', background: 'linear-gradient(135deg, #b85c2d, #7d3a06)',
                    borderRadius: '20px 20px 0 0',
                }}>
                    <div>
                        <h4 style={{ margin: 0, color: '#fff', fontFamily: "'Playfair Display', serif", display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.1rem' }}>
                            <FaLayerGroup /> {product.name}
                        </h4>
                        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,.85)', fontSize: '.82rem' }}>
                            {getCategoryLabel(product.category)} · {product.batches.length} batch{product.batches.length === 1 ? '' : 'es'} · Total Stock: {product.totalStock} {product.unit}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.2)', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FaTimes size={12} />
                    </button>
                </div>

                <div style={{ padding: '20px 26px', maxHeight: '65vh', overflowY: 'auto' }}>
                    {product.batches.length === 0 ? (
                        <p style={{ color: '#7A5C4E', textAlign: 'center', padding: '1.5rem 0' }}>
                            This product has no batches left. It will disappear from the table once refreshed.
                        </p>
                    ) : (
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>Batch</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Expiration Date</th>
                                    <th>Batch Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.batches.map(batch => {
                                    const st = BATCH_STATUS_STYLE[batch.batchStatus] || BATCH_STATUS_STYLE.Active;
                                    return (
                                        <tr key={batch._id}>
                                            <td><strong>#{batch.batchNumber || '—'}</strong></td>
                                            <td>{batch.quantity}</td>
                                            <td>{batch.unit}</td>
                                            <td style={{ fontSize: '.85rem' }}>
                                                {batch.doesNotExpire
                                                    ? <span style={{ color: '#7A5C4E' }}>Does not expire</span>
                                                    : batch.expirationDate
                                                        ? new Date(batch.expirationDate).toLocaleDateString()
                                                        : <span style={{ color: '#ccc' }}>—</span>}
                                            </td>
                                            <td>
                                                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: '.76rem', fontWeight: 700, background: st.bg, color: st.color, border: `1.5px solid ${st.color}30` }}>
                                                    {batch.batchStatus}
                                                </span>
                                            </td>
                                            <td className="actions">
                                                <span title="Edit batch" className="edit" onClick={() => onEditBatch(batch)} style={{ cursor: 'pointer' }}><FaEdit /></span>
                                                <span title="Delete batch" className="delete" onClick={() => onDeleteBatch(batch)} style={{ cursor: 'pointer' }}><FaTrash /></span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {product.expiringSoonCount > 0 && (
                        <p style={{ marginTop: 14, marginBottom: 0, fontSize: '.82rem', color: '#7c5a00', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FaClock size={12} /> {product.expiringSoonCount} batch{product.expiringSoonCount === 1 ? '' : 'es'} expiring within {EXPIRING_SOON_DAYS} days.
                        </p>
                    )}
                    {product.expiredCount > 0 && (
                        <p style={{ marginTop: 6, marginBottom: 0, fontSize: '.82rem', color: '#b71c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FaExclamationTriangle size={12} /> {product.expiredCount} expired batch{product.expiredCount === 1 ? '' : 'es'} excluded from Total Stock.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};


const STOCK_REQ_STATUS_STYLE = {
    pending:  { label: 'Pending',  bg: '#fff8e1', color: '#7c5a00' },
    approved: { label: 'Approved', bg: '#e0faf4', color: '#0d6b4f' },
    rejected: { label: 'Rejected', bg: '#fdecea', color: '#b71c1c' },
};

const STOCK_REQ_PER_PAGE = 10;

const StockRequestsPanel = ({ onApproved, showConfirm, closeConfirm }) => {
    const [requests, setRequests]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [showResolved, setShowResolved] = useState(false);
    const [reqPage, setReqPage]     = useState(1);

    const authHeaders = () => {
        const token = localStorage.getItem('token');
        return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
    };

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/admin/stock-requests`, { headers: authHeaders() });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Failed to load stock requests.');
            setRequests(data.data || []);
        } catch (e) {
            setError(e.message || 'Failed to load stock requests.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    // The actual PUT — separated from the confirmation prompt below so it
    // can be reused whether or not showConfirm is available.
    const performResolve = async (id, status) => {
        setError('');
        setProcessingId(id);
        try {
            const res = await fetch(`${API_BASE_URL}/admin/stock-requests/${id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            // Insufficient stock, duplicate-approval, and deleted-product
            // failures all come back here as data.success === false with a
            // specific data.message (Part 6 §5/§8) — surfaced as-is rather
            // than papered over with a generic error, so Admin sees exactly
            // why an approval didn't go through.
            if (!data.success) throw new Error(data.message || 'Failed to update request.');
            setRequests(prev => prev.map(r => r._id === id ? data.data : r));
            if (status === 'approved' && onApproved) onApproved(data.data);
        } catch (e) {
            setError(e.message || 'Failed to update request.');
        } finally {
            setProcessingId(null);
        }
    };

    // Part 6 §9 — confirm before approval/rejection, same pattern already
    // used for bookings elsewhere in the Admin dashboard (showConfirm/
    // closeConfirm passed down from AdminDashboard). Falls back to running
    // immediately if a parent ever renders this panel without that pattern
    // wired up.
    const resolveRequest = (id, status) => {
        const req = requests.find(r => r._id === id);
        if (!showConfirm) return performResolve(id, status);

        const actionLabel = status === 'approved' ? 'Approve' : 'Reject';
        showConfirm(
            `${actionLabel} Stock Request`,
            `Are you sure you want to ${actionLabel.toLowerCase()} the request for ${req?.quantity ?? ''} ${req?.unit || 'pcs'} of "${req?.itemName}"?${status === 'approved' ? '\n\nThis will deduct the quantity from Admin Central Inventory and add it to the head caregiver\'s assigned stock.' : ''}`,
            async () => {
                if (closeConfirm) closeConfirm();
                await performResolve(id, status);
            },
            status === 'rejected',
            actionLabel
        );
    };

    const pending  = requests.filter(r => r.status === 'pending' || !r.status);
    const resolved = requests.filter(r => r.status === 'approved' || r.status === 'rejected');
    const visible  = showResolved ? resolved : pending;

    // Reset to page 1 whenever the visible list changes (toggle or new data)
    useEffect(() => { setReqPage(1); }, [showResolved, requests.length]);

    const reqTotalPages = Math.max(1, Math.ceil(visible.length / STOCK_REQ_PER_PAGE));
    const visiblePaged  = visible.slice((reqPage - 1) * STOCK_REQ_PER_PAGE, reqPage * STOCK_REQ_PER_PAGE);

    const requesterName = (r) => {
        const u = r.requestedBy;
        if (!u) return '—';
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        return name || u.email || u.username || '—';
    };

    return (
        <div className="card-white" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <FaBoxOpen /> Stock Requests
                    {pending.length > 0 && (
                        <span style={{ background: '#dc3545', color: '#fff', fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                            {pending.length} pending
                        </span>
                    )}
                </h5>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn-outline-sm"
                        onClick={() => setShowResolved(false)}
                        style={{ fontWeight: showResolved ? 400 : 700, borderColor: showResolved ? '#E8D6CC' : '#b85c2d', color: showResolved ? '#7A5C4E' : '#b85c2d' }}
                    >
                        Pending ({pending.length})
                    </button>
                    <button
                        className="btn-outline-sm"
                        onClick={() => setShowResolved(true)}
                        style={{ fontWeight: showResolved ? 700 : 400, borderColor: showResolved ? '#b85c2d' : '#E8D6CC', color: showResolved ? '#b85c2d' : '#7A5C4E' }}
                    >
                        Resolved ({resolved.length})
                    </button>
                    <button className="btn-outline-sm" onClick={fetchRequests} title="Refresh">
                        <FaSyncAlt size={12} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '.85rem' }}>
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <p style={{ padding: '1rem', color: '#7A5C4E', textAlign: 'center' }}>Loading stock requests…</p>
            ) : visible.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#7A5C4E' }}>
                    <FaBoxOpen style={{ fontSize: '2rem', opacity: .3, display: 'block', margin: '0 auto 10px' }} />
                    <p style={{ margin: 0 }}>
                        {showResolved ? 'No resolved stock requests yet.' : 'No pending stock requests.'}
                    </p>
                </div>
            ) : (
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Reason</th>
                            <th>Requested By</th>
                            <th>Date</th>
                            <th>Status</th>
                            {!showResolved && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {visiblePaged.map(r => {
                            const s = STOCK_REQ_STATUS_STYLE[r.status] || STOCK_REQ_STATUS_STYLE.pending;
                            return (
                                <tr key={r._id}>
                                    <td><strong>{r.itemName}</strong></td>
                                    <td>{r.quantity} {r.unit || 'pcs'}</td>
                                    <td style={{ maxWidth: 220 }}>{r.reason || <span style={{ color: '#ccc' }}>—</span>}</td>
                                    <td>{requesterName(r)}</td>
                                    <td style={{ fontSize: '.82rem', color: '#7A5C4E' }}>
                                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                                    </td>
                                    <td>
                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: '.78rem', fontWeight: 700, background: s.bg, color: s.color, border: `1.5px solid ${s.color}30` }}>
                                            {s.label}
                                        </span>
                                    </td>
                                    {!showResolved && (
                                        <td className="actions">
                                            <button
                                                onClick={() => resolveRequest(r._id, 'approved')}
                                                disabled={processingId === r._id}
                                                title="Approve"
                                                style={{ background: 'none', border: 'none', color: '#0d6b4f', cursor: processingId === r._id ? 'not-allowed' : 'pointer', marginRight: 10 }}
                                            >
                                                <FaCheckCircle />
                                            </button>
                                            <button
                                                onClick={() => resolveRequest(r._id, 'rejected')}
                                                disabled={processingId === r._id}
                                                title="Reject"
                                                style={{ background: 'none', border: 'none', color: '#b71c1c', cursor: processingId === r._id ? 'not-allowed' : 'pointer' }}
                                            >
                                                <FaTimesCircle />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {/* Pagination (max 10 requests per page) — same style as Inventory & Stock Management's table pagination */}
            {!loading && reqTotalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderTop: '1.5px solid #E8D6CC', marginTop: 8, background: '#FFF8F3' }}>
                    <small style={{ color: '#7A5C4E', fontSize: '.8rem' }}>
                        Showing {(reqPage - 1) * STOCK_REQ_PER_PAGE + 1}–{Math.min(reqPage * STOCK_REQ_PER_PAGE, visible.length)} of {visible.length}
                    </small>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => setReqPage(p => Math.max(1, p - 1))} disabled={reqPage === 1} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: reqPage === 1 ? '#f5f5f5' : '#FFF8F3', cursor: reqPage === 1 ? 'not-allowed' : 'pointer', color: '#7A5C4E' }}>
                            <FaChevronLeft size={11} />
                        </button>
                        {Array.from({ length: reqTotalPages }, (_, i) => i + 1).map(n => (
                            <button key={n} onClick={() => setReqPage(n)} style={{ padding: '5px 11px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, border: `1.5px solid ${reqPage === n ? '#b85c2d' : '#E8D6CC'}`, background: reqPage === n ? '#b85c2d' : '#FFF8F3', color: reqPage === n ? '#fff' : '#7A5C4E', cursor: 'pointer' }}>{n}</button>
                        ))}
                        <button onClick={() => setReqPage(p => Math.min(reqTotalPages, p + 1))} disabled={reqPage === reqTotalPages} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E8D6CC', background: reqPage === reqTotalPages ? '#f5f5f5' : '#FFF8F3', cursor: reqPage === reqTotalPages ? 'not-allowed' : 'pointer', color: '#7A5C4E' }}>
                            <FaChevronRight size={11} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const InventoryTab = ({ inventory, setInventory, setShowAddInventory, currentUser, showConfirm, closeConfirm, onStockApproved }) => {
    const [editItem, setEditItem]           = useState(null);
    const [deleteTarget, setDeleteTarget]   = useState(null);
    const [deleting, setDeleting]           = useState(false);
    const [localSearch, setLocalSearch]     = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter]   = useState('All');
    const [page, setPage]                   = useState(1);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [viewingProductId, setViewingProductId] = useState(null);
    const printRef = useRef(null);

    // ── Part 3: one row per PRODUCT, aggregated from the flat batch list.
    // See src/utils/inventoryGrouping.js for the aggregation rules
    // (active-batch-only Total Stock, Status thresholds, expiring/expired
    // counts) — kept in its own framework-free module so it's unit tested
    // directly rather than only eyeballed inside JSX.
    const productRows = useMemo(() => groupInventoryByProduct(inventory), [inventory]);
    const summary = useMemo(() => summarizeProductRows(productRows), [productRows]);

    // Re-derive the currently-open Batch Details product from the live,
    // recomputed rows (not a stale snapshot) so editing/deleting a batch
    // inside the modal is reflected immediately without closing it.
    const viewingProduct = viewingProductId ? productRows.find(p => p.productId === viewingProductId) : null;
    useEffect(() => {
        // If every batch for the product being viewed got deleted, its row
        // disappears from productRows — close the now-empty modal instead
        // of leaving it open with nothing to show.
        if (viewingProductId && !viewingProduct) setViewingProductId(null);
    }, [viewingProductId, viewingProduct]);

    const filtered = productRows.filter(p => {
        const q = localSearch.toLowerCase();
        const nameMatch = !q || p.name?.toLowerCase().includes(q) || getCategoryLabel(p.category).toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
        const catMatch  = categoryFilter === 'All' || p.category === categoryFilter;

        let stMatch = true;
        if (statusFilter === 'Expiring Soon') stMatch = p.expiringSoonCount > 0;
        else if (statusFilter === 'Expired') stMatch = p.expiredCount > 0;
        else if (statusFilter !== 'All') stMatch = p.status === statusFilter;

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

    const handleBulkImported = (newItems) => {
        setInventory(prev => [...prev, ...newItems]);
    };

    const handlePrint = () => {
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) {
            alert('Print was blocked by your browser\'s popup blocker. Please allow popups for this site and try again.');
            return;
        }

        const now = new Date();
        const generatedByName = currentUser
            ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || currentUser.username || 'Admin'
            : 'Admin';
        const generatedByRole = currentUser?.role || 'admin';
        const filtersApplied = [
            localSearch ? `Search: "${localSearch}"` : null,
            categoryFilter !== 'All' ? `Category: ${categoryFilter}` : null,
            statusFilter !== 'All' ? `Status: ${statusFilter}` : null,
        ].filter(Boolean).join(' • ') || 'None (showing all items)';

        win.document.write(`
            <html>
            <head>
                <title>Inventory Report</title>
                <style>
                    body { font-family: 'DM Sans', sans-serif; padding: 24px; color: #1A0A00; }
                    h2 { color: #b85c2d; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                    h4 { color: #b85c2d; font-family: 'Playfair Display', serif; margin: 26px 0 10px; font-size: 1rem; }
                    p.sub { color: #7A5C4E; font-size: .85rem; margin-bottom: 20px; }
                    .summary-grid { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
                    .summary-box { flex: 1; min-width: 130px; background: #FFF8F3; border: 1px solid #E8D6CC; border-radius: 10px; padding: 12px 14px; text-align: center; }
                    .summary-box .val { font-size: 1.5rem; font-weight: 700; font-family: 'Playfair Display', serif; }
                    .summary-box .lbl { font-size: .72rem; color: #7A5C4E; text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
                    th { background: #b85c2d; color: #fff; padding: 10px 12px; text-align: left; font-weight: 700; }
                    td { padding: 9px 12px; border-bottom: 1px solid #E8D6CC; }
                    tr:nth-child(even) td { background: #FFF8F3; }
                    .low { color: #7c5a00; } .out { color: #b71c1c; } .ok { color: #0d6b4f; }
                    .audit-table td, .audit-table th { font-size: .8rem; }
                    .audit-table th { background: #7d3a06; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h2>Kanang-Alalay — Inventory &amp; Stock Report</h2>
                <p class="sub">Generated: ${now.toLocaleString('en-PH')} | Filters applied: ${filtersApplied}</p>

                <div class="summary-grid">
                    <div class="summary-box"><div class="val">${summary.totalProducts}</div><div class="lbl">Total Products</div></div>
                    <div class="summary-box"><div class="val">${summary.totalStock}</div><div class="lbl">Total Stock</div></div>
                    <div class="summary-box"><div class="val" style="color:#7c5a00">${summary.lowStockCount}</div><div class="lbl">Low Stock</div></div>
                    <div class="summary-box"><div class="val" style="color:#b71c1c">${summary.outOfStockCount}</div><div class="lbl">Out of Stock</div></div>
                    <div class="summary-box"><div class="val" style="color:#856404">${summary.expiringSoonCount}</div><div class="lbl">Expiring Soon</div></div>
                </div>

                <h4>Inventory List (${filtered.length} of ${productRows.length} products shown)</h4>
                <table>
                    <thead>
                        <tr><th>Item</th><th>Category</th><th>Total Stock</th><th>Minimum Stock</th><th>Expiring Soon</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${filtered.map(p => {
                            const cls = p.status === 'Out of Stock' ? 'out' : p.status === 'Low Stock' ? 'low' : 'ok';
                            return `<tr>
                                <td><strong>${p.name}</strong></td>
                                <td>${getCategoryLabel(p.category)}</td>
                                <td class="${cls}">${p.totalStock} ${p.unit}</td>
                                <td>${p.minThreshold} ${p.unit}</td>
                                <td>${p.expiringSoonCount > 0 ? `${p.expiringSoonCount} batch(es)` : '—'}</td>
                                <td>${p.status}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>

                <h4>Audit Trail</h4>
                <table class="audit-table">
                    <tbody>
                        <tr><th style="width:180px">Generated By</th><td>${generatedByName}</td></tr>
                        <tr><th>Role</th><td>${generatedByRole}</td></tr>
                        <tr><th>Date</th><td>${now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                        <tr><th>Time</th><td>${now.toLocaleTimeString('en-PH')}</td></tr>
                        <tr><th>Action Performed</th><td>Inventory Report Generated</td></tr>
                        <tr><th>Report Type</th><td>Inventory &amp; Stock Management — Full Report</td></tr>
                        <tr><th>Number of Records</th><td>${filtered.length}</td></tr>
                        <tr><th>System Version</th><td>Kanang-Alalay Admin Panel v1.0</td></tr>
                        <tr><th>Export Timestamp</th><td>${now.toISOString()}</td></tr>
                    </tbody>
                </table>
            </body>
            </html>
        `);
        win.document.close();

        // NOTE: closing the window immediately after print() causes it to
        // flash open and shut before the print dialog can render, since
        // print() does not block execution. Instead, wait for the report to
        // finish loading before printing, and only auto-close once the user
        // has actually dismissed the print dialog (onafterprint).
        let printed = false;
        const triggerPrint = () => {
            if (printed) return;
            printed = true;
            win.focus();
            win.print();
        };

        win.onload = triggerPrint;
        // Fallback in case onload doesn't fire reliably after document.write()
        setTimeout(triggerPrint, 300);

        win.onafterprint = () => win.close();
    };

    return (
        <>
            <div className="card-white">
                <div className="card-header">
                    <h5>Inventory &amp; Stock Management</h5>
                    <div className="inventory-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn-outline-sm" onClick={handlePrint}><FaPrint /> Print Report</button>
                        <button className="btn-outline-sm" onClick={() => setShowBulkImport(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FaUpload size={12} /> Bulk Import
                        </button>
                        <button className="btn-primary-sm" onClick={() => setShowAddInventory(true)}><FaBox /> Add Item</button>
                    </div>
                </div>

                {/* Stats row — Part 3: Total Products, Total Stock, Low Stock, Out of Stock, Expiring Soon */}
                <div className="stats-grid inventory-stats-grid" style={{ marginBottom: 20 }}>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#17a2b8' }}><FaLayerGroup /></div>
                        <div className="stat-info"><h3>{summary.totalProducts}</h3><p>Total Products</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#28a745' }}><FaBox /></div>
                        <div className="stat-info"><h3>{summary.totalStock}</h3><p>Total Stock</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#dc3545' }}><FaExclamationTriangle /></div>
                        <div className="stat-info"><h3 style={{ color: '#dc3545' }}>{summary.lowStockCount}</h3><p>Low Stock</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#6c757d' }}><FaBoxOpen /></div>
                        <div className="stat-info"><h3 style={{ color: '#6c757d' }}>{summary.outOfStockCount}</h3><p>Out of Stock</p></div>
                    </div>
                    <div className="stat-card" style={{ padding: 14 }}>
                        <div className="stat-icon" style={{ background: '#ffc107' }}><FaClock /></div>
                        <div className="stat-info"><h3 style={{ color: summary.expiringSoonCount > 0 ? '#ffc107' : undefined }}>{summary.expiringSoonCount}</h3><p>Expiring Soon</p></div>
                    </div>
                </div>

                {/* Filters row */}
                <div className="inventory-filters-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                    {/* Search */}
                    <div className="inventory-filter-search" style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <FaSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7A5C4E', fontSize: '.82rem' }} />
                        <input
                            value={localSearch}
                            onChange={e => setLocalSearch(e.target.value)}
                            placeholder="Search by item name or category…"
                            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '.88rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', boxSizing: 'border-box', height: 38 }}
                        />
                        {localSearch && (
                            <button onClick={() => setLocalSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5C4E' }}>
                                <FaTimes size={11} />
                            </button>
                        )}
                    </div>

                    <FaFilter className="inventory-filter-icon" style={{ color: '#7A5C4E', fontSize: '.8rem' }} />

                    {/* Category */}
                    <select
                        className="inventory-filter-select"
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        style={{ padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif", height: 38, boxSizing: 'border-box' }}
                    >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'Category: All' : getCategoryLabel(c)}</option>)}
                    </select>

                    {/* Status (includes Expiring Soon / Expired, per Part 3) */}
                    <select
                        className="inventory-filter-select"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ padding: '8px 12px', border: '1.5px solid #E8D6CC', borderRadius: 9, fontSize: '.85rem', background: '#FFF8F3', color: '#1A0A00', outline: 'none', fontFamily: "'DM Sans', sans-serif", height: 38, boxSizing: 'border-box' }}
                    >
                        {STATUS_FILTERS.map(s => (
                            <option key={s} value={s}>{s === 'All' ? 'Status: All' : s}</option>
                        ))}
                    </select>
                </div>

                {paged.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: '#7A5C4E' }}>
                        <FaBox style={{ fontSize: '2.5rem', opacity: .3, display: 'block', margin: '0 auto 10px' }} />
                        <p style={{ margin: 0 }}>
                            {localSearch || categoryFilter !== 'All' || statusFilter !== 'All'
                                ? 'No products match your filters.'
                                : 'No inventory items yet. Click "Add Item" to begin.'}
                        </p>
                    </div>
                ) : (
                    <div ref={printRef}>
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Total Stock</th>
                                    <th>Minimum Stock</th>
                                    <th>Expiring Soon</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(product => {
                                    const s = PRODUCT_STATUS_STYLE[product.status] || PRODUCT_STATUS_STYLE['In Stock'];
                                    return (
                                        <tr key={product.productId}>
                                            <td>
                                                <strong>{product.name}</strong>
                                                {product.batches.length > 1 && (
                                                    <small style={{ display: 'block', color: '#7A5C4E', fontSize: '.75rem' }}>
                                                        {product.batches.length} batches
                                                    </small>
                                                )}
                                            </td>
                                            <td><span className="badge-custom staff">{getCategoryLabel(product.category)}</span></td>
                                            <td>
                                                <strong style={{ color: product.status === 'Out of Stock' ? '#dc3545' : product.status === 'Low Stock' ? '#ffc107' : 'inherit' }}>
                                                    {product.totalStock}
                                                </strong>{' '}
                                                <small style={{ color: '#7A5C4E' }}>{product.unit}</small>
                                                {product.expiredCount > 0 && (
                                                    <small style={{ display: 'block', color: '#b71c1c', fontSize: '.72rem' }} title="Expired batches are excluded from Total Stock">
                                                        {product.expiredCount} expired batch{product.expiredCount === 1 ? '' : 'es'} excluded
                                                    </small>
                                                )}
                                            </td>
                                            <td style={{ color: '#7A5C4E', fontSize: '.88rem' }}>{product.minThreshold} {product.unit}</td>
                                            <td style={{ fontSize: '.85rem' }}>
                                                {product.expiringSoonCount > 0 ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#7c5a00', fontWeight: 600 }}>
                                                        <FaClock size={11} /> {product.expiringSoonCount} batch{product.expiringSoonCount === 1 ? '' : 'es'}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#ccc' }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: '.78rem', fontWeight: 700, background: s.bg, color: s.color, border: `1.5px solid ${s.color}30` }}>
                                                    {product.status}
                                                </span>
                                            </td>
                                            <td className="actions">
                                                <span title="View / Manage batches" className="edit" onClick={() => setViewingProductId(product.productId)} style={{ cursor: 'pointer' }}><FaEye /></span>
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

            <StockRequestsPanel onApproved={onStockApproved} showConfirm={showConfirm} closeConfirm={closeConfirm} />

            {viewingProduct && (
                <BatchDetailsModal
                    product={viewingProduct}
                    onClose={() => setViewingProductId(null)}
                    onEditBatch={(batch) => setEditItem(batch)}
                    onDeleteBatch={(batch) => setDeleteTarget(batch)}
                />
            )}
            {editItem && <EditItemModal item={editItem} onSave={handleSaveEdit} onClose={() => setEditItem(null)} />}
            {deleteTarget && <DeleteInventoryModal item={deleteTarget} onConfirm={handleDeleteConfirm} onClose={() => setDeleteTarget(null)} />}
            {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onImported={handleBulkImported} />}
        </>
    );
};

export default InventoryTab;