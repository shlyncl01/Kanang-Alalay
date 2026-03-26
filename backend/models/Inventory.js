const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    itemId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['medication', 'medical_supplies', 'food', 'cleaning', 'other'],
        required: true
    },
    currentStock: {
        type: Number,
        default: 0
    },
    minimumStock: {
        type: Number,
        default: 10
    },
    maximumStock: {
        type: Number,
        default: 100
    },
    unit: String,
    lastRestocked: Date,
    expiryDate: Date,
    supplier: String,
    reorderPoint: Number,
    isActive: {
        type: Boolean,
        default: true
    },
    alerts: [{
        type: {
            type: String,
            enum: ['low_stock', 'expiring_soon', 'out_of_stock']
        },
        triggeredAt: Date,
        resolved: Boolean,
        resolvedAt: Date
    }]
}, { timestamps: true });

// Check if item needs reorder
inventorySchema.methods.needsReorder = function() {
    return this.currentStock <= this.reorderPoint;
};

// Check if item is expiring soon (within 30 days)
inventorySchema.methods.isExpiringSoon = function() {
    if (!this.expiryDate) return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return this.expiryDate <= thirtyDaysFromNow;
};

module.exports = mongoose.model('Inventory', inventorySchema);