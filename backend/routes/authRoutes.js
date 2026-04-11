const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const RegistrationCode = require('../models/VerificationCode');
const { sendEmail, generateOtpTemplate } = require('../models/mailer');
const { protect } = require('../middleware/authMiddleware');

// ==================== PROFILE (protected) ====================================
// GET /api/auth/profile
// Returns the logged-in user's own data. Requires a valid JWT.
router.get('/profile', protect, async (req, res) => {
    try {
        // req.user is already populated by the protect middleware (password excluded)
        res.json({
            success: true,
            user: {
                id:        req.user._id,
                staffId:   req.user.staffId,
                username:  req.user.username,
                email:     req.user.email,
                firstName: req.user.firstName,
                lastName:  req.user.lastName,
                phone:     req.user.phone,
                role:      req.user.role,
                isActive:  req.user.isActive,
                createdAt: req.user.createdAt
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching profile' });
    }
});

// ==================== LOGIN ==================================================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
        }

        const user = await User.findOne({ $or: [{ email: username }, { username }] });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        if (!user.isVerified || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is not yet activated. Please verify your OTP first.',
                userId: user._id   // let the frontend redirect to OTP screen
            });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role, username: user.username, email: user.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id:        user._id,
                staffId:   user.staffId,
                username:  user.username,
                email:     user.email,
                role:      user.role,
                firstName: user.firstName,
                lastName:  user.lastName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// ==================== VALIDATE REGISTRATION CODE =============================
router.post('/validate-code', async (req, res) => {
    try {
        const { registrationCode } = req.body;
        if (!registrationCode) {
            return res.status(400).json({ success: false, message: 'Registration code is required.' });
        }

        const codeDoc = await RegistrationCode.findOne({
            code:      registrationCode.toUpperCase(),
            status:    'active',
            expiresAt: { $gt: new Date() }
        });

        if (!codeDoc) {
            return res.status(400).json({ success: false, message: 'Invalid or expired registration code.' });
        }

        const generatedId = `LSAE-${Date.now().toString().slice(-6)}`;
        res.json({ success: true, valid: true, role: codeDoc.role, generatedId });
    } catch (error) {
        console.error('Validate code error:', error);
        res.status(500).json({ success: false, message: 'Server error validating code' });
    }
});

// ==================== STAFF REGISTRATION =====================================
router.post('/register-staff', async (req, res) => {
    try {
        const {
            registrationCode, staffId, username, email, password,
            firstName, lastName, phone, role
        } = req.body;

        if (!registrationCode) {
            return res.status(400).json({ success: false, message: 'Registration code is required.' });
        }

        const codeDoc = await RegistrationCode.findOne({
            code:      registrationCode.toUpperCase(),
            status:    'active',
            expiresAt: { $gt: new Date() }
        });

        if (!codeDoc) {
            return res.status(400).json({ success: false, message: 'Invalid or expired registration code.' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email or username already exists.' });
        }

        // Mark code as used so it cannot be reused
        await RegistrationCode.findOneAndUpdate(
            { code: registrationCode.toUpperCase() },
            { status: 'used', usedAt: new Date() }
        );

        const finalStaffId = staffId || `LSAE-${Date.now().toString().slice(-6)}`;

        const user = new User({
            staffId:    finalStaffId,
            username:   username || email.split('@')[0],
            email,
            password,
            firstName,
            lastName,
            phone,
            role:       codeDoc.role || role || 'staff',
            isVerified: false,
            isActive:   false
        });

        await user.save();

        // Generate and store OTP
        const otpCode      = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode       = otpCode;
        user.otpExpires    = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        console.log('\n=======================================');
        console.log(`🔐 OTP Generated for new staff: ${email}`);
        console.log(`🔑 OTP CODE: ${otpCode}`);
        console.log('=======================================\n');

        try {
            await sendEmail(email, 'Activate your Kanang-Alalay Account', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('❌ Email send error:', mailError.message);
        }

        res.status(201).json({
            success:   true,
            message:   'Staff registered successfully. An OTP has been sent to the provided email for account activation.',
            userId:    user._id,
            email:     user.email,
            firstName: user.firstName,
            staffId:   user.staffId
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// ==================== SEND / RESEND ACTIVATION OTP ===========================
router.post('/send-otp', async (req, res) => {
    try {
        const { email, userId } = req.body;
        const user = userId ? await User.findById(userId) : await User.findOne({ email });

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const otpCode   = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode    = otpCode;
        user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        console.log('\n=======================================');
        console.log(`🔐 OTP Generated for: ${user.email}`);
        console.log(`🔑 OTP CODE: ${otpCode}`);
        console.log('=======================================\n');

        try {
            await sendEmail(user.email, 'Verify your Kanang-Alalay Account', generateOtpTemplate(otpCode));
            res.json({ success: true, message: 'OTP sent successfully.' });
        } catch (mailError) {
            console.error('❌ Email error:', mailError.message);
            res.json({ success: true, message: 'OTP generated (email delivery failed — check server logs).' });
        }
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error sending OTP' });
    }
});

router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const otpCode   = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode    = otpCode;
        user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
            await sendEmail(user.email, 'Your new Kanang-Alalay OTP', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('❌ Email error:', mailError.message);
        }

        res.json({ success: true, message: 'New OTP sent to your email.' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error resending OTP' });
    }
});

// ==================== VERIFY ACTIVATION OTP ==================================
router.post('/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (user.otpCode !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
        if (user.otpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        user.otpCode    = undefined;
        user.otpExpires = undefined;
        user.isVerified = true;
        user.isActive   = true;
        await user.save();

        res.json({ success: true, message: 'Account activated successfully. You can now log in.' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error verifying OTP' });
    }
});

// ==================== FORGOT PASSWORD ========================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const user = await User.findOne({ email });
        if (!user) {
            // Prevent email enumeration
            return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp        = otpCode;
        user.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        console.log('\n=======================================');
        console.log(`🔐 Password Reset OTP for: ${email}`);
        console.log(`🔑 OTP CODE: ${otpCode}`);
        console.log('=======================================\n');

        try {
            await sendEmail(email, 'Reset your Kanang-Alalay Password', generateOtpTemplate(otpCode));
            console.log('✅ Reset OTP email sent to:', email);
        } catch (mailError) {
            console.error('❌ Email send FAILED:', mailError.message);
            // OTP is saved in DB — user can still get it from server logs during dev
            // Return a specific error so the frontend knows email failed
            return res.status(500).json({
                success: false,
                message: 'OTP generated but email could not be sent. Check server EMAIL_USER / EMAIL_PASS environment variables.'
            });
        }

        res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ==================== VERIFY RESET OTP =======================================
router.post('/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (user.resetPasswordOtp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
        if (user.resetPasswordOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        res.json({ success: true, message: 'OTP verified. You may now reset your password.' });
    } catch (error) {
        console.error('Verify reset OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== RESET PASSWORD WITH OTP ================================
router.post('/reset-password-with-otp', async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        if (!email || !otp || !password) {
            return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (user.resetPasswordOtp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
        if (user.resetPasswordOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        user.password                = password; // pre-save hook will hash it
        user.resetPasswordOtp        = undefined;
        user.resetPasswordOtpExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== RESEND RESET OTP =======================================
router.post('/resend-reset-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: true, message: 'If that email exists, a new OTP has been sent.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp        = otpCode;
        user.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
            await sendEmail(email, 'Your new Password Reset OTP', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('❌ Email error:', mailError.message);
        }

        res.json({ success: true, message: 'New OTP sent to your email.' });
    } catch (error) {
        console.error('Resend reset OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add these to the END of your authRoutes.js (before module.exports)

// ==================== EMAIL VERIFICATION LINK (legacy) =======================
// GET /api/auth/verify-email/:token
// For users who received an email with a verification link (older flow)
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({
            emailVerificationToken:   token,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification link'
            });
        }

        user.isEmailVerified          = true;
        user.emailVerificationToken   = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Email verified successfully! You can now login.' });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== RESEND VERIFICATION EMAIL ==============================
// POST /api/auth/resend-verification
// body: { email: "user@example.com" }
router.post('/resend-verification', async (req, res) => {
    try {
        const crypto = require('crypto');
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email already verified' });

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken   = verificationToken;
        user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        console.log(`Verification link: ${verificationLink}`);

        try {
            // If you want to send this via email:
            await sendEmail(email, 'Verify your Email', `Click here: ${verificationLink}`);
        } catch (mailError) {
            console.error('❌ Email error:', mailError.message);
        }

        res.json({ success: true, message: 'Verification email sent' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;