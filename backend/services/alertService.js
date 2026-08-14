const Alert = require('../models/Alert');
const User = require('../models/User');
const { sendPushToUsers } = require('./pushService');

// Sends an alert to the caregiver it's about plus every admin/head_caregiver,
// matching the same targeting rule already used for medication reminders:
// caregivers only see alerts relevant to their own residents, but overseers
// see everything.
const notifyCaregiverAndOverseers = async (io, { type, title, message, caregiverId, details }) => {
    const overseers = await User.find(
        { role: { $in: ['admin', 'head_caregiver'] } },
        { _id: 1 }
    );
    const recipientIds = [...new Set([
        caregiverId ? String(caregiverId) : null,
        ...overseers.map((u) => String(u._id)),
    ].filter(Boolean))];

    const alert = await Alert.create({ type, title, message, details, relatedUser: caregiverId });

    io.to(recipientIds).emit('newAlert', {
        _id: alert._id,
        type: alert.type,
        message: alert.message,
        subMessage: alert.details?.subMessage || '',
        details: alert.details,
        isRead: false,
    });

    sendPushToUsers(recipientIds, alert.title, alert.message, {
        alertId: String(alert._id),
        type: alert.type,
        ...alert.details,
    }).catch(() => {});

    return alert;
};

module.exports = { notifyCaregiverAndOverseers };
