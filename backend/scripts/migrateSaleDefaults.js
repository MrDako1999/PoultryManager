import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

async function run() {
  await connectDB();
  console.log(`[migrateSaleDefaults] starting${DRY_RUN ? ' (dry run)' : ''}`);

  const raw = await mongoose.connection.db
    .collection('users')
    .find({ saleDefaults: { $exists: true } })
    .toArray();

  console.log(`[migrateSaleDefaults] found ${raw.length} users with legacy saleDefaults`);

  let migrated = 0;
  for (const doc of raw) {
    const existing = doc.moduleSettings?.broiler?.saleDefaults;
    if (existing && (existing.portionRates || existing.transportRatePerTruck !== undefined)) {
      if (VERBOSE) console.log(`[skip] ${doc.email} already has moduleSettings.broiler.saleDefaults`);
      continue;
    }

    const legacy = doc.saleDefaults || {};
    const newBlock = {
      portionRates: legacy.portionRates || {},
      transportRatePerTruck: legacy.transportRatePerTruck ?? 0,
    };

    if (DRY_RUN) {
      console.log(`[dry] ${doc.email} -> moduleSettings.broiler.saleDefaults =`, newBlock);
      migrated++;
      continue;
    }

    await mongoose.connection.db.collection('users').updateOne(
      { _id: doc._id },
      {
        $set: { [`moduleSettings.broiler.saleDefaults`]: newBlock },
        $unset: { saleDefaults: '' },
      }
    );
    if (VERBOSE) console.log(`[ok] migrated ${doc.email}`);
    migrated++;
  }

  console.log(`[migrateSaleDefaults] done. ${migrated} user(s) migrated${DRY_RUN ? ' (dry run)' : ''}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
