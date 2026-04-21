import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Business from '../models/Business.js';
import { protectBillingExempt } from '../middleware/auth.js';
import { resolveModules } from '../middleware/modules.js';
import {
  actionsForRole,
  subscriptionStatus,
  billingBlockReason,
  MODULE_CAPABILITIES,
} from '@poultrymanager/shared';
import { getAssignedFarmIds, getAssignedHouseIds } from '../services/workerScope.js';

const router = express.Router();

async function buildAuthPayload(user) {
  const ownerId = user.createdBy || user._id;
  const isOwner = String(user._id) === String(ownerId);

  let owner = user;
  if (!isOwner) {
    owner = await User.findById(ownerId).select(
      'firstName lastName accountBusiness modules country vatRate currency invoiceLanguage moduleSettings companyName subscription'
    );
  }

  const modules = await resolveModules(user);

  const explicitAllow = Array.isArray(user.permissions?.allow) ? user.permissions.allow : [];
  const explicitDeny = Array.isArray(user.permissions?.deny) ? user.permissions.deny : [];
  const roleDefaults = actionsForRole(user.accountRole);

  // Per-module role capability matrix for the modules this user can see.
  // Clients use this to render the role-aware UI (button enable/disable,
  // PermissionEditor checkbox grid) without their own copy of the matrix.
  const moduleCapabilities = {};
  for (const moduleId of modules) {
    const map = MODULE_CAPABILITIES[moduleId];
    if (map && Array.isArray(map[user.accountRole])) {
      moduleCapabilities[moduleId] = map[user.accountRole];
    }
  }

  // Data scope. Farm-level only for this iteration (see WORKERS.md).
  // assignedFarmIds drives the scope picker / summary; assignedHouseIds
  // is the derived union (farms -> houses, plus any legacy explicit
  // house picks) that house-keyed list filters consume client-side.
  const [assignedFarmIds, assignedHouseIds] = await Promise.all([
    getAssignedFarmIds(user),
    getAssignedHouseIds(user),
  ]);

  // Subscription state. Always sourced from the OWNER doc; sub-users
  // inherit their owner's status. See SUBSCRIPTION.md.
  const subscriptionPolicy = subscriptionStatus(owner);
  const subscriptionPayload = {
    status: owner?.subscription?.status || 'active',
    policy: subscriptionPolicy,
    reason: billingBlockReason(owner),
    currentPeriodEnd: owner?.subscription?.currentPeriodEnd || null,
    verifiedAt: new Date().toISOString(),
  };

  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    companyName: user.companyName,
    accountRole: user.accountRole,
    modules,
    moduleCapabilities,
    permissions: {
      allow: explicitAllow,
      deny: explicitDeny,
      defaults: roleDefaults,
    },
    scope: {
      isOwner,
      assignedFarmIds,
      assignedHouseIds,
    },
    workspace: {
      ownerId,
      ownerName: owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() : '',
      ownerBusiness: owner?.accountBusiness || null,
      isOwner,
      subscription: subscriptionPayload,
    },
    accountBusiness: user.accountBusiness,
    country: owner?.country ?? user.country ?? null,
    vatRate: owner?.vatRate ?? user.vatRate ?? null,
    currency: owner?.currency ?? user.currency ?? null,
    invoiceLanguage: owner?.invoiceLanguage ?? user.invoiceLanguage ?? 'en',
    moduleSettings: owner?.moduleSettings ?? user.moduleSettings ?? {},
    mustChangePassword: !!user.mustChangePassword,
    isActive: user.isActive,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const sendTokenResponse = async (user, statusCode, res) => {
  const token = generateToken(user._id);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  const payload = await buildAuthPayload(user);
  res.status(statusCode).json({ user: payload, token });
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

    await sendTokenResponse(user, 201, res);
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

    if (user.deletedAt) {
      return res.status(401).json({ code: 'USER_DELETED', message: 'Account has been removed' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    await sendTokenResponse(user, 200, res);
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

// /auth/me uses protectBillingExempt so a workspace whose subscription
// is blocked can still hydrate the BillingLockScreen and let the owner
// open the billing portal. Every other route uses standard `protect`
// which 402s out the moment subscription is non-active.
router.get('/me', protectBillingExempt, async (req, res) => {
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

  const payload = await buildAuthPayload(user);
  res.json(payload);
});

export { sendTokenResponse, buildAuthPayload };

export default router;
