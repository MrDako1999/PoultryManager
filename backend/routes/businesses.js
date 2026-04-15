import express from 'express';
import Business from '../models/Business.js';
import Farm from '../models/Farm.js';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { generateStatement } from '../services/statementService.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

// GET /api/businesses — list businesses (with optional search)
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
        { companyName: regex },
        { tradeLicenseNumber: regex },
        { trnNumber: regex },
      ];
    }

    const businesses = await Business.find(query)
      .populate('contacts', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(businesses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/businesses/:id — single business
router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const business = await Business.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null })
      .populate('contacts', 'firstName lastName email phone')
      .populate('logo')
      .populate('trnCertificate')
      .populate('tradeLicense')
      .populate('otherDocs.media_id')
      .populate('createdBy', 'firstName lastName');

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json(business);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/businesses — create
router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      companyName,
      logo,
      tradeLicenseNumber,
      trnNumber,
      trnCertificate,
      tradeLicense,
      address,
      otherDocs,
      contacts,
      businessType,
    } = req.body;

    const business = await Business.create({
      user_id: ownerId,
      createdBy: req.user._id,
      companyName,
      logo: logo || null,
      tradeLicenseNumber: tradeLicenseNumber || '',
      trnNumber: trnNumber || '',
      trnCertificate: trnCertificate || null,
      tradeLicense: tradeLicense || null,
      address: address || {},
      otherDocs: otherDocs || [],
      contacts: contacts || [],
      businessType: businessType || 'TRADER',
    });

    if (contacts?.length) {
      await Contact.updateMany(
        { _id: { $in: contacts }, user_id: ownerId },
        { $addToSet: { businesses: business._id } }
      );
    }

    const populated = await Business.findById(business._id)
      .populate('contacts', 'firstName lastName email');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/businesses/:id — update
router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const business = await Business.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const {
      companyName,
      logo,
      tradeLicenseNumber,
      trnNumber,
      trnCertificate,
      tradeLicense,
      address,
      otherDocs,
      contacts,
      businessType,
    } = req.body;

    if (companyName !== undefined) {
      business.companyName = companyName;
      if (business.isAccountBusiness) {
        await User.findByIdAndUpdate(ownerId, { companyName });
      }
    }
    if (logo !== undefined) business.logo = logo;
    if (tradeLicenseNumber !== undefined) business.tradeLicenseNumber = tradeLicenseNumber;
    if (trnNumber !== undefined) business.trnNumber = trnNumber;
    if (trnCertificate !== undefined) business.trnCertificate = trnCertificate;
    if (tradeLicense !== undefined) business.tradeLicense = tradeLicense;
    if (address !== undefined) business.address = address;
    if (otherDocs !== undefined) business.otherDocs = otherDocs;
    if (businessType !== undefined) business.businessType = businessType;

    if (contacts !== undefined) {
      const oldContactIds = business.contacts.map((c) => c.toString());
      const newContactIds = contacts.map((c) => c.toString());

      const removed = oldContactIds.filter((id) => !newContactIds.includes(id));
      const added = newContactIds.filter((id) => !oldContactIds.includes(id));

      if (removed.length) {
        await Contact.updateMany(
          { _id: { $in: removed }, user_id: ownerId },
          { $pull: { businesses: business._id } }
        );
      }
      if (added.length) {
        await Contact.updateMany(
          { _id: { $in: added }, user_id: ownerId },
          { $addToSet: { businesses: business._id } }
        );
      }

      business.contacts = contacts;
    }

    await business.save();

    const populated = await Business.findById(business._id)
      .populate('contacts', 'firstName lastName email')
      .populate('logo')
      .populate('trnCertificate')
      .populate('tradeLicense')
      .populate('otherDocs.media_id');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/businesses/:id — soft-delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const business = await Business.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (business.isAccountBusiness) {
      return res.status(403).json({ message: 'Cannot delete your account business' });
    }

    business.deletedAt = new Date();
    await business.save();

    await Farm.updateMany(
      { business: business._id, deletedAt: null },
      { $set: { business: null } }
    );

    res.json({ message: 'Business deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/businesses/:id/statement — generate statement of account PDF
router.post('/:id/statement', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const business = await Business.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const { dateFrom, dateTo } = req.body;
    const media = await generateStatement(business._id, ownerId, dateFrom, dateTo);
    res.json(media);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
