/**
 * Shared product-name normalization.
 *
 * Used by BOTH the live "add inventory" route and the one-time migration
 * script, so the duplicate-prevention rule is defined exactly once.
 *
 * Rule (intentionally conservative — see Part 1 spec):
 *   - trim leading/trailing whitespace
 *   - collapse internal whitespace runs to a single space
 *   - lowercase
 *
 * This makes "Example Product", "example product", "EXAMPLE PRODUCT" and
 * " Example Product " all resolve to the same product, while
 * "Example Product" and "Example Product Chocolate" remain different
 * products (no fuzzy/partial matching is performed).
 */
function normalizeProductName(rawName) {
  if (typeof rawName !== 'string') return '';
  return rawName.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Produces a zero-padded, human-readable batch label ("001", "002", ...)
 * from a 1-based batch index.
 */
function formatBatchNumber(oneBasedIndex) {
  return String(oneBasedIndex).padStart(3, '0');
}

module.exports = { normalizeProductName, formatBatchNumber };