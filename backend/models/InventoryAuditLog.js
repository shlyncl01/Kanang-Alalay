const mongoose = require('mongoose');

/**
 * models/InventoryAuditLog.js
 *
 * PART 11 — BULK STOCK REDUCTION AUDIT TRAIL
 *
 * One document per individual BATCH (Inventory document) touched by an
 * Admin "Bulk Reduction" submission. A single submission that reduces 5
 * items creates 5 of these rows — never one combined row — so each batch's
 * history can be queried on its own via `inventoryItemId`, and so partial
 * failures (see routes/adminRoutes.js POST /inventory/bulk-reduce) only
 * ever produce log rows for items that actually changed.
 *
 * This is deliberately its own collection rather than reusing
 * models/ActivityLog.js — ActivityLog stores a single free-text `details`
 * sentence for staff/user admin actions, whereas a stock reduction needs
 * real, individually-queryable numeric fields (previousQuantity /
 * quantityReduced / newQuantity) so they can be summed, filtered, or
 * displayed in a table without parsing a sentence back apart.
 *
 * Purely additive and read-only from every other model's perspective:
 * nothing in Inventory.js, Product.js, HCAssignedStock.js, StockRequest,
 * or MedicationLog logic ever reads this collection, and this collection
 * never reads or writes any of those either. It is a record of what
 * already happened, not a source of truth for current stock — deleting
 * every row here would not change any Inventory quantity.
 */
const inventoryAuditLogSchema = new mongoose.Schema(
  {
    // Reserved for future audit-log actions beyond bulk reduction (single-
    // item edits, deletes, etc.) without needing a schema migration later.
    action: {
      type: String,
      enum: ['bulk_reduction'],
      default: 'bulk_reduction',
      required: true,
    },

    // The exact Inventory batch this entry reduced. Intentionally NOT
    // `required` at the ref-integrity level beyond storing the id — if the
    // batch is later deleted, this log row should still exist and still
    // read correctly using the denormalized fields below, not disappear
    // or break.
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true,
    },

    // Denormalized at write time, on purpose — captured from the batch AS
    // IT WAS at the moment of reduction, never re-read from the live
    // Inventory/Product record later. This keeps old log entries accurate
    // even if the batch is subsequently renamed, re-categorized, or
    // deleted entirely.
    itemName: { type: String, required: true, trim: true },
    batchNumber: { type: String, trim: true },
    unit: { type: String, trim: true },

    quantityReduced: { type: Number, required: true, min: 0 },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },

    // Optional reason/notes entered once per Bulk Reduction submission and
    // copied onto every row it produced.
    reason: { type: String, trim: true, default: '' },

    // The admin who performed the reduction. Always taken from the
    // authenticated request (req.user._id) server-side — never trusted
    // from the request body.
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true } // createdAt doubles as "date and time" of the reduction
);

inventoryAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InventoryAuditLog', inventoryAuditLogSchema);