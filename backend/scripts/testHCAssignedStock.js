const mongoose = require('mongoose');

/**
 * models/HCAssignedStock.js
 *
 * PART 4 — HC ASSIGNED STOCK
 *
 * Represents a SEPARATE stock balance held by an individual Head
 * Caregiver (HC), distinct from Admin Central Stock (the batch
 * quantities in models/Inventory.js). One document = "this HC currently
 * holds this many units of this Product in their own assigned stock."
 *
 * Central Stock and HC Assigned Stock are two independent numbers for the
 * same Product — this collection never reads from or writes to Inventory,
 * and Inventory is never summed into this collection. E.g. Admin Central
 * Stock for "Product X" can read 100 while a given HC's assigned stock for
 * the same Product reads 20; they are tracked completely separately.
 *
 * References the EXISTING Product catalog (models/Product.js) — per the
 * Part 4 spec, there is no separate HC product catalog. Display fields
 * that live on Product (name, category, unit, minimumStockLevel) are
 * intentionally NOT duplicated here; they're read from the Product at
 * request time (see routes/headCaregiverRoutes.js GET /assigned-stock) so
 * they can never drift out of sync with the Admin-managed Product record.
 *
 * `quantity` is intentionally the ONLY numeric field here, and Part 4
 * exposes no write route for it to a head_caregiver — there is no POST/
 * PUT/PATCH on this collection reachable from the HC dashboard, so an HC
 * cannot manually increase or decrease their assigned stock. It will only
 * ever change automatically, via the stock request/approval/transfer
 * workflow built in Part 5 and Part 6 (not implemented yet — see the
 * headCaregiverRoutes.js comment above the GET route for how a future
 * approval handler would $inc it).
 */
const hcAssignedStockSchema = new mongoose.Schema(
  {
    // Which HC this balance belongs to. Every read of this collection
    // MUST be scoped by this field to the requesting user — see
    // routes/headCaregiverRoutes.js GET /assigned-stock — so one HC can
    // never see another HC's assigned stock.
    headCaregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which Product this balance is for. Always the existing Product
    // model from Parts 1–3 — never a separate/duplicated catalog entry.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    // This HC's own on-hand quantity for this Product. Independent of
    // Inventory (Admin Central Stock) quantities for the same Product.
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// One balance row per (HC, Product) pair. The Part 5/6 approval workflow
// should findOneAndUpdate + $inc this row rather than creating a second
// row for a product the HC already holds some of.
hcAssignedStockSchema.index({ headCaregiverId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('HCAssignedStock', hcAssignedStockSchema);