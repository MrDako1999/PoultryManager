import express from 'express';
import { protectBillingExempt, requireOwner } from '../middleware/auth.js';

/**
 * Placeholder billing routes. Returns 501 Not Implemented for every
 * endpoint until Stripe is integrated. The URL contract is locked so
 * the BillingLockScreen "Fix Billing" button has something to call
 * from day one — when Stripe lands we replace these handlers with
 * real implementations and the clients don't change.
 *
 * See SUBSCRIPTION.md §"Future Stripe integration checklist".
 *
 * IMPORTANT: every authenticated route here uses `protectBillingExempt`
 * so a workspace whose subscription is `block` can still load the
 * portal URL. Otherwise the user would be locked out of the very
 * mechanism they need to fix the lock.
 */

const router = express.Router();

// GET /api/billing/portal-url — returns a URL the owner can open in
// the system browser to manage their Stripe subscription. When Stripe
// is wired this calls billingPortal.sessions.create().
router.get('/portal-url', protectBillingExempt, requireOwner, (req, res) => {
  return res.status(501).json({
    code: 'BILLING_NOT_CONFIGURED',
    message: 'Billing portal is not yet available. Stripe integration pending.',
  });
});

// POST /api/billing/checkout — starts a new subscription via Stripe
// Checkout. Used during the post-registration onboarding flow.
router.post('/checkout', protectBillingExempt, requireOwner, (req, res) => {
  return res.status(501).json({
    code: 'BILLING_NOT_CONFIGURED',
    message: 'Checkout is not yet available. Stripe integration pending.',
  });
});

// POST /api/billing/webhook — Stripe calls this to push subscription
// state changes. NO auth (verified via Stripe signature header
// instead). Uses raw body parser when wired up.
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  return res.status(501).json({
    code: 'BILLING_NOT_CONFIGURED',
    message: 'Webhook handler not yet available. Stripe integration pending.',
  });
});

export default router;
