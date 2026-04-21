/**
 * Subscription gate — single source of truth for whether a workspace
 * is allowed to use the app.
 *
 * The contract is intentionally binary: 'allow' or 'block'. There is
 * no read-only mode. When the owner's subscription is active or trialing,
 * the workspace works. Anything else (past_due, unpaid, canceled,
 * incomplete, paused) blocks the entire workspace — owner included.
 *
 * Today every owner defaults to status:'active' so this returns 'allow'
 * unconditionally. When Stripe is integrated, only the data flowing
 * into User.subscription changes; this function does not.
 *
 * See SUBSCRIPTION.md for the full design.
 */

export const ALLOWED_STATUSES = new Set(['active', 'trialing']);

export const BLOCK_REASONS = {
  noState: 'noState',
  paymentFailed: 'paymentFailed',
  canceled: 'canceled',
  incomplete: 'incomplete',
  paused: 'paused',
  unknown: 'unknown',
};

export function subscriptionStatus(owner) {
  if (!owner) return 'block';
  const status = owner?.subscription?.status;
  if (!status) return 'block';
  return ALLOWED_STATUSES.has(status) ? 'allow' : 'block';
}

export function billingBlockReason(owner) {
  const sub = owner?.subscription || {};
  if (!sub.status) return BLOCK_REASONS.noState;
  if (ALLOWED_STATUSES.has(sub.status)) return null;
  if (sub.status === 'canceled') return BLOCK_REASONS.canceled;
  if (sub.status === 'past_due' || sub.status === 'unpaid') return BLOCK_REASONS.paymentFailed;
  if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') return BLOCK_REASONS.incomplete;
  if (sub.status === 'paused') return BLOCK_REASONS.paused;
  return BLOCK_REASONS.unknown;
}

export function isSubscriptionAllowed(owner) {
  return subscriptionStatus(owner) === 'allow';
}
