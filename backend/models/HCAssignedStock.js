const mongoose = require('mongoose');

/**
 * models/HCAssignedStock.js
 *
 * PART 4 — HC ASSIGNED STOCK  (now a SHARED POOL across all Head
 * Caregivers, per user request)
 *
 * ── CHANGE OF DESIGN ──────────────────────────────────────────────────
 * This used to be ONE ROW PER (headCaregiverId, productId) PAIR — i.e.
 * every Head Caregiver (HC) had their own private balance for a given
 * Product, and one HC drawing down their stock never affected any other
 * HC's number for that same Product.
 *
 * That is now replaced with ONE ROW PER PRODUCT, period. There is exactly
 * one `quantity` per Product, shared by every head_caregiver account —
 * everyone reads the same number, and any HC administering a dose (or any
 * future draw against this pool) decrements that single shared row. This
 * is a genuine behavior change: two HCs can no longer both hold their own
 * 20 units of the same Product; they now hold — and compete for — one
 * shared pool.
 *
 * `lastUpdatedBy` replaces the old required `headCaregiverId` scoping
 * field. It's optional, purely informational (last HC to move this
 * pool's quantity), and MUST NOT be used to filter reads or writes —
 * doing so would silently reintroduce the old per-HC behavior.
 *
 * Still references the existing Product catalog (models/Product.js) —
 * per the original Part 4 spec, there is no separate HC product catalog.
 * Display fields that live on Product (name, category, unit,
 * minimumStockLevel) are intentionally NOT duplicated here; they're read
 * from the Product at request time (see routes/headCaregiverRoutes.js)
 * so they can never drift out of sync with the Admin-managed Product
 * record.
 *
 * `quantity` is still the only numeric field here. It changes via the
 * medication-administration deduction (routes/headCaregiverRoutes.js PUT
 * /schedule/:id/status) and, once built, the stock request/approval/
 * transfer workflow (Part 5/6) — both now read/write the single shared
 * row for a productId instead of a (headCaregiverId, productId) row.
 *
 * ── MIGRATING EXISTING DATA ───────────────────────────────────────────
 * Any environment that already has per-HC rows from before this change
 * needs a one-time migration to collapse them into a single row per
 * productId (summing quantities) BEFORE this schema/index change is
 * deployed, or the old compound-unique index will conflict with data
 * that no longer matches the new single unique index on productId. See
 * scripts/migrateHCAssignedStockToShared.js.
 */
const hcAssignedStockSchema = new mongoose.Schema(
  {
    // Which Product this shared balance is for. Always the existing
    // Product model from Parts 1–3 — never a separate/duplicated catalog
    // entry. This is now the ONLY thing a balance row is keyed by.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },

    // The shared on-hand quantity for this Product, visible to and drawn
    // from by every head_caregiver account. Independent of Inventory
    // (Admin Central Stock) quantities for the same Product.
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // Informational only — the last HC whose action changed this pool's
    // quantity (e.g. administered a dose, or had a stock request
    // approved into it). NOT used to scope any query; every HC reads and
    // writes the same row regardless of what this field holds.
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HCAssignedStock', hcAssignedStockSchema);