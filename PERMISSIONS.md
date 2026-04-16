# Permissions & Capabilities

This document defines how access control works in PoultryManager across the backend API, mobile app, and web app.

---

## Axes of access

Three independent dimensions determine what a user can see and do:

| Axis | Values | Source of truth |
|---|---|---|
| **Module** | `broiler`, `hatchery`, `eggProduction`, `freeRange`, `slaughterhouse`, `marketing`, `equipment` | `user.modules[]` (owner) OR inherited from `user.createdBy` (sub-account) |
| **Role** | `owner`, `manager`, `veterinarian`, `accountant`, `ground_staff`, `viewer` | `user.accountRole` + `user.permissions` |
| **Workspace** | own OR owner's | `user.createdBy` (null = owner) + `user.accountBusiness` |

---

## Action grammar

Every permission check uses a string of the form:

```
<entity>:<verb>[:<scope>]
```

- `entity` — resource type (e.g. `batch`, `sale`, `dailyLog`, `media`, `settings`)
- `verb` — action (`read`, `create`, `update`, `delete`, or domain-specific like `approve`)
- `scope` — optional narrowing (`own`, `assigned`, a type name like `WEIGHT`)
- `*` — wildcard (matches any remaining segment)

Examples:

- `batch:create` — can create new batches
- `dailyLog:read:own` — can read only daily logs they authored
- `dailyLog:create:WEIGHT` — can create only weight-type daily logs
- `batch:*` — any action on batches
- `*` — everything (owner)

---

## Role defaults

Source: [shared/permissions.js](shared/permissions.js) `DEFAULT_ROLE_ACTIONS`.

| Role | Summary |
|---|---|
| `owner` | `*` — full access to everything |
| `manager` | Full CRUD on all domain entities, read-only on account settings |
| `accountant` | Full CRUD on sales/expenses/feed orders/transfers + accounting settings; read-only on batches |
| `veterinarian` | Read batches/houses, create WEIGHT/ENVIRONMENT daily logs, update own logs |
| `ground_staff` | Read assigned houses, create/update own daily logs |
| `viewer` | Read-only across all shared entities |

---

## Explicit permission overrides

A user's `permissions.allow[]` and `permissions.deny[]` refine the role defaults:

- `allow[]` — extra action strings granted in addition to role defaults
- `deny[]` — action strings explicitly blocked (overrides role defaults and allow[])

---

## Enforcement points

- **Backend routes** — `requireModule(moduleId)` and `requirePermission(action)` in [backend/middleware/modules.js](backend/middleware/modules.js) and [backend/middleware/permissions.js](backend/middleware/permissions.js).
- **Mobile/web UI** — `useCapabilities().can(action)` hook gates buttons, tabs, routes.
- **Module registry** — each module declares a `capabilities: { [role]: [actions] }` map that extends the global defaults.

The shared resolver [shared/permissions.js](shared/permissions.js) `userCan(user, action)` is the single authoritative check. Backend middleware and client hooks both call it.

---

## Module inheritance for sub-accounts

When `user.createdBy` is set, the user's effective modules are resolved at read time from the creator's `modules` array — not snapshotted at create time. This means if an owner later subscribes to a new module, their existing workers automatically gain access on next `/auth/me`.

Implementation: [backend/middleware/modules.js](backend/middleware/modules.js) `resolveModules(user)`.

---

## The `/auth/me` capability payload

Both clients trust this single response for all authorization decisions:

```json
{
  "_id": "...",
  "accountRole": "ground_staff",
  "modules": ["broiler"],
  "permissions": {
    "allow": [],
    "deny": [],
    "defaults": ["batch:read", "dailyLog:create", ...]
  },
  "workspace": {
    "ownerId": "...",
    "ownerName": "Estera Farms",
    "ownerBusiness": "...",
    "isOwner": false
  },
  "moduleSettings": { "broiler": { "saleDefaults": { ... } } }
}
```
