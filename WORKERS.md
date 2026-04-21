# Workers & Team Access

This document codifies how team members are modelled, invited, scoped,
and removed across PoultryManager. The invariants here are enforced
by convention — every change to user/worker code must preserve them.

Related docs:
- [PERMISSIONS.md](PERMISSIONS.md) — capability grammar.
- [DATA_OWNERSHIP.md](DATA_OWNERSHIP.md) — multi-tenant invariants.
- [SUBSCRIPTION.md](SUBSCRIPTION.md) — billing gate (owner subscription
  cascades to every sub-user).

---

## Conceptual model

Three orthogonal entities, each with one job:

| Entity | Purpose | Lifecycle |
|---|---|---|
| **`Worker`** | HR record. Salary, EID, passport, photo, role title. May exist for someone who never logs in. | Created by owner/manager. Soft-deleted. |
| **`User` (sub-account)** | Login credential + capability bag. `accountRole` + `permissions.allow/deny`. | Created when an owner *invites* a worker to the app. |
| **Assignment** | Scope object joining a User (via the linked Worker) to farms. | Lives on the Worker as `farmAssignments[]`. |

The four orthogonal axes that determine what a sub-user can do:

| Axis | Bound to | Where it lives | Example |
|---|---|---|---|
| **Modules** | Owner subscription | Inherited from `owner.modules[]` at read time | If owner has `[broiler, eggProduction]`, every sub-user can potentially access both |
| **Role** | The user | `User.accountRole` | `manager`, `veterinarian`, `accountant`, `ground_staff`, `viewer` |
| **Scope** | The user (via Worker) | `Worker.farmAssignments[]` | "Only farms A and B" |
| **Permission overrides** | The user | `User.permissions.allow[]`, `User.permissions.deny[]` | Add `saleOrder:create` to a viewer; deny `expense:delete` to a manager |

---

## Invariants

These must hold across every backend route, mobile screen, and web
component that touches users or workers.

### 1. Worker ≠ User

A `Worker` may have zero or one linked `User` (`Worker.linkedUser`).
A `User` may have at most one Worker per owner. Never the reverse.

The two flows the owner sees:
- **Add Worker** (HR-only) → `POST /api/workers` with `grantAppAccess: false`.
- **Add User** (with app access) → `POST /api/users`, which calls the
  same `inviteWorker` service with `grantAppAccess: true`. Both wrap
  [backend/services/inviteService.js](backend/services/inviteService.js).

### 2. Modules are owned by the owner

Sub-accounts inherit their effective module list from
`owner.modules[]` at every `/auth/me` call (live, not snapshotted).
Sub-users cannot drop or add modules — that's a billing decision.

Implementation: `resolveModules(user)` in
[backend/middleware/modules.js](backend/middleware/modules.js).

### 3. `Worker.farmAssignments` is the only data-scope mechanism

For now, scope is **farm-level only**. House-level scoping is deferred
— it added too much UX complexity for the first cut.

The legacy `Worker.houseAssignments` field is retained on the schema
for backward compatibility with workers seeded before farm-level
scoping. New flows do not write to it. The scope helper unions both:

- [backend/services/workerScope.js](backend/services/workerScope.js)
  `getAssignedFarmIds(user)` — primary axis. Returns `null` for owners
  (unscoped), `[]` for sub-users with a Worker but no farms (sees
  nothing), or `[id]` for scoped sub-users.
- `getAssignedHouseIds(user)` — derived. Walks `farmAssignments` →
  `House.find({ farm: { $in } })` and unions with any legacy explicit
  `houseAssignments`. Used by list filters that key on house id
  (batches, dailyLogs, houses).

### 4. Module capability maps are additive

Each module declares a `capabilities: { [role]: [actions] }` matrix in
[shared/modules/<id>/capabilities.js](shared/modules/broiler/capabilities.js).
These actions are **added** to the global role defaults; modules never
*remove* an action. To take an action away from a specific user, set
`user.permissions.deny[]`.

Backend resolution: `protect` calls `effectiveActionsForUser(user,
modules)` from [shared/permissions.js](shared/permissions.js) and
caches the result on `req.user.effectiveActions`. Both backend
`requirePermission` and the client `useCapabilities()` hooks read from
`/auth/me`'s `moduleCapabilities` block.

### 5. One invite endpoint, one revoke endpoint

- `POST /api/users` → invite with app access (creates User + Worker +
  Contact, emails temp password).
- `POST /api/workers` → HR-only worker (creates Worker + Contact, no
  User).
- `POST /api/workers/:id/grant-access` → upgrade an existing HR worker
  into an invited user.
- `DELETE /api/workers/:id/revoke-access` → set `User.isActive = false`
  (deactivate, NOT soft-delete). Reversible: `PUT /api/users/:id` with
  `{ isActive: true }` restores access.

Every flow goes through `inviteWorker()` in
[backend/services/inviteService.js](backend/services/inviteService.js).

### 6. Owner-only ops are gated by `requireOwner`

All routes that mutate the team (`/api/users/*`, the grant/revoke
endpoints) use `requireOwner` middleware after `protect`. The mobile
`Settings → Team` screen and the web `TeamSettings` page also gate the
entry point on `accountRole === 'owner'` for defense in depth.

### 7. `workers` syncs as `dependsOn` for every house-scoped module

Every module whose data is scoped by farms or houses must declare
`workers` in its `sync.dependsOn` array (see broiler/index.js for the
canonical example) so the sub-user's worker record is always loaded
before the module's own list endpoints fetch.

The `users` table is **owner-only sync**. See `OWNER_ONLY_TABLES` in
[mobile/lib/syncEngine.js](mobile/lib/syncEngine.js) — sub-users would
get 403 from `/api/users` (which uses `requireOwner`), so we just skip
the fetch entirely.

### 8. NEVER hard-delete users, workers, or contacts

These records author other records (DailyLog.createdBy,
Media.createdBy, Source.createdBy, etc.). Hard-deleting them would
break those references and lose audit history.

Always set `deletedAt` and cascade with the same timestamp per
[DATA_OWNERSHIP.md](DATA_OWNERSHIP.md) Invariant 6:

```js
const now = new Date();
user.deletedAt = now;
user.isActive = false;
await user.save();
await Worker.updateMany(
  { linkedUser: user._id, deletedAt: null },
  { deletedAt: now }
);
await Contact.updateMany(
  { linkedUser: user._id, deletedAt: null },
  { deletedAt: now }
);
```

The cascade is encapsulated in `softDeleteUser()` in
[backend/services/inviteService.js](backend/services/inviteService.js)
which also writes `DeletionLog` entries for each affected entity so
mobile sync engines drop them locally on the next tick.

The `protect` middleware rejects users with `deletedAt != null`
returning `401 { code: 'USER_DELETED' }`. Both clients map that to a
force-logout via the axios interceptor.

### 9. Distinguish Deactivate from Remove

- **Deactivate** → `isActive: false`. Reversible. Member stays in the
  team list with a "Deactivated" badge. Login is blocked at the
  `protect` middleware.
- **Remove** → `deletedAt: Date`. One-way from normal UI. Member
  disappears from the default team list. All authored records survive
  intact. Restoration requires a manual / admin path.

Both web (TeamSettings kebab menu) and mobile (TeamSettings swipe
actions) expose the two operations side-by-side. The Remove confirm
dialog explicitly calls out that historical records remain intact.

---

## Adding a worker dashboard for a new module

When a new module ships its own role-tailored screen for ground_staff
(or any other role), drop it into the module folder and register it in
the module's `roleDashboards` map:

```js
// mobile/modules/<id>/index.js
import EggCollectionWorkerHome from './screens/EggCollectionWorkerHome';

const eggProductionModule = {
  // ...
  roleDashboards: {
    ground_staff: EggCollectionWorkerHome,
  },
  // ...
};
```

[mobile/modules/_shared/RoleDashboardRouter.js](mobile/modules/_shared/RoleDashboardRouter.js)
picks the right component based on the active module + role
automatically. No core dashboard changes needed.

---

## Future work

- House-level scoping (currently deferred — only farm-level today).
- "Restore removed member" admin flow (today removal is one-way from
  normal UI).
- Per-seat pricing once Stripe lands (will live in
  [SUBSCRIPTION.md](SUBSCRIPTION.md), not here).
- Audit log surface in the UI for the `?includeDeleted=true` view.
