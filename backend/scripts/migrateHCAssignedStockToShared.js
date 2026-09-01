/**
 * scripts/migrateHCAssignedStockToShared.js
 *
 * ONE-TIME migration to run BEFORE deploying the shared-pool version of
 * models/HCAssignedStock.js.
 *
 * Old shape: many rows per Product, one per (headCaregiverId, productId)
 *   pair, unique on that compound key.
 * New shape: exactly one row per Product, unique on productId alone.
 *
 * This script:
 *   1. Groups all existing HCAssignedStock documents by productId.
 *   2. Sums their quantities into a single combined total per product
 *      (so no stock is silently lost in the switch to a shared pool).
 *   3. Deletes the old per-HC rows for that product.
 *   4. Inserts one new row: { productId, quantity: <sum> }.
 *
 * Run with the OLD model/index still in place is fine — this script talks
 * to the collection directly via the native driver so it isn't blocked by
 * either the old or new Mongoose schema/index definitions. Run it, THEN
 * deploy the new model file (which declares productId as unique) so the
 * new unique index can build cleanly against already-deduplicated data.
 *
 * Usage:
 *   node scripts/migrateHCAssignedStockToShared.js
 *
 * Safe to re-run: if it's already been run once, every product already
 * has exactly one row and the "sum + replace" step is a no-op per
 * product (sum of one row = that row's own quantity).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function migrate() {
  if (!MONGO_URI) {
    throw new Error('Set MONGO_URI (or MONGODB_URI) before running this script.');
  }

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('hcassignedstocks');

  console.log('Reading existing HCAssignedStock rows...');
  const rows = await collection.find({}).toArray();
  console.log(`Found ${rows.length} existing row(s).`);

  const totalsByProduct = new Map();
  for (const row of rows) {
    const key = String(row.productId);
    totalsByProduct.set(key, (totalsByProduct.get(key) || 0) + (Number(row.quantity) || 0));
  }

  console.log(`Collapsing into ${totalsByProduct.size} shared product row(s)...`);

  console.log('Dropping all old per-HC rows...');
  await collection.deleteMany({});

  console.log('Dropping old compound index (headCaregiverId_1_productId_1) if present...');
  try {
    await collection.dropIndex('headCaregiverId_1_productId_1');
  } catch (err) {
    // Index may already be gone (e.g. re-run, or a differently-named
    // index) — not fatal, just log and continue.
    console.log('  (skipped: ' + err.message + ')');
  }

  const now = new Date();
  const docs = [...totalsByProduct.entries()].map(([productId, quantity]) => ({
    productId: new mongoose.Types.ObjectId(productId),
    quantity,
    createdAt: now,
    updatedAt: now,
  }));

  if (docs.length > 0) {
    console.log(`Inserting ${docs.length} shared row(s)...`);
    await collection.insertMany(docs);
  }

  console.log('Done. Sample of migrated totals:');
  for (const doc of docs.slice(0, 10)) {
    console.log(`  productId=${doc.productId}  quantity=${doc.quantity}`);
  }

  await mongoose.disconnect();
}

migrate()
  .then(() => {
    console.log('Migration complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });