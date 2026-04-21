import express from 'express';
import Worker from '../models/Worker.js';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import { protect, requireOwner } from '../middleware/auth.js';
import { logDeletion } from '../middleware/deletionTracker.js';
import { inviteWorker, revokeAccess } from '../services/inviteService.js';

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
      .populate('linkedUser', 'firstName lastName email accountRole isActive deletedAt')
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
      .populate('linkedUser', 'firstName lastName email accountRole isActive')
      .populate('createdBy', 'firstName lastName');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/workers — HR-only worker (no app access). For invited
// users with login credentials, use POST /api/users instead, which
// runs the same inviteService with grantAppAccess: true.
router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { existingContactId, ...rest } = req.body;

    if (existingContactId) {
      // Legacy mode: caller already created a Contact and just wants
      // a Worker linked to it. Keep the old shape working.
      const existing = await Contact.findOne({ _id: existingContactId, user_id: ownerId });
      if (!existing) {
        return res.status(404).json({ message: 'Contact not found' });
      }
      const worker = await Worker.create({
        user_id: ownerId,
        createdBy: req.user._id,
        contact: existing._id,
        role: rest.role || 'labourer',
        firstName: rest.firstName,
        lastName: rest.lastName || '',
        phone: rest.phone || '',
        emiratesIdNumber: rest.emiratesIdNumber || '',
        emiratesIdExpiry: rest.emiratesIdExpiry || '',
        passportNumber: rest.passportNumber || '',
        passportCountry: rest.passportCountry || '',
        passportExpiry: rest.passportExpiry || '',
        compensation: rest.compensation ?? null,
        photo: rest.photo || null,
        eidFront: rest.eidFront || null,
        eidBack: rest.eidBack || null,
        visa: rest.visa || null,
        passportPage: rest.passportPage || null,
        otherDocs: Array.isArray(rest.otherDocs) ? rest.otherDocs : [],
        farmAssignments: Array.isArray(rest.farmAssignments) ? rest.farmAssignments : [],
      });
      return res.status(201).json(worker);
    }

    const result = await inviteWorker({
      ownerId,
      invitedBy: req.user._id,
      grantAppAccess: false,
      workerRole: rest.role,
      firstName: rest.firstName,
      lastName: rest.lastName,
      phone: rest.phone,
      photo: rest.photo,
      compensation: rest.compensation,
      emiratesIdNumber: rest.emiratesIdNumber,
      emiratesIdExpiry: rest.emiratesIdExpiry,
      passportNumber: rest.passportNumber,
      passportCountry: rest.passportCountry,
      passportExpiry: rest.passportExpiry,
      eidFront: rest.eidFront,
      eidBack: rest.eidBack,
      visa: rest.visa,
      passportPage: rest.passportPage,
      otherDocs: rest.otherDocs,
      farmAssignments: rest.farmAssignments,
    });

    res.status(201).json(result.worker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/workers/:id/grant-access — upgrade an existing HR worker
// into an invited user. Owner-only because it creates a sub-account.
router.post('/:id/grant-access', protect, requireOwner, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const existing = await Worker.findOne({
      _id: req.params.id,
      user_id: ownerId,
      deletedAt: null,
    });
    if (!existing) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    if (existing.linkedUser) {
      return res.status(400).json({ message: 'Worker already has app access' });
    }

    const { email, accountRole, permissions, farmAssignments } = req.body;

    const result = await inviteWorker({
      ownerId,
      invitedBy: req.user._id,
      grantAppAccess: true,
      existingWorkerId: existing._id,
      firstName: existing.firstName,
      lastName: existing.lastName,
      email,
      phone: existing.phone,
      accountRole,
      permissions,
      farmAssignments: Array.isArray(farmAssignments) ? farmAssignments : existing.farmAssignments,
    });

    res.status(200).json({
      worker: result.worker,
      user: result.user,
      tempPassword: result.tempPassword,
    });
  } catch (err) {
    if (err.code === 'EMAIL_IN_USE') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/workers/:id/revoke-access — set linked User isActive=false
// (deactivate, NOT soft-delete). Reversible: PUT /api/users/:id with
// { isActive: true } restores access.
router.delete('/:id/revoke-access', protect, requireOwner, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const result = await revokeAccess({ ownerId, workerId: req.params.id });
    res.json({
      message: result.alreadyRevoked ? 'Worker had no app access' : 'App access revoked',
      worker: result.worker,
      user: result.user,
    });
  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/workers/:id — update HR fields and farm scope. The mirror
// to the linked User's farmAssignments happens automatically here so
// scope changes apply on the worker's next /auth/me without a second
// client round-trip.
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
      compensation,
      photo,
      eidFront,
      eidBack,
      visa,
      passportPage,
      otherDocs,
      farmAssignments,
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
    if (compensation !== undefined) worker.compensation = compensation;
    if (photo !== undefined) worker.photo = photo;
    if (eidFront !== undefined) worker.eidFront = eidFront;
    if (eidBack !== undefined) worker.eidBack = eidBack;
    if (visa !== undefined) worker.visa = visa;
    if (passportPage !== undefined) worker.passportPage = passportPage;
    if (otherDocs !== undefined) worker.otherDocs = otherDocs;
    if (Array.isArray(farmAssignments)) worker.farmAssignments = farmAssignments;

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
      .populate('otherDocs.media_id')
      .populate('linkedUser', 'firstName lastName email accountRole isActive');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/workers/:id — soft-delete worker + linked contact.
// If the worker has a linked User, prefer DELETE /api/users/:id which
// cascades correctly. This endpoint deletes only HR-only workers.
router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const worker = await Worker.findOne({ _id: req.params.id, user_id: ownerId, deletedAt: null });

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    if (worker.linkedUser) {
      return res.status(400).json({
        message: 'This worker has app access. Use DELETE /api/users/:id to remove the team member (cascades worker + contact).',
      });
    }

    const now = new Date();
    worker.deletedAt = now;
    await worker.save();
    await logDeletion(ownerId, 'worker', worker._id);

    if (worker.contact) {
      await Contact.findByIdAndUpdate(worker.contact, { deletedAt: now });
      await logDeletion(ownerId, 'contact', worker.contact);
    }

    res.json({ message: 'Worker deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
