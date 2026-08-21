const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    // ── NEW: links this batch to its Product ─────────────────────────
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
      // Not `required: true` at the schema level on purpose: existing
      // documents created before this change won't have it until the
      // migration script (scripts/migrateInventoryToProducts.js) runs.
      // All NEW documents created through the routes always set it.
    },

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

    dateOfManufacture: { type: Date },
    dateOfPurchase: { type: Date },

    // ── NEW: was already being sent by AddInventoryModal.js but the
    // schema had nowhere to put it, so it was silently dropped. Adding it
    // here doesn't change any existing behavior, it just stops losing data.
    supplier: {
      type: String,
      trim: true,
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
      required: function() { return this.category === 'medication'; }
    },

    // ── NEW (Part 2): lets the Add/Edit form mark an item as never
    // expiring. This is purely additive — it does NOT change the schema's
    // existing `required` rule above (still medication-only), so bulk CSV
    // import (routes/adminRoutes.js POST /inventory/bulk-import, which
    // uses insertMany and therefore full-document validation) keeps
    // working exactly as before for non-medication rows with no
    // expiration date. The broader "expiration required unless
    // doesNotExpire, for every category" rule from the Part 2 spec is
    // enforced instead at the route layer for the single-item Add/Edit
    // form (utils/inventoryFormValidation.js), which is the correct,
    // narrowly-scoped place for a form-specific rule.
    doesNotExpire: {
      type: Boolean,
      default: false,
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