// Category options shown in the Add/Edit Inventory forms. `value` is the
// backend enum value (models/Inventory.js / models/Product.js `category`
// field) — forms should store/submit `value`, and only use `label` for
// display, so there's exactly one representation of "category" flowing
// through the app (no more separate UI-label <-> backend-value mapping).
export const CATEGORY_OPTIONS = [
    { label: 'Medicine', value: 'medication' },
    { label: 'Food & Nutrition', value: 'food' },
    { label: 'Linens & Bedding', value: 'Linens & Bedding' },
    { label: 'Hygiene', value: 'hygiene' },
    { label: 'Medical Supplies', value: 'medical_supplies' },
    { label: 'Cleaning', value: 'Cleaning' },
    { label: 'Equipment', value: 'Equipment' },
    { label: 'General', value: 'General' },
];

// Category (backend value) -> the ONLY units that make sense for it.
// This is the single source of truth on the frontend for which Units to
// show once a Category is picked. Mirrored on the backend in
// utils/inventoryCategoryUnits.js for server-side validation — keep both
// in sync if this list changes.
export const CATEGORY_UNITS = {
    medication: ['tablet', 'capsule', 'bottle', 'vial', 'tube', 'box', 'pack'],
    food: ['pcs', 'pack', 'box', 'can', 'bottle', 'bag', 'kg', 'liters'],
    'Linens & Bedding': ['pcs', 'set', 'pair'],
    hygiene: ['pcs', 'bottle', 'box', 'pack', 'tube'],
    medical_supplies: ['pcs', 'box', 'pack', 'roll', 'bottle', 'tube'],
    Cleaning: ['pcs', 'bottle', 'box', 'pack', 'liters', 'kg'],
    Equipment: ['pcs', 'set'],
    General: ['pcs', 'box', 'pack', 'set'],
};

export const getUnitsForCategory = (category) => CATEGORY_UNITS[category] || [];