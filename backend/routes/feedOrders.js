import express from 'express';
import FeedOrder from '../models/FeedOrder.js';
import FeedOrderItem from '../models/FeedOrderItem.js';
import FeedItem from '../models/FeedItem.js';
import Expense from '../models/Expense.js';
import Batch from '../models/Batch.js';
import Business from '../models/Business.js';
import { protect } from '../middleware/auth.js';
import { requireModule } from '../middleware/modules.js';
import { logDeletion, logDeletions } from '../middleware/deletionTracker.js';

const router = express.Router();

router.use(protect, requireModule('broiler'));

const getOwnerId = (user) => user.createdBy || user._id;

function titleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildExpenseDescription(companyName, lineItems) {
  if (!lineItems || lineItems.length === 0) return 'Feed Order';
  const lines = lineItems.map((li) => {
    const type = (li.feedType || 'Feed').toLowerCase();
    return titleCase(`${li.bags || 0} bags ${type}`);
  });
  return lines.join(', ');
}

router.get('/', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { batch, updatedSince, syncAll } = req.query;

    if (!batch && !updatedSince && !syncAll) {
      return res.status(400).json({ message: 'Batch ID is required' });
    }

    const query = { user_id: ownerId };
    if (batch) query.batch = batch;
    if (updatedSince) query.updatedAt = { $gte: new Date(updatedSince) };

    const orders = await FeedOrder.find(query)
      .populate('feedCompany', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id')
      .sort({ createdAt: -1 });

    const orderIds = orders.map((o) => o._id);
    const allItems = await FeedOrderItem.find({ feedOrder: { $in: orderIds } })
      .populate('feedItem', 'feedDescription feedType')
      .sort({ createdAt: 1 });

    const itemsByOrder = {};
    allItems.forEach((item) => {
      const key = item.feedOrder.toString();
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push(item);
    });

    const result = orders.map((order) => ({
      ...order.toObject(),
      items: itemsByOrder[order._id.toString()] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const order = await FeedOrder.findOne({ _id: req.params.id, user_id: ownerId })
      .populate('feedCompany', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id');

    if (!order) {
      return res.status(404).json({ message: 'Feed order not found' });
    }

    const items = await FeedOrderItem.find({ feedOrder: order._id })
      .populate('feedItem', 'feedDescription feedType')
      .sort({ createdAt: 1 });

    res.json({ ...order.toObject(), items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      batch: batchId,
      feedCompany,
      taxInvoiceId,
      orderDate,
      deliveryDate,
      subtotal,
      deliveryCharge,
      vatAmount,
      grandTotal,
      items,
      taxInvoiceDocs,
      transferProofs,
      deliveryNoteDocs,
      otherDocs,
    } = req.body;

    if (!batchId || !feedCompany) {
      return res.status(400).json({ message: 'Batch ID and feed company are required' });
    }

    const batchDoc = await Batch.findOne({ _id: batchId, user_id: ownerId });
    if (!batchDoc) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const order = await FeedOrder.create({
      user_id: ownerId,
      createdBy: req.user._id,
      batch: batchId,
      feedCompany,
      taxInvoiceId: taxInvoiceId || '',
      orderDate: orderDate || null,
      deliveryDate: deliveryDate || null,
      subtotal: subtotal || 0,
      deliveryCharge: deliveryCharge || 0,
      vatAmount: vatAmount || 0,
      grandTotal: grandTotal || 0,
      taxInvoiceDocs: taxInvoiceDocs || [],
      transferProofs: transferProofs || [],
      deliveryNoteDocs: deliveryNoteDocs || [],
      otherDocs: otherDocs || [],
    });

    if (items && items.length > 0) {
      const itemDocs = items.map((item) => ({
        user_id: ownerId,
        feedOrder: order._id,
        feedItem: item.feedItem,
        feedType: item.feedType,
        feedDescription: item.feedDescription || '',
        pricePerBag: item.pricePerBag || 0,
        quantitySize: item.quantitySize || 50,
        quantityUnit: item.quantityUnit || 'KG',
        bags: item.bags || 0,
        subtotal: item.subtotal || 0,
        vatAmount: item.vatAmount || 0,
        lineTotal: item.lineTotal || 0,
      }));
      await FeedOrderItem.insertMany(itemDocs);
    }

    let companyName = '';
    if (feedCompany) {
      const biz = await Business.findById(feedCompany);
      companyName = biz?.companyName || '';
    }

    await Expense.create({
      user_id: ownerId,
      createdBy: req.user._id,
      batch: batchId,
      feedOrder: order._id,
      expenseDate: order.orderDate || new Date(),
      invoiceType: 'TAX_INVOICE',
      invoiceId: order.taxInvoiceId || '',
      category: 'FEED',
      description: buildExpenseDescription(companyName, items || []),
      tradingCompany: feedCompany || null,
      grossAmount: order.subtotal || 0,
      taxableAmount: order.vatAmount || 0,
      totalAmount: order.grandTotal || 0,
      receipts: order.taxInvoiceDocs || [],
      transferProofs: order.transferProofs || [],
    });

    const populated = await FeedOrder.findById(order._id)
      .populate('feedCompany', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id');

    const createdItems = await FeedOrderItem.find({ feedOrder: order._id })
      .populate('feedItem', 'feedDescription feedType')
      .sort({ createdAt: 1 });

    res.status(201).json({ ...populated.toObject(), items: createdItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const order = await FeedOrder.findOne({ _id: req.params.id, user_id: ownerId });

    if (!order) {
      return res.status(404).json({ message: 'Feed order not found' });
    }

    const {
      feedCompany,
      taxInvoiceId: updTaxInvoiceId,
      orderDate,
      deliveryDate,
      subtotal,
      deliveryCharge,
      vatAmount,
      grandTotal,
      items,
      taxInvoiceDocs,
      transferProofs,
      deliveryNoteDocs,
      otherDocs,
    } = req.body;

    if (feedCompany !== undefined) order.feedCompany = feedCompany;
    if (updTaxInvoiceId !== undefined) order.taxInvoiceId = updTaxInvoiceId;
    if (orderDate !== undefined) order.orderDate = orderDate;
    if (deliveryDate !== undefined) order.deliveryDate = deliveryDate;
    if (subtotal !== undefined) order.subtotal = subtotal;
    if (deliveryCharge !== undefined) order.deliveryCharge = deliveryCharge;
    if (vatAmount !== undefined) order.vatAmount = vatAmount;
    if (grandTotal !== undefined) order.grandTotal = grandTotal;
    if (taxInvoiceDocs !== undefined) order.taxInvoiceDocs = taxInvoiceDocs;
    if (transferProofs !== undefined) order.transferProofs = transferProofs;
    if (deliveryNoteDocs !== undefined) order.deliveryNoteDocs = deliveryNoteDocs;
    if (otherDocs !== undefined) order.otherDocs = otherDocs;

    await order.save();

    if (items !== undefined) {
      await FeedOrderItem.deleteMany({ feedOrder: order._id });
      if (items.length > 0) {
        const itemDocs = items.map((item) => ({
          user_id: ownerId,
          feedOrder: order._id,
          feedItem: item.feedItem,
          feedType: item.feedType,
          feedDescription: item.feedDescription || '',
          pricePerBag: item.pricePerBag || 0,
          quantitySize: item.quantitySize || 50,
          quantityUnit: item.quantityUnit || 'KG',
          bags: item.bags || 0,
          subtotal: item.subtotal || 0,
          vatAmount: item.vatAmount || 0,
          lineTotal: item.lineTotal || 0,
        }));
        await FeedOrderItem.insertMany(itemDocs);
      }
    }

    const expense = await Expense.findOne({ feedOrder: order._id });
    if (expense) {
      let companyName = '';
      if (order.feedCompany) {
        const biz = await Business.findById(order.feedCompany);
        companyName = biz?.companyName || '';
      }
      const currentItems = await FeedOrderItem.find({ feedOrder: order._id }).lean();

      expense.expenseDate = order.orderDate || expense.expenseDate;
      expense.invoiceId = order.taxInvoiceId || '';
      expense.tradingCompany = order.feedCompany || null;
      expense.grossAmount = order.subtotal || 0;
      expense.taxableAmount = order.vatAmount || 0;
      expense.totalAmount = order.grandTotal || 0;
      expense.receipts = order.taxInvoiceDocs || [];
      expense.transferProofs = order.transferProofs || [];
      expense.description = buildExpenseDescription(companyName, currentItems);
      await expense.save();
    }

    const populated = await FeedOrder.findById(order._id)
      .populate('feedCompany', 'companyName')
      .populate('taxInvoiceDocs')
      .populate('transferProofs')
      .populate('deliveryNoteDocs')
      .populate('otherDocs.media_id');

    const updatedItems = await FeedOrderItem.find({ feedOrder: order._id })
      .populate('feedItem', 'feedDescription feedType')
      .sort({ createdAt: 1 });

    res.json({ ...populated.toObject(), items: updatedItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const order = await FeedOrder.findOne({ _id: req.params.id, user_id: ownerId });

    if (!order) {
      return res.status(404).json({ message: 'Feed order not found' });
    }

    const foItemIds = await FeedOrderItem.find({ feedOrder: order._id }).distinct('_id');
    const expenseIds = await Expense.find({ feedOrder: order._id }).distinct('_id');

    await FeedOrderItem.deleteMany({ feedOrder: order._id });
    await Expense.deleteMany({ feedOrder: order._id });
    await FeedOrder.deleteOne({ _id: order._id });

    await logDeletions(ownerId, 'feedOrderItem', foItemIds);
    await logDeletions(ownerId, 'expense', expenseIds);
    await logDeletion(ownerId, 'feedOrder', order._id);

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
