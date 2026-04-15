import express from 'express';
import Worker from '../models/Worker.js';
import Contact from '../models/Contact.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

// GET /api/workers — list workers (with optional search)
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
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { emiratesIdNumber: regex },
        { passportNumber: regex },
      ];
    }

    const workers = await Worker.find(query)
      .populate({ path: 'contact', select: 'firstName lastName photo', populate: { path: 'photo', select: 'url' } })
      .populate('photo', 'url')
      .sort({ createdAt: -1 });

    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/workers/:id — single worker with populated media
router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const worker = await Worker.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null })
      .populate('contact', 'firstName lastName email')
      .populate('photo')
      .populate('eidFront')
      .populate('eidBack')
      .populate('visa')
      .populate('passportPage')
      .populate('otherDocs.media_id')
      .populate('createdBy', 'firstName lastName');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/workers — create worker, link existing contact or auto-create one
router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      existingContactId,
      role,
      firstName,
      lastName,
      phone,
      emiratesIdNumber,
      emiratesIdExpiry,
      passportNumber,
      passportCountry,
      passportExpiry,
      photo,
      eidFront,
      eidBack,
      visa,
      passportPage,
      otherDocs,
    } = req.body;

    let contactId;

    if (existingContactId) {
      const existing = await Contact.findOne({ _id: existingContactId, user_id: ownerId });
      if (!existing) {
        return res.status(404).json({ message: 'Contact not found' });
      }
      contactId = existing._id;
    } else {
      const contact = await Contact.create({
        user_id: ownerId,
        createdBy: req.user._id,
        firstName,
        lastName,
        phone: phone || '',
        jobTitle: 'Worker',
        photo: photo || null,
      });
      contactId = contact._id;
    }

    const worker = await Worker.create({
      user_id: ownerId,
      createdBy: req.user._id,
      contact: contactId,
      role: role || 'labourer',
      firstName,
      lastName,
      phone: phone || '',
      emiratesIdNumber: emiratesIdNumber || '',
      emiratesIdExpiry: emiratesIdExpiry || '',
      passportNumber: passportNumber || '',
      passportCountry: passportCountry || '',
      passportExpiry: passportExpiry || '',
      photo: photo || null,
      eidFront: eidFront || null,
      eidBack: eidBack || null,
      visa: visa || null,
      passportPage: passportPage || null,
      otherDocs: otherDocs || [],
    });

    res.status(201).json(worker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/workers/:id — update
router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const worker = await Worker.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const {
      role,
      firstName,
      lastName,
      phone,
      emiratesIdNumber,
      emiratesIdExpiry,
      passportNumber,
      passportCountry,
      passportExpiry,
      photo,
      eidFront,
      eidBack,
      visa,
      passportPage,
      otherDocs,
    } = req.body;

    if (role !== undefined) worker.role = role;
    if (firstName !== undefined) worker.firstName = firstName;
    if (lastName !== undefined) worker.lastName = lastName;
    if (phone !== undefined) worker.phone = phone;
    if (emiratesIdNumber !== undefined) worker.emiratesIdNumber = emiratesIdNumber;
    if (emiratesIdExpiry !== undefined) worker.emiratesIdExpiry = emiratesIdExpiry;
    if (passportNumber !== undefined) worker.passportNumber = passportNumber;
    if (passportCountry !== undefined) worker.passportCountry = passportCountry;
    if (passportExpiry !== undefined) worker.passportExpiry = passportExpiry;
    if (photo !== undefined) worker.photo = photo;
    if (eidFront !== undefined) worker.eidFront = eidFront;
    if (eidBack !== undefined) worker.eidBack = eidBack;
    if (visa !== undefined) worker.visa = visa;
    if (passportPage !== undefined) worker.passportPage = passportPage;
    if (otherDocs !== undefined) worker.otherDocs = otherDocs;

    await worker.save();

    if (worker.contact && (firstName !== undefined || lastName !== undefined || phone !== undefined)) {
      await Contact.findByIdAndUpdate(worker.contact, {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
      });
    }

    const populated = await Worker.findById(worker._id)
      .populate('photo')
      .populate('eidFront')
      .populate('eidBack')
      .populate('visa')
      .populate('passportPage')
      .populate('otherDocs.media_id');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/workers/:id — soft-delete worker + linked contact
router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const worker = await Worker.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const now = new Date();
    worker.deletedAt = now;
    await worker.save();

    if (worker.contact) {
      await Contact.findByIdAndUpdate(worker.contact, { deletedAt: now });
    }

    res.json({ message: 'Worker deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
