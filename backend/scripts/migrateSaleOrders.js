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
    if (doc.slaughter || doc.counts || doc.totals) {
      console.log(`  Skipping ${doc._id} (already migrated)`);
      skipped++;
      continue;
    }

    const $set = {
      slaughter: {
        method: doc.saleMethod || 'SLAUGHTERED',
        date: doc.slaughterDate || null,
        slaughterhouse: doc.slaughterhouse || null,
        invoiceRef: doc.slaughterInvoiceRef || '',
        reportDocs: doc.slaughterReportDocs || [],
        processingCost: (doc.processingCost || 0) + (doc.processingCostVat || 0),
        relatedExpense: doc.relatedExpense || null,
      },
      counts: {
        chickensSent: doc.chickensSent || 0,
        condemnation: doc.condemnation || 0,
        deathOnArrival: doc.deathOnArrival || 0,
        rejections: doc.rejections || 0,
        shortage: doc.shortage || 0,
        bGrade: doc.bGradeCount || 0,
      },
      transport: {
        truckCount: doc.truckCount || 0,
        ratePerTruck: doc.truckRate || 0,
      },
      totals: {
        wholeChicken: doc.wholeChickenTotal || 0,
        portions: doc.portionsTotal || 0,
        grossSales: doc.grossSalesAmount || 0,
        transportDeduction: doc.transportDeduction || 0,
        subtotal: doc.subtotal || 0,
        vat: doc.vatAmount || 0,
        grandTotal: doc.grandTotal || 0,
      },
    };

    const $unset = {
      saleType: '',
      saleMethod: '',
      slaughterDate: '',
      slaughterhouse: '',
      slaughterInvoiceRef: '',
      slaughterReportDocs: '',
      processingCost: '',
      processingCostVat: '',
      relatedExpense: '',
      chickensSent: '',
      condemnation: '',
      deathOnArrival: '',
      rejections: '',
      shortage: '',
      bGradeCount: '',
      truckCount: '',
      truckRate: '',
      wholeChickenTotal: '',
      portionsTotal: '',
      grossSalesAmount: '',
      transportDeduction: '',
      subtotal: '',
      vatAmount: '',
      grandTotal: '',
    };

    await collection.updateOne({ _id: doc._id }, { $set, $unset });
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
