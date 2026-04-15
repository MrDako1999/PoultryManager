import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('saleorders');

  const docs = await collection.find({}).toArray();
  console.log(`Found ${docs.length} sale order(s) to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    if (doc.saleMethod) {
      console.log(`  Skipping ${doc._id} (already has saleMethod)`);
      skipped++;
      continue;
    }

    const $set = {
      saleMethod: doc.slaughter?.method || 'SLAUGHTERED',
      live: null,
      discounts: [],
      'totals.liveSales': 0,
      'totals.discounts': 0,
    };

    await collection.updateOne({ _id: doc._id }, { $set });
    console.log(`  Migrated ${doc._id} (${doc.saleNumber})`);
    migrated++;
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
