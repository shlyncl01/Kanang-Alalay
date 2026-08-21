const mongoose = require('mongoose');

/**
 * A Product represents ONE unique inventory item (e.g. "Skyflakes",
 * "Paracetamol 500mg"). Products are never seeded or hardcoded — they are
 * created dynamically the first time an Admin adds inventory for a name
 * that doesn't already exist (see routes/adminRoutes.js POST /inventory).
 *
 * Actual stock lives on Batch documents (models/Inventory.js), which
 * reference a Product via productId. A Product's "total stock" is the sum
 * of quantity across all of its batches — it is not stored on the Product
 * itself, so it can never go stale.
 */
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