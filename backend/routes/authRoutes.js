const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RegistrationCode = require('../models/VerificationCode');
const { sendEmail, generateOtpTemplate } = require('../models/mailer');
const { protect } = require('../middleware/authMiddleware');

// ActivityLog is optional — wrapped in try/catch everywhere it's used so a
// missing/mismatched field in your existing schema never breaks the reset flow.
let ActivityLog = null;
try {
    ActivityLog = require('../models/ActivityLog');
} catch (e) {
    console.warn('ActivityLog model not found — password reset attempts will not be audit-logged.');
}
const logActivity = async (fields) => {
    if (!ActivityLog) return;
    try {
        await ActivityLog.create(fields);
    } catch (err) {
        console.error('ActivityLog write failed (non-fatal):', err.message);
    }
};

// ── OTP hashing ───────────────────────────────────────────────────────────────
// OTPs are never stored in plain text — only their SHA-256 hash is persisted.
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// ── Lightweight in-memory rate limiter ────────────────────────────────────────
// Per-IP brute-force guard for the forgot-password endpoints. For multi-instance
// deployments, swap this Map for a shared store (e.g. Redis) or the
// `express-rate-limit` package — this in-memory version is fine for a single
// Node process like a typical Render/Railway deployment.
const rateLimitStore = new Map();
const rateLimit = ({ windowMs, max, keyPrefix }) => (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key) || { count: 0, start: now };

    if (now - entry.start > windowMs) {
        entry.count = 0;
        entry.start = now;
    }
    entry.count += 1;
    rateLimitStore.set(key, entry);

    if (entry.count > max) {
        return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }
    next();
};

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

router.get('/me', protect, async (req, res) => {
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
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
        }
        if (password.length > 12) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const user = await User.findOne({ $or: [{ email: username }, { username }] });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
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

        const BLOCKED_STATUSES = ['restricted', 'suspended', 'deactivated', 'on_leave', 'terminated'];
        if (BLOCKED_STATUSES.includes(user.status)) {
            const statusMessages = {
                deactivated: 'This account has been deactivated.',
                restricted: 'This account has been blocked.',
                suspended: 'This account has been blocked.',
            };
            return res.status(403).json({
                success: false,
                message: (statusMessages[user.status] || `Your account is ${user.status.replace('_', ' ')}.`) + ' Please contact your administrator.',
                accountStatus: user.status,
                reason: user.statusReason || ''
            });
        }

        if (!user.isVerified || !user.isActive || user.status === 'pending') {
            return res.status(401).json({
                success: false,
                message: 'Account is not yet activated. Please verify your OTP first.',
                userId: user._id
            });
        }

        const isMobileLogin = req.body.platform === 'mobile';
        const WEB_ALLOWED_ROLES = ['admin', 'head_caregiver'];
        if (!isMobileLogin && !WEB_ALLOWED_ROLES.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Web access is not available for your role. Please use the mobile app.',
                accountStatus: 'role_blocked'
            });
        }

        // Mobile stays logged in until the user explicitly logs out; web keeps a
        // shorter session since it's used on shared/admin machines.
        const token = jwt.sign(
            { userId: user._id, role: user.role, username: user.username, email: user.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: isMobileLogin ? '365d' : '24h' }
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
        const { userId, otp } = req.body;
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

        const isMobileLogin = req.body.platform === 'mobile';
        const WEB_ALLOWED_ROLES = ['admin', 'head_caregiver'];
        if (!isMobileLogin && !WEB_ALLOWED_ROLES.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Web access is not available for your role. Please use the mobile app.',
                accountStatus: 'role_blocked'
            });
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
            { expiresIn: isMobileLogin ? '365d' : '24h' }
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

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        const user = new User({
            staffId: finalStaffId,
            username: username || email.split('@')[0],
            email,
            password,
            firstName,
            lastName,
            phone,
            role: codeDoc.role,
            status: 'pending',
            isVerified: false,
            isActive: false,
            otpCode,
            otpExpires: new Date(Date.now() + 15 * 60 * 1000),
        });

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
        user.isFirstLogin = false;
        if (user.status === 'pending') user.status = 'active';
        await user.save();

        res.json({ success: true, message: 'Account activated successfully. You can now log in.' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error verifying OTP' });
    }
});

// ── Forgot password ───────────────────────────────────────────────────────────
// NOTE on security trade-off: this endpoint explicitly reveals whether an email
// is registered (per product decision). This is convenient for users but is a
// known account-enumeration risk — an attacker can use it to test which emails
// exist in your system. The rate limiter below mitigates automated scanning,
// but if you ever want to close this gap, switch the 404 branch back to a
// generic "If that email exists, an OTP has been sent." response.
router.post('/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'forgot-password' }), async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        const user = await User.findOne({ email: email.trim() });
        if (!user) {
            await logActivity({ action: 'password_reset_requested', details: `Forgot-password request for unregistered email: ${email.trim()}` });
            return res.status(404).json({ success: false, message: 'No account is registered with this email address.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp = hashOtp(otpCode);
        user.resetPasswordOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        user.resetOtpAttempts = 0;
        user.resetOtpResendCount = 0;
        user.resetOtpResendWindowStart = new Date();
        await user.save();

        try {
            await sendEmail(email, 'Reset your Kanang-Alalay Password', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('Email send FAILED (OTP still saved in DB):', mailError.message);
        }

        await logActivity({ user: user._id, action: 'password_reset_requested', details: `OTP sent to ${user.email} for password reset` });

        res.json({ success: true, message: 'A verification code has been sent to your email.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ── Verify reset OTP ──────────────────────────────────────────────────────────
const MAX_OTP_ATTEMPTS = 5;

router.post('/verify-reset-otp', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'verify-reset-otp' }), async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
        }

        const user = await User.findOne({ email: email.trim() });
        if (!user) return res.status(404).json({ success: false, message: 'No account is registered with this email address.' });

        if (!user.resetPasswordOtp) {
            return res.status(400).json({ success: false, message: 'No active verification code found. Please restart the process.' });
        }

        if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
            user.resetPasswordOtp = undefined;
            user.resetPasswordOtpExpires = undefined;
            await user.save();
            await logActivity({ user: user._id, action: 'password_reset_otp_locked', details: `Reset OTP locked after ${MAX_OTP_ATTEMPTS} failed attempts for ${user.email}` });
            return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please request a new verification code.' });
        }

        // Check expiry before comparing so an expired code always gets the
        // "expired" message rather than "invalid", per the required UX.
        if (user.resetPasswordOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Verification code has expired.' });
        }

        if (hashOtp(otp) !== user.resetPasswordOtp) {
            user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
            await user.save();
            await logActivity({ user: user._id, action: 'password_reset_otp_failed', details: `Incorrect reset OTP entered for ${user.email} (attempt ${user.resetOtpAttempts})` });
            return res.status(400).json({ success: false, message: 'Invalid verification code.' });
        }

        // Correct code — reset the attempt counter and extend the window
        // slightly so the person has time to fill in the password step.
        user.resetOtpAttempts = 0;
        user.resetPasswordOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        const resetToken = jwt.sign(
            { userId: user._id, purpose: 'password-reset' },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '10m' }
        );

        await logActivity({ user: user._id, action: 'password_reset_otp_verified', details: `Reset OTP verified successfully for ${user.email}` });

        res.json({
            success: true,
            message: 'Verification code confirmed. You may now reset your password.',
            resetToken,
            userId: user._id
        });
    } catch (error) {
        console.error('Verify reset OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Reset password using temporary token (mobile reset flow) ──────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }
        if (newPassword.length > 12) {
            return res.status(400).json({ success: false, message: 'Password must not exceed 12 characters.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'fallback_secret');
            if (decoded.purpose !== 'password-reset') {
                return res.status(400).json({ success: false, message: 'Invalid reset token.' });
            }
        } catch (err) {
            return res.status(400).json({ success: false, message: 'Reset token has expired or is invalid.' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (await user.comparePassword(newPassword)) {
            return res.status(400).json({ success: false, message: 'New password must be different from your current password.' });
        }

        user.password = newPassword;
        user.resetPasswordOtp = undefined;
        user.resetPasswordOtpExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
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
        if (password.length > 12) {
            return res.status(400).json({ success: false, message: 'Password must not exceed 12 characters.' });
        }

        const user = await User.findOne({ email: email.trim() });
        if (!user) return res.status(404).json({ success: false, message: 'No account is registered with this email address.' });

        if (!user.resetPasswordOtp) {
            return res.status(400).json({ success: false, message: 'No active verification code found. Please restart the process.' });
        }
        if (hashOtp(otp) !== user.resetPasswordOtp) {
            return res.status(400).json({ success: false, message: 'Invalid verification code.' });
        }
        if (user.resetPasswordOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Verification code has expired.' });
        }
        if (await user.comparePassword(password)) {
            return res.status(400).json({ success: false, message: 'New password must be different from your current password.' });
        }

        user.password = password; // hashed automatically by the User pre-save hook (bcrypt)
        user.resetPasswordOtp = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetOtpAttempts = 0;
        user.resetOtpResendCount = 0;
        user.resetOtpResendWindowStart = undefined;
        await user.save();

        await logActivity({ user: user._id, action: 'password_reset_completed', details: `Password successfully reset for ${user.email}` });

        res.json({ success: true, message: 'Your password has been successfully updated. Please log in with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Resend reset OTP ──────────────────────────────────────────────────────────
const MAX_RESENDS = 3;
const RESEND_WINDOW_MS = 15 * 60 * 1000;

router.post('/resend-reset-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const user = await User.findOne({ email: email.trim() });
        if (!user) {
            return res.status(404).json({ success: false, message: 'No account is registered with this email address.' });
        }

        const now = new Date();
        if (!user.resetOtpResendWindowStart || (now - user.resetOtpResendWindowStart) > RESEND_WINDOW_MS) {
            user.resetOtpResendWindowStart = now;
            user.resetOtpResendCount = 0;
        }

        if (user.resetOtpResendCount >= MAX_RESENDS) {
            return res.status(429).json({ success: false, message: 'Maximum resend attempts reached. Please try again in a few minutes.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp = hashOtp(otpCode); // invalidates the previous code
        user.resetPasswordOtpExpires = new Date(now.getTime() + 5 * 60 * 1000);
        user.resetOtpAttempts = 0;
        user.resetOtpResendCount += 1;
        await user.save();

        try {
            await sendEmail(email, 'Your new Password Reset OTP', generateOtpTemplate(otpCode));
        } catch (mailError) {
            console.error('Email error:', mailError.message);
        }

        await logActivity({ user: user._id, action: 'password_reset_otp_resent', details: `Reset OTP resent to ${user.email} (resend ${user.resetOtpResendCount}/${MAX_RESENDS})` });

        res.json({ success: true, message: 'New verification code sent to your email.' });
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
        if (newPassword.length > 12)
            return res.status(400).json({ success: false, message: 'New password must not exceed 12 characters.' });

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