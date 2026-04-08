const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['medication', 'medical_supplies', 'food', 'hygiene'], 
        required: true 
    },
    quantity: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true }, // e.g., 'tablets', 'bottles'
    
    // ── NEW FIELDS FOR ALERTS ──
    expirationDate: { type: Date, required: true }, 
    minThreshold: { type: Number, default: 10 }, // Alert if quantity falls below this
    
    status: { 
        type: String, 
        enum: ['available', 'low_stock', 'out_of_stock', 'expired'],
        default: 'available'
    }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);