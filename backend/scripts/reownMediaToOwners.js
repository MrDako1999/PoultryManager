import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Media from '../models/Media.js';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

async function run() {
  await connectDB();
  console.log(`[reownMediaToOwners] starting${DRY_RUN ? ' (dry run)' : ''}`);

  const subAccounts = await User.find({ createdBy: { $ne: null } }).select('_id createdBy email');
  const subMap = new Map(subAccounts.map((u) => [String(u._id), String(u.createdBy)]));

  console.log(`[reownMediaToOwners] ${subMap.size} sub-accounts to check`);

  const userIds = Array.from(subMap.keys());
  if (userIds.length === 0) {
    console.log('[reownMediaToOwners] no sub-accounts found; nothing to do');
    await mongoose.disconnect();
    return;
  }

  const orphans = await Media.find({
    user_id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).select('_id user_id key');
  console.log(`[reownMediaToOwners] ${orphans.length} Media doc(s) owned by sub-accounts`);

  let fixed = 0;
  for (const media of orphans) {
    const subId = String(media.user_id);
    const ownerId = subMap.get(subId);
    if (!ownerId) continue;

    if (DRY_RUN) {
      if (VERBOSE) console.log(`[dry] ${media.key}: user_id ${subId} -> ${ownerId}`);
      fixed++;
      continue;
    }

    await Media.updateOne(
      { _id: media._id },
      { $set: { user_id: new mongoose.Types.ObjectId(ownerId), createdBy: new mongoose.Types.ObjectId(subId) } }
    );
    if (VERBOSE) console.log(`[ok] ${media.key}: re-owned`);
    fixed++;
  }

  console.log(`[reownMediaToOwners] done. ${fixed} Media doc(s) re-owned${DRY_RUN ? ' (dry run)' : ''}`);
  console.log('[reownMediaToOwners] note: S3 objects were NOT moved; the existing keys remain valid for serving.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
