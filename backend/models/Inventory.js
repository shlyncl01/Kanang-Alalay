const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    qrCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    barcode: {
      type: String,
      sparse: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Added specific medicine details
    brand: {
      type: String,
      trim: true,
      required: function() { return this.category === 'medication'; }
    },
    dosage: {
      type: String,
      trim: true,
      required: function() { return this.category === 'medication'; }
    },
    batchNumber: {
      type: String,
      trim: true,
      required: function() { return this.category === 'medication'; }
    },
    dateOfManufacture: {
      type: Date,
    },
    dateOfPurchase: {
      type: Date,
    },
    expirationDate: {
      type: Date,
      required: function() { return this.category === 'medication'; }
    },
    category: {
      type: String,
      enum: ['medication', 'medical_supplies', 'food', 'hygiene', 'General'],
      default: 'General',
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      default: 'pcs',
      trim: true,
    },
    minThreshold: {
      type: Number,
      default: 10,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['available', 'low_stock', 'out_of_stock', 'expired'],
      default: 'available',
    },
  },
  { timestamps: true }
);

// Auto-update status hooks remain unchanged
inventorySchema.pre('save', function () {
  if (!this.itemId) {
    this.itemId = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
  }
  if (!this.qrCode) {
    this.qrCode = `INVQR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100000)}`;
  }
  if (this.expirationDate && this.expirationDate < new Date()) {
    this.status = 'expired';
  } else if (this.quantity === 0) {
    this.status = 'out_of_stock';
  } else if (this.quantity <= this.minThreshold) {
    this.status = 'low_stock';
  } else {
    this.status = 'available';
  }
});

inventorySchema.pre('validate', function () {
  if (!this.qrCode) {
    this.qrCode = `INVQR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100000)}`;
  }
  if (!this.itemId) {
    this.itemId = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
  }
});

module.exports = mongoose.model('Inventory', inventorySchema);