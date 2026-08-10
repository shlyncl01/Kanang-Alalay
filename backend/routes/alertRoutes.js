const express = require('express');
const router  = express.Router();
const Alert   = require('../models/Alert');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendPushToAll } = require('../services/pushService');

// GET /api/alerts  — fetch all alerts (admin) or unread count (nurse/caregiver)
router.get('/', protect, async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? {}
            : { relatedUser: req.user._id };

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({ success: true, data: alerts, count: alerts.length });
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching alerts' });
    }
});

// GET /api/alerts/unread-count
router.get('/unread-count', protect, async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? { isRead: false }
            : { isRead: false, relatedUser: req.user._id };

        const count = await Alert.countDocuments(query);
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/alerts  — create alert (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const { type, title, message, details, relatedUser } = req.body;

        if (!type || !title || !message) {
            return res.status(400).json({ success: false, message: 'type, title, and message are required.' });
        }

        const alert = new Alert({ type, title, message, details, relatedUser });
        await alert.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('newAlert', {
                _id: alert._id,
                type: alert.type,
                message: alert.message,
                subMessage: typeof alert.details === 'string' ? alert.details : alert.details?.message || '',
                isRead: false,
            });
        }

        sendPushToAll(alert.title, alert.message, {
            alertId: String(alert._id),
            type: alert.type,
        }).catch(() => {});

        res.status(201).json({ success: true, data: alert });
    } catch (error) {
        console.error('Create alert error:', error);
        res.status(500).json({ success: false, message: 'Server error creating alert' });
    }
});

// PUT /api/alerts/:id/read  — mark single alert as read
router.put('/:id/read', protect, async (req, res) => {
    try {
        const alert = await Alert.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );
        if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT /api/alerts/mark-all-read  — mark all alerts as read for current user
router.put('/mark-all-read', protect, async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? { isRead: false }
            : { isRead: false, relatedUser: req.user._id };

        await Alert.updateMany(query, { isRead: true });
        res.json({ success: true, message: 'All alerts marked as read.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /api/alerts/:id  — delete alert (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const alert = await Alert.findByIdAndDelete(req.params.id);
        if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
        res.json({ success: true, message: 'Alert deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;