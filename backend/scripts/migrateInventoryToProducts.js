/**
 * scripts/migrateInventoryToProducts.js
 *
 * ONE-TIME, IDEMPOTENT migration for the Product + Batch restructuring.
 *
 * What it does:
 *   1. Finds every existing Inventory (batch) document that has no
 *      productId yet (i.e. everything created before this change).
 *   2. Groups them by normalized name (same rule used by the live routes —
 *      see utils/productNormalization.js) so "Skyflakes", "Sky Flakes",
 *      "SKYFLAKES" all fall into one group.
 *   3. For each group, finds-or-creates a Product (using the oldest batch
 *      in the group to seed the Product's category/unit/minimumStockLevel).
 *   4. Sets productId + a sequential batchNumber ("001", "002", ...) on
 *      every batch in the group, ordered by createdAt.
 *
 * What it explicitly does NOT do:
 *   - It never deletes an Inventory document.
 *   - It never changes quantity, expirationDate, category, or unit on any
 *     existing batch.
 *   - It never touches batches that already have a productId, so it is
 *     safe to re-run (e.g. if new legacy data shows up later).
 *
 * Usage:
 *   node scripts/migrateInventoryToProducts.js
 *
 * Requires MONGODB_URI in the environment, same as server.js.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const { normalizeProductName, formatBatchNumber } = require('../utils/productNormalization');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting — refusing to guess a connection string.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const unlinked = await Inventory.find({
    $or: [{ productId: { $exists: false } }, { productId: null }],
  }).sort({ createdAt: 1 });

  console.log(`Found ${unlinked.length} existing batch(es) without a productId.`);

  if (unlinked.length === 0) {
    console.log('Nothing to migrate. Existing data is untouched.');
    await mongoose.disconnect();
    return;
  }

  // Group by normalized name, preserving createdAt order within each group.
  const groups = new Map(); // normalizedName -> [batchDocs]
  for (const batch of unlinked) {
    const key = normalizeProductName(batch.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(batch);
  }

  console.log(`Grouped into ${groups.size} distinct product(s).`);

  let productsCreated = 0;
  let productsReused = 0;
  let batchesLinked = 0;

  for (const [normalizedName, batches] of groups) {
    if (!normalizedName) {
      console.warn('Skipping a batch group with an empty/unusable name — leaving those records untouched.');
      continue;
    }

    let product = await Product.findOne({ normalizedName });

    if (!product) {
      // Seed the new Product from the oldest existing batch in the group,
      // since that's the closest thing to "how the Admin originally
      // entered it".
      const seed = batches[0];
      product = await Product.create({
        name: seed.name,
        normalizedName,
        category: seed.category || 'General',
        unit: seed.unit || 'pcs',
        minimumStockLevel: seed.minThreshold ?? 10,
      });
      productsCreated += 1;
    } else {
      productsReused += 1;
    }

    // Assign sequential batch numbers in creation order for this group.
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      batch.productId = product._id;
      if (!batch.batchNumber) {
        batch.batchNumber = formatBatchNumber(i + 1);
      }
      await batch.save({ validateModifiedOnly: true });
      batchesLinked += 1;
    }

    const totalQty = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    console.log(
      `  "${product.name}" -> ${batches.length} batch(es) linked, total stock preserved: ${totalQty} ${product.unit}`
    );
  }

  console.log('\nMigration summary:');
  console.log(`  Products created: ${productsCreated}`);
  console.log(`  Products reused (already existed): ${productsReused}`);
  console.log(`  Batches linked: ${batchesLinked}`);
  console.log('  No existing Inventory documents were deleted or had their quantity/expiration/category/unit changed.');

  await mongoose.disconnect();
  console.log('Done.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});