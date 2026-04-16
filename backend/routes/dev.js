import express from 'express';
import User from '../models/User.js';
import { sendTokenResponse } from './auth.js';

const router = express.Router();

router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
});

router.post('/login-as', async (req, res) => {
  try {
    const { userId, email } = req.body || {};
    let target = null;

    if (userId) {
      target = await User.findById(userId);
    } else if (email) {
      target = await User.findOne({ email: String(email).toLowerCase() });
    }

    if (!target) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    await sendTokenResponse(target, 200, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
