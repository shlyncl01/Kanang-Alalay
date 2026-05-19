const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RegistrationCode = require('../models/VerificationCode');
const { sendEmail, generateOtpTemplate } = require('../models/mailer');
const { protect } = require('../middleware/authMiddleware');

// ── Cookie helper ─────────────────────────────────────────────────────────────
const COOKIE_NAME = 'ka_token';

const cookieOptions = {
    httpOnly: true,                                   // JS cannot read this
    secure: process.env.NODE_ENV === 'production',    // HTTPS only on Render
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // cross-origin on Render
    maxAge: 24 * 60 * 60 * 1000,                     // 24 hours
    path: '/',
};

const setTokenCookie = (res, token) => res.cookie(COOKIE_NAME, token, cookieOptions);
const clearTokenCookie = (res) => res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile', protect, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                staffId: req.user.staffId,
                username: req.user.username,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                middleName: req.user.middleName,
                phone: req.user.phone,
                role: req.user.role,
                department: req.user.department,
                shift: req.user.shift,
                isActive: req.user.isActive,
                isVerified: req.user.isVerified,
                createdAt: req.user.createdAt,
                hireDate: req.user.hireDate,
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching profile' });
    }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password, platform } = req.body;
        const isMobile = platform === 'mobile';

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
        }

        const user = await User.findOne({ $or: [{ email: username }, { username }] });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        if (!isMobile) {
            const WEB_ALLOWED_ROLES = ['admin', 'head_caregiver'];
            if (!WEB_ALLOWED_ROLES.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Web access is not available for your role. Please use the mobile app.',
                    accountStatus: 'role_blocked'
                });
            }
        }

        if (user.isFirstLogin && user.role !== 'admin') {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.verificationOtp = otp;
            user.verificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
            user.lastOtpSentAt = new Date();
            await user.save();

            const otpHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5">
  <div style="max-width:440px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#b85c2d,#d94e1b);padding:22px 28px">
      <h2 style="margin:0;color:#fff;font-size:1.2rem">Verify Your Identity</h2>
    </div>
    <div style="padding:28px;text-align:center">
      <p style="color:#444;margin:0 0 20px">Enter this code to complete your first login to Kanang-Alalay.</p>
      <div style="font-size:2.6rem;font-weight:900;font-family:monospace;letter-spacing:12px;color:#d94e1b;margin:20px 0;padding:16px;background:#fff8e1;border-radius:10px;border:2px solid #f96b38">${otp}</div>
      <p style="color:#888;font-size:.82rem;margin:0">Expires in 10 minutes &nbsp; Do not share this code</p>
    </div>
  </div>
</body>
</html>`;

            try {
                await sendEmail(user.email, 'Your Kanang-Alalay Verification Code', otpHtml);
            } catch (mailErr) {
                console.error('OTP email error:', mailErr.message);
            }

            return res.json({ success: true, requiresOTP: true, userId: user._id });
        }

        if (user.isFirstLogin && user.role === 'admin') {
            user.isFirstLogin       = false;
            user.needsProfileUpdate = false;
            user.isVerified         = true;
            user.isActive           = true;
            if (user.status === 'pending') user.status = 'active';
            await user.save();
        }

        if (!user.isVerified || !user.isActive || user.status === 'pending') {
            return res.status(401).json({
                success: false,
                message: 'Account is not yet activated. Please verify your OTP first.',
                userId: user._id
            });
        }

        const BLOCKED_STATUSES = ['restricted', 'suspended', 'deactivated', 'on_leave', 'terminated'];
        if (BLOCKED_STATUSES.includes(user.status)) {
            return res.status(403).json({
                success: false,
                message: `Your account is ${user.status.replace('_', ' ')}. Please contact your administrator.`,
                accountStatus: user.status,
                reason: user.statusReason || ''
            });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role, username: user.username, email: user.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        setTokenCookie(res, token);

        res.json({
            success: true,
            token,
            message: 'Login successful',
            user: {
                id: user._id,
                staffId: user.staffId,
                username: user.username,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                middleName: user.middleName,
                phone: user.phone,
                department: user.department,
                shift: user.shift,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    clearTokenCookie(res);
    res.json({ success: true, message: 'Logged out successfully.' });
});

// ── Verify first login (OTP) ──────────────────────────────────────────────────
router.post('/verify-first-login', async (req, res) => {
    try {
        const { userId, otp, platform } = req.body;
        const isMobile = platform === 'mobile';

        if (!userId || !otp) {
            return res.status(400).json({ success: false, message: 'userId and otp are required.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (user.verificationOtp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
        if (!user.verificationOtpExpires || user.verificationOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        if (!isMobile) {
            const WEB_ALLOWED_ROLES = ['admin', 'head_caregiver'];
            if (!WEB_ALLOWED_ROLES.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Web access is not available for your role. Please use the mobile app.',
                    accountStatus: 'role_blocked'
                });
            }
        }

        user.isFirstLogin = false;
        user.isVerified = true;
        user.isActive = true;
        user.status = 'active';
        user.verificationOtp = undefined;
        user.verificationOtpExpires = undefined;
        await user.save();

        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                username: user.username,
                email: user.email,
                needsProfileUpdate: user.needsProfileUpdate
            },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        setTokenCookie(res, token);

        res.json({
            success: true,
            token,
            needsProfileUpdate: user.needsProfileUpdate,
            user: {
                id: user._id,
                staffId: user.staffId,
                username: user.username,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                middleName: user.middleName,
                phone: user.phone,
                shift: user.shift,
                assignedFloor: user.assignedFloor,
                assignedRoom: user.assignedRoom,
            }
        });
    } catch (error) {
        console.error('Verify first login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Validate token (session restore) ─────────────────────────────────────────
router.get('/validate-token', protect, async (req, res) => {
    const WEB_ALLOWED_ROLES = ['admin', 'head_caregiver'];
    if (!WEB_ALLOWED_ROLES.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Role no longer valid for web login.' });
    }
    res.json({
        success: true,
        user: {
            id: req.user._id,
            staffId: req.user.staffId,
            username: req.user.username,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            middleName: req.user.middleName,
            phone: req.user.phone,
            role: req.user.role,
            department: req.user.department,
            shift: req.user.shift,
            isActive: req.user.isActive,
            createdAt: req.user.createdAt,
        }
    });
});

// ── Validate code ─────────────────────────────────────────────────────────────
router.post('/validate-code', async (req, res) => {
    try {
        const { registrationCode } = req.body;
        if (!registrationCode) {
            return res.status(400).json({ success: false, message: 'Registration code is required.' });
        }

        const codeDoc = await RegistrationCode.findOne({
            code: registrationCode.toUpperCase(),
            status: 'active',
            expiresAt: { $gt: new Date() }
        });

        if (!codeDoc) {
            return res.status(400).json({ success: false, message: 'Invalid or expired registration code.' });
        }

        const allowedRoles = ['admin', 'head_caregiver', 'caregiver'];
        if (!allowedRoles.includes(codeDoc.role)) {
            return res.status(400).json({ success: false, message: 'Invalid registration code for this role.' });
        }

        const generatedId = `LSAE-${Date.now().toString().slice(-6)}`;
        res.json({ success: true, valid: true, role: codeDoc.role, generatedId });
    } catch (error) {
        console.error('Validate code error:', error);
        res.status(500).json({ success: false, message: 'Server error validating code' });
    }
});

// ── Register staff ────────────────────────────────────────────────────────────
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
            code: registrationCode.toUpperCase(),
            status: 'active',
            expiresAt: { $gt: new Date() }
        });

        if (!codeDoc) {
            return res.status(400).json({ success: false, message: 'Invalid or expired registration code.' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email or username already exists.' });
        }

        await RegistrationCode.findOneAndUpdate(
            { code: registrationCode.toUpperCase() },
            { status: 'used', usedAt: new Date() }
        );

        const finalStaffId = staffId || `LSAE-${Date.now().toString().slice(-6)}`;

        const user = new User({
            staffId: finalStaffId,
            username: username || email.split('@')[0],
            email,
            password,
            firstName,
            lastName,
            phone,
            role: codeDoc.role,
            isVerified: false,
            isActive: false
        });

        await user.save();

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode = otpCode;
        user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
            await sendEmail(email, 'Activate your Kanang-Alalay Account', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('Email send error:', mailError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Staff registered successfully. An OTP has been sent to the provided email for account activation.',
            userId: user._id,
            email: user.email,
            firstName: user.firstName,
            staffId: user.staffId
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// ── Send OTP ──────────────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
    try {
        const { email, userId } = req.body;
        const user = userId ? await User.findById(userId) : await User.findOne({ email });

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode = otpCode;
        user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
            await sendEmail(user.email, 'Verify your Kanang-Alalay Account', generateOtpTemplate(otpCode));
            res.json({ success: true, message: 'OTP sent successfully.' });
        } catch (mailError) {
            console.error('Email error:', mailError.message);
            res.json({ success: true, message: 'OTP generated (email delivery failed).' });
        }
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error sending OTP' });
    }
});

// ── Resend OTP ────────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (user.isFirstLogin && user.lastOtpSentAt) {
            const secondsSince = (Date.now() - new Date(user.lastOtpSentAt)) / 1000;
            if (secondsSince < 60) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting another OTP.`
                });
            }
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        user.verificationOtp = otpCode;
        user.verificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.otpCode = otpCode;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.lastOtpSentAt = new Date();
        await user.save();

        const otpHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5">
  <div style="max-width:440px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#b85c2d,#d94e1b);padding:22px 28px">
      <h2 style="margin:0;color:#fff;font-size:1.2rem">New Verification Code</h2>
    </div>
    <div style="padding:28px;text-align:center">
      <p style="color:#444;margin:0 0 20px">Your new Kanang-Alalay OTP:</p>
      <div style="font-size:2.6rem;font-weight:900;font-family:monospace;letter-spacing:12px;color:#d94e1b;margin:20px 0;padding:16px;background:#fff8e1;border-radius:10px;border:2px solid #f96b38">${otpCode}</div>
      <p style="color:#888;font-size:.82rem;margin:0">Expires in 10 minutes &nbsp; Do not share this code</p>
    </div>
  </div>
</body>
</html>`;

        try {
            await sendEmail(user.email, 'Your new Kanang-Alalay OTP', otpHtml);
        } catch (mailError) {
            console.error('Email error:', mailError.message);
        }

        res.json({ success: true, message: 'New OTP sent to your email.' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error resending OTP' });
    }
});

// ── Verify OTP (account activation) ──────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const validOtp = user.otpCode === otp || user.verificationOtp === otp;
        if (!validOtp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }

        const isExpired = (user.otpExpires && user.otpExpires < new Date()) &&
                          (user.verificationOtpExpires && user.verificationOtpExpires < new Date());
        if (isExpired) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        user.otpCode = undefined;
        user.otpExpires = undefined;
        user.isVerified = true;
        user.isActive = true;
        await user.save();

        res.json({ success: true, message: 'Account activated successfully. You can now log in.' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error verifying OTP' });
    }
});

// ── Forgot password ───────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp = otpCode;
        user.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
            await sendEmail(email, 'Reset your Kanang-Alalay Password', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('Email send FAILED (OTP still saved in DB):', mailError.message);
        }

        res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ── Verify reset OTP ──────────────────────────────────────────────────────────
router.post('/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (!user.resetPasswordOtp) {
            return res.status(400).json({ success: false, message: 'No active OTP found. Please request a new one.' });
        }
        if (user.resetPasswordOtp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
        if (user.resetPasswordOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        user.resetPasswordOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        res.json({ success: true, message: 'OTP verified. You may now reset your password.' });
    } catch (error) {
        console.error('Verify reset OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Reset password with OTP ───────────────────────────────────────────────────
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

        if (!user.resetPasswordOtp) {
            return res.status(400).json({ success: false, message: 'No active OTP found. Please restart the process.' });
        }
        if (user.resetPasswordOtp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
        if (user.resetPasswordOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        user.password = password;
        user.resetPasswordOtp = undefined;
        user.resetPasswordOtpExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Resend reset OTP ──────────────────────────────────────────────────────────
router.post('/resend-reset-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: true, message: 'If that email exists, a new OTP has been sent.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp = otpCode;
        user.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
            await sendEmail(email, 'Your new Password Reset OTP', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('Email error:', mailError.message);
        }

        res.json({ success: true, message: 'New OTP sent to your email.' });
    } catch (error) {
        console.error('Resend reset OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Verify email via link ─────────────────────────────────────────────────────
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Email verified successfully! You can now login.' });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── Resend verification ───────────────────────────────────────────────────────
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
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        try {
            await sendEmail(email, 'Verify your Email', `Click here: ${verificationLink}`);
        } catch (mailError) {
            console.error('Email error:', mailError.message);
        }

        res.json({ success: true, message: 'Verification email sent' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── Change password ───────────────────────────────────────────────────────────
router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ success: false, message: 'Both current and new password are required.' });
        if (newPassword.length < 8)
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

        const user = await User.findById(req.user._id);
        const match = await user.comparePassword(currentPassword);
        if (!match)
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        if (currentPassword === newPassword)
            return res.status(400).json({ success: false, message: 'New password must be different from the current one.' });

        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ── Update phone ──────────────────────────────────────────────────────────────
router.put('/update-phone', protect, async (req, res) => {
    try {
        const { phone } = req.body;
        await User.findByIdAndUpdate(req.user._id, { phone: phone || '' });
        res.json({ success: true, message: 'Contact number updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

module.exports = router;