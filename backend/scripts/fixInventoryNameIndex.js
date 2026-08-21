/**
 * scripts/fixInventoryNameIndex.js
 *
 * PART 1 BUG FIX — DUPLICATE PRODUCT ("E11000 duplicate key error ...
 * index: name_1 ... dup key: { name: ... }")
 *
 * ROOT CAUSE (confirmed, not guessed):
 *   The error happens on the `inventories` collection (batches), not
 *   `products`. Today's models/Inventory.js does NOT declare `unique: true`
 *   on `name` — so this isn't a schema bug. It's a STALE index: at some
 *   earlier point in this project's history (before batches existed, when
 *   each inventory row needed a unique name), MongoDB was given a unique
 *   index named `name_1` on the `inventories` collection. Removing
 *   `unique: true` from a Mongoose schema does NOT drop the index that's
 *   already living in the database — only an explicit dropIndex() does.
 *   So MongoDB has been rejecting every second batch of the same product
 *   ever since, regardless of what the application code does.
 *
 *   The Product find-or-create logic (utils/inventoryProductService.js) is
 *   NOT the problem — it already runs successfully and correctly finds the
 *   existing Product before this failure happens on the very next line
 *   (Inventory.save()).
 *
 * WHAT THIS SCRIPT DOES:
 *   Connects to the same database as the app, inspects the `inventories`
 *   collection's actual indexes, and — ONLY if an index literally named
 *   `name_1` exists — drops it. Nothing else is touched: itemId_1,
 *   qrCode_1 (both legitimately unique per the current schema), and every
 *   index on the `products` collection are left exactly as they are.
 *
 *   Idempotent — safe to run more than once. If the index is already gone,
 *   it says so and exits cleanly.
 *
 * USAGE:
 *   node scripts/fixInventoryNameIndex.js
 *
 * Requires MONGODB_URI in the environment, same as server.js.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting — refusing to guess a connection string.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const inventories = db.collection('inventories');

  const indexesBefore = await inventories.indexes();
  console.log('\nCurrent indexes on `inventories`:');
  indexesBefore.forEach((idx) => console.log(`  - ${idx.name}  ${JSON.stringify(idx.key)}${idx.unique ? '  (unique)' : ''}`));

  const staleIndex = indexesBefore.find((idx) => idx.name === 'name_1');

  if (!staleIndex) {
    console.log('\nNo "name_1" index found on `inventories` — nothing to fix. (Already fixed, or this environment never had it.)');
  } else {
    console.log('\nFound the stale unique index "name_1" on `inventories`. Dropping it...');
    await inventories.dropIndex('name_1');
    console.log('Dropped.');

    const indexesAfter = await inventories.indexes();
    console.log('\nIndexes on `inventories` after fix:');
    indexesAfter.forEach((idx) => console.log(`  - ${idx.name}  ${JSON.stringify(idx.key)}${idx.unique ? '  (unique)' : ''}`));
  }

  // Sanity check only — confirms the Product collection's intended unique
  // index (on normalizedName, for duplicate-product prevention) is intact
  // and was never the issue. Not modified.
  const products = db.collection('products');
  const productIndexes = await products.indexes();
  console.log('\nFor reference, current indexes on `products` (unchanged by this script):');
  productIndexes.forEach((idx) => console.log(`  - ${idx.name}  ${JSON.stringify(idx.key)}${idx.unique ? '  (unique)' : ''}`));

  await mongoose.disconnect();
  console.log('\nDone. Adding the same product twice should now work: first add creates the Batch under the existing Product, no new Product is created.');
}

run().catch((err) => {
  console.error('Fix script failed:', err);
  process.exit(1);
});