/**
 * Category -> valid Units mapping (backend copy).
 *
 * Keys are the backend category enum values used by models/Inventory.js
 * and models/Product.js. This is the SAME mapping the frontend uses (see
 * frontend/constants/inventoryOptions.js) — keep both in sync if you add
 * or change a category/unit here.
 *
 * This exists so the backend can reject an invalid Category/Unit
 * combination even if a request bypasses the frontend form entirely
 * (curl, Postman, a buggy future frontend change, etc.) — per Part 2 spec:
 * "Do not rely only on frontend validation."
 */
const CATEGORY_UNIT_MAP = {
  medication: ['tablet', 'capsule', 'bottle', 'vial', 'tube', 'box', 'pack'],
  food: ['pcs', 'pack', 'box', 'can', 'bottle', 'bag', 'kg', 'liters'],
  'Linens & Bedding': ['pcs', 'set', 'pair'],
  hygiene: ['pcs', 'bottle', 'box', 'pack', 'tube'],
  medical_supplies: ['pcs', 'box', 'pack', 'roll', 'bottle', 'tube'],
  Cleaning: ['pcs', 'bottle', 'box', 'pack', 'liters', 'kg'],
  Equipment: ['pcs', 'set'],
  General: ['pcs', 'box', 'pack', 'set'],
};

const CATEGORY_VALUES = Object.keys(CATEGORY_UNIT_MAP);

module.exports = { CATEGORY_UNIT_MAP, CATEGORY_VALUES };