const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Minutes since midnight, Asia/Manila wall-clock time, for the given instant.
function manilaMinutesOfDay(date = new Date()) {
    const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
    return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

const DAY_START_MIN = 7 * 60;  // 7:00 AM
const DAY_END_MIN = 19 * 60;   // 7:00 PM

// Matches the DAY(7AM-7PM)/NIGHT(7PM-7AM)/FLEXIBLE shift system in
// backend/models/User.js. FLEXIBLE (admins) has no fixed window, so it's
// always on duty. NIGHT is DAY's complement across the same boundary, so it
// wraps past midnight (e.g. 11PM and 3AM are on duty, 3PM is not).
function isOnDuty(shift, date = new Date()) {
    if (shift !== 'DAY' && shift !== 'NIGHT') return true;
    const minutes = manilaMinutesOfDay(date);
    const isDayWindow = minutes >= DAY_START_MIN && minutes < DAY_END_MIN;
    return shift === 'DAY' ? isDayWindow : !isDayWindow;
}

module.exports = { isOnDuty };
