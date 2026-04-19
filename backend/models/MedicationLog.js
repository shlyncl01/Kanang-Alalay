const mongoose = require('mongoose');

const medicationLogSchema = new mongoose.Schema({
    logId: { type: String, required: true, unique: true },

    // ── References ─────────────────────────────────────────────────────────────
    residentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', required: true },
    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medication', required: true },
    caregiverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Denormalized display fields (so queries don't always need populate) ───
    // These are written at creation time from the populated refs
    residentName: { type: String, default: '' },   // 'Maria Santos'
    medicationName:{ type: String, default: '' },  // 'Metformin 500mg'
    room:         { type: String, default: '' },   // '201'
    floor:        { type: String, default: '' },   // '2nd Floor'
    bed:          { type: String, default: '' },   // 'Bed 1'
    condition:    { type: String, default: '' },   // medication purpose/condition
    dosage:       { type: String, default: '' },   // '1 tablet'
    frequency:    { type: String, default: '' },   // 'Daily', 'Twice daily'
    nextDose:     { type: String, default: '' },   // '8:00 PM'

    // ── Timing ────────────────────────────────────────────────────────────────
    scheduledTime:    { type: Date },
    administeredTime: { type: Date },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['scheduled', 'administered', 'overdue', 'missed', 'skipped', 'completed', 'pending'],
        default: 'scheduled'
    },

    // ── Notes & verification ──────────────────────────────────────────────────
    notes: { type: String, default: '' },
    verificationMethod: {
        type: String,
        enum: ['manual', 'scan', 'voice'],
        default: 'manual'
    },
    scanData: {
        medicationCode: String,
        scanTime:       Date,
        match:          Boolean
    },
    voicePrompt: {
        played:   Boolean,
        playedAt: Date,
        language: String
    }

}, { timestamps: true });

// ── Indexes for performance ───────────────────────────────────────────────────
medicationLogSchema.index({ residentId: 1, scheduledTime: 1 });
medicationLogSchema.index({ caregiverId: 1, status: 1 });
medicationLogSchema.index({ caregiverId: 1, scheduledTime: 1 });
medicationLogSchema.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model('MedicationLog', medicationLogSchema);