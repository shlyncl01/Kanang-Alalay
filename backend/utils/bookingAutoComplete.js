const Booking = require('../models/Booking');
const { manilaDateAndTimeToUTC } = require('./dateHelpers');

// The org's fixed visiting windows, keyed by the visitor's original request.
const DEFAULT_SLOT_END = {
    morning: '11:00',   // 9:00 AM - 11:00 AM
    afternoon: '17:00', // 3:00 PM - 5:00 PM
};

// Resolves the real end-of-visit instant (UTC) for an approved booking.
// Prefers the exact end time the admin set during approval
// (facilityAvailability.slots — may have been narrowed via "Edit time
// slots"), and falls back to the org's default window matched off the
// visitor's originally requested slot if no custom time was saved.
function getSlotEndUTC(booking) {
    const isMorning = booking.visitTime === '09:00';
    let endHHMM = isMorning ? DEFAULT_SLOT_END.morning : DEFAULT_SLOT_END.afternoon;

    const slots = booking.facilityAvailability?.slots || [];
    const matchingSlot = slots.find(s =>
        (isMorning && s.label === 'Morning Slot') || (!isMorning && s.label === 'Afternoon Slot')
    );
    if (matchingSlot?.end) endHHMM = matchingSlot.end;

    return manilaDateAndTimeToUTC(new Date(booking.visitDate), endHHMM);
}

// Flips every 'approved' booking whose scheduled visiting window has already
// passed (real-world Asia/Manila time) to 'completed'. Idempotent and cheap
// to call repeatedly — a no-op once nothing currently qualifies. Intended to
// run both from a periodic server-side tick and lazily whenever the booking
// list is fetched, so the status is always accurate regardless of whether the
// interval has ticked recently.
async function autoCompletePastBookings() {
    const now = new Date();
    const approved = await Booking.find({ status: 'approved' });
    const completedIds = [];

    for (const booking of approved) {
        if (now >= getSlotEndUTC(booking)) {
            booking.status = 'completed';
            await booking.save();
            completedIds.push(String(booking._id));
        }
    }
    return completedIds;
}

module.exports = { getSlotEndUTC, autoCompletePastBookings };