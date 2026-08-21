// src/utils/inventoryGrouping.js
//
// Turns the flat list of Inventory BATCH documents (what
// GET /admin/inventory already returns) into ONE ROW PER PRODUCT for the
// Admin Inventory monitoring table (Part 3).
//
// Deliberately framework-free (no React) so the aggregation rules — the
// part most worth getting exactly right — can be unit tested directly with
// plain Node, without spinning up a browser/React test harness.
//
// Design note on "which batch's category/unit/minThreshold represents the
// Product": today there is no frontend fetch of the Product model itself
// (see models/Product.js on the backend) — the table only has the flat
// batch list. Each batch already mirrors its Product's category/unit/
// minThreshold at the time it was created (see routes/adminRoutes.js POST
// /admin/inventory from Part 1/2). If an Admin edits one batch's
// minThreshold via the Edit modal, that's the most recent expression of
// intent we have, so we use the MOST RECENTLY UPDATED batch in the group
// to represent the product's category/unit/minThreshold. A fully correct
// implementation would fetch models/Product.js directly — flagging that as
// a good Part 4+ improvement rather than doing it here, to keep Part 3
// scoped to the table/monitoring view as instructed.

export const EXPIRING_SOON_DAYS = 30;

/** Start of "today" (local time, time-of-day zeroed) — used for all expiry math. */
export function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * A batch is expired if it has an expiration date, isn't flagged
 * "does not expire", and that date is before today. Never expired if
 * doesNotExpire is true or there's no expirationDate at all.
 */
export function isBatchExpired(batch, now = new Date()) {
  if (!batch || batch.doesNotExpire || !batch.expirationDate) return false;
  return new Date(batch.expirationDate) < startOfToday(now);
}

/** Whole (possibly fractional) days between today and the batch's expiration. */
export function daysUntilExpiration(batch, now = new Date()) {
  if (!batch || !batch.expirationDate) return Infinity;
  return (new Date(batch.expirationDate) - startOfToday(now)) / (1000 * 60 * 60 * 24);
}

/**
 * A batch is "expiring soon" if it isn't already expired, isn't flagged
 * non-expiring, and expires within EXPIRING_SOON_DAYS (inclusive, and
 * today itself counts as expiring soon, not "safe").
 */
export function isBatchExpiringSoon(batch, now = new Date()) {
  if (!batch || batch.doesNotExpire || !batch.expirationDate) return false;
  if (isBatchExpired(batch, now)) return false;
  const days = daysUntilExpiration(batch, now);
  return days >= 0 && days <= EXPIRING_SOON_DAYS;
}

/** Per-batch status shown in the Batch Details view. */
export function getBatchStatus(batch, now = new Date()) {
  if (isBatchExpired(batch, now)) return 'Expired';
  if ((batch.quantity ?? 0) === 0) return 'Depleted';
  return 'Active';
}

/**
 * Product-level status, per the Part 3 spec exactly:
 *   totalStock > minThreshold        -> In Stock
 *   0 < totalStock <= minThreshold   -> Low Stock
 *   totalStock === 0                 -> Out of Stock
 */
export function getProductStatus(totalStock, minThreshold) {
  if (totalStock === 0) return 'Out of Stock';
  if (totalStock <= minThreshold) return 'Low Stock';
  return 'In Stock';
}

/** Same normalization rule as the backend (utils/productNormalization.js on
 * the server) — trim, collapse whitespace, lowercase — used ONLY as a
 * fallback grouping key for legacy batches that predate the productId
 * migration (see scripts/migrateInventoryToProducts.js). Once a store has
 * fully migrated, every batch has a productId and this fallback is unused. */
export function normalizeProductName(rawName) {
  if (typeof rawName !== 'string') return '';
  return rawName.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Groups a flat array of Inventory batch documents into one row per
 * Product.
 *
 * @param {Array} inventory - flat batch documents (as returned by
 *   GET /admin/inventory)
 * @param {Date} now - injectable for deterministic testing
 * @returns {Array} product rows, sorted by name, each shaped:
 *   {
 *     productId, name, category, unit, minThreshold,
 *     totalStock, status, expiringSoonCount, expiredCount,
 *     batches: [ batch docs, each also carrying batch.batchStatus ]
 *   }
 */
export function groupInventoryByProduct(inventory, now = new Date()) {
  const groups = new Map();

  for (const batch of inventory || []) {
    const key = batch.productId
      ? String(batch.productId)
      : `legacy:${normalizeProductName(batch.name) || batch._id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(batch);
  }

  const rows = [];
  for (const [productId, batches] of groups) {
    // Most-recently-updated batch represents current product-level fields
    // (see module doc comment above for why).
    const canonical = [...batches].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    )[0];

    const totalStock = batches.reduce(
      (sum, b) => sum + (isBatchExpired(b, now) ? 0 : Number(b.quantity) || 0),
      0
    );
    const minThreshold = canonical.minThreshold ?? 10;
    const status = getProductStatus(totalStock, minThreshold);
    const expiringSoonCount = batches.filter((b) => isBatchExpiringSoon(b, now)).length;
    const expiredCount = batches.filter((b) => isBatchExpired(b, now)).length;

    const sortedBatches = [...batches]
      .sort((a, b) => {
        const byNumber = (a.batchNumber || '').localeCompare(b.batchNumber || '');
        if (byNumber !== 0) return byNumber;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      })
      .map((b) => ({ ...b, batchStatus: getBatchStatus(b, now) }));

    rows.push({
      productId,
      name: canonical.name,
      category: canonical.category,
      unit: canonical.unit,
      minThreshold,
      totalStock,
      status,
      expiringSoonCount,
      expiredCount,
      batches: sortedBatches,
    });
  }

  rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return rows;
}

/** Product-level summary cards (Total Products, Total Stock, Low Stock,
 * Out of Stock, Expiring Soon) computed from the grouped product rows. */
export function summarizeProductRows(productRows) {
  return {
    totalProducts: productRows.length,
    totalStock: productRows.reduce((sum, p) => sum + p.totalStock, 0),
    lowStockCount: productRows.filter((p) => p.status === 'Low Stock').length,
    outOfStockCount: productRows.filter((p) => p.status === 'Out of Stock').length,
    expiringSoonCount: productRows.filter((p) => p.expiringSoonCount > 0).length,
  };
}
