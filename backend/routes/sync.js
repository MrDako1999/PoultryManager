import express from 'express';
import DeletionLog from '../models/DeletionLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

// GET /api/sync/status
router.get('/status', protect, (req, res) => {
  res.json({ serverTime: new Date().toISOString() });
});

// GET /api/sync/deletions?since=ISO_TIMESTAMP
router.get('/deletions', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { since } = req.query;

    if (!since) {
      return res.status(400).json({ message: 'since parameter is required' });
    }

    const sinceDate = new Date(since);
    const deletions = await DeletionLog.find({
      user_id: ownerId,
      deletedAt: { $gte: sinceDate },
    }).lean();

    const grouped = {};
    for (const d of deletions) {
      if (!grouped[d.entityType]) grouped[d.entityType] = [];
      grouped[d.entityType].push(d.entityId.toString());
    }

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
