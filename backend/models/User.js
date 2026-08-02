const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    staffId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    middleName: { type: String, default: '' },
    suffix: { type: String, default: '' },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, default: '' }, // REMOVED unique: true
    department: {
        type: String,
        trim: true,
        default: '',
    },
    shift: {
        type: String,
        enum: ['morning', 'afternoon', 'night', 'flexible', 'rotating'],
        default: 'morning'
    },
    employeeId: { type: String, sparse: true },
    hireDate: { type: Date, default: Date.now },
    address: {
        street: String,
        city: String,
        province: String,
        zipCode: String
    },
    emergencyContact: {
        name: String,
        phone: String,
        relation: String
    },
    role: {
        type: String,
        enum: ['admin', 'head_caregiver', 'caregiver'], 
        default: 'caregiver'
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'restricted', 'suspended', 'deactivated', 'on_leave', 'terminated'],
        default: 'pending'  // CHANGED from 'active' to 'pending'
    },
    statusReason: { type: String, default: '' },
    statusUpdatedAt: { type: Date },
    statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },  // CHANGED from true to false
    isEmailVerified: { type: Boolean, default: false },
    otpCode: { type: String },
    otpExpires: { type: Date },
    resetPasswordOtp: { type: String },
    resetPasswordOtpExpires: { type: Date },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    verificationOtp: { type: String },
    verificationOtpExpires: { type: Date },
    resetOtp: { type: String },
    resetOtpExpires: { type: Date },

    // Forgot-password OTP security tracking
    resetOtpAttempts: { type: Number, default: 0 },          // failed verify attempts (max 5)
    resetOtpResendCount: { type: Number, default: 0 },        // resends used in current window (max 3)
    resetOtpResendWindowStart: { type: Date },                // start of the 15-min resend window

    assignedFloor:       { type: String, default: '' },
    assignedRoom:        { type: String, default: '' },
    temporaryPassword:   { type: String },
    tempPasswordExpires: { type: Date },
    isFirstLogin:        { type: Boolean, default: true },
    needsProfileUpdate:  { type: Boolean, default: true },
    lastOtpSentAt:       { type: Date },

}, { timestamps: true });

// Auto-generate staffId before saving
userSchema.pre('save', async function() {
    if (!this.staffId) {
        const year = new Date().getFullYear();
        const prefixMap = {
            admin: 'ADMIN',
            head_caregiver: 'HCG',
            caregiver: 'CG',
        };
        const prefix = prefixMap[this.role] || 'CG';
        const count = await mongoose.model('User').countDocuments({ role: this.role });
        this.staffId = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
    }
});

userSchema.pre('save', async function() {
    if (!this.isModified('password') || this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);