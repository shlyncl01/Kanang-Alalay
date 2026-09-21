import React, { useState } from 'react';

// Photos a caregiver attached to a flagged medication: one large preview
// plus a fixed-size thumbnail row to switch between them. Clicking the
// large preview opens the full-size photo in a new tab.
const MedicationFlagPhotos = ({ photos = [], heroHeight = 130 }) => {
    const [active, setActive] = useState(0);
    if (!photos.length) return null;

    const current = photos[Math.min(active, photos.length - 1)];

    return (
        <div style={{ marginBottom: 10 }}>
            <img
                src={current.url}
                alt="Medication packaging"
                title="Click to open full size"
                onClick={() => window.open(current.url, '_blank')}
                style={{ display: 'block', width: '100%', height: heroHeight, objectFit: 'contain', borderRadius: 8, cursor: 'zoom-in', background: '#f5efe9' }}
            />
            {photos.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginTop: 4 }}>
                    {photos.map((p, i) => (
                        <img
                            key={i}
                            src={p.url}
                            alt={`Packaging view ${i + 1} of ${photos.length}`}
                            onClick={() => setActive(i)}
                            style={{
                                width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 4, cursor: 'pointer',
                                boxSizing: 'border-box', border: `2px solid ${i === active ? '#b85c2d' : 'transparent'}`,
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default MedicationFlagPhotos;
