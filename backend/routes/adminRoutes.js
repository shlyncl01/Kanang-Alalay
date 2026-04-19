const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Donation = require('../models/Donation');
const Inventory = require('../models/Inventory');
const RegistrationCode = require('../models/VerificationCode');
const StockRequest = require('../models/StockRequest');
const VitalsLog    = require('../models/VitalsLog');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendEmail, generateOtpTemplate } = require('../models/mailer');

router.use(protect, adminOnly);

// ── Auto-generate staff ID with role prefix + 4-digit counter ────────────────
async function generateStaffId(role) {
    const prefixMap = {
        admin:     'ADMIN',
        nurse:     'NURSE',
        caregiver: 'CG',
    };
    const prefix = prefixMap[role] || 'NURSE';

    // Find highest existing ID for this prefix
    const latest = await User.findOne(
        { staffId: new RegExp(`^${prefix}-\\d+$`) },
        { staffId: 1 },
        { sort: { staffId: -1 } }
    );

    let next = 1;
    if (latest && latest.staffId) {
        const parts = latest.staffId.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num)) next = num + 1;
    }

    return `${prefix}-${String(next).padStart(4, '0')}`;
}

// ==================== ADMIN CREATE USER (no registration code needed) ====================

router.post('/create-user', async (req, res) => {
    try {
        const {
            firstName, lastName, middleName = '', username, email,
            password, phone = '', role = 'nurse', ward = '', department = '',
            activateImmediately = true
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ success: false, message: 'First name, last name, email, and password are required.' });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email address.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        // Prevent duplicate email/username
        const derived = username?.trim() || email.split('@')[0];
        const existing = await User.findOne({ $or: [{ email }, { username: derived }] });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: existing.email === email
                    ? 'A user with this email already exists.'
                    : 'This username is already taken.'
            });
        }

        // Auto-generate staff ID
        const staffId = await generateStaffId(role);

        const user = new User({
            staffId,
            firstName:  firstName.trim(),
            lastName:   lastName.trim(),
            middleName: middleName.trim(),
            username:   derived,
            email:      email.trim().toLowerCase(),
            password,
            phone:      phone.trim(),
            role,
            ward:       ward || undefined,
            department: department || undefined,
            isVerified: activateImmediately,
            isActive:   activateImmediately,
        });

        await user.save();

        // Send welcome/OTP email if not immediately activated
        let userId = user._id;
        if (!activateImmediately) {
            const otpCode   = Math.floor(100000 + Math.random() * 900000).toString();
            user.otpCode    = otpCode;
            user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
            await user.save();

            try {
                await sendEmail(email, 'Activate your Kanang-Alalay Account', generateOtpTemplate(otpCode));
            } catch (mailErr) {
                console.error('❌ Email error:', mailErr.message);
            }
        }

        res.status(201).json({
            success:   true,
            message:   `User ${firstName} ${lastName} created with ID ${staffId}.${activateImmediately ? ' Account is active.' : ' OTP sent for activation.'}`,
            userId:    user._id,
            staffId:   user.staffId,
            email:     user.email,
            firstName: user.firstName,
            role:      user.role,
        });
    } catch (error) {
        console.error('Create user error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Email or username already exists.' });
        }
        res.status(500).json({ success: false, message: 'Server error creating user: ' + error.message });
    }
});

// ==================== STAFF MANAGEMENT ====================

router.get('/staff', async (req, res) => {
    try {
        const staff = await User.find({
            role: { $in: ['admin', 'nurse', 'caregiver'] }
        }).select('-password').sort({ createdAt: -1 });

        res.json({ success: true, count: staff.length, staff });
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching staff' });
    }
});

router.get('/staff/:id', async (req, res) => {
    try {
        const staff = await User.findById(req.params.id).select('-password');
        if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
        res.json({ success: true, staff });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/staff/:id/status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

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
        res.status(500).json({ success: false, message: 'Server error updating status' });
    }
});

router.put('/staff/:id/role', async (req, res) => {
    try {
        const allowedRoles = ['admin', 'nurse', 'caregiver'];
        const { role } = req.body;

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, message: `Invalid role. Allowed: ${allowedRoles.join(', ')}.` });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
            return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
        }

        user.role = role;
        await user.save();

        res.json({ success: true, message: `Role updated to '${role}' for ${user.firstName} ${user.lastName}.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error changing role' });
    }
});

router.delete('/staff/:id', async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
        }

        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'User not found.' });

        res.json({ success: true, message: 'Staff member deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error deleting staff' });
    }
});

// ==================== REGISTRATION CODES ====================

router.get('/registration-codes', async (req, res) => {
    try {
        const codes = await RegistrationCode.find().sort({ createdAt: -1 });
        res.json({ success: true, codes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching codes' });
    }
});

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
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                status:    'active'
            });
            await newCode.save();
            codes.push(newCode);
        }

        res.json({ success: true, message: `Generated ${count} code(s).`, codes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error generating codes' });
    }
});

// ==================== DASHBOARD STATS (FIXED: lowStockItems from real DB) ====================

router.get('/stats', async (req, res) => {
    try {
        const [
            totalDonations, pendingBookings, staffOnDuty,
            donationAmount, totalBookings, activeStaff,
            inventoryItems
        ] = await Promise.all([
            Donation.countDocuments(),
            Booking.countDocuments({ status: 'pending' }),
            User.countDocuments({ role: { $ne: 'admin' }, isActive: true }),
            Donation.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Booking.countDocuments(),
            User.countDocuments({ isActive: true, role: { $ne: 'admin' } }),
            // FIX: fetch inventory to compute real low-stock count
            Inventory.find({}, { quantity: 1, minThreshold: 1 })
        ]);

        // FIXED: compute lowStockItems from real data (was hardcoded 5)
        const lowStockItems = inventoryItems.filter(
            i => i.quantity <= (i.minThreshold ?? 10)
        ).length;

        res.json({
            success: true,
            data: {
                totalResidents: 71,
                staffOnDuty,
                pendingBookings,
                totalDonations,
                totalDonationAmount: donationAmount[0]?.total || 0,
                lowStockItems,           // ← now real
                totalBookings,
                activeStaff
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
});

// ==================== INVENTORY ROUTES ====================

router.get('/inventory', async (req, res) => {
    try {
        const { category, status, limit = 100 } = req.query;
        let query = {};
        if (category) query.category = category;
        if (status)   query.status   = status;

        const items = await Inventory.find(query)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching inventory' });
    }
});

router.post('/inventory', async (req, res) => {
    try {
        const item = new Inventory({
            ...req.body,
            itemId: `INV-${Date.now().toString().slice(-6)}`
        });
        await item.save();
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error adding inventory item' });
    }
});

router.put('/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
        res.json({ success: true, data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating inventory' });
    }
});

router.delete('/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting inventory' });
    }
});


// ==================== ATTENDANCE ====================
router.post('/staff/:id/attendance', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'Staff not found.' });
        // Log attendance as an activity
        const ActivityLog = require('../models/ActivityLog');
        await ActivityLog.create({
            action:  'ATTENDANCE',
            details: `Attendance logged for ${user.firstName} ${user.lastName} at ${new Date().toLocaleTimeString()}`,
            user:    req.user._id,
            targetId: user._id,
        });
        res.json({ success: true, message: `Attendance logged for ${user.firstName} ${user.lastName}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== STOCK REQUESTS ====================
router.get('/stock-requests', async (req, res) => {
    try {
        const requests = await StockRequest.find()
            .populate('requestedBy', 'firstName lastName role ward')
            .populate('resolvedBy',  'firstName lastName')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: requests, count: requests.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/stock-requests/:id', async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        const req_ = await StockRequest.findByIdAndUpdate(
            req.params.id,
            { status, adminNote: adminNote || '', resolvedBy: req.user._id, resolvedAt: new Date() },
            { new: true }
        ).populate('requestedBy', 'firstName lastName');
        if (!req_) return res.status(404).json({ success: false, message: 'Request not found.' });

        // Notify nurse via socket
        const io = req.app.get('io');
        if (io) io.emit('stock_request_updated', { requestId: req_._id, status, itemName: req_.itemName });

        res.json({ success: true, data: req_, message: `Stock request ${status}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;