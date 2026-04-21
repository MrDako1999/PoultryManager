import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  subscriptionStatus,
  billingBlockReason,
  effectiveActionsForUser,
} from '@poultrymanager/shared';
import { resolveModules } from './modules.js';

// Resolves the workspace owner for any authenticated user. For owners
// `req.user` IS the owner (req.workspaceOwner === req.user). For sub-users,
// loads the owner doc once (cached by mongoose hydration) so subscription
// state is always available without a second round-trip.
async function loadWorkspaceOwner(user) {
  if (!user) return null;
  if (!user.createdBy) return user;
  return User.findById(user.createdBy);
}

// Shared verifier used by both protect variants. Validates the JWT,
// loads the user, and rejects deactivated or soft-deleted accounts.
// Returns the user document on success or sends an error response.
async function verifyAndLoadUser(req, res) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ message: 'Not authorized — no token' });
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
    return null;
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    res.status(401).json({ message: 'User not found' });
    return null;
  }

  if (user.deletedAt) {
    res.status(401).json({ code: 'USER_DELETED', message: 'Account has been removed' });
    return null;
  }

  if (!user.isActive) {
    res.status(403).json({ code: 'USER_DEACTIVATED', message: 'Account is deactivated' });
    return null;
  }

  return user;
}

// Standard authentication. Verifies JWT, rejects deleted/deactivated
// accounts, resolves the workspace owner, and enforces the subscription
// gate. If the owner's subscription is anything other than 'active' or
// 'trialing', responds with 402 SUBSCRIPTION_INACTIVE — every route
// downstream is gated by this single check.
export const protect = async (req, res, next) => {
  try {
    const user = await verifyAndLoadUser(req, res);
    if (!user) return;

    req.user = user;

    const owner = await loadWorkspaceOwner(user);
    req.workspaceOwner = owner;

    if (subscriptionStatus(owner) === 'block') {
      return res.status(402).json({
        code: 'SUBSCRIPTION_INACTIVE',
        reason: billingBlockReason(owner),
        isOwner: !user.createdBy,
      });
    }

    // Resolve effective modules + cache effective actions on the user
    // so requirePermission and userCan don't re-walk the role/module
    // matrix on every check within the same request.
    const effectiveModules = await resolveModules(user);
    user.effectiveActions = effectiveActionsForUser(user, effectiveModules);
    req.effectiveModules = effectiveModules;

    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Same as `protect` but bypasses the subscription gate. Use for routes
// that MUST remain reachable while the workspace is blocked, so the
// client can still render the lock screen and the owner can pay:
//
//   - GET  /api/auth/me        (hydrate the lock screen)
//   - GET  /api/billing/*      (billing portal + checkout)
//   - POST /api/billing/*
//
// The webhook endpoint itself uses no auth at all.
export const protectBillingExempt = async (req, res, next) => {
  try {
    const user = await verifyAndLoadUser(req, res);
    if (!user) return;

    req.user = user;
    req.workspaceOwner = await loadWorkspaceOwner(user);
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized for this action' });
    }
    next();
  };
};

export const requireOwner = (req, res, next) => {
  if (req.user.accountRole !== 'owner') {
    return res.status(403).json({ message: 'Only account owners can perform this action' });
  }
  next();
};
