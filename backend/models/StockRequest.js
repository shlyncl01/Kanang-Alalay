const mongoose = require('mongoose');

const stockRequestSchema = new mongoose.Schema({
    // Part 5: the request must point at a real catalog Product (Parts
    // 1–3, models/Product.js) — the same Admin Central Inventory catalog
    // the "Select Item" dropdown is populated from. This is the field the
    // backend validates against (see routes/headCaregiverRoutes.js POST
    // /inventory/request) so an HC can never submit a request for a
    // product that doesn't exist in Admin Central Inventory, and can
    // never manually create a new product through this form.
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // itemId/itemName remain as a denormalized snapshot of the product at
    // request time, purely for display (e.g. the Admin stock-requests
    // list) without an extra populate — productId above is the source of
    // truth used for validation.
    itemId:       { type: String, default: '' },
    itemName:     { type: String, required: true },
    quantity:     { type: Number, required: true, min: 1 },
    unit:         { type: String, default: 'pcs', trim: true },
    reason:       { type: String, default: '' },
    requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:       { type: String, enum: ['pending','approved','rejected','fulfilled'], default: 'pending' },
    resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt:   { type: Date },
    adminNote:    { type: String, default: '' },
}, { timestamps: true });

stockRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('StockRequest', stockRequestSchema);