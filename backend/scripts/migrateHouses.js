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
  const farmsCollection = db.collection('farms');
  const housesCollection = db.collection('houses');

  const farms = await farmsCollection
    .find({ totalCapacity: { $ne: null }, deletedAt: null })
    .toArray();

  console.log(`Found ${farms.length} farm(s) with totalCapacity to migrate`);

  let created = 0;
  let skipped = 0;

  for (const farm of farms) {
    const existingHouse = await housesCollection.findOne({ farm: farm._id });
    if (existingHouse) {
      console.log(`  SKIP: ${farm.farmName} (${farm._id}) — already has houses`);
      skipped++;
      continue;
    }

    const now = new Date();
    await housesCollection.insertOne({
      user_id: farm.user_id,
      createdBy: farm.createdBy || farm.user_id,
      farm: farm._id,
      name: 'House 1',
      capacity: farm.totalCapacity,
      sortOrder: 0,
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await farmsCollection.updateOne(
      { _id: farm._id },
      { $unset: { totalCapacity: '' } }
    );

    console.log(`  OK: ${farm.farmName} (${farm._id}) — created House 1 with capacity ${farm.totalCapacity}`);
    created++;
  }

  console.log(`\nDone. Created ${created} house(s), skipped ${skipped}.`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
