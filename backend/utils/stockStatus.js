/**
 * utils/stockStatus.js
 *
 * Backend (CommonJS) counterpart to the Status rules already implemented
 * for the frontend in src/utils/inventoryGrouping.js (getProductStatus),
 * used here so routes/headCaregiverRoutes.js can compute a Status for
 * each HC Assigned Stock row without importing a frontend ES module.
 *
 * Same three rules, unchanged from Part 3:
 *   quantity > minThreshold        -> In Stock
 *   0 < quantity <= minThreshold   -> Low Stock
 *   quantity === 0                 -> Out of Stock
 */
function getStockStatus(quantity, minThreshold) {
  const qty = Number(quantity) || 0;
  const min = minThreshold ?? 10;
  if (qty === 0) return 'Out of Stock';
  if (qty <= min) return 'Low Stock';
  return 'In Stock';
}

module.exports = { getStockStatus };