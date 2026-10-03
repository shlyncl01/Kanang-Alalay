import React from 'react';
import '../styles/MedicationFlagRegister.css';

// Read-only display of what was read from a flagged medication's photos
// (extractedData). Shared by the Head Caregiver and Admin "view medication"
// popups so both show the same fields the same way. Only fields that were
// actually read are shown — nothing is filled in or invented.
const GRID = [
    ['name', 'Name'], ['genericName', 'Generic Name'], ['brand', 'Brand'],
    ['dosage', 'Dosage'], ['strength', 'Strength'], ['form', 'Form'],
    ['route', 'Route'], ['manufacturer', 'Manufacturer'], ['expiryDate', 'Expiry Date'],
];
const LONG = [
    ['purpose', 'Purpose'], ['instructions', 'Instructions'], ['warnings', 'Warnings'],
    ['sideEffects', 'Side Effects'], ['contraindications', 'Contraindications'],
    ['drugInteractions', 'Drug Interactions'], ['pregnancy', 'Pregnancy Notes'], ['storage', 'Storage'],
];

const format = (key, value) => {
    if (key !== 'expiryDate') return value;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-PH', { dateStyle: 'medium' });
};

const MedicationFlagDetailFields = ({ read }) => {
    if (!read) return null;
    const gridRows = GRID.filter(([k]) => read[k]);
    const longRows = LONG.filter(([k]) => read[k]);
    return (
        <>
            {gridRows.length > 0 && (
                <div className="mfr-grid">
                    {gridRows.map(([k, label]) => (
                        <div className="mfr-field" key={k}>
                            <div className="mfr-label">{label}</div>
                            <div className="mfr-input">{format(k, read[k])}</div>
                        </div>
                    ))}
                </div>
            )}
            {longRows.map(([k, label]) => (
                <div className="mfr-field mfr-field-full" key={k}>
                    <div className="mfr-label">{label}</div>
                    <div className="mfr-input" style={{ whiteSpace: 'pre-wrap' }}>{read[k]}</div>
                </div>
            ))}
        </>
    );
};

export default MedicationFlagDetailFields;