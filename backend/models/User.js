const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, enum: ['admin', 'nurse', 'caregiver', 'staff', 'doctor', 'therapist'], default: 'staff' },
    phone: { type: String },
    
    // Status flags
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    
    // Login/Activation OTP
    otp: { type: String },
    otpExpires: { type: Date },
    
    // Forgot Password OTP
    resetPasswordOtp: { type: String },
    resetPasswordOtpExpires: { type: Date },
    
    lastLogin: { type: Date }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);