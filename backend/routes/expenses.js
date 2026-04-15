import express from 'express';
import Expense from '../models/Expense.js';
import Source from '../models/Source.js';
import FeedOrder from '../models/FeedOrder.js';
import FeedOrderItem from '../models/FeedOrderItem.js';
import SaleOrder from '../models/SaleOrder.js';
import Batch from '../models/Batch.js';
import { protect } from '../middleware/auth.js';
import { logDeletion, logDeletions } from '../middleware/deletionTracker.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

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

    const expenses = await Expense.find(query)
      .populate('tradingCompany', 'companyName')
      .populate('source')
      .populate('feedOrder')
      .populate('receipts')
      .populate('transferProofs')
      .populate('otherDocs.media_id')
      .sort({ createdAt: -1 });

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const expense = await Expense.findOne({ _id: req.params.id, user_id: ownerId })
      .populate('tradingCompany', 'companyName')
      .populate('source')
      .populate('feedOrder')
      .populate('receipts')
      .populate('transferProofs')
      .populate('otherDocs.media_id');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      batch: batchId,
      expenseDate,
      invoiceType,
      invoiceId,
      description,
      category,
      tradingCompany,
      grossAmount,
      taxableAmount,
      totalAmount,
      receipts,
      transferProofs,
      otherDocs,
    } = req.body;

    if (!batchId || !expenseDate) {
      return res.status(400).json({ message: 'Batch ID and expense date are required' });
    }

    const batchDoc = await Batch.findOne({ _id: batchId, user_id: ownerId });
    if (!batchDoc) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const expense = await Expense.create({
      user_id: ownerId,
      createdBy: req.user._id,
      batch: batchId,
      expenseDate,
      invoiceType: invoiceType || 'NO_INVOICE',
      invoiceId: invoiceId || '',
      description: description || '',
      category: category || 'OTHERS',
      tradingCompany: tradingCompany || null,
      grossAmount: grossAmount || 0,
      taxableAmount: taxableAmount || 0,
      totalAmount: totalAmount || 0,
      receipts: receipts || [],
      transferProofs: transferProofs || [],
      otherDocs: otherDocs || [],
    });

    const populated = await Expense.findById(expense._id)
      .populate('tradingCompany', 'companyName')
      .populate('receipts')
      .populate('transferProofs')
      .populate('otherDocs.media_id');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const expense = await Expense.findOne({ _id: req.params.id, user_id: ownerId });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.source) {
      return res.status(403).json({ message: 'This expense is linked to a source entry. Edit the source to update this expense.' });
    }

    if (expense.feedOrder) {
      return res.status(403).json({ message: 'This expense is linked to a feed order. Edit the feed order to update this expense.' });
    }

    if (expense.saleOrder) {
      return res.status(403).json({ message: 'This expense is linked to a sale order. Edit the sale order to update this expense.' });
    }

    const {
      expenseDate,
      invoiceType,
      invoiceId,
      description,
      category,
      tradingCompany,
      grossAmount,
      taxableAmount,
      totalAmount,
      receipts,
      transferProofs,
      otherDocs,
    } = req.body;

    if (expenseDate !== undefined) expense.expenseDate = expenseDate;
    if (invoiceType !== undefined) expense.invoiceType = invoiceType;
    if (invoiceId !== undefined) expense.invoiceId = invoiceId;
    if (description !== undefined) expense.description = description;
    if (category !== undefined) expense.category = category;
    if (tradingCompany !== undefined) expense.tradingCompany = tradingCompany || null;
    if (grossAmount !== undefined) expense.grossAmount = grossAmount;
    if (taxableAmount !== undefined) expense.taxableAmount = taxableAmount;
    if (totalAmount !== undefined) expense.totalAmount = totalAmount;
    if (receipts !== undefined) expense.receipts = receipts;
    if (transferProofs !== undefined) expense.transferProofs = transferProofs;
    if (otherDocs !== undefined) expense.otherDocs = otherDocs;

    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate('tradingCompany', 'companyName')
      .populate('source')
      .populate('feedOrder')
      .populate('receipts')
      .populate('transferProofs')
      .populate('otherDocs.media_id');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const expense = await Expense.findOne({ _id: req.params.id, user_id: ownerId });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.source) {
      await Source.deleteOne({ _id: expense.source });
      await logDeletion(ownerId, 'source', expense.source);
    }

    if (expense.feedOrder) {
      const foItemIds = await FeedOrderItem.find({ feedOrder: expense.feedOrder }).distinct('_id');
      await FeedOrderItem.deleteMany({ feedOrder: expense.feedOrder });
      await FeedOrder.deleteOne({ _id: expense.feedOrder });
      await logDeletions(ownerId, 'feedOrderItem', foItemIds);
      await logDeletion(ownerId, 'feedOrder', expense.feedOrder);
    }

    if (expense.saleOrder) {
      await SaleOrder.deleteOne({ _id: expense.saleOrder });
      await logDeletion(ownerId, 'saleOrder', expense.saleOrder);
    }

    await Expense.deleteOne({ _id: expense._id });
    await logDeletion(ownerId, 'expense', expense._id);

    res.json({ deleted: true, cascadedSaleOrder: !!expense.saleOrder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
