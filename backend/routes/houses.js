import express from 'express';
import House from '../models/House.js';
import Farm from '../models/Farm.js';
import Worker from '../models/Worker.js';
import { protect } from '../middleware/auth.js';
import { requireModule } from '../middleware/modules.js';
import { logDeletion } from '../middleware/deletionTracker.js';

const router = express.Router();

router.use(protect, requireModule('broiler'));

const getOwnerId = (user) => user.createdBy || user._id;

async function resolveGroundStaffHouses(user) {
  if (user.accountRole !== 'ground_staff') return null;
  const worker = await Worker.findOne({ linkedUser: user._id, deletedAt: null }).select('houseAssignments');
  return Array.isArray(worker?.houseAssignments) ? worker.houseAssignments : [];
}

router.get('/', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { farm, updatedSince } = req.query;

    const query = { user_id: ownerId };

    if (farm) {
      query.farm = farm;
    }

    if (updatedSince) {
      query.updatedAt = { $gte: new Date(updatedSince) };
    } else {
      query.deletedAt = null;
    }

    const scoped = await resolveGroundStaffHouses(req.user);
    if (scoped !== null) {
      if (scoped.length === 0) return res.json([]);
      query._id = { $in: scoped };
    }

    const houses = await House.find(query).sort({ sortOrder: 1, createdAt: 1 });
    res.json(houses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const house = await House.findOne({
      _id: req.params.id,
      user_id: ownerId,
      deletedAt: null,
    });

    if (!house) {
      return res.status(404).json({ message: 'House not found' });
    }

    res.json(house);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { farm: farmId, name, capacity, sortOrder } = req.body;

    if (!farmId || !name || capacity == null) {
      return res.status(400).json({ message: 'Farm, name, and capacity are required' });
    }

    const farm = await Farm.findOne({ _id: farmId, user_id: ownerId, deletedAt: null });
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    const house = await House.create({
      user_id: ownerId,
      createdBy: req.user._id,
      farm: farmId,
      name,
      capacity,
      sortOrder: sortOrder ?? 0,
    });

    res.status(201).json(house);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { farm: farmId, houses } = req.body;

    if (!farmId || !Array.isArray(houses) || houses.length === 0) {
      return res.status(400).json({ message: 'Farm and houses array are required' });
    }

    const farm = await Farm.findOne({ _id: farmId, user_id: ownerId, deletedAt: null });
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    const docs = houses.map((h, i) => ({
      user_id: ownerId,
      createdBy: req.user._id,
      farm: farmId,
      name: h.name,
      capacity: h.capacity,
      sortOrder: h.sortOrder ?? i,
    }));

    const created = await House.insertMany(docs);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const house = await House.findOne({
      _id: req.params.id,
      user_id: ownerId,
      deletedAt: null,
    });

    if (!house) {
      return res.status(404).json({ message: 'House not found' });
    }

    const { name, capacity, sortOrder, isActive } = req.body;

    if (name !== undefined) house.name = name;
    if (capacity !== undefined) house.capacity = capacity;
    if (sortOrder !== undefined) house.sortOrder = sortOrder;
    if (isActive !== undefined) house.isActive = isActive;

    await house.save();
    res.json(house);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const house = await House.findOne({
      _id: req.params.id,
      user_id: ownerId,
      deletedAt: null,
    });

    if (!house) {
      return res.status(404).json({ message: 'House not found' });
    }

    house.deletedAt = new Date();
    await house.save();
    await logDeletion(ownerId, 'house', house._id);

    res.json({ message: 'House deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
