const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const Booking  = require('../models/Booking');
const Donation = require('../models/Donation');
const Inventory = require('../models/Inventory');
const RegistrationCode = require('../models/VerificationCode');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── Apply protect + adminOnly to EVERY route in this file ────────────────────
// Any request without a valid Admin JWT is rejected before reaching any handler.
router.use(protect, adminOnly);

const sanitizeUser = (user) => ({
    id: user._id,
    staffId: user.staffId,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    createdAt: user.createdAt
});

// ── 1. GET all staff/users ────────────────────────────────────────────────────
// GET /api/admin/staff
router.get('/staff', async (req, res) => {
    try {
        const staff = await User.find({
            role: { $in: ['admin', 'staff', 'nurse', 'caregiver'] }
        }).select('-password').sort({ createdAt: -1 });

        res.json({ success: true, count: staff.length, staff });
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching staff' });
    }
});

// ── 2. Toggle staff active status ─────────────────────────────────────────────
// PUT /api/admin/staff/:id/status  —  body: { status: 'active' | 'inactive' }
router.put('/staff/:id/status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        // Prevent admin from deactivating themselves
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot change your own status.' });
        }

        user.isActive = req.body.status === 'active';
        await user.save();

        res.json({
            success: true,
            message: `Staff status updated to ${user.isActive ? 'active' : 'inactive'}.`
        });
    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({ success: false, message: 'Server error updating status' });
    }
});

// ── 3. Change a staff member's role ───────────────────────────────────────────
// PUT /api/admin/staff/:id/role  —  body: { role: 'nurse' | 'caregiver' | ... }
router.put('/staff/:id/role', async (req, res) => {
    try {
        const allowedRoles = ['admin', 'staff', 'nurse', 'caregiver'];
        const { role } = req.body;

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, message: `Invalid role. Allowed: ${allowedRoles.join(', ')}.` });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        // Prevent admin from accidentally demoting themselves
        if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
            return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
        }

        user.role = role;
        await user.save();

        res.json({ success: true, message: `Role updated to '${role}' for ${user.firstName} ${user.lastName}.` });
    } catch (error) {
        console.error('Change role error:', error);
        res.status(500).json({ success: false, message: 'Server error changing role' });
    }
});

// ── 4. Delete a staff member ──────────────────────────────────────────────────
// DELETE /api/admin/staff/:id
router.delete('/staff/:id', async (req, res) => {
    try {
        // Prevent admin from deleting themselves
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
        }

        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'User not found.' });

        res.json({ success: true, message: 'Staff member deleted successfully.' });
    } catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting staff' });
    }
});

// ── 5. Generate registration codes ────────────────────────────────────────────
// POST /api/admin/generate-codes  —  body: { count: 1, role: 'nurse' }
router.post('/generate-codes', async (req, res) => {
    try {
        const { count = 1, role = 'staff' } = req.body;
        const codes = [];

        for (let i = 0; i < count; i++) {
            const code = `LSAE-REG-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
            const newCode = new RegistrationCode({
                code,
                role,
                email:     'unassigned@lsae.org',
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
            });
            await newCode.save();
            codes.push(newCode);
        }

        res.json({ success: true, message: `Generated ${count} code(s).`, codes });
    } catch (error) {
        console.error('Generate codes error:', error);
        res.status(500).json({ success: false, message: 'Error generating codes' });
    }
});

// ── 6. Dashboard statistics ───────────────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const [totalDonations, pendingBookings, staffOnDuty, donationAmount] = await Promise.all([
            Donation.countDocuments(),
            Booking.countDocuments({ status: 'pending' }),
            User.countDocuments({ role: { $ne: 'admin' }, isActive: true }),
            Donation.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        res.json({
            success: true,
            data: {
                totalResidents:      71,
                staffOnDuty,
                pendingBookings,
                totalDonations,
                totalDonationAmount: donationAmount[0]?.total || 0,
                lowStockItems:       5
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
});

module.exports = router;