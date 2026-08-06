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

module.exports = { startOfManilaDay, getManilaDayBounds };
