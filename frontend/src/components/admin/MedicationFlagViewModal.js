import React from 'react';
import MedicationFlagPhotos from '../MedicationFlagPhotos';
import MedicationFlagDetailFields from '../MedicationFlagDetailFields';
import '../../styles/MedicationFlagRegister.css';

const personName = (u) => {
    if (!u) return null;
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || null;
};
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : null);

// Read-only look at a flagged medication awaiting registration — same popup
// the Head Caregiver gets, so Admin can inspect every submitted photo and the
// details read from them before choosing Register or Reject. Nothing is
// editable here; corrections are made in the Register form.
const MedicationFlagViewModal = ({ flag, onClose, onRegister, onReject }) => {
    const photoCount = (flag.photos || []).length;
    const read = flag.extractedData || null;
    const readError = flag.extractionError || null;

    let notice;
    if (read && read.name) {
        notice = { tone: 'info', text: 'Details were read automatically from the photos. Check them against the packaging; you can correct anything when you register.' };
    } else if (readError) {
        notice = { tone: 'warn', text: `The photos couldn't be auto-read (${String(readError).slice(0, 120)}). Use the pictures above to check the packaging yourself.` };
    } else {
        notice = { tone: 'warn', text: 'No product name could be read from the photos. Use the pictures above to check the packaging yourself.' };
    }

    const rows = [
        ['Barcode', flag.barcode],
        ['Photos Submitted', photoCount],
        ['Flagged By', personName(flag.flaggedBy) || '—'],
        ['Submitted', when(flag.createdAt)],
        ['Approved By (Head Caregiver)', personName(flag.hcResolvedBy)],
        ['Approved', when(flag.hcResolvedAt)],
    ].filter(([, v]) => v !== null && v !== undefined && v !== '');

    return (
        <div className="modal-overlay">
            <div className="mfr-modal" role="dialog" aria-modal="true" aria-label="Medication details">
                <div className="mfr-header">
                    <h5 className="mfr-title">Medication Details — Barcode {flag.barcode}</h5>
                    <button type="button" className="mfr-close" onClick={onClose} aria-label="Close">&times;</button>
                </div>

                <div className="mfr-body">
                    <MedicationFlagPhotos photos={flag.photos} heroHeight={280} />

                    <div className={`mfr-banner mfr-banner-${notice.tone}`}>
                        <span className="mfr-banner-text">{notice.text}</span>
                    </div>

                    <MedicationFlagDetailFields read={read} />

                    <div className="mfr-grid">
                        {rows.map(([label, value]) => (
                            <div className="mfr-field" key={label}>
                                <div className="mfr-label">{label}</div>
                                <div className="mfr-input">{value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mfr-footer">
                    <button
                        type="button"
                        className="mfr-btn"
                        style={{ background: '#fff', color: '#C0392B', border: '1.5px solid #C0392B' }}
                        onClick={() => onReject(flag)}
                    >
                        Reject
                    </button>
                    <button type="button" className="mfr-btn mfr-btn-primary" onClick={() => onRegister(flag)}>
                        Register
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MedicationFlagViewModal;