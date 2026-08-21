const { CATEGORY_UNIT_MAP, CATEGORY_VALUES } = require('./inventoryCategoryUnits');

/**
 * Validates the fields entered on the Add/Edit Inventory form.
 *
 * This is intentionally the single source of truth for these rules on the
 * backend — both POST /admin/inventory and PUT /admin/inventory/:id call
 * this with the fully-resolved (merged, in the edit case) set of fields,
 * so the same rules apply whether an item is being created or edited.
 *
 * Returns a human-readable error string, or null if the input is valid.
 *
 * Rules (Part 2 spec):
 *   - name, category, quantity, unit, minThreshold are required.
 *   - unit must belong to the selected category (server owns this mapping
 *     too — never trust the frontend dropdown alone).
 *   - expirationDate is required UNLESS doesNotExpire is true.
 *   - when provided, expirationDate cannot be in the past.
 *   - quantity and minThreshold implicitly share the same `unit` field
 *     (there is only one Unit per batch), so "50 pack / 10 kg" mismatches
 *     are structurally impossible rather than something we have to check.
 */
function validateInventoryInput({ name, category, quantity, unit, minThreshold, expirationDate, doesNotExpire }) {
  if (!name || !String(name).trim()) {
    return 'Item name is required.';
  }

  if (!category || !CATEGORY_UNIT_MAP[category]) {
    return `Category is required and must be one of: ${CATEGORY_VALUES.join(', ')}.`;
  }

  if (quantity === undefined || quantity === null || quantity === '' || isNaN(quantity) || Number(quantity) < 0) {
    return 'Quantity is required and must be zero or greater.';
  }

  if (!unit || !String(unit).trim()) {
    return 'Unit is required.';
  }
  if (!CATEGORY_UNIT_MAP[category].includes(unit)) {
    return `"${unit}" is not a valid unit for category "${category}". Valid units: ${CATEGORY_UNIT_MAP[category].join(', ')}.`;
  }

  if (minThreshold === undefined || minThreshold === null || minThreshold === '' || isNaN(minThreshold) || Number(minThreshold) < 0) {
    return 'Minimum stock level is required and must be zero or greater.';
  }

  if (!doesNotExpire) {
    if (!expirationDate) {
      return 'Expiration date is required, or mark this item as "Does not expire".';
    }
    const parsed = new Date(expirationDate);
    if (isNaN(parsed.getTime())) {
      return 'Expiration date is invalid.';
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (parsed < startOfToday) {
      return 'Expiration date cannot be in the past.';
    }
  }

  return null;
}

module.exports = { validateInventoryInput };