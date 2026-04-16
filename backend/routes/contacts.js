import express from 'express';
import Contact from '../models/Contact.js';
import Business from '../models/Business.js';
import Worker from '../models/Worker.js';
import { protect } from '../middleware/auth.js';
import { logDeletion, logDeletions } from '../middleware/deletionTracker.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

// GET /api/contacts — list contacts (with optional search)
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
        { email: regex },
        { phone: regex },
      ];
    }

    const contacts = await Contact.find(query)
      .populate('businesses', 'companyName')
      .populate('photo', 'url')
      .sort({ createdAt: -1 });

    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/contacts/:id — single contact
router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const contact = await Contact.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null })
      .populate('businesses', 'companyName')
      .populate('photo')
      .populate('createdBy', 'firstName lastName');

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/contacts — create
router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { firstName, lastName, email, phone, jobTitle, notes, businesses, photo } = req.body;

    const contact = await Contact.create({
      user_id: ownerId,
      createdBy: req.user._id,
      firstName,
      lastName,
      email: email || '',
      phone: phone || '',
      jobTitle: jobTitle || '',
      notes: notes || '',
      photo: photo || null,
      businesses: businesses || [],
    });

    if (businesses?.length) {
      await Business.updateMany(
        { _id: { $in: businesses }, user_id: ownerId },
        { $addToSet: { contacts: contact._id } }
      );
    }

    const populated = await Contact.findById(contact._id)
      .populate('businesses', 'companyName')
      .populate('photo', 'url');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/contacts/:id — update
router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const contact = await Contact.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const { firstName, lastName, email, phone, jobTitle, notes, businesses, photo } = req.body;

    if (firstName !== undefined) contact.firstName = firstName;
    if (lastName !== undefined) contact.lastName = lastName;
    if (email !== undefined) contact.email = email;
    if (phone !== undefined) contact.phone = phone;
    if (jobTitle !== undefined) contact.jobTitle = jobTitle;
    if (notes !== undefined) contact.notes = notes;
    if (photo !== undefined) contact.photo = photo;

    if (businesses !== undefined) {
      const oldBusinessIds = contact.businesses.map((b) => b.toString());
      const newBusinessIds = businesses.map((b) => b.toString());

      const removed = oldBusinessIds.filter((id) => !newBusinessIds.includes(id));
      const added = newBusinessIds.filter((id) => !oldBusinessIds.includes(id));

      if (removed.length) {
        await Business.updateMany(
          { _id: { $in: removed }, user_id: ownerId },
          { $pull: { contacts: contact._id } }
        );
      }
      if (added.length) {
        await Business.updateMany(
          { _id: { $in: added }, user_id: ownerId },
          { $addToSet: { contacts: contact._id } }
        );
      }

      contact.businesses = businesses;
    }

    await contact.save();

    const populated = await Contact.findById(contact._id)
      .populate('businesses', 'companyName')
      .populate('photo', 'url');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/contacts/:id — soft-delete contact + linked workers
router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const contact = await Contact.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const now = new Date();
    contact.deletedAt = now;
    await contact.save();
    await logDeletion(ownerId, 'contact', contact._id);

    const cascadedWorkers = await Worker.find({
      contact: contact._id,
      user_id: ownerId,
      deletedAt: null,
    }).select('_id');

    if (cascadedWorkers.length > 0) {
      const ids = cascadedWorkers.map((w) => w._id);
      await Worker.updateMany(
        { _id: { $in: ids } },
        { deletedAt: now }
      );
      await logDeletions(ownerId, 'worker', ids);
    }

    res.json({ message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
