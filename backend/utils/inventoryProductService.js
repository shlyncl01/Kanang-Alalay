const { normalizeProductName, formatBatchNumber } = require('./productNormalization');

/**
 * Finds the Product this name belongs to, or creates it if this is the
 * first time it's being added.
 *
 * Models are passed in (dependency injection) rather than required
 * directly, so this exact function can be exercised in tests against an
 * in-memory fake without touching a real database.
 *
 * @param {Object} ProductModel - Mongoose model (or compatible fake) with
 *   .findOne({normalizedName}) and .create(doc)
 * @param {Object} fields - { name, category, unit, minimumStockLevel }
 * @returns {Promise<{ product: Object, created: boolean }>}
 */
async function findOrCreateProduct(ProductModel, fields) {
  const rawName = (fields.name || '').trim();
  if (!rawName) {
    throw new Error('Product name is required.');
  }

  const normalizedName = normalizeProductName(rawName);

  const existing = await ProductModel.findOne({ normalizedName });
  if (existing) {
    return { product: existing, created: false };
  }

  const product = await ProductModel.create({
    name: rawName,
    normalizedName,
    category: fields.category || 'General',
    unit: fields.unit || 'pcs',
    minimumStockLevel:
      fields.minimumStockLevel !== undefined && fields.minimumStockLevel !== null && fields.minimumStockLevel !== ''
        ? Number(fields.minimumStockLevel)
        : 10,
  });

  return { product, created: true };
}

/**
 * Determines the next batch number ("001", "002", ...) for a product by
 * counting how many batches already exist for it.
 *
 * @param {Object} BatchModel - Mongoose model (or compatible fake) with
 *   .countDocuments({productId})
 * @param {*} productId
 */
async function getNextBatchNumber(BatchModel, productId) {
  const existingCount = await BatchModel.countDocuments({ productId });
  return formatBatchNumber(existingCount + 1);
}

module.exports = { findOrCreateProduct, getNextBatchNumber, normalizeProductName };