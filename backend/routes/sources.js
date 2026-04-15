import express from 'express';
import Source from '../models/Source.js';
import Batch from '../models/Batch.js';
import Expense from '../models/Expense.js';
import Business from '../models/Business.js';
import { protect } from '../middleware/auth.js';
import { logDeletion, logDeletions } from '../middleware/deletionTracker.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

async function buildExpenseDescription(source, businessName) {
  const qty = source.totalChicks || source.quantityPurchased || 0;
  const from = businessName || 'Unknown';
  return `Source: ${qty.toLocaleString()} chicks from ${from}`;
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

    const sources = await Source.find(query)
      .populate('sourceFrom', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id')
      .sort({ createdAt: -1 });

    res.json(sources);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const source = await Source.findOne({ _id: req.params.id, user_id: ownerId })
      .populate('sourceFrom', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id');

    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    res.json(source);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      batch: batchId,
      sourceFrom,
      invoiceType,
      taxInvoiceId,
      chicksRate,
      quantityPurchased,
      focPercentage,
      totalChicks,
      subtotal,
      vatAmount,
      grandTotal,
      invoiceDate,
      deliveryDate,
      taxInvoiceDocs,
      transferProofs,
      deliveryNoteDocs,
      otherDocs,
    } = req.body;

    if (!batchId) {
      return res.status(400).json({ message: 'Batch ID is required' });
    }

    const batchDoc = await Batch.findOne({ _id: batchId, user_id: ownerId });
    if (!batchDoc) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const source = await Source.create({
      user_id: ownerId,
      createdBy: req.user._id,
      batch: batchId,
      sourceFrom: sourceFrom || null,
      invoiceType: invoiceType || 'TAX_INVOICE',
      taxInvoiceId: taxInvoiceId || '',
      chicksRate: chicksRate || 0,
      quantityPurchased: quantityPurchased || 0,
      focPercentage: focPercentage || 0,
      totalChicks: totalChicks || 0,
      subtotal: subtotal || 0,
      vatAmount: vatAmount || 0,
      grandTotal: grandTotal || 0,
      invoiceDate: invoiceDate || null,
      deliveryDate: deliveryDate || null,
      taxInvoiceDocs: taxInvoiceDocs || [],
      transferProofs: transferProofs || [],
      deliveryNoteDocs: deliveryNoteDocs || [],
      otherDocs: otherDocs || [],
    });

    let businessName = '';
    if (sourceFrom) {
      const biz = await Business.findById(sourceFrom);
      businessName = biz?.companyName || '';
    }

    const description = await buildExpenseDescription(source, businessName);

    const expense = await Expense.create({
      user_id: ownerId,
      createdBy: req.user._id,
      batch: batchId,
      source: source._id,
      expenseDate: source.invoiceDate || new Date(),
      invoiceType: source.invoiceType || 'TAX_INVOICE',
      invoiceId: source.taxInvoiceId || '',
      category: 'SOURCE',
      description,
      tradingCompany: source.sourceFrom || null,
      grossAmount: source.subtotal || 0,
      taxableAmount: source.vatAmount || 0,
      totalAmount: source.grandTotal || 0,
      receipts: source.taxInvoiceDocs || [],
      transferProofs: source.transferProofs || [],
    });

    const populated = await Source.findById(source._id)
      .populate('sourceFrom', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id');

    res.status(201).json({ source: populated, expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const source = await Source.findOne({ _id: req.params.id, user_id: ownerId });

    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    const {
      sourceFrom,
      invoiceType,
      taxInvoiceId,
      chicksRate,
      quantityPurchased,
      focPercentage,
      totalChicks,
      subtotal,
      vatAmount,
      grandTotal,
      invoiceDate,
      deliveryDate,
      taxInvoiceDocs,
      transferProofs,
      deliveryNoteDocs,
      otherDocs,
    } = req.body;

    if (sourceFrom !== undefined) source.sourceFrom = sourceFrom || null;
    if (invoiceType !== undefined) source.invoiceType = invoiceType;
    if (taxInvoiceId !== undefined) source.taxInvoiceId = taxInvoiceId;
    if (chicksRate !== undefined) source.chicksRate = chicksRate;
    if (quantityPurchased !== undefined) source.quantityPurchased = quantityPurchased;
    if (focPercentage !== undefined) source.focPercentage = focPercentage;
    if (totalChicks !== undefined) source.totalChicks = totalChicks;
    if (subtotal !== undefined) source.subtotal = subtotal;
    if (vatAmount !== undefined) source.vatAmount = vatAmount;
    if (grandTotal !== undefined) source.grandTotal = grandTotal;
    if (invoiceDate !== undefined) source.invoiceDate = invoiceDate;
    if (deliveryDate !== undefined) source.deliveryDate = deliveryDate;
    if (taxInvoiceDocs !== undefined) source.taxInvoiceDocs = taxInvoiceDocs;
    if (transferProofs !== undefined) source.transferProofs = transferProofs;
    if (deliveryNoteDocs !== undefined) source.deliveryNoteDocs = deliveryNoteDocs;
    if (otherDocs !== undefined) source.otherDocs = otherDocs;

    await source.save();

    const expense = await Expense.findOne({ source: source._id });
    if (expense) {
      let businessName = '';
      if (source.sourceFrom) {
        const biz = await Business.findById(source.sourceFrom);
        businessName = biz?.companyName || '';
      }

      expense.expenseDate = source.invoiceDate || expense.expenseDate;
      expense.invoiceType = source.invoiceType || 'TAX_INVOICE';
      expense.invoiceId = source.taxInvoiceId || '';
      expense.tradingCompany = source.sourceFrom || null;
      expense.grossAmount = source.subtotal || 0;
      expense.taxableAmount = source.vatAmount || 0;
      expense.totalAmount = source.grandTotal || 0;
      expense.receipts = source.taxInvoiceDocs || [];
      expense.transferProofs = source.transferProofs || [];
      expense.description = await buildExpenseDescription(source, businessName);
      await expense.save();
    }

    const populated = await Source.findById(source._id)
      .populate('sourceFrom', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id');

    res.json({ source: populated, expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const source = await Source.findOne({ _id: req.params.id, user_id: ownerId });

    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    const expenseIds = await Expense.find({ source: source._id }).distinct('_id');

    await Expense.deleteMany({ source: source._id });
    await Source.deleteOne({ _id: source._id });

    await logDeletions(ownerId, 'expense', expenseIds);
    await logDeletion(ownerId, 'source', source._id);

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
