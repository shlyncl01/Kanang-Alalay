const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendEmail, generateSupportRequestTemplate } = require('../models/mailer');

// Where support requests land. Override with SUPPORT_EMAIL in your env
// if you want it to go somewhere other than the default support inbox.
const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || 'support@kanangalalay.org';

const CATEGORIES = [
    'Login / Account access',
    'Bug or error',
    'Feature question',
    'Data issue',
    'Other',
];

// POST /api/support/contact
// Sends the Help Center "Contact Support" form to SUPPORT_INBOX, with
// reply-to set to the requesting staff member so support can just hit
// reply. Requires a valid session — req.user comes from authMiddleware.
router.post('/contact', protect, async (req, res) => {
    try {
        const { category, subject, message } = req.body;

        if (!subject || !subject.trim() || !message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message are required.'
            });
        }

        const safeCategory = CATEGORIES.includes(category) ? category : 'Other';
        const user = req.user;
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Staff member';

        const html = generateSupportRequestTemplate({
            category: safeCategory,
            subject: subject.trim(),
            message: message.trim(),
            name,
            email: user.email,
            staffId: user.staffId,
            role: user.role,
        });

        await sendEmail(
            SUPPORT_INBOX,
            `[Support] ${safeCategory}: ${subject.trim()}`,
            html,
            user.email ? { replyTo: user.email } : {}
        );

        res.json({ success: true, message: 'Your message has been sent.' });
    } catch (error) {
        console.error('Support contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send your message. Please try again.'
        });
    }
});

module.exports = router;