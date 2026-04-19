const mongoose = require('mongoose');

const stockRequestSchema = new mongoose.Schema({
    itemId:       { type: String, default: '' },
    itemName:     { type: String, required: true },
    quantity:     { type: Number, required: true, min: 1 },
    reason:       { type: String, default: '' },
    requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:       { type: String, enum: ['pending','approved','rejected','fulfilled'], default: 'pending' },
    resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt:   { type: Date },
    adminNote:    { type: String, default: '' },
}, { timestamps: true });

stockRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('StockRequest', stockRequestSchema);