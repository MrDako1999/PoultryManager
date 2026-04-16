# Data Ownership Invariants

This document codifies the multi-tenant data-ownership rules that every route, service, and migration in PoultryManager must follow. Breaking these invariants breaks sub-account access and data isolation.

---

## Invariant 1: `user_id` is always the OWNER id

Every document's `user_id` field holds the account OWNER's MongoDB `_id` — never the sub-account's id. A sub-account (e.g. a farm worker) is merely an actor performing operations within the owner's workspace.

### Why

- Lets a worker see/modify records belonging to their owner's account.
- Makes account-wide export, deletion, and analytics straightforward (single tenant filter).
- Matches the S3 storage layout (`{ownerId}/...`).

### The canonical resolver

```js
const getOwnerId = (user) => user.createdBy || user._id;
```

Used in every route file under `backend/routes/`. There is no exception.

---

## Invariant 2: `createdBy` tracks the acting sub-account

When a sub-account creates a record, the model's `createdBy` field stores THEIR id. This preserves an audit trail of who actually performed the operation while keeping `user_id` on the owner.

Example:
- Owner `O` hires worker `W` → `W.createdBy = O._id`
- Worker `W` uploads a photo → `Media.user_id = O._id`, `Media.createdBy = W._id`
- Worker `W` logs a daily entry → `DailyLog.user_id = O._id`, `DailyLog.createdBy = W._id`

---

## Invariant 3: Writes to `user_id` are server-only

Clients never send `user_id` in request bodies — or if they do, the server ignores it and always writes `getOwnerId(req.user)`. Never trust a client-supplied owner id.

---

## Invariant 4: All queries filter by owner id

Every backend route handler that reads records does:

```js
const ownerId = getOwnerId(req.user);
const docs = await Model.find({ user_id: ownerId, ...filters });
```

Soft-deleted records are additionally filtered with `deletedAt: null` on list/get routes.

---

## Invariant 5: S3 keys are prefixed with the owner id

Per [STORAGE.md](STORAGE.md), every S3 object key starts with `{ownerId}/...`. This enables:

- Per-account exports (zip everything under `{ownerId}/`)
- Account deletion (prefix delete)
- Ownership verification from the URL alone

Implementation: [backend/services/storageService.js](backend/services/storageService.js) `uploadFile({ userId: ownerId, ... })`.

---

## Invariant 6: Cascading soft-deletes share a timestamp

When deleting an entity causes cascade soft-deletes (e.g. Contact → linked Workers), all affected records use the **same** `deletedAt` timestamp. This lets a future "undo" or "restore" feature find and reverse the group atomically.

---

## Anti-patterns (do NOT do these)

- `user_id: req.user._id` — use `getOwnerId(req.user)` instead.
- `Media.find({ user_id: req.user._id })` — sub-accounts would see empty results.
- Storing `user_id` on a sub-document that also has a parent `user_id` — redundant and divergence-prone.
- Hard-deleting records when the model has `deletedAt` — breaks referential integrity and sync.

---

## Why these are written down

The invariants above are enforced by convention, not by TypeScript types or runtime guards. A single well-meaning "fix" that uses `req.user._id` instead of the owner id silently breaks multi-tenancy for every sub-account user of that route.

When in doubt, re-read this document before merging.
