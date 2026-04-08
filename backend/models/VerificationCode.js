const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    email: { type: String, default: 'unassigned@lsae.org' },
    expiresAt: { type: Date, required: true },
    status: { 
        type: String, 
        enum: ['active', 'used', 'expired'], 
        default: 'active' // <--- This is the magic line we were missing!
    },
    usedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);