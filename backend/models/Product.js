const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      // Display name, as typed by the Admin on first add (original casing
      // preserved).
      type: String,
      required: true,
      trim: true,
    },

    normalizedName: {
      // Lowercased, whitespace-collapsed version of `name`, used purely
      // for duplicate detection. See utils/productNormalization.js.
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    category: {
      type: String,
      enum: [
        'medication', 'medical_supplies', 'food', 'hygiene',
        'General', 'Cleaning', 'Equipment', 'Linens & Bedding',
      ],
      default: 'General',
      trim: true,
    },

    unit: {
      type: String,
      required: true,
      default: 'pcs',
      trim: true,
    },

    minimumStockLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);