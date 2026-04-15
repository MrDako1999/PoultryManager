import express from 'express';
import DailyLog from '../models/DailyLog.js';
import Batch from '../models/Batch.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

function toUTCMidnight(d) {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

function computeCycleDay(batchStartDate, entryDate) {
  const start = toUTCMidnight(batchStartDate);
  const entry = toUTCMidnight(entryDate);
  return Math.floor((entry - start) / (1000 * 60 * 60 * 24)) + 1;
}

router.get('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { batch, house, logType, updatedSince, syncAll } = req.query;

    const query = { user_id: ownerId };

    if (batch) query.batch = batch;
    if (house) query.house = house;
    if (logType) query.logType = logType;

    if (updatedSince) {
      query.updatedAt = { $gte: new Date(updatedSince) };
    } else if (!syncAll) {
      query.deletedAt = null;
    }

    const logs = await DailyLog.find(query)
      .populate('house', 'name capacity')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ date: -1, logType: 1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const log = await DailyLog.findOne({ _id: req.params.id, user_id: ownerId })
      .populate('house', 'name capacity')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!log) {
      return res.status(404).json({ message: 'Daily log not found' });
    }

    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { batch: batchId, house, date, logType, ...fields } = req.body;

    if (!batchId || !house || !date || !logType) {
      return res.status(400).json({ message: 'Batch, house, date, and logType are required' });
    }

    const batch = await Batch.findOne({ _id: batchId, user_id: ownerId });
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const entryDate = toUTCMidnight(date);
    const startDate = toUTCMidnight(batch.startDate);

    if (entryDate < startDate) {
      return res.status(400).json({ message: 'Date cannot be before the batch start date' });
    }

    const cycleDay = computeCycleDay(batch.startDate, date);

    const existing = await DailyLog.findOne({
      user_id: ownerId,
      batch: batchId,
      house,
      date: entryDate,
      logType,
      deletedAt: null,
    });

    if (existing) {
      const allowedFields = [
        'deaths', 'feedKg', 'waterLiters',
        'averageWeight',
        'temperature', 'humidity', 'waterTDS', 'waterPH',
        'notes', 'photos',
      ];
      for (const f of allowedFields) {
        if (fields[f] !== undefined) existing[f] = fields[f];
      }
      existing.cycleDay = cycleDay;
      existing.updatedBy = req.user._id;
      await existing.save();

      const populated = await DailyLog.findById(existing._id)
        .populate('house', 'name capacity')
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');

      return res.json(populated);
    }

    const log = await DailyLog.create({
      user_id: ownerId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      batch: batchId,
      house,
      date: entryDate,
      cycleDay,
      logType,
      ...pickLogFields(logType, fields),
      notes: fields.notes || null,
      photos: Array.isArray(fields.photos) ? fields.photos : [],
    });

    const populated = await DailyLog.findById(log._id)
      .populate('house', 'name capacity')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An entry for this house, date, and log type already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const log = await DailyLog.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!log) {
      return res.status(404).json({ message: 'Daily log not found' });
    }

    const { date, deaths, feedKg, waterLiters, averageWeight, temperature, humidity, waterTDS, waterPH, notes, photos } = req.body;

    if (date !== undefined) {
      const batch = await Batch.findById(log.batch);
      const entryDate = toUTCMidnight(date);
      const startDate = toUTCMidnight(batch.startDate);

      if (entryDate < startDate) {
        return res.status(400).json({ message: 'Date cannot be before the batch start date' });
      }

      log.date = entryDate;
      log.cycleDay = computeCycleDay(batch.startDate, date);
    }

    if (deaths !== undefined) log.deaths = deaths;
    if (feedKg !== undefined) log.feedKg = feedKg;
    if (waterLiters !== undefined) log.waterLiters = waterLiters;
    if (averageWeight !== undefined) log.averageWeight = averageWeight;
    if (temperature !== undefined) log.temperature = temperature;
    if (humidity !== undefined) log.humidity = humidity;
    if (waterTDS !== undefined) log.waterTDS = waterTDS;
    if (waterPH !== undefined) log.waterPH = waterPH;
    if (notes !== undefined) log.notes = notes;
    if (photos !== undefined) log.photos = photos;

    log.updatedBy = req.user._id;
    await log.save();

    const populated = await DailyLog.findById(log._id)
      .populate('house', 'name capacity')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const log = await DailyLog.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!log) {
      return res.status(404).json({ message: 'Daily log not found' });
    }

    log.deletedAt = new Date();
    await log.save();

    res.json({ message: 'Daily log deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function pickLogFields(logType, fields) {
  switch (logType) {
    case 'DAILY':
      return {
        deaths: fields.deaths ?? null,
        feedKg: fields.feedKg ?? null,
        waterLiters: fields.waterLiters ?? null,
      };
    case 'WEIGHT':
      return {
        averageWeight: fields.averageWeight ?? null,
      };
    case 'ENVIRONMENT':
      return {
        temperature: fields.temperature ?? null,
        humidity: fields.humidity ?? null,
        waterTDS: fields.waterTDS ?? null,
        waterPH: fields.waterPH ?? null,
      };
    default:
      return {};
  }
}

export default router;
