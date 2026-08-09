const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
    medicationId: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true }, // Added field
    batchNumber: { type: String, required: true, trim: true }, // Added field
    genericName: String,
    dosage: { value: Number, unit: String },
    strength: String,
    form: String,
    route: String,
    manufacturer: String,
    barcode: String,
    uniqueCode: String,
    ndc: String,
    purpose: String,
    instructions: String,
    warnings: String,
    sideEffects: String,
    contraindications: String,
    drugInteractions: String,
    pregnancy: String,
    storage: String,
    ingredients: { type: String, default: '' },
    // Whether this medicine is legally available in the Philippines. Enforced
    // at creation time in medicationRoutes.js (new medicines must be 'available').
    phAvailability: {
        type: String,
        enum: ['available', 'banned', 'discontinued', 'unavailable'],
        default: 'available',
    },
    dateOfManufacture: Date, // Added field
    dateOfPurchase: Date,    // Added field
    expiryDate: { type: Date, required: true }, // Structured expiration
    stock: {
        current: { type: Number, default: 0 },
        minimum: { type: Number, default: 10 },
        maximum: { type: Number, default: 100 },
        unit: String
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Medication', medicationSchema);