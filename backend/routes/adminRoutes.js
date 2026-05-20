const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const User = require('../models/User');
const Booking = require('../models/Booking');
const Donation = require('../models/Donation');
const Inventory = require('../models/Inventory');
const RegistrationCode = require('../models/VerificationCode');
const StockRequest = require('../models/StockRequest');
const VitalsLog = require('../models/VitalsLog');
const ActivityLog = require('../models/ActivityLog');

const { protect, adminOrHeadCaregiver } = require('../middleware/authMiddleware');
const { sendEmail, generateOtpTemplate } = require('../models/mailer');
const { generateRandomPassword, generateUsername } = require('../utils/userHelpers');

router.use(protect, adminOrHeadCaregiver);

// ─────────────────────────────────────────────────────────────
// STAFF ID GENERATOR
// ─────────────────────────────────────────────────────────────
async function generateStaffId(role) {
    const prefixMap = {
        admin: 'ADMIN',
        head_caregiver: 'HCG',
        caregiver: 'CG',
    };

    const prefix = prefixMap[role] || 'CG';

    const latest = await User.findOne(
        { staffId: new RegExp(`^${prefix}-\\d+$`) },
        { staffId: 1 },
        { sort: { staffId: -1 } }
    );

    let next = 1;

    if (latest?.staffId) {
        const parts = latest.staffId.split('-');
        const num = parseInt(parts[parts.length - 1], 10);

        if (!isNaN(num)) {
            next = num + 1;
        }
    }

    return `${prefix}-${String(next).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// CREATE USER
// ─────────────────────────────────────────────────────────────
router.post('/create-user', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            middleName = '',
            username,
            email,
            password,
            phone = '',
            role = 'caregiver',
            department = '',
            activateImmediately = true
        } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, email, and password are required.'
            });
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters.'
            });
        }

        const allowedRoles = ['admin', 'head_caregiver', 'caregiver'];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role must be one of: ${allowedRoles.join(', ')}`
            });
        }

        const derivedUsername = username?.trim() || email.split('@')[0];

        const existing = await User.findOne({
            $or: [
                { email: email.trim().toLowerCase() },
                { username: derivedUsername }
            ]
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message:
                    existing.email === email
                        ? 'A user with this email already exists.'
                        : 'This username is already taken.'
            });
        }

        const staffId = await generateStaffId(role);

        const user = new User({
            staffId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim(),
            username: derivedUsername,
            email: email.trim().toLowerCase(),
            password,
            phone: phone.trim(),
            role,
            department: department || undefined,
            isVerified: activateImmediately,
            isActive: activateImmediately,
        });

        await user.save();

        if (!activateImmediately) {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            user.otpCode = otpCode;
            user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);

            await user.save();

            try {
                await sendEmail(
                    email,
                    'Activate your Kanang-Alalay Account',
                    generateOtpTemplate(otpCode)
                );
            } catch (mailErr) {
                console.error('Email error:', mailErr.message);
            }
        }

        res.status(201).json({
            success: true,
            message: `Account created. Credentials emailed to ${email}.`,
            userId: user._id,
            staffId: user.staffId,
            email: user.email,
            firstName: user.firstName,
            role: user.role,
        });

    } catch (error) {
        console.error('Create user error:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email or username already exists.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error creating user: ' + error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────
// ENHANCED CREATE USER
// ─────────────────────────────────────────────────────────────
router.post('/create-user-enhanced', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            middleName = '',
            email,
            phone = '',
            role = 'caregiver',
            shift = 'morning',
            assignedFloor = '',
            assignedRoom = ''
        } = req.body;

        // VALIDATIONS
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and email are required.'
            });
        }

        const nameRegex = /^[a-zA-Z\s]*$/;

        if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
            return res.status(400).json({
                success: false,
                message: 'Names cannot contain numbers.'
            });
        }

        if (lastName.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Surname must be at least 2 characters.'
            });
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address.'
            });
        }

        const allowedRoles = ['admin', 'head_caregiver', 'caregiver'];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role must be one of: ${allowedRoles.join(', ')}`
            });
        }

        const existing = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists.'
            });
        }

        // AUTO GENERATED CREDENTIALS
        const tempPassword = generateRandomPassword();

        let username = generateUsername(firstName, lastName);

        let attempts = 0;

        while (await User.findOne({ username }) && attempts < 5) {
            username = generateUsername(firstName, lastName);
            attempts++;
        }

        const staffId = await generateStaffId(role);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const user = new User({
            staffId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim(),
            username,
            email: email.trim().toLowerCase(),
            password: tempPassword,
            phone: phone.trim(),
            role,
            shift,
            assignedFloor,
            assignedRoom,

            status: 'pending',
            isVerified: false,
            isActive: true,
            isFirstLogin: true,
            needsProfileUpdate: true,

            verificationOtp: otp,
            verificationOtpExpires: new Date(Date.now() + 30 * 60 * 1000),
            lastOtpSentAt: new Date(),
        });

        await user.save();

        const loginUrl =
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

        const roleLabel =
            role === 'head_caregiver'
                ? 'Head Caregiver'
                : role.charAt(0).toUpperCase() + role.slice(1);

        // EMAIL TEMPLATE
        const welcomeHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5">
    <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
        
        <div style="background:linear-gradient(135deg,#b85c2d,#d94e1b);padding:28px 32px">
            <h2 style="margin:0;color:#fff;font-size:1.4rem">
                Welcome to Kanang-Alalay!
            </h2>

            <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:.9rem">
                Your account has been created by an administrator.
            </p>
        </div>

        <div style="padding:28px 32px">

            <p style="color:#444;margin:0 0 20px">
                Hello <strong>${firstName} ${lastName}</strong>,
                here are your login credentials:
            </p>

            <table style="width:100%;border-collapse:collapse;margin-bottom:24px">

                <tr style="background:#fafafa">
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee;width:40%">
                        Username
                    </td>

                    <td style="padding:10px 14px;font-weight:700;font-family:monospace;font-size:1rem;border-bottom:1px solid #eee">
                        ${username}
                    </td>
                </tr>

                <tr>
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee">
                        Temporary Password
                    </td>

                    <td style="padding:10px 14px;font-weight:700;font-family:monospace;font-size:1rem;color:#d94e1b;border-bottom:1px solid #eee">
                        ${tempPassword}
                    </td>
                </tr>

                <tr style="background:#fafafa">
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee">
                        Role
                    </td>

                    <td style="padding:10px 14px;border-bottom:1px solid #eee">
                        ${roleLabel}
                    </td>
                </tr>

                <tr>
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee">
                        Shift
                    </td>

                    <td style="padding:10px 14px;border-bottom:1px solid #eee;text-transform:capitalize">
                        ${shift}
                    </td>
                </tr>

                <tr style="background:#fafafa">
                    <td style="padding:10px 14px;color:#888;font-size:.85rem">
                        Floor / Room
                    </td>

                    <td style="padding:10px 14px">
                        ${assignedFloor || '—'} / ${assignedRoom || '—'}
                    </td>
                </tr>
            </table>

            <div style="background:#fff8e1;border:2px solid #f96b38;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">

                <p style="margin:0 0 8px;font-weight:700;color:#b85c2d;font-size:.9rem">
                    YOUR ONE-TIME PASSCODE (OTP)
                </p>

                <div style="font-size:2.4rem;font-weight:900;font-family:monospace;letter-spacing:10px;color:#d94e1b">
                    ${otp}
                </div>

                <p style="margin:10px 0 0;font-size:.78rem;color:#999">
                    ⏱ Expires in 30 minutes · Do not share this code
                </p>
            </div>

            <div style="background:#f0f7ff;border-radius:10px;padding:16px 20px;margin-bottom:24px">

                <p style="margin:0 0 10px;font-weight:700;color:#1a5276;font-size:.88rem">
                    HOW TO GET STARTED
                </p>

                <ol style="margin:0;padding-left:18px;color:#444;font-size:.86rem;line-height:1.8">
                    <li>
                        Go to 
                        <a href="${loginUrl}" style="color:#d94e1b">
                            ${loginUrl}
                        </a>
                    </li>

                    <li>
                        Log in with your username and temporary password
                    </li>

                    <li>
                        Enter the OTP code when prompted
                    </li>

                    <li>
                        Set your permanent password and complete your profile
                    </li>
                </ol>
            </div>

            <p style="color:#dc3545;font-size:.8rem;text-align:center;margin:0">
                ⚠️ For your security, do not share these credentials with anyone.
            </p>

        </div>

        <div style="background:#fafafa;padding:14px 32px;text-align:center;border-top:1px solid #eee">
            <p style="margin:0;color:#aaa;font-size:.76rem">
                Kanang-Alalay Care Management System
            </p>
        </div>

    </div>
</body>
</html>`;

        try {
            await sendEmail(
                email.trim().toLowerCase(),
                'Your Kanang-Alalay Account Credentials',
                welcomeHtml
            );
        } catch (mailErr) {
            console.error(
                'Welcome email error (account still created):',
                mailErr.message
            );
        }

        res.status(201).json({
            success: true,
            message: `Account created. Credentials emailed to ${email}.`,
            userId: user._id,
            staffId: user.staffId,
        });

    } catch (error) {
        console.error('Create enhanced user error:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email or username already exists.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────
// BOOKING STATUS UPDATE
// ─────────────────────────────────────────────────────────────
router.put('/bookings/:id/status', async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;

        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            {
                status,
                rejectionReason:
                    status === 'rejected'
                        ? rejectionReason
                        : undefined
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found.'
            });
        }

        if (status === 'rejected' && rejectionReason) {
            await sendEmail(
                booking.email,
                'Booking Update',
                `<p>Your booking has been rejected. Reason: ${rejectionReason}</p>`
            );
        }

        res.json({
            success: true,
            data: booking
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────
// BULK INVENTORY IMPORT
// ─────────────────────────────────────────────────────────────
router.post('/inventory/bulk-import', async (req, res) => {
    try {
        const { items } = req.body;

        const result = await Inventory.insertMany(items);

        res.status(201).json({
            success: true,
            count: result.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Bulk import failed.'
        });
    }
});

// ─────────────────────────────────────────────────────────────
// STAFF ROUTES
// ─────────────────────────────────────────────────────────────
router.get('/staff', async (req, res) => {
    try {
        const staff = await User.find({
            role: { $in: ['admin', 'head_caregiver', 'caregiver'] }
        })
            .select('-password')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: staff.length,
            staff
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error fetching staff'
        });
    }
});

router.get('/staff/:id', async (req, res) => {
    try {
        const staff = await User.findById(req.params.id).select('-password');

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found'
            });
        }

        res.json({
            success: true,
            staff
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.put('/staff/:id/status', async (req, res) => {
    try {
        const target = await User.findById(req.params.id);

        if (!target) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (target._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own status.'
            });
        }

        const { status, reason } = req.body;

        const allowedStatuses = [
            'pending',
            'active',
            'restricted',
            'suspended',
            'deactivated',
            'on_leave',
            'terminated'
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`
            });
        }

        target.status = status;
        target.isActive = status === 'active';
        target.statusReason = reason || '';
        target.statusUpdatedAt = new Date();
        target.statusUpdatedBy = req.user._id;

        await target.save();

        res.json({
            success: true,
            message: `Staff status updated to "${status}".`,
            staff: {
                _id: target._id,
                status: target.status,
                isActive: target.isActive,
                statusReason: target.statusReason
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error updating status'
        });
    }
});

router.put('/staff/:id/role', async (req, res) => {
    try {
        const { role } = req.body;

        const allowedRoles = [
            'admin',
            'head_caregiver',
            'caregiver'
        ];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Allowed: ${allowedRoles.join(', ')}.`
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (
            user._id.toString() === req.user._id.toString() &&
            role !== 'admin'
        ) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role.'
            });
        }

        user.role = role;

        await user.save();

        res.json({
            success: true,
            message: `Role updated to '${role}' for ${user.firstName} ${user.lastName}.`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error changing role'
        });
    }
});

router.delete('/staff/:id', async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account.'
            });
        }

        const deleted = await User.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        res.json({
            success: true,
            message: 'Staff member deleted successfully.'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error deleting staff'
        });
    }
});

// ─────────────────────────────────────────────────────────────
// REGISTRATION CODES
// ─────────────────────────────────────────────────────────────
router.get('/registration-codes', async (req, res) => {
    try {
        const codes = await RegistrationCode.find()
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            codes
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching codes'
        });
    }
});

router.post('/generate-codes', async (req, res) => {
    try {
        const { count = 1, role = 'caregiver' } = req.body;

        const allowedRoles = [
            'admin',
            'head_caregiver',
            'caregiver'
        ];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role must be one of: ${allowedRoles.join(', ')}`
            });
        }

        const codes = [];

        for (let i = 0; i < count; i++) {
            const code =
                `LSAE-REG-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

            const newCode = new RegistrationCode({
                code,
                role,
                email: 'unassigned@lsae.org',
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                status: 'active'
            });

            await newCode.save();

            codes.push(newCode);
        }

        res.json({
            success: true,
            message: `Generated ${count} code(s).`,
            codes
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating codes'
        });
    }
});

// ─────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [
            totalDonations,
            pendingBookings,
            activeStaff,
            donationAmount,
            totalBookings,
            inventoryItems
        ] = await Promise.all([
            Donation.countDocuments(),

            Booking.countDocuments({
                status: 'pending'
            }),

            User.countDocuments({
                isActive: true
            }),

            Donation.aggregate([
                { $match: { paymentStatus: 'paid' } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ]),

            Booking.countDocuments(),

            Inventory.find({}, {
                quantity: 1,
                minThreshold: 1
            })
        ]);

        const lowStockItems = inventoryItems.filter(
            item => item.quantity <= (item.minThreshold ?? 10)
        ).length;

        res.json({
            success: true,
            data: {
                totalResidents: 71,
                activeStaff,
                pendingBookings,
                totalDonations,
                totalDonationAmount: donationAmount[0]?.total || 0,
                lowStockItems,
                totalBookings
            }
        });

    } catch (error) {
        console.error('Stats error:', error);

        res.status(500).json({
            success: false,
            message: 'Error fetching stats'
        });
    }
});

// ─────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────
router.get('/inventory', async (req, res) => {
    try {
        const { category, status, limit = 100 } = req.query;

        const query = {};

        if (category) query.category = category;
        if (status) query.status = status;

        const items = await Inventory.find(query)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: items
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching inventory'
        });
    }
});

router.post('/inventory', async (req, res) => {
    try {
        const item = new Inventory({
            name: req.body.name,
            quantity: req.body.quantity || 0,
            unit: req.body.unit || 'pcs',
            category: req.body.category || 'General',
            minThreshold: req.body.minThreshold || 10,
            barcode: req.body.barcode || undefined,
            expirationDate: req.body.expirationDate,
            notes: req.body.notes
        });

        await item.save();

        res.status(201).json({
            success: true,
            data: item
        });

    } catch (error) {
        console.error('Admin inventory create error:', error);

        const message =
            error.code === 11000
                ? 'Duplicate inventory identifier. Please retry.'
                : 'Error adding inventory item';

        res.status(500).json({
            success: false,
            message,
            error: error.message
        });
    }
});

router.put('/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        res.json({
            success: true,
            data: item
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating inventory'
        });
    }
});

router.delete('/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findByIdAndDelete(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        res.json({
            success: true,
            message: 'Item deleted'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting inventory'
        });
    }
});

// ─────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────
router.post('/staff/:id/attendance', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found.'
            });
        }

        await ActivityLog.create({
            action: 'ATTENDANCE',
            details:
                `Attendance logged for ${user.firstName} ${user.lastName} at ${new Date().toLocaleTimeString()}`,
            user: req.user._id,
            targetId: user._id,
        });

        res.json({
            success: true,
            message: `Attendance logged for ${user.firstName} ${user.lastName}.`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ─────────────────────────────────────────────────────────────
// STOCK REQUESTS
// ─────────────────────────────────────────────────────────────
router.get('/stock-requests', async (req, res) => {
    try {
        const requests = await StockRequest.find()
            .populate('requestedBy', 'firstName lastName role')
            .populate('resolvedBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: requests,
            count: requests.length
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.put('/stock-requests/:id', async (req, res) => {
    try {
        const { status, adminNote } = req.body;

        const stockReq = await StockRequest.findByIdAndUpdate(
            req.params.id,
            {
                status,
                adminNote: adminNote || '',
                resolvedBy: req.user._id,
                resolvedAt: new Date()
            },
            { new: true }
        )
            .populate('requestedBy', 'firstName lastName');

        if (!stockReq) {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        res.json({
            success: true,
            data: stockReq,
            message: `Stock request ${status}.`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// ─────────────────────────────────────────────────────────────
// EDIT USER (name, email, phone, role)
// PUT /api/admin/users/:id
// Called by the Edit modal in AdminDashboard
// ─────────────────────────────────────────────────────────────
router.put('/users/:id', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, role } = req.body;

        const allowedRoles = ['admin', 'head_caregiver', 'caregiver'];

        if (role && !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Must be one of: ${allowedRoles.join(', ')}`
            });
        }

        const target = await User.findById(req.params.id);

        if (!target) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Prevent admin from changing their own role to something lower
        if (
            target._id.toString() === req.user._id.toString() &&
            role && role !== 'admin'
        ) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role.'
            });
        }

        // Check email uniqueness if changing
        if (email && email.toLowerCase() !== target.email) {
            const emailExists = await User.findOne({
                email: email.trim().toLowerCase(),
                _id: { $ne: target._id }
            });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Another account already uses this email.'
                });
            }
        }

        if (firstName)  target.firstName = firstName.trim();
        if (lastName)   target.lastName  = lastName.trim();
        if (email)      target.email     = email.trim().toLowerCase();
        if (phone !== undefined) target.phone = phone.trim();
        if (role)       target.role      = role;

        // If role changed, log it
        if (role && role !== target.role) {
            await ActivityLog.create({
                action: 'ROLE_CHANGE',
                details: `Role changed to '${role}' for ${target.firstName} ${target.lastName}`,
                user: req.user._id,
                targetId: target._id,
            }).catch(() => {});
        }

        await target.save();

        res.json({
            success: true,
            message: 'User updated successfully.',
            data: {
                _id:       target._id,
                staffId:   target.staffId,
                firstName: target.firstName,
                lastName:  target.lastName,
                email:     target.email,
                phone:     target.phone,
                role:      target.role,
                status:    target.status,
            }
        });

    } catch (error) {
        console.error('Edit user error:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

module.exports = router;