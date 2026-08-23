const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Booking = require('../models/Booking');
const Donation = require('../models/Donation');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const { findOrCreateProduct, getNextBatchNumber } = require('../utils/inventoryProductService');
const { validateInventoryInput } = require('../utils/inventoryFormValidation');
const RegistrationCode = require('../models/VerificationCode');
const StockRequest = require('../models/StockRequest');
const HCAssignedStock = require('../models/HCAssignedStock');
const Alert = require('../models/Alert');
const VitalsLog = require('../models/VitalsLog');
const ActivityLog = require('../models/ActivityLog');
const MedicationLog = require('../models/MedicationLog');
const Resident = require('../models/Resident');

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
    const year = new Date().getFullYear();

    const latest = await User.findOne(
        { staffId: new RegExp(`^${prefix}-${year}-\\d+$`) },
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

    return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// CREATE USER (Standard)
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
            status: activateImmediately ? 'active' : 'pending'
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
// ENHANCED CREATE USER (with auto-generated credentials)
// ─────────────────────────────────────────────────────────────
router.post('/create-user-enhanced', async (req, res) => {
    try {
        console.log('📝 Create user request received:', JSON.stringify(req.body, null, 2));
        
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

        // ── VALIDATIONS ──────────────────────────────────────────────────────
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and email are required.'
            });
        }

        const nameRegex = /^[a-zA-Z\s\-']*$/;

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

        // Check if email already exists
        const existing = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists.'
            });
        }

        // ── GENERATE CREDENTIALS ─────────────────────────────────────────────
        const tempPassword = generateRandomPassword();

        // Generate username from email (ensure uniqueness)
        let username = email.split('@')[0].toLowerCase();
        // Remove special characters from username
        username = username.replace(/[^a-z0-9]/g, '');
        let usernameAttempt = username;
        let counter = 1;
        
        while (await User.findOne({ username: usernameAttempt })) {
            usernameAttempt = `${username}${counter}`;
            counter++;
        }
        username = usernameAttempt;

        // Generate staffId
        const staffId = await generateStaffId(role);

        // Generate OTP for first login
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // ── CREATE USER ──────────────────────────────────────────────────────
        const user = new User({
            staffId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim(),
            username,
            email: email.trim().toLowerCase(),
            password: tempPassword,
            phone: phone.trim() || '',
            role,
            shift,
            assignedFloor: assignedFloor || '',
            assignedRoom: assignedRoom || '',
            status: 'pending',
            isVerified: false,
            isActive: false,
            isFirstLogin: true,
            needsProfileUpdate: true,
            verificationOtp: otp,
            verificationOtpExpires: new Date(Date.now() + 30 * 60 * 1000),
            lastOtpSentAt: new Date(),
        });

        await user.save();
        console.log('✅ User created successfully:', user._id);

        // ── SEND WELCOME EMAIL ──────────────────────────────────────────────
        const loginUrl = `${process.env.FRONTEND_URL || 'https://lsae-kanangalalay.online'}/entry-a96cc8350c56e2d3`;
        const roleLabel = role === 'head_caregiver' ? 'Head Caregiver' : role.charAt(0).toUpperCase() + role.slice(1);

        const welcomeHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5">
    <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
        <div style="background:linear-gradient(135deg,#b85c2d,#d94e1b);padding:28px 32px">
            <h2 style="margin:0;color:#fff;font-size:1.4rem">Welcome to Kanang-Alalay!</h2>
            <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:.9rem">
                Your account has been created by an administrator.
            </p>
        </div>
        <div style="padding:28px 32px">
            <p style="color:#444;margin:0 0 20px">
                Hello <strong>${firstName} ${lastName}</strong>, here are your login credentials:
            </p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
                <tr style="background:#fafafa">
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee;width:40%">Staff ID</td>
                    <td style="padding:10px 14px;font-weight:700;font-family:monospace;font-size:1rem;border-bottom:1px solid #eee">${staffId}</td>
                </tr>
                <tr>
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee">Username</td>
                    <td style="padding:10px 14px;font-weight:700;font-family:monospace;font-size:1rem;border-bottom:1px solid #eee">${username}</td>
                </tr>
                <tr style="background:#fafafa">
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee">Temporary Password</td>
                    <td style="padding:10px 14px;font-weight:700;font-family:monospace;font-size:1rem;color:#d94e1b;border-bottom:1px solid #eee">${tempPassword}</td>
                </tr>
                <tr>
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee">Role</td>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee">${roleLabel}</td>
                </tr>
                <tr style="background:#fafafa">
                    <td style="padding:10px 14px;color:#888;font-size:.85rem;border-bottom:1px solid #eee">Shift</td>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;text-transform:capitalize">${shift}</td>
                </tr>
            </table>
            <div style="background:#f0f7ff;border-radius:10px;padding:16px 20px;margin-bottom:24px">
                <p style="margin:0 0 10px;font-weight:700;color:#1a5276;font-size:.88rem">HOW TO GET STARTED</p>
                <ol style="margin:0;padding-left:18px;color:#444;font-size:.86rem;line-height:1.8">
                    <li>Go to <a href="${loginUrl}" style="color:#d94e1b">${loginUrl}</a></li>
                    <li>Log in with your username and temporary password</li>
                    <li>Set your permanent password and complete your profile</li>
                </ol>
            </div>
            <p style="color:#dc3545;font-size:.8rem;text-align:center;margin:0">
                For your security, do not share these credentials with anyone.
            </p>
        </div>
        <div style="background:#fafafa;padding:14px 32px;text-align:center;border-top:1px solid #eee">
            <p style="margin:0;color:#aaa;font-size:.76rem">Kanang-Alalay Care Management System</p>
        </div>
    </div>
</body>
</html>`;

        try {
            await sendEmail(email.trim().toLowerCase(), 'Your Kanang-Alalay Account Credentials', welcomeHtml);
            console.log('📧 Welcome email sent to:', email);
        } catch (mailErr) {
            console.error('Welcome email error (account still created):', mailErr.message);
        }

        res.status(201).json({
            success: true,
            message: `Account created. Credentials emailed to ${email}.`,
            userId: user._id,
            staffId: user.staffId,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                shift: user.shift
            }
        });

    } catch (error) {
        console.error('Create enhanced user error:', error);
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `A user with this ${field} already exists.`
            });
        }
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error: ' + errors.join(', ')
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

        const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found.'
            });
        }

        booking.status = status;
        
        if (status === 'rejected' && rejectionReason) {
            booking.rejectionReason = rejectionReason;
        }

        await booking.save();

        if (status === 'rejected' && rejectionReason) {
            try {
                const { generateBookingRejectionTemplate } = require('../models/mailer');
                await sendEmail(
                    booking.email,
                    'Booking Update - Kanang-Alalay',
                    generateBookingRejectionTemplate(booking, rejectionReason)
                );
            } catch (emailErr) {
                console.error('Rejection email error:', emailErr.message);
            }
        }

        const io = req.app.get('io');
        if (io) io.emit('update_booking', booking);

        res.json({
            success: true,
            data: booking,
            message: `Booking ${status} successfully.`
        });

    } catch (error) {
        console.error('Update booking error:', error);
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

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Items array is required.'
            });
        }

        const result = await Inventory.insertMany(items, { ordered: false });

        res.status(201).json({
            success: true,
            count: result.length,
            message: `${result.length} items imported successfully.`
        });

    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({
            success: false,
            message: 'Bulk import failed: ' + error.message
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
        console.error('Get staff error:', error);
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
        console.error('Get staff by id error:', error);
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

        await ActivityLog.create({
            action: 'STATUS_CHANGE',
            details: `Status changed to "${status}" for ${target.firstName} ${target.lastName}`,
            user: req.user._id,
            targetId: target._id,
        }).catch(() => {});

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
        console.error('Update staff status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating status'
        });
    }
});

router.put('/staff/:id/role', async (req, res) => {
    try {
        const { role } = req.body;

        const allowedRoles = ['admin', 'head_caregiver', 'caregiver'];

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

        if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role.'
            });
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();

        await ActivityLog.create({
            action: 'ROLE_CHANGE',
            details: `Role changed from "${oldRole}" to "${role}" for ${user.firstName} ${user.lastName}`,
            user: req.user._id,
            targetId: user._id,
        }).catch(() => {});

        res.json({
            success: true,
            message: `Role updated to '${role}' for ${user.firstName} ${user.lastName}.`
        });

    } catch (error) {
        console.error('Change role error:', error);
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
        console.error('Delete staff error:', error);
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
        console.error('Get codes error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching codes'
        });
    }
});

router.post('/generate-codes', async (req, res) => {
    try {
        const { count = 1, role = 'caregiver' } = req.body;

        const allowedRoles = ['admin', 'head_caregiver', 'caregiver'];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role must be one of: ${allowedRoles.join(', ')}`
            });
        }

        const codes = [];

        for (let i = 0; i < count; i++) {
            const code = `LSAE-REG-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

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
        console.error('Generate codes error:', error);
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
            Booking.countDocuments({ status: 'pending' }),
            User.countDocuments({ isActive: true, status: 'active' }),
            Donation.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Booking.countDocuments(),
            Inventory.find({}, { quantity: 1, minThreshold: 1 })
        ]);

        const lowStockItems = inventoryItems.filter(
            item => item.quantity <= (item.minThreshold ?? 10)
        ).length;

        res.json({
            success: true,
            data: {
                totalResidents: await Resident.countDocuments({ status: 'active' }),
                activeStaff,
                pendingBookings,
                totalDonations,
                totalDonationAmount: donationAmount[0]?.total || 0,
                lowStockItems,
                totalBookings,
                complianceRate: 92
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

        if (category && category !== 'All') query.category = category;
        if (status && status !== 'All') query.status = status;

        const items = await Inventory.find(query)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: items,
            count: items.length
        });

    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching inventory'
        });
    }
});

router.post('/inventory', async (req, res) => {
    try {
        const { name, quantity, unit, category, minThreshold, expirationDate, notes, supplier, doesNotExpire, brand, dosage } = req.body;

        // ── Form validation (backend is the source of truth — never rely
        // on the frontend alone) ──────────────────────────────────────
        const validationError = validateInventoryInput({
            name, category, quantity, unit, minThreshold, expirationDate, doesNotExpire, brand, dosage,
        });
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        // ── Product + Batch ──────────────────────────────────────────
        // Every "Add Inventory" is now a BATCH belonging to a PRODUCT.
        // Products are never seeded/hardcoded — find-or-create dynamically
        // here, on whatever name the Admin types. Name matching is done on
        // a normalized (trimmed, whitespace-collapsed, lowercased) form so
        // "Skyflakes" / "skyflakes " / "SKYFLAKES" all resolve to the same
        // product, while "Skyflakes" and "Skyflakes Chocolate" stay separate.
        const { product, created } = await findOrCreateProduct(Product, {
            name,
            category,
            unit,
            minimumStockLevel: minThreshold,
        });

        // If this name already resolves to an existing Product, the new
        // batch's category/unit MUST match that Product's — otherwise
        // "total stock" for the product (e.g. summing quantity across
        // batches) stops making sense (you can't add "10 kg" to a product
        // whose existing stock is tracked in "pack"). Reject rather than
        // silently overriding what the Admin typed.
        if (!created && (product.category !== category || product.unit !== unit)) {
            return res.status(400).json({
                success: false,
                message: `"${product.name}" already exists as a product with category "${product.category}" and unit "${product.unit}". Add this batch using the same category and unit, or use a different item name if this is actually a different product.`,
            });
        }

        const batchNumber = await getNextBatchNumber(Inventory, product._id);

        // The batch keeps its own copy of name/category/unit/minThreshold
        // (mirrored from the product) so every existing query, the
        // Inventory table, low-stock counts, etc. keep working exactly as
        // before without needing to know about Product yet. Batch-specific
        // details (quantity, expiration, supplier) are per-batch.
        const item = new Inventory({
            productId: product._id,
            name: product.name,
            batchNumber,
            quantity: quantity || 0,
            unit: product.unit,
            category: product.category,
            minThreshold: Number(minThreshold),
            expirationDate: doesNotExpire ? null : (expirationDate || null),
            doesNotExpire: !!doesNotExpire,
            supplier: supplier || undefined,
            // Required by the model (and by validateInventoryInput above)
            // whenever category is 'medication' ("Medicine" in the form);
            // optional for every other category.
            brand: brand ? String(brand).trim() : undefined,
            dosage: dosage ? String(dosage).trim() : undefined,
            notes: notes || ''
        });

        await item.save();

        res.status(201).json({
            success: true,
            data: item,
            message: 'Inventory item added successfully.'
        });

    } catch (error) {
        console.error('Admin inventory create error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding inventory item: ' + error.message
        });
    }
});

router.put('/inventory/:id', async (req, res) => {
    try {
        const existing = await Inventory.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const updates = { ...req.body };

        // Merge incoming updates over the existing document so we validate
        // the FINAL state of the item, not just whichever fields happened
        // to be included in this particular PUT body.
        const merged = {
            name: updates.name !== undefined ? updates.name : existing.name,
            category: updates.category !== undefined ? updates.category : existing.category,
            quantity: updates.quantity !== undefined ? updates.quantity : existing.quantity,
            unit: updates.unit !== undefined ? updates.unit : existing.unit,
            minThreshold: updates.minThreshold !== undefined ? updates.minThreshold : existing.minThreshold,
            expirationDate: updates.expirationDate !== undefined ? updates.expirationDate : existing.expirationDate,
            doesNotExpire: updates.doesNotExpire !== undefined ? updates.doesNotExpire : existing.doesNotExpire,
            brand: updates.brand !== undefined ? updates.brand : existing.brand,
            dosage: updates.dosage !== undefined ? updates.dosage : existing.dosage,
        };

        const validationError = validateInventoryInput(merged);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        // If the batch's name is being edited, re-resolve which Product it
        // belongs to (same normalized-name matching used on create) instead
        // of leaving it pointed at the old product or left unlinked.
        if (updates.name && updates.name.trim()) {
            const { product, created } = await findOrCreateProduct(Product, {
                name: merged.name,
                category: merged.category,
                unit: merged.unit,
                minimumStockLevel: merged.minThreshold,
            });

            if (!created && (product.category !== merged.category || product.unit !== merged.unit)) {
                return res.status(400).json({
                    success: false,
                    message: `"${product.name}" already exists as a product with category "${product.category}" and unit "${product.unit}". Edit this batch using the same category and unit, or use a different item name if this is actually a different product.`,
                });
            }

            updates.productId = product._id;
            updates.name = product.name;
        }

        // "Does not expire" always wins — never leave a stale expiration
        // date set on a document flagged as non-expiring.
        if (merged.doesNotExpire) {
            updates.expirationDate = null;
        }

        const item = await Inventory.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        res.json({
            success: true,
            data: item,
            message: 'Inventory item updated successfully.'
        });

    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating inventory: ' + error.message
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
            message: 'Item deleted successfully.'
        });

    } catch (error) {
        console.error('Delete inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting inventory: ' + error.message
        });
    }
});

// GET inventory QR code
router.get('/inventory/:id/qr', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const QRCode = require('qrcode');
        const qrData = JSON.stringify({
            id: item._id,
            itemId: item.itemId,
            name: item.name,
            qrCode: item.qrCode
        });

        QRCode.toDataURL(qrData, (err, url) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'QR generation failed' });
            }
            res.json({ success: true, qrCode: url });
        });

    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────
router.post('/staff/:id/attendance', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found.'
            });
        }

        await ActivityLog.create({
            action: 'ATTENDANCE',
            details: `Attendance logged for ${user.firstName} ${user.lastName} at ${new Date().toLocaleTimeString()}`,
            user: req.user._id,
            targetId: user._id,
        });

        res.json({
            success: true,
            message: `Attendance logged for ${user.firstName} ${user.lastName}.`
        });

    } catch (err) {
        console.error('Attendance error:', err);
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
        console.error('Get stock requests error:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ── Part 6 helpers ──────────────────────────────────────────────────
//
// This codebase has no existing mongoose session/transaction usage
// anywhere (checked routes/*.js), so we can't assume the deployment is
// running MongoDB as a replica set — multi-document `session.
// startTransaction()` calls throw outright on a standalone mongod, which
// is the more likely setup for a project at this stage. Rather than risk
// that, approval is built as a small saga: every write is an atomic,
// conditional single-document operation (guarded with a filter so it can
// never overshoot), performed in an order where a failure partway through
// is safely undone by compensating writes. The net effect is the same
// all-or-nothing guarantee section 7 asks for, without depending on
// replica-set transactions being available.

// Batch draw-down order when a Product has more than one Inventory batch.
// No FIFO/FEFO logic existed anywhere in the project to reuse, so this
// establishes one: batches with a real expiration date are drawn down
// soonest-expiring-first (FEFO), since handing out stock closest to
// expiring first is the only choice that makes sense for a caregiving
// facility. Non-expiring batches (doesNotExpire, or no expirationDate)
// are drawn down oldest-purchased-first (FIFO) and only after every
// dated batch is exhausted.
function sortBatchesFefoFifo(batches) {
    return [...batches].sort((a, b) => {
        const aDated = a.expirationDate && !a.doesNotExpire;
        const bDated = b.expirationDate && !b.doesNotExpire;
        if (aDated && bDated) return new Date(a.expirationDate) - new Date(b.expirationDate);
        if (aDated && !bDated) return -1;
        if (!aDated && bDated) return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
    });
}

// Inventory's own status auto-calc lives in a pre('save') hook (models/
// Inventory.js), which findOneAndUpdate never triggers. Re-run the same
// rule by hand after every atomic $inc so a batch's status field doesn't
// go stale the moment it's touched outside .save().
async function recomputeBatchStatus(batchId) {
    const batch = await Inventory.findById(batchId);
    if (!batch) return;
    let status;
    if (batch.expirationDate && batch.expirationDate < new Date()) status = 'expired';
    else if (batch.quantity === 0) status = 'out_of_stock';
    else if (batch.quantity <= batch.minThreshold) status = 'low_stock';
    else status = 'available';
    if (batch.status !== status) {
        await Inventory.updateOne({ _id: batch._id }, { status });
    }
}

// Compensating action: undo a partial set of batch deductions (used when
// a later step in the approval saga fails) by adding each amount back to
// the exact batch it was taken from.
async function restoreBatchDeductions(deductions) {
    for (const d of deductions) {
        await Inventory.updateOne({ _id: d.batchId }, { $inc: { quantity: d.amount } });
        await recomputeBatchStatus(d.batchId);
    }
}

router.put('/stock-requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNote } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid request ID.' });
        }
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be 'approved' or 'rejected'." });
        }

        // Part 6 §8 — duplicate approval guard, part 1: fail fast on the
        // common case (someone already resolved this, no race involved).
        // The atomic status-flip filters below (status: 'pending') are what
        // actually close the race window for two near-simultaneous clicks.
        const existing = await StockRequest.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Request not found.' });
        }
        if (existing.status !== 'pending') {
            return res.status(409).json({
                success: false,
                message: `This request has already been ${existing.status}.`,
            });
        }

        // ── REJECT — Part 6 §2: status flips, nothing else moves. ──────
        if (status === 'rejected') {
            const updated = await StockRequest.findOneAndUpdate(
                { _id: id, status: 'pending' },
                { status: 'rejected', adminNote: adminNote || '', resolvedBy: req.user._id, resolvedAt: new Date() },
                { new: true }
            )
                .populate('requestedBy', 'firstName lastName role')
                .populate('resolvedBy', 'firstName lastName');

            if (!updated) {
                return res.status(409).json({ success: false, message: 'This request has already been resolved.' });
            }

            // Part 8 §2 — notify the requesting HC via the project's
            // existing Alert system (not a separate notification store).
            // Best-effort: the rejection itself already committed above,
            // so a failure here is only logged, never turned into a
            // failed rejection response.
            try {
                await Alert.create({
                    type: 'stock-request-rejected',
                    title: 'Stock Request Rejected',
                    message: `Your request for ${existing.quantity} ${existing.unit} of ${existing.itemName} has been rejected.`,
                    relatedUser: existing.requestedBy,
                    details: { stockRequestId: existing._id },
                });
            } catch (notifyErr) {
                console.error('Failed to create stock request rejection alert:', notifyErr);
            }

            return res.json({ success: true, data: updated, message: 'Stock request rejected.' });
        }

        // ── APPROVE — Part 6 §3–§7 ──────────────────────────────────────

        // §3.1 — the requested Product must still exist (Admin could have
        // deleted it between the HC's request and this approval).
        const product = await Product.findById(existing.productId);
        if (!product) {
            return res.status(400).json({
                success: false,
                message: 'The requested product no longer exists in Admin Central Inventory. Request left Pending.',
            });
        }

        const requestedQty = existing.quantity;

        // §3.2 / §5 — verify enough stock is available BEFORE touching
        // anything. Expired batches and empty batches are never eligible
        // to be handed out.
        const eligibleBatches = await Inventory.find({
            productId: product._id,
            quantity: { $gt: 0 },
            status: { $ne: 'expired' },
        });
        const totalAvailable = eligibleBatches.reduce((sum, b) => sum + b.quantity, 0);

        if (totalAvailable < requestedQty) {
            // Do NOT change Admin stock or HC stock; request stays Pending.
            return res.status(409).json({
                success: false,
                message: `Insufficient stock: only ${totalAvailable} ${product.unit} available, but ${requestedQty} ${product.unit} were requested. Request left Pending.`,
            });
        }

        // §3.3 / §4 — deduct from Admin Central Inventory batch-by-batch in
        // FEFO/FIFO order. Each deduction is an atomic conditional $inc
        // (quantity: { $gte: take }) so a batch can never be driven
        // negative even under concurrent approvals. If a batch's quantity
        // changed underneath us since we read it (rare race), we stop and
        // roll back everything already deducted rather than leave the
        // request half-fulfilled.
        const ordered = sortBatchesFefoFifo(eligibleBatches);
        let remaining = requestedQty;
        const deductions = [];

        for (const batch of ordered) {
            if (remaining <= 0) break;
            const take = Math.min(batch.quantity, remaining);
            const updatedBatch = await Inventory.findOneAndUpdate(
                { _id: batch._id, quantity: { $gte: take } },
                { $inc: { quantity: -take } },
                { new: true }
            );
            if (!updatedBatch) {
                await restoreBatchDeductions(deductions);
                return res.status(409).json({
                    success: false,
                    message: 'Stock levels changed while processing this approval. Please try again. Request left Pending.',
                });
            }
            await recomputeBatchStatus(updatedBatch._id);
            deductions.push({ batchId: batch._id, amount: take });
            remaining -= take;
        }

        if (remaining > 0) {
            // Defensive only — the totalAvailable check above should make
            // this unreachable, but never allow a partial transfer.
            await restoreBatchDeductions(deductions);
            return res.status(409).json({
                success: false,
                message: 'Insufficient stock to fulfill this request. Request left Pending.',
            });
        }

        // §3.4 — credit the requesting HC's OWN assigned-stock balance,
        // identified by their user ID (never name/email), upserting the
        // (headCaregiver, product) row per HCAssignedStock's unique index.
        await HCAssignedStock.findOneAndUpdate(
            { headCaregiverId: existing.requestedBy, productId: product._id },
            { $inc: { quantity: requestedQty } },
            { upsert: true }
        );

        // §3.5 / §8 — flip the request to Approved with the SAME
        // status:'pending' guard used for reject. If this doesn't match
        // (another action resolved it in the moment between our checks
        // above and now), someone else won the race — undo both the batch
        // deduction and the HC credit so we never double-transfer.
        const updatedRequest = await StockRequest.findOneAndUpdate(
            { _id: id, status: 'pending' },
            { status: 'approved', adminNote: adminNote || '', resolvedBy: req.user._id, resolvedAt: new Date() },
            { new: true }
        )
            .populate('requestedBy', 'firstName lastName role')
            .populate('resolvedBy', 'firstName lastName');

        if (!updatedRequest) {
            await restoreBatchDeductions(deductions);
            await HCAssignedStock.findOneAndUpdate(
                { headCaregiverId: existing.requestedBy, productId: product._id },
                { $inc: { quantity: -requestedQty } }
            );
            return res.status(409).json({ success: false, message: 'This request has already been resolved by another action.' });
        }

        // Part 8 §2 — notify the requesting HC via the existing Alert
        // system. Best-effort, same as the reject branch above: the
        // transfer already fully committed by this point, so a
        // notification failure is only logged.
        try {
            await Alert.create({
                type: 'stock-request-approved',
                title: 'Stock Request Approved',
                message: `Your request for ${existing.quantity} ${existing.unit} of ${existing.itemName} has been approved.`,
                relatedUser: existing.requestedBy,
                details: { stockRequestId: existing._id },
            });
        } catch (notifyErr) {
            console.error('Failed to create stock request approval alert:', notifyErr);
        }

        res.json({
            success: true,
            data: updatedRequest,
            message: `Stock request approved — ${requestedQty} ${product.unit} transferred to the head caregiver's assigned stock.`,
        });

    } catch (err) {
        console.error('Update stock request error:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ─────────────────────────────────────────────────────────────
// EDIT USER (name, email, phone, role)
// PUT /api/admin/users/:id
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

        if (target._id.toString() === req.user._id.toString() && role && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role.'
            });
        }

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

        if (firstName) target.firstName = firstName.trim();
        if (lastName) target.lastName = lastName.trim();
        if (email) target.email = email.trim().toLowerCase();
        if (phone !== undefined) target.phone = phone.trim();
        if (role) target.role = role;

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
                _id: target._id,
                staffId: target.staffId,
                firstName: target.firstName,
                lastName: target.lastName,
                email: target.email,
                phone: target.phone,
                role: target.role,
                status: target.status,
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

// ─────────────────────────────────────────────────────────────
// ACTION LOG (record user actions)
// POST /api/admin/staff/:id/action-log
// ─────────────────────────────────────────────────────────────
router.post('/staff/:id/action-log', async (req, res) => {
    try {
        const { action, reason, effectiveDate, notes, newStatus } = req.body;

        await ActivityLog.create({
            action: action.toUpperCase(),
            details: `${action}: ${reason || 'No reason provided'} | Effective: ${effectiveDate || 'Immediate'} | New status: ${newStatus || 'N/A'} | Notes: ${notes || 'None'}`,
            user: req.user._id,
            targetId: req.params.id,
        });

        res.json({ success: true, message: 'Action logged.' });

    } catch (error) {
        console.error('Action log error:', error);
        res.status(500).json({ success: false, message: 'Failed to log action.' });
    }
});

module.exports = router;