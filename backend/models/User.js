const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    staffId:   { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    username:  { type: String, required: true, unique: true },
    email:     { type: String, required: true, unique: true },
    password:  { type: String, required: true },
    phone:     { type: String },

    role: {
        type:    String,
        enum:    ['admin', 'staff', 'nurse', 'caregiver'],
        default: 'staff'
    },

    // Account status
    isVerified:      { type: Boolean, default: false },
    isActive:        { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },

    // Login / Activation OTP
    otpCode:    { type: String },
    otpExpires: { type: Date },

    // Forgot-Password OTP  ← used by /forgot-password routes
    resetPasswordOtp:        { type: String },
    resetPasswordOtpExpires: { type: Date },

    // Legacy email-link verification (older flow)
    emailVerificationToken:   { type: String },
    emailVerificationExpires: { type: Date },

    // Legacy OTP fields (kept for backward compat)
    verificationOtp:        { type: String },
    verificationOtpExpires: { type: Date },
    resetOtp:               { type: String },
    resetOtpExpires:        { type: Date },

}, { timestamps: true });

// ── Hash password before saving ──────────────────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt    = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// ── Instance method: compare plain-text vs hashed password ───────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);