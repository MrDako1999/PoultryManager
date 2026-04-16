import express from 'express';
import User from '../models/User.js';
import Business from '../models/Business.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.put('/profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/business', protect, async (req, res) => {
  try {
    const ownerId = req.user.createdBy || req.user._id;
    const owner = ownerId.toString() === req.user._id.toString()
      ? req.user
      : await User.findById(ownerId);

    if (!owner?.accountBusiness) {
      return res.json(null);
    }

    const business = await Business.findById(owner.accountBusiness)
      .populate('logo')
      .populate('trnCertificate')
      .populate('tradeLicense');

    res.json(business);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/business', protect, async (req, res) => {
  try {
    const isOwner = req.user.accountRole === 'owner' || !req.user.createdBy;
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the account owner can edit business info' });
    }

    const user = await User.findById(req.user._id);
    if (!user?.accountBusiness) {
      return res.status(404).json({ message: 'No account business found' });
    }

    const business = await Business.findById(user.accountBusiness);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const { companyName, logo, tradeLicenseNumber, trnNumber, trnCertificate, tradeLicense, address } = req.body;

    if (companyName !== undefined) {
      business.companyName = companyName;
      user.companyName = companyName;
      await user.save();
    }
    if (logo !== undefined) business.logo = logo;
    if (tradeLicenseNumber !== undefined) business.tradeLicenseNumber = tradeLicenseNumber;
    if (trnNumber !== undefined) business.trnNumber = trnNumber;
    if (trnCertificate !== undefined) business.trnCertificate = trnCertificate;
    if (tradeLicense !== undefined) business.tradeLicense = tradeLicense;
    if (address !== undefined) business.address = address;

    await business.save();

    const populated = await Business.findById(business._id)
      .populate('logo')
      .populate('trnCertificate')
      .populate('tradeLicense');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/accounting', protect, async (req, res) => {
  try {
    const ownerId = req.user.createdBy || req.user._id;
    const owner = ownerId.toString() === req.user._id.toString()
      ? req.user
      : await User.findById(ownerId);

    res.json({
      country: owner?.country || null,
      vatRate: owner?.vatRate != null ? owner.vatRate : null,
      currency: owner?.currency || null,
      invoiceLanguage: owner?.invoiceLanguage || 'en',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/accounting', protect, async (req, res) => {
  try {
    const isOwner = req.user.accountRole === 'owner' || !req.user.createdBy;
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the account owner can edit accounting settings' });
    }

    const { country, vatRate, currency, invoiceLanguage } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (country !== undefined) user.country = country;
    if (vatRate !== undefined) user.vatRate = vatRate;
    if (currency !== undefined) user.currency = currency;
    if (invoiceLanguage !== undefined) user.invoiceLanguage = invoiceLanguage;

    await user.save();

    res.json({ country: user.country, vatRate: user.vatRate, currency: user.currency, invoiceLanguage: user.invoiceLanguage });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const DEFAULT_BROILER_SALE_DEFAULTS = () => ({
  portionRates: {
    LIVER: 0, GIZZARD: 0, HEART: 0, BREAST: 0,
    LEG: 0, WING: 0, BONE: 0, THIGH: 0,
    DRUMSTICK: 0, BONELESS_THIGH: 0, NECK: 0, MINCE: 0,
  },
  transportRatePerTruck: 0,
});

function getModuleSettings(user, moduleId) {
  const block = user?.moduleSettings?.[moduleId] || {};
  return block;
}

router.get('/sale-defaults', protect, async (req, res) => {
  try {
    const ownerId = req.user.createdBy || req.user._id;
    const owner = ownerId.toString() === req.user._id.toString()
      ? req.user
      : await User.findById(ownerId);

    const moduleId = (req.query.module || 'broiler').toString();
    const moduleBlock = getModuleSettings(owner, moduleId);
    const defaults = moduleBlock.saleDefaults || DEFAULT_BROILER_SALE_DEFAULTS();
    const portionRates = defaults.portionRates || {};

    res.json({
      portionRates,
      transportRatePerTruck: defaults.transportRatePerTruck ?? 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/sale-defaults', protect, async (req, res) => {
  try {
    const isOwner = req.user.accountRole === 'owner' || !req.user.createdBy;
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the account owner can edit sale defaults' });
    }

    const moduleId = (req.query.module || 'broiler').toString();
    const { portionRates, transportRatePerTruck } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.moduleSettings) user.moduleSettings = {};
    if (!user.moduleSettings[moduleId]) user.moduleSettings[moduleId] = {};
    if (!user.moduleSettings[moduleId].saleDefaults) {
      user.moduleSettings[moduleId].saleDefaults = DEFAULT_BROILER_SALE_DEFAULTS();
    }

    const block = user.moduleSettings[moduleId].saleDefaults;
    if (portionRates !== undefined) block.portionRates = portionRates;
    if (transportRatePerTruck !== undefined) block.transportRatePerTruck = transportRatePerTruck;

    user.markModified('moduleSettings');
    await user.save();

    res.json({
      portionRates: block.portionRates || {},
      transportRatePerTruck: block.transportRatePerTruck ?? 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
