import express from 'express';
import SaleOrder from '../models/SaleOrder.js';
import Batch from '../models/Batch.js';
import Expense from '../models/Expense.js';
import Business from '../models/Business.js';
import { protect } from '../middleware/auth.js';
import { logDeletion, logDeletions } from '../middleware/deletionTracker.js';
import { generateInvoice } from '../services/invoiceService.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

const populateFields = [
  {
    path: 'customer',
    select: 'companyName trnNumber address contacts',
    populate: { path: 'contacts', select: 'firstName phone' },
  },
  { path: 'slaughter.slaughterhouse', select: 'companyName' },
  { path: 'slaughter.reportDocs' },
  { path: 'slaughter.relatedExpense' },
  { path: 'invoiceDocs' },
  { path: 'transferProofs' },
  { path: 'otherDocs.media_id' },
];

async function buildExpenseDescription(saleOrder) {
  const ref = saleOrder.slaughter?.invoiceRef || '';
  return ref
    ? `Slaughtering fee – ${ref}`
    : 'Slaughtering fee';
}

async function syncExpense(saleOrder, ownerId, createdBy) {
  const processingCost = saleOrder.slaughter?.processingCost || 0;

  const description = await buildExpenseDescription(saleOrder);

  if (processingCost > 0) {
    const existingExpenseId = saleOrder.slaughter?.relatedExpense;
    let expense = existingExpenseId
      ? await Expense.findById(existingExpenseId)
      : await Expense.findOne({ saleOrder: saleOrder._id });

    const reportDocs = saleOrder.slaughter?.reportDocs || [];

    const invoiceRef = saleOrder.slaughter?.invoiceRef || '';

    if (expense) {
      expense.expenseDate = saleOrder.slaughter?.date || saleOrder.saleDate;
      expense.invoiceType = saleOrder.invoiceType === 'VAT_INVOICE' ? 'TAX_INVOICE' : 'CASH_MEMO';
      expense.invoiceId = invoiceRef;
      expense.tradingCompany = saleOrder.slaughter?.slaughterhouse || null;
      expense.grossAmount = processingCost;
      expense.taxableAmount = 0;
      expense.totalAmount = processingCost;
      expense.description = description;
      expense.receipts = reportDocs;
      await expense.save();
      return expense;
    }

    expense = await Expense.create({
      user_id: ownerId,
      createdBy,
      batch: saleOrder.batch,
      saleOrder: saleOrder._id,
      expenseDate: saleOrder.slaughter?.date || saleOrder.saleDate,
      invoiceType: saleOrder.invoiceType === 'VAT_INVOICE' ? 'TAX_INVOICE' : 'CASH_MEMO',
      invoiceId: invoiceRef,
      category: 'ANIMAL_PROCESSING',
      description,
      tradingCompany: saleOrder.slaughter?.slaughterhouse || null,
      grossAmount: processingCost,
      taxableAmount: 0,
      totalAmount: processingCost,
      receipts: reportDocs,
    });
    return expense;
  }

  if (saleOrder.slaughter?.relatedExpense) {
    await Expense.deleteMany({ saleOrder: saleOrder._id });
    return null;
  }
  return null;
}

router.get('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { batch, updatedSince, syncAll } = req.query;

    if (!batch && !updatedSince && !syncAll) {
      return res.status(400).json({ message: 'Batch ID is required' });
    }

    const query = { user_id: ownerId };
    if (batch) query.batch = batch;
    if (updatedSince) query.updatedAt = { $gte: new Date(updatedSince) };

    const saleOrders = await SaleOrder.find(query)
      .populate('customer', 'companyName')
      .populate('slaughter.slaughterhouse', 'companyName')
      .populate('slaughter.reportDocs')
      .populate('invoiceDocs')
      .populate('transferProofs')
      .populate('otherDocs.media_id')
      .sort({ createdAt: -1 });

    res.json(saleOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const saleOrder = await SaleOrder.findOne({ _id: req.params.id, user_id: ownerId })
      .populate(populateFields);

    if (!saleOrder) {
      return res.status(404).json({ message: 'Sale order not found' });
    }

    res.json(saleOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { batch: batchId } = req.body;

    if (!batchId) {
      return res.status(400).json({ message: 'Batch ID is required' });
    }

    const batchDoc = await Batch.findOne({ _id: batchId, user_id: ownerId });
    if (!batchDoc) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const count = await SaleOrder.countDocuments({ user_id: ownerId, batch: batchId });
    const saleNumber = `SALE-${batchDoc.batchName}-${String(count + 1).padStart(3, '0')}`;

    const b = req.body;

    const saleOrder = await SaleOrder.create({
      user_id: ownerId,
      createdBy: req.user._id,
      batch: batchId,
      saleNumber,
      saleMethod: b.saleMethod,
      invoiceType: b.invoiceType,
      saleDate: b.saleDate,
      customer: b.customer || null,

      slaughter: b.slaughter || null,
      live: b.live || null,

      counts: b.counts || {},
      transport: b.transport || {},
      discounts: b.discounts || [],
      totals: b.totals || {},

      wholeChickenItems: b.wholeChickenItems || [],
      portions: b.portions || [],

      notes: b.notes || '',
      invoiceDocs: b.invoiceDocs || [],
      transferProofs: b.transferProofs || [],
      otherDocs: b.otherDocs || [],
    });

    const expense = await syncExpense(saleOrder, ownerId, req.user._id);
    if (expense) {
      saleOrder.slaughter.relatedExpense = expense._id;
      saleOrder.markModified('slaughter');
      await saleOrder.save();
    }

    const populated = await SaleOrder.findById(saleOrder._id).populate(populateFields);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const saleOrder = await SaleOrder.findOne({ _id: req.params.id, user_id: ownerId });

    if (!saleOrder) {
      return res.status(404).json({ message: 'Sale order not found' });
    }

    const topFields = [
      'saleMethod', 'invoiceType', 'saleDate', 'customer',
      'wholeChickenItems', 'portions', 'discounts',
      'notes', 'invoiceDocs', 'transferProofs', 'otherDocs',
    ];

    for (const field of topFields) {
      if (req.body[field] !== undefined) {
        saleOrder[field] = req.body[field];
      }
    }

    if (req.body.slaughter !== undefined) {
      saleOrder.slaughter = req.body.slaughter;
      saleOrder.markModified('slaughter');
    }
    if (req.body.live !== undefined) {
      saleOrder.live = req.body.live;
      saleOrder.markModified('live');
    }
    if (req.body.counts !== undefined) {
      saleOrder.counts = req.body.counts;
      saleOrder.markModified('counts');
    }
    if (req.body.transport !== undefined) {
      saleOrder.transport = req.body.transport;
      saleOrder.markModified('transport');
    }
    if (req.body.totals !== undefined) {
      saleOrder.totals = req.body.totals;
      saleOrder.markModified('totals');
    }

    await saleOrder.save();

    const expense = await syncExpense(saleOrder, ownerId, req.user._id);
    if (expense) {
      saleOrder.slaughter = saleOrder.slaughter || {};
      saleOrder.slaughter.relatedExpense = expense._id;
      saleOrder.markModified('slaughter');
      await saleOrder.save();
    } else if (!expense && saleOrder.slaughter?.relatedExpense) {
      saleOrder.slaughter.relatedExpense = null;
      saleOrder.markModified('slaughter');
      await saleOrder.save();
    }

    const populated = await SaleOrder.findById(saleOrder._id).populate(populateFields);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/invoice', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const saleOrder = await SaleOrder.findOne({ _id: req.params.id, user_id: ownerId });

    if (!saleOrder) {
      return res.status(404).json({ message: 'Sale order not found' });
    }

    const invoiceMedia = await generateInvoice(saleOrder._id, ownerId);

    const populated = await SaleOrder.findByIdAndUpdate(
      saleOrder._id,
      { $set: { invoiceDocs: [invoiceMedia._id] } },
      { new: true },
    ).populate(populateFields);

    res.json(populated);
  } catch (err) {
    console.error('Invoice generation failed:', err);
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const saleOrder = await SaleOrder.findOne({ _id: req.params.id, user_id: ownerId });

    if (!saleOrder) {
      return res.status(404).json({ message: 'Sale order not found' });
    }

    const expenseIds = await Expense.find({ saleOrder: saleOrder._id }).distinct('_id');

    await Expense.deleteMany({ saleOrder: saleOrder._id });
    await SaleOrder.deleteOne({ _id: saleOrder._id });

    await logDeletions(ownerId, 'expense', expenseIds);
    await logDeletion(ownerId, 'saleOrder', saleOrder._id);

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
