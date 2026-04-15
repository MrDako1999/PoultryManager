import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Business from '../models/Business.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.status(statusCode).json({ user, token });
};

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, companyName, email, password, phone, modules } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      firstName,
      lastName,
      companyName,
      email,
      password,
      phone,
      modules: modules || [],
    });

    const business = await Business.create({
      user_id: user._id,
      createdBy: user._id,
      companyName: companyName || `${firstName}'s Business`,
      isAccountBusiness: true,
    });

    user.accountBusiness = business._id;
    await user.save();

    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.json({ message: 'Logged out' });
});

router.get('/me', protect, async (req, res) => {
  const user = req.user;

  if (user.accountRole === 'owner' && !user.accountBusiness) {
    const business = await Business.create({
      user_id: user._id,
      createdBy: user._id,
      companyName: user.companyName || `${user.firstName}'s Business`,
      isAccountBusiness: true,
    });
    user.accountBusiness = business._id;
    await user.save();
  }

  res.json(user);
});

export default router;
