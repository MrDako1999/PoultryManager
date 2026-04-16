import express from 'express';
import Transfer from '../models/Transfer.js';
import { protect } from '../middleware/auth.js';
import { generateTransferReceipt } from '../services/transferService.js';
import { logDeletion } from '../middleware/deletionTracker.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

router.get('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { business, updatedSince } = req.query;

    const query = { user_id: ownerId };
    if (business) query.business = business;
    if (updatedSince) {
      query.updatedAt = { $gte: new Date(updatedSince) };
    } else {
      query.deletedAt = null;
    }

    const transfers = await Transfer.find(query)
      .populate('business', 'companyName')
      .populate('transferProof')
      .populate('receiptDoc')
      .sort({ transferDate: -1 });

    res.json(transfers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const transfer = await Transfer.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null })
      .populate('business', 'companyName address trnNumber')
      .populate('transferProof')
      .populate('receiptDoc');

    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }

    res.json(transfer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      business,
      transferDate,
      amount,
      transferType,
      transferProof,
      notes,
    } = req.body;

    if (!business) {
      return res.status(400).json({ message: 'Business is required' });
    }

    const transfer = await Transfer.create({
      user_id: ownerId,
      createdBy: req.user._id,
      business,
      transferDate: transferDate || new Date(),
      amount: amount || 0,
      transferType: transferType || 'CASH',
      transferProof: transferProof || null,
      notes: notes || '',
    });

    try {
      const receiptMedia = await generateTransferReceipt(transfer._id, ownerId);
      transfer.receiptDoc = receiptMedia._id;
      await transfer.save();
    } catch (receiptErr) {
      console.error('Transfer receipt generation failed:', receiptErr.message);
    }

    const populated = await Transfer.findById(transfer._id)
      .populate('business', 'companyName')
      .populate('transferProof')
      .populate('receiptDoc');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const transfer = await Transfer.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }

    const {
      business,
      transferDate,
      amount,
      transferType,
      transferProof,
      notes,
    } = req.body;

    if (business !== undefined) transfer.business = business;
    if (transferDate !== undefined) transfer.transferDate = transferDate;
    if (amount !== undefined) transfer.amount = amount;
    if (transferType !== undefined) transfer.transferType = transferType;
    if (transferProof !== undefined) transfer.transferProof = transferProof;
    if (notes !== undefined) transfer.notes = notes;

    await transfer.save();

    try {
      const receiptMedia = await generateTransferReceipt(transfer._id, ownerId);
      transfer.receiptDoc = receiptMedia._id;
      await transfer.save();
    } catch (receiptErr) {
      console.error('Transfer receipt re-generation failed:', receiptErr.message);
    }

    const populated = await Transfer.findById(transfer._id)
      .populate('business', 'companyName')
      .populate('transferProof')
      .populate('receiptDoc');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const transfer = await Transfer.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }

    transfer.deletedAt = new Date();
    await logDeletion(ownerId, 'transfer', transfer._id);
    await transfer.save();

    res.json({ message: 'Transfer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/receipt', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const transfer = await Transfer.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }

    const receiptMedia = await generateTransferReceipt(transfer._id, ownerId);
    transfer.receiptDoc = receiptMedia._id;
    await transfer.save();

    const populated = await Transfer.findById(transfer._id)
      .populate('business', 'companyName')
      .populate('transferProof')
      .populate('receiptDoc');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
