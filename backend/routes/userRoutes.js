/**
 * routes/userRoutes.js
 *
 * User-facing routes (accessible by authenticated staff).
 * Mount in server.js as:  app.use('/api/users', userRoutes);
 */

const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

/**
 * PUT /api/users/update-profile
 *
 * Allows an authenticated user to complete their first-login profile update.
 * Accepts: firstName, lastName, phone, address, shift,
 *          assignedFloor, assignedRoom, newPassword
 *
 * On success:
 *   - Saves all provided fields.
 *   - Hashes + saves new password (if provided & valid).
 *   - Clears isFirstLogin, needsProfileUpdate, and temporary credential fields.
 */
router.put('/update-profile', protect, async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            phone,
            address,
            shift,
            assignedFloor,
            assignedRoom,
            newPassword,
        } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // ── Basic fields ──────────────────────────────────────────────────────
        if (firstName !== undefined) user.firstName    = firstName.trim();
        if (lastName  !== undefined) user.lastName     = lastName.trim();
        if (phone     !== undefined) user.phone        = phone.trim();

        // ── Address (nested object) ───────────────────────────────────────────
        if (address && typeof address === 'object') {
            user.address = {
                street:   address.street   || user.address?.street   || '',
                city:     address.city     || user.address?.city     || '',
                province: address.province || user.address?.province || '',
                zipCode:  address.zipCode  || user.address?.zipCode  || '',
            };
        }

        // ── Work assignment ───────────────────────────────────────────────────
        if (shift         !== undefined) user.shift         = shift;
        if (assignedFloor !== undefined) user.assignedFloor = assignedFloor;
        if (assignedRoom  !== undefined) user.assignedRoom  = assignedRoom;

        // ── Password change ───────────────────────────────────────────────────
        if (newPassword) {
            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 8 characters.',
                });
            }
            if (newPassword.length > 12) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must not exceed 12 characters.',
                });
            }
            if (!/[A-Z]/.test(newPassword)) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must contain at least one uppercase letter.',
                });
            }
            if (!/[0-9]/.test(newPassword)) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must contain at least one number.',
                });
            }
            if (!/[^A-Za-z0-9]/.test(newPassword)) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must contain at least one special character.',
                });
            }

            // The User model's pre-save hook handles bcrypt hashing
            user.password = newPassword;
        }

        // ── Mark first-login setup as complete ────────────────────────────────
        user.isFirstLogin       = false;
        user.needsProfileUpdate = false;

        // Clear temporary credential fields
        user.temporaryPassword      = undefined;
        user.tempPasswordExpires    = undefined;
        user.verificationOtp        = undefined;
        user.verificationOtpExpires = undefined;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully.',
            user: {
                id:            user._id,
                staffId:       user.staffId,
                username:      user.username,
                email:         user.email,
                role:          user.role,
                firstName:     user.firstName,
                lastName:      user.lastName,
                middleName:    user.middleName,
                phone:         user.phone,
                shift:         user.shift,
                assignedFloor: user.assignedFloor,
                assignedRoom:  user.assignedRoom,
                address:       user.address,
                isFirstLogin:  user.isFirstLogin,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

/**
 * PUT /api/users/push-token
 *
 * Saves the caller's Expo push token so the server can send real
 * background push notifications (in addition to the live socket feed).
 */
router.put('/push-token', protect, async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) {
            return res.status(400).json({ success: false, message: 'pushToken is required.' });
        }

        await User.findByIdAndUpdate(req.user._id, { pushToken });
        res.json({ success: true, message: 'Push token saved.' });
    } catch (error) {
        console.error('Save push token error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

module.exports = router;