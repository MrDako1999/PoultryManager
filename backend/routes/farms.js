import express from 'express';
import Farm from '../models/Farm.js';
import Business from '../models/Business.js';
import { protect } from '../middleware/auth.js';
import { logDeletion } from '../middleware/deletionTracker.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

router.get('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { search, updatedSince } = req.query;

    const query = { user_id: ownerId };
    if (updatedSince) {
      query.updatedAt = { $gte: new Date(updatedSince) };
    } else {
      query.deletedAt = null;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { farmName: regex },
        { nickname: regex },
      ];
    }

    const farms = await Farm.find(query)
      .populate({
        path: 'business',
        select: 'companyName tradeLicenseNumber trnNumber',
        match: { deletedAt: null },
      })
      .sort({ createdAt: -1 });

    res.json(farms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const farm = await Farm.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null })
      .populate({
        path: 'business',
        match: { deletedAt: null },
        populate: [
          { path: 'logo' },
          { path: 'trnCertificate' },
          { path: 'tradeLicense' },
        ],
      })
      .populate('logo')
      .populate('otherDocs.media_id')
      .populate('createdBy', 'firstName lastName');

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.business === null && farm._doc.business) {
      farm.business = null;
      await Farm.updateOne({ _id: farm._id }, { $set: { business: null } });
    }

    res.json(farm);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      existingBusinessId,
      farmName,
      farmType,
      nickname,
      logo,
      tradeLicenseNumber,
      trnNumber,
      trnCertificate,
      tradeLicense,
      location,
      otherDocs,
      businessAddress,
    } = req.body;

    let businessId = null;

    if (existingBusinessId) {
      const existing = await Business.findOne({ _id: existingBusinessId, user_id: ownerId });
      if (!existing) {
        return res.status(404).json({ message: 'Business not found' });
      }
      businessId = existing._id;
    } else {
      const business = await Business.create({
        user_id: ownerId,
        createdBy: req.user._id,
        companyName: farmName,
        logo: logo || null,
        tradeLicenseNumber: tradeLicenseNumber || '',
        trnNumber: trnNumber || '',
        trnCertificate: trnCertificate || null,
        tradeLicense: tradeLicense || null,
        address: businessAddress || {},
      });
      businessId = business._id;
    }

    const farm = await Farm.create({
      user_id: ownerId,
      createdBy: req.user._id,
      business: businessId,
      farmName,
      farmType: farmType || 'broiler',
      nickname: nickname || '',
      logo: logo || null,
      location: location || {},
      otherDocs: otherDocs || [],
    });

    const populated = await Farm.findById(farm._id)
      .populate({
        path: 'business',
        select: 'companyName tradeLicenseNumber trnNumber',
        match: { deletedAt: null },
      });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const farm = await Farm.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    const {
      farmName,
      farmType,
      nickname,
      logo,
      business,
      tradeLicenseNumber,
      trnNumber,
      trnCertificate,
      tradeLicense,
      location,
      otherDocs,
    } = req.body;

    if (farmName !== undefined) farm.farmName = farmName;
    if (farmType !== undefined) farm.farmType = farmType;
    if (nickname !== undefined) farm.nickname = nickname;
    if (logo !== undefined) farm.logo = logo;
    if (business !== undefined) farm.business = business;
    if (location !== undefined) farm.location = location;
    if (otherDocs !== undefined) farm.otherDocs = otherDocs;

    await farm.save();

    if (farm.business) {
      const bizUpdate = {};
      if (farmName !== undefined) bizUpdate.companyName = farmName;
      if (tradeLicenseNumber !== undefined) bizUpdate.tradeLicenseNumber = tradeLicenseNumber;
      if (trnNumber !== undefined) bizUpdate.trnNumber = trnNumber;
      if (trnCertificate !== undefined) bizUpdate.trnCertificate = trnCertificate;
      if (tradeLicense !== undefined) bizUpdate.tradeLicense = tradeLicense;

      if (Object.keys(bizUpdate).length > 0) {
        await Business.findByIdAndUpdate(farm.business, bizUpdate);
      }
    }

    const populated = await Farm.findById(farm._id)
      .populate({
        path: 'business',
        match: { deletedAt: null },
        populate: [
          { path: 'logo' },
          { path: 'trnCertificate' },
          { path: 'tradeLicense' },
        ],
      })
      .populate('logo')
      .populate('otherDocs.media_id');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const farm = await Farm.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    farm.deletedAt = new Date();
    await farm.save();
    await logDeletion(ownerId, 'farm', farm._id);

    res.json({ message: 'Farm deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
