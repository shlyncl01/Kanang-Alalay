const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { sendEmail } = require('../utils/mailer');
const { sendEmail, generateOtpTemplate } = require('../utils/mailer');


//  STAFF REGISTRATION & ACTIVATION FLOW
// Register Staff (Called by AdminDashboard/StaffRegistration)
router.post('/register-staff', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, role, phone } = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email or username already exists' });
        }

        const user = new User({
            username, email, password, firstName, lastName, role, phone,
            isVerified: false, // Needs OTP verification
            isActive: false
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'Staff registered successfully. Awaiting OTP activation.',
            userId: user._id,
            email: user.email,
            firstName: user.firstName
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// Send Activation OTP (Called by AdminDashboard right after registration)
router.post('/send-otp', async (req, res) => {
    try {
        const { email, userId } = req.body;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        const html = generateOtpTemplate(otp, 'Activation');
        await sendEmail(email, 'Account Activation OTP - Kanang Alalay', html);

        res.json({ success: true, message: 'OTP sent successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error sending OTP' });
    }
});

//  LOGIN & GENERAL OTP VERIFICATION

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ $or: [{ email: username }, { username: username }] });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (!user.isVerified) {
            return res.status(401).json({ success: false, message: 'Account not verified. Please contact admin.' });
        }
        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Account is deactivated' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user._id, role: user.role, username: user.username, email: user.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: user._id, username: user.username, role: user.role, firstName: user.firstName }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Verify OTP (Used for Admin Activation)
router.post('/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.otp !== otp || user.otpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Clear OTP and activate
        user.otp = undefined;
        user.otpExpires = undefined;
        user.isVerified = true;
        user.isActive = true;
        await user.save();

        res.json({ success: true, message: 'Account activated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

//FORGOT PASSWORD FLOW
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp = otp;
        user.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        const html = generateOtpTemplate(otp, 'Activation');
await sendEmail(email, 'Account Activation OTP - Kanang Alalay', html);
        res.json({ success: true, message: 'OTP sent to your email' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({
            email, resetPasswordOtp: otp, resetPasswordOtpExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/resend-reset-otp', async (req, res) => {
    // Re-uses the forgot-password logic
    req.url = '/forgot-password';
    router.handle(req, res);
});

router.post('/reset-password-with-otp', async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        const user = await User.findOne({
            email, resetPasswordOtp: otp, resetPasswordOtpExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

        user.password = password; // The pre-save hook in User.js will hash this
        user.resetPasswordOtp = undefined;
        user.resetPasswordOtpExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;