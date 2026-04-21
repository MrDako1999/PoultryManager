import express from 'express';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import Worker from '../models/Worker.js';
import { protect, requireOwner } from '../middleware/auth.js';
import { sendCredentials } from '../services/emailService.js';
import { inviteWorker, softDeleteUser } from '../services/inviteService.js';
import { logDeletion } from '../middleware/deletionTracker.js';

const router = express.Router();

// GET /api/users — list sub-accounts of the current owner.
// By default hides soft-deleted members; pass ?includeDeleted=true for
// the audit view (read-only — removed members can't be edited from UI).
router.get('/', protect, requireOwner, async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const filter = { createdBy: req.user._id };
    if (!includeDeleted) filter.deletedAt = null;
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, requireOwner, async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const filter = { _id: req.params.id, createdBy: req.user._id };
    if (!includeDeleted) filter.deletedAt = null;
    const user = await User.findOne(filter);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users — invite a sub-account with app access. Thin wrapper
// over the shared inviteService so the same logic powers /api/workers
// (HR-only) and the eventual /api/workers/:id/grant-access (upgrade).
router.post('/', protect, requireOwner, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      photo,
      accountRole,
      permissions,
      farmAssignments,
      // legacy alias from older mobile clients
      houseAssignments: _legacyHouseAssignments,
    } = req.body;

    const result = await inviteWorker({
      ownerId: req.user._id,
      invitedBy: req.user._id,
      firstName,
      lastName,
      email,
      phone,
      photo,
      grantAppAccess: true,
      accountRole,
      permissions,
      farmAssignments,
    });

    res.status(201).json({ user: result.user, tempPassword: result.tempPassword });
  } catch (err) {
    if (err.code === 'EMAIL_IN_USE') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, requireOwner, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      deletedAt: null,
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      firstName,
      lastName,
      phone,
      accountRole,
      permissions,
      isActive,
      farmAssignments,
    } = req.body;

    if (accountRole === 'owner') {
      return res.status(400).json({ message: 'Cannot promote to owner' });
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (accountRole !== undefined) user.accountRole = accountRole;
    if (permissions !== undefined) user.permissions = permissions;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    if (Array.isArray(farmAssignments)) {
      await Worker.findOneAndUpdate(
        { linkedUser: user._id, user_id: req.user._id, deletedAt: null },
        { farmAssignments }
      );
    }

    const contactUpdate = {};
    if (firstName !== undefined) contactUpdate.firstName = firstName;
    if (lastName !== undefined) contactUpdate.lastName = lastName;
    if (phone !== undefined) contactUpdate.phone = phone;
    if (accountRole !== undefined) contactUpdate.jobTitle = accountRole.replace('_', ' ');
    if (Object.keys(contactUpdate).length > 0) {
      await Contact.findOneAndUpdate({ linkedUser: user._id }, contactUpdate);
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/reset-password', protect, requireOwner, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      deletedAt: null,
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    user.password = tempPassword;
    user.mustChangePassword = true;
    await user.save();

    try {
      await sendCredentials(user, tempPassword, {
        ownerName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email,
      });
    } catch (err) {
      console.warn('[users] sendCredentials failed on reset:', err?.message);
    }

    res.json({ message: 'Password reset successfully', tempPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id — soft-delete with cascading timestamps.
//
// IMPORTANT: never hard-delete. Sub-users author records (DailyLog,
// Media, etc.) and removing them would break those references and lose
// audit history. See WORKERS.md and DATA_OWNERSHIP.md Invariant 6.
router.delete('/:id', protect, requireOwner, async (req, res) => {
  try {
    const result = await softDeleteUser({
      ownerId: req.user._id,
      userId: req.params.id,
      logDeletion,
    });
    res.json({
      message: 'User removed',
      cascaded: result.deletions.length,
    });
  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: err.message });
  }
});

export default router;
