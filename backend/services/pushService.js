const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Broadcasts to every registered device, mirroring the existing io.emit('newAlert')
// fan-out (the mobile app already shows a local notification for every alert it
// receives over the socket, regardless of who it's for).
async function sendPushToAll(title, body, data = {}) {
    try {
        const users = await User.find(
            { pushToken: { $exists: true, $ne: null } },
            { pushToken: 1 }
        );
        const tokens = [...new Set(users.map((u) => u.pushToken).filter(Boolean))];
        if (tokens.length === 0) return;

        const messages = tokens.map((to) => ({
            to,
            sound: 'default',
            title,
            body,
            data,
        }));

        for (let i = 0; i < messages.length; i += 100) {
            const chunk = messages.slice(i, i + 100);
            await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });
        }
    } catch (error) {
        console.error('[Push] Failed to send push notifications:', error.message);
    }
}

module.exports = { sendPushToAll };
