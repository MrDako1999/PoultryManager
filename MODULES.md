# Adding a New Module

This document describes how to extend PoultryManager with a new module (e.g. slaughterhouse, egg production, marketing).

---

## The module contract

Every module is a plain JS object registered in [mobile/modules/registry.js](mobile/modules/registry.js) (and, later, `frontend/src/modules/registry.js`). It declares:

| Field | Purpose |
|---|---|
| `id` | camelCase unique identifier matching `shared/modules.js` `MODULE_IDS` |
| `labelKey` | i18n key for the module's display name |
| `icon` | lucide-react-native icon component |
| `color` | `{ light, dark }` hex colors used by UI chrome |
| `tabs` | primary tab-bar items contributed to the mobile shell |
| `routes` | deep-route capability gates |
| `sync.tables` | local DB tables this module owns (synced only when the module is active) |
| `sync.dependsOn` | shared tables this module needs available |
| `sync.deletionTypes` | DeletionLog entity-type strings this module produces |
| `sync.mediaCategories` | allowed S3 `category` values |
| `sync.batchScoped` | tables that receive `syncAll=true` on first sync |
| `dashboardWidgets` | widgets contributed to the Dashboard tab |
| `roleDashboards` | role -> full-screen override for the Dashboard tab |
| `accountingViews` | tabs contributed to the Accounting tab |
| `capabilities` | role -> extra action strings (merged with defaults) |
| `i18n` | `{ lang: bundle }` merged under `modules.<id>.*` at boot |

See [mobile/modules/_template/index.js](mobile/modules/_template/index.js) for the reference skeleton and [mobile/modules/broiler/index.js](mobile/modules/broiler/index.js) for a complete example.

---

## Step-by-step: adding `slaughterhouse`

### 1. Shared constants

Add the module to [shared/modules.js](shared/modules.js) `MODULE_CATALOG`:

```js
slaughterhouse: {
  id: 'slaughterhouse',
  labelKey: 'modules.slaughterhouse',
  descKey: 'modules.slaughterhouseDesc',
  icon: 'Factory',
  color: { light: '#dc2626', dark: '#f87171' },
  available: true,
},
```

### 2. Backend

- **Models** under `backend/models/` for the module's entities (e.g. `ProcessingLot`, `YieldRecord`).
- **Routes** under `backend/routes/` with the standard boilerplate:

```js
import { protect } from '../middleware/auth.js';
import { requireModule } from '../middleware/modules.js';
import { logDeletion } from '../middleware/deletionTracker.js';

const router = express.Router();
router.use(protect, requireModule('slaughterhouse'));

const getOwnerId = (user) => user.createdBy || user._id;
```

- Register routes in [backend/server.js](backend/server.js).
- `DeletionLog.entityType` is no longer an enum — just pick stable strings and list them in your module's `sync.deletionTypes`.

### 3. Mobile module folder

```bash
cp -r mobile/modules/_template mobile/modules/slaughterhouse
# rename references (`_template` -> `slaughterhouse`, etc.)
```

Subfolders:

- `screens/` — full-screen components referenced by expo-router re-exports in `app/`
- `sheets/` — slide-up forms (follow the existing `BatchSheet.js` shape)
- `rows/` — compact list-row components
- `dashboard/` — dashboard widgets (each a React component)
- `accounting/` — accounting views (each a React component)
- `i18n/en.json` — keys under `modules.slaughterhouse.*`

### 4. Register in the mobile registry

```js
// mobile/modules/registry.js
import broiler from './broiler/index.js';
import slaughterhouse from './slaughterhouse/index.js';

export const MODULES = {
  [broiler.id]: broiler,
  [slaughterhouse.id]: slaughterhouse,
};
```

### 5. Expo-router re-export files

For every deep route the module declares, add a thin re-export:

```js
// mobile/app/(app)/processing-lot/[id].js
export { default } from '@/modules/slaughterhouse/screens/ProcessingLotDetail';
```

Place files under `app/(app)/` so expo-router discovers them. Group related routes in subfolders (e.g. `app/(app)/processing-lot/`).

### 6. Local DB migrations

If the module adds SQLite tables, declare migrations:

```js
// mobile/modules/slaughterhouse/migrations.js
export default [
  {
    id: 'v1_slaughterhouse_tables',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS processingLots (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS yieldRecords  (_id TEXT PRIMARY KEY, data TEXT, lot TEXT, updatedAt TEXT);
      `);
    },
  },
];
```

Register them at app boot (or in the module's `index.js`):

```js
import { registerModuleMigrations } from '@/lib/db';
import migrations from './migrations';

registerModuleMigrations(migrations);
```

### 7. Web (frontend)

Copy `frontend/src/modules/_template` to `frontend/src/modules/slaughterhouse/` and fill in the web-specific fields:

- `sidebarGroups[]` — items contributed to the sidebar (each `{ key, path, icon, capability }`).
- `routes[]` — React Router route objects, supporting nested `children`. Each gets a `<RequireCapability>` wrapper automatically based on its `capability`.
- `dashboardWidgets[]` — components rendered in the Dashboard slot host. Same shape as mobile but use web UI primitives (shadcn `<Card>`).
- `accountingTabs[]` — components rendered as tabs inside the Accounting shell.
- `roleDashboards[role]` — optional full-screen dashboard override for a specific role.
- `capabilities`, `sync`, `i18n` — identical to the mobile contract.

Register in [frontend/src/modules/registry.js](frontend/src/modules/registry.js):

```js
import slaughterhouse from './slaughterhouse/index.js';

export const MODULES = {
  [broiler.id]: broiler,
  [slaughterhouse.id]: slaughterhouse,
};
```

Sidebar items appear automatically, routes register automatically, dashboard widgets render in order, accounting tabs surface in `AccountingShell`. No sidebar/router/dashboard code changes needed.

Gate any Add/Edit/Delete button inside the module's pages with `useCapabilities().can('<entity>:<verb>')` so all roles receive the right UI without branching.

### 8. Verify

Run the persona seed script and log in as the owner of a multi-module account:

```bash
node backend/scripts/seedPersonas.js
```

Then:

- The module switcher pill should appear in the dashboard header (since the account now has 2+ modules).
- Switching should swap the tab bar, dashboard widgets, and accounting views to the new module.
- Sync engine should download only the new module's tables when it becomes active.

---

## Conventions to preserve

- `module.id` must match `MODULE_IDS` in [shared/modules.js](shared/modules.js).
- Every DB table lives in exactly one module's `sync.tables` OR in the shared shell tables. No ambiguity.
- Every route enforces module gating via `requireModule(moduleId)` on the router.
- Every deletion is logged via `logDeletion(ownerId, entityType, id)`.
- Permissions follow the `<entity>:<verb>[:<scope>]` grammar in [PERMISSIONS.md](PERMISSIONS.md).
- Data ownership follows [DATA_OWNERSHIP.md](DATA_OWNERSHIP.md).

When a module contract is wrong, `validateRegistry()` in [mobile/modules/registry.js](mobile/modules/registry.js) (and [frontend/src/modules/registry.js](frontend/src/modules/registry.js)) throws at app boot with a clear message — don't silently skip the validator.
