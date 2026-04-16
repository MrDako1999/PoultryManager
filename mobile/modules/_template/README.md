# Module Template

This folder is a skeleton for adding a new module to PoultryManager.

## Steps to create a new module

1. **Pick a module id** (camelCase, e.g. `slaughterhouse`, `eggProduction`). Make sure it exists in [shared/modules.js](../../../shared/modules.js) `MODULE_IDS` — if not, add it there first.

2. **Copy this folder** to `mobile/modules/<yourModuleId>/` and rename references:

```bash
cp -r mobile/modules/_template mobile/modules/slaughterhouse
# then grep-replace: _template -> slaughterhouse, Template -> Slaughterhouse
```

3. **Register the module** in [mobile/modules/registry.js](../registry.js):

```js
import slaughterhouse from './slaughterhouse/index.js';

export const MODULES = {
  [broiler.id]: broiler,
  [slaughterhouse.id]: slaughterhouse,
};
```

4. **Fill in the contract** in `modules/<yourModuleId>/index.js`:
   - `tabs`, `routes`, `sync.tables`, `sync.dependsOn`, `sync.deletionTypes`, `sync.mediaCategories`
   - `dashboardWidgets`, `accountingViews`, `roleDashboards`
   - `capabilities: { [role]: [...] }`

5. **Add subfolders** for implementation: `screens/`, `sheets/`, `rows/`, `dashboard/`, `accounting/`, `i18n/`.

6. **Add expo-router re-exports** in `mobile/app/(app)/` for each route the module exposes:

```js
// mobile/app/(app)/slaughterhouse/[id]/index.js
export { default } from '@/modules/slaughterhouse/screens/SlaughterhouseDetail';
```

7. **Declare migrations** for any new SQLite tables in your module's bootstrap:

```js
import { registerModuleMigrations } from '@/lib/db';

registerModuleMigrations([
  {
    id: 'v1_slaughterhouse_tables',
    up: async (db) => {
      await db.execAsync(`CREATE TABLE IF NOT EXISTS slaughterLots (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT);`);
    },
  },
]);
```

8. **Backend routes** for the module's entities must:
   - Use `router.use(protect, requireModule('<yourModuleId>'))` at the top.
   - Use the `getOwnerId = user.createdBy || user._id` pattern.
   - Call `logDeletion(ownerId, '<entityType>', entityId)` after every soft-delete.

See [PERMISSIONS.md](../../../PERMISSIONS.md) and [DATA_OWNERSHIP.md](../../../DATA_OWNERSHIP.md) for the contracts every route must follow.
