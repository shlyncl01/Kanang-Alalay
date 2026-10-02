import React, { useRef, useState, useEffect, useCallback } from 'react';
import '../styles/MedicationFlagRegister.css';

// One row of flag cards that scrolls sideways, shared by the Head Caregiver
// and Admin flag panels. Same pattern as the Admin photo strip: round arrows
// (mfr-arrow) appear only when more cards are off-screen, and the scroll bar
// is hidden (mfr-strip). `step` is how far one arrow press scrolls (one card
// + gap); `arrowTop` centres the arrows on the cards' photo area.
const MedicationFlagCardRow = ({ count, children, step = 244, gap = 14, arrowTop = 64 }) => {
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
    }, [update, count]);

    const scroll = (direction) => {
        const el = ref.current;
        if (el) el.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    const arrow = (direction) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={direction === 'right' ? 'M5 12h14M13 6l6 6-6 6' : 'M19 12H5M11 6l-6 6 6 6'} />
        </svg>
    );

    return (
        <div style={{ position: 'relative' }}>
            <div className="mfr-strip" ref={ref} onScroll={update} style={{ gap, padding: '4px 0' }}>
                {children}
            </div>
            {canLeft && (
                <button type="button" className="mfr-arrow mfr-arrow-left" style={{ top: arrowTop, left: 6 }} onClick={() => scroll(-1)} aria-label="Show earlier cards">
                    {arrow('left')}
                </button>
            )}
            {canRight && (
                <button type="button" className="mfr-arrow mfr-arrow-right" style={{ top: arrowTop, right: 6 }} onClick={() => scroll(1)} aria-label="Show more cards">
                    {arrow('right')}
                </button>
            )}
        </div>
    );
};

export default MedicationFlagCardRow;