const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Start of "today" in Asia/Manila, as a UTC Date instant — independent of
// whatever timezone the server process itself is running in (Render's
// containers default to UTC, which silently shifts "today" by 8 hours from
// what a Philippines-based caregiver actually means).
function startOfManilaDay(date = new Date()) {
    const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
    const y = shifted.getUTCFullYear();
    const m = shifted.getUTCMonth();
    const d = shifted.getUTCDate();
    return new Date(Date.UTC(y, m, d, 0, 0, 0) - MANILA_OFFSET_MS);
}

function getManilaDayBounds(date = new Date()) {
    const today = startOfManilaDay(date);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return { today, tomorrow };
}

// A timezone-naive "YYYY-MM-DDTHH:mm[:ss]" string (e.g. from an
// <input type="datetime-local">) has no offset, so `new Date(str)` parses it
// against the SERVER's local timezone — UTC on Render — instead of the
// caregiver's actual Asia/Manila wall-clock time, silently shifting every
// scheduled time 8 hours off from what was picked. This treats any string
// that doesn't already carry an offset/Z as Manila time before parsing.
function parseManilaDateTime(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const hasOffset = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(value);
    return new Date(hasOffset ? value : `${value}+08:00`);
}

// Combines a date (only the calendar date matters — any time-of-day on it is
// discarded) with an "HH:MM" 24-hour Manila wall-clock time, returning the
// equivalent UTC instant. Used to compare "now" against a scheduled slot's
// end time regardless of what timezone the server process runs in.
function manilaDateAndTimeToUTC(dateOnly, hhmm) {
    const shifted = new Date(dateOnly.getTime() + MANILA_OFFSET_MS);
    const y = shifted.getUTCFullYear();
    const m = shifted.getUTCMonth();
    const d = shifted.getUTCDate();
    const [hh, mm] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(y, m, d, hh, mm, 0) - MANILA_OFFSET_MS);
}

module.exports = { startOfManilaDay, getManilaDayBounds, parseManilaDateTime, manilaDateAndTimeToUTC };