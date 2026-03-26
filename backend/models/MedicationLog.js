const mongoose = require('mongoose');

const medicationLogSchema = new mongoose.Schema({
    logId: {
        type: String,
        required: true,
        unique: true
    },
    residentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resident',
        required: true
    },
    medicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medication',
        required: true
    },
    caregiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scheduledTime: Date,
    administeredTime: Date,
    status: {
        type: String,
        enum: ['scheduled', 'administered', 'overdue', 'missed', 'skipped'],
        default: 'scheduled'
    },
    dosage: String,
    notes: String,
    verificationMethod: {
        type: String,
        enum: ['manual', 'scan', 'voice'],
        default: 'manual'
    },
    scanData: {
        medicationCode: String,
        scanTime: Date,
        match: Boolean
    },
    voicePrompt: {
        played: Boolean,
        playedAt: Date,
        language: String
    }
}, { timestamps: true });

// Indexes for performance
medicationLogSchema.index({ residentId: 1, scheduledTime: 1 });
medicationLogSchema.index({ caregiverId: 1, status: 1 });

module.exports = mongoose.model('MedicationLog', medicationLogSchema);