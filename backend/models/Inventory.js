const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    itemId: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
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

    expirationDate: {
      type: Date,
      required: false, // optional unless needed
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

// OPTIONAL: Auto-update status before saving
inventorySchema.pre('save', function (next) {
  if (this.expirationDate && this.expirationDate < new Date()) {
    this.status = 'expired';
  } else if (this.quantity === 0) {
    this.status = 'out_of_stock';
  } else if (this.quantity <= this.minThreshold) {
    this.status = 'low_stock';
  } else {
    this.status = 'available';
  }
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);