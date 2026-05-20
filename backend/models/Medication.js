const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
    medicationId: { type: String, required: true, unique: true, uppercase: true },
    uniqueCode: { type: String, sparse: true, trim: true },
    barcode: { type: String, sparse: true, trim: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    batchNumber: { type: String, required: true, trim: true },
    genericName: String,
    dosage: { value: Number, unit: String },
    strength: String,
    form: String,
    route: String,
    manufacturer: String,
    ndc: String,
    purpose: String,
    instructions: String,
    warnings: String,
    sideEffects: [String],
    contraindications: [String],
    drugInteractions: [String],
    pregnancy: String,
    storage: String,
    dateOfManufacture: Date,
    dateOfPurchase: Date,
    expiryDate: { type: Date, required: true },
    stock: {
        current: { type: Number, default: 0 },
        minimum: { type: Number, default: 10 },
        maximum: { type: Number, default: 100 },
        unit: String
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Medication', medicationSchema);