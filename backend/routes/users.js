import express from 'express';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import Business from '../models/Business.js';
import { protect, requireOwner } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, requireOwner, async (req, res) => {
  try {
    const users = await User.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, requireOwner, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, requireOwner, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, accountRole, permissions } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    if (accountRole === 'owner') {
      return res.status(400).json({ message: 'Cannot create another owner' });
    }

    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone: phone || '',
      password: tempPassword,
      companyName: req.user.companyName,
      modules: req.user.modules,
      accountRole: accountRole || 'viewer',
      permissions: permissions || {},
      createdBy: req.user._id,
    });

    const ownerId = req.user.createdBy || req.user._id;
    const owner = ownerId === req.user._id.toString()
      ? req.user
      : await User.findById(ownerId);

    const accountBizId = owner?.accountBusiness || null;
    const contact = await Contact.create({
      user_id: ownerId,
      createdBy: req.user._id,
      firstName,
      lastName,
      email: email || '',
      phone: phone || '',
      jobTitle: accountRole ? accountRole.replace('_', ' ') : '',
      linkedUser: user._id,
      businesses: accountBizId ? [accountBizId] : [],
    });

    if (accountBizId) {
      await Business.findByIdAndUpdate(accountBizId, {
        $addToSet: { contacts: contact._id },
      });
    }

    res.status(201).json({ user, tempPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, requireOwner, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { firstName, lastName, phone, accountRole, permissions, isActive } = req.body;

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
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    user.password = tempPassword;
    await user.save();

    res.json({ message: 'Password reset successfully', tempPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, requireOwner, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await Contact.findOneAndDelete({ linkedUser: user._id });
    await User.findByIdAndDelete(user._id);
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
