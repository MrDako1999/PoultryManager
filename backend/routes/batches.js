import express from 'express';
import Batch from '../models/Batch.js';
import Farm from '../models/Farm.js';
import Source from '../models/Source.js';
import Expense from '../models/Expense.js';
import { protect } from '../middleware/auth.js';
import { requireModule } from '../middleware/modules.js';
import { logDeletion, logDeletions } from '../middleware/deletionTracker.js';

const router = express.Router();

router.use(protect, requireModule('broiler'));

const getOwnerId = (user) => user.createdBy || user._id;

function formatBatchDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

router.get('/', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { search, farm, updatedSince } = req.query;

    const query = { user_id: ownerId };

    if (farm) {
      query.farm = farm;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ batchName: regex }];
    }

    if (updatedSince) {
      query.updatedAt = { $gte: new Date(updatedSince) };
    }

    const batches = await Batch.find(query)
      .populate('farm', 'farmName nickname')
      .populate('houses.house', 'name capacity')
      .sort({ createdAt: -1 });

    const batchIds = batches.map((b) => b._id);
    const [sourceCounts, expenseCounts] = await Promise.all([
      Source.aggregate([
        { $match: { batch: { $in: batchIds } } },
        { $group: { _id: '$batch', count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { batch: { $in: batchIds } } },
        { $group: { _id: '$batch', count: { $sum: 1 } } },
      ]),
    ]);

    const sourceMap = Object.fromEntries(sourceCounts.map((s) => [s._id.toString(), s.count]));
    const expenseMap = Object.fromEntries(expenseCounts.map((e) => [e._id.toString(), e.count]));

    const result = batches.map((b) => ({
      ...b.toObject(),
      _sourcesCount: sourceMap[b._id.toString()] || 0,
      _expensesCount: expenseMap[b._id.toString()] || 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const batch = await Batch.findOne({ _id: req.params.id, user_id: ownerId })
      .populate('farm', 'farmName nickname')
      .populate('houses.house', 'name capacity')
      .populate('createdBy', 'firstName lastName');

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const [sourcesCount, expensesCount] = await Promise.all([
      Source.countDocuments({ batch: batch._id }),
      Expense.countDocuments({ batch: batch._id }),
    ]);

    res.json({
      ...batch.toObject(),
      _sourcesCount: sourcesCount,
      _expensesCount: expensesCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { farm: farmId, startDate, status, houses } = req.body;

    if (!farmId || !startDate) {
      return res.status(400).json({ message: 'Farm and start date are required' });
    }

    const farm = await Farm.findOne({ _id: farmId, user_id: ownerId, deletedAt: null });
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    const existingCount = await Batch.countDocuments({ user_id: ownerId, farm: farmId });
    const sequenceNumber = existingCount + 1;

    const nickname = farm.nickname || farm.farmName.substring(0, 8).toUpperCase();
    const dateStr = formatBatchDate(startDate);
    const batchName = `${nickname}-${dateStr}-B${sequenceNumber}`;

    const batch = await Batch.create({
      user_id: ownerId,
      createdBy: req.user._id,
      farm: farmId,
      startDate,
      sequenceNumber,
      batchName,
      status: status || 'NEW',
      houses: Array.isArray(houses) ? houses : [],
    });

    const populated = await Batch.findById(batch._id)
      .populate('farm', 'farmName nickname')
      .populate('houses.house', 'name capacity');

    res.status(201).json({ ...populated.toObject(), _sourcesCount: 0, _expensesCount: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const batch = await Batch.findOne({ _id: req.params.id, user_id: ownerId });

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const { status, startDate, houses } = req.body;

    if (status !== undefined) batch.status = status;
    if (houses !== undefined) batch.houses = houses;

    if (startDate !== undefined) {
      batch.startDate = startDate;
      const farm = await Farm.findById(batch.farm);
      const nickname = farm?.nickname || farm?.farmName?.substring(0, 8).toUpperCase() || '';
      const dateStr = formatBatchDate(startDate);
      batch.batchName = `${nickname}-${dateStr}-B${batch.sequenceNumber}`;
    }

    await batch.save();

    const populated = await Batch.findById(batch._id)
      .populate('farm', 'farmName nickname')
      .populate('houses.house', 'name capacity');

    const [sourcesCount, expensesCount] = await Promise.all([
      Source.countDocuments({ batch: batch._id }),
      Expense.countDocuments({ batch: batch._id }),
    ]);

    res.json({
      ...populated.toObject(),
      _sourcesCount: sourcesCount,
      _expensesCount: expensesCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const batch = await Batch.findOne({ _id: req.params.id, user_id: ownerId });

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const [sourcesCount, expensesCount, expenseIds, sourceIds] = await Promise.all([
      Source.countDocuments({ batch: batch._id }),
      Expense.countDocuments({ batch: batch._id }),
      Expense.find({ batch: batch._id }).distinct('_id'),
      Source.find({ batch: batch._id }).distinct('_id'),
    ]);

    await Promise.all([
      Expense.deleteMany({ batch: batch._id }),
      Source.deleteMany({ batch: batch._id }),
    ]);

    await Batch.deleteOne({ _id: batch._id });

    await Promise.all([
      logDeletions(ownerId, 'expense', expenseIds),
      logDeletions(ownerId, 'source', sourceIds),
      logDeletion(ownerId, 'batch', batch._id),
    ]);

    res.json({
      deleted: true,
      counts: { sources: sourcesCount, expenses: expensesCount },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
