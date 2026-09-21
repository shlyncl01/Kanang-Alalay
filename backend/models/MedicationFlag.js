const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
    url: { type: String, required: true },
    publicId: { type: String },
}, { _id: false });

// A caregiver's report that a scanned barcode isn't in the Medication
// catalog yet, with a photo of the packaging as evidence/reference. Goes
// through a two-step gate before anything touches real Inventory: Head
// Caregiver approves/rejects the report itself, then only on approval does
// Admin register it as a real Medication + Inventory Product. Deliberately
// a separate model from StockRequest — StockRequest requires an existing
// productId by design (see its own comments), so it can't represent "this
// product doesn't exist yet at all."
const medicationFlagSchema = new mongoose.Schema({
    barcode: { type: String, required: true, trim: true },
    // Several shots of the same package (front, back, side, expiry print) —
    // one photo often doesn't capture everything Admin needs to register it.
    photos: { type: [photoSchema], default: [] },

    flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: {
        type: String,
        enum: ['pending', 'hc_approved', 'hc_rejected', 'registered', 'admin_rejected'],
        default: 'pending',
    },

    hcResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hcResolvedAt: { type: Date },
    hcNote: { type: String, default: '' },

    // OpenAI vision extraction from the photo, run once (on HC approval) so
    // Admin's registration form opens pre-filled instead of blank. Never
    // trusted blindly — Admin still reviews/edits every field.
    extractedData: { type: Object, default: null },
    extractionError: { type: String, default: null },

    adminResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminResolvedAt: { type: Date },
    adminNote: { type: String, default: '' },

    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medication', default: null },
}, { timestamps: true });

medicationFlagSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('MedicationFlag', medicationFlagSchema);
