# Web Module Template

Skeleton for adding a new module to the PoultryManager web app.

## Steps

1. **Pick a module id** matching an entry in [shared/modules.js](../../../../shared/modules.js) `MODULE_IDS` (camelCase).

2. **Copy this folder** to `frontend/src/modules/<yourModuleId>/` and rename references.

3. **Register the module** in [frontend/src/modules/registry.js](../registry.js):

```js
import yourModule from './<yourModuleId>/index.js';

export const MODULES = {
  [broiler.id]: broiler,
  [yourModule.id]: yourModule,
};
```

4. **Fill in the contract** in `modules/<yourModuleId>/index.js`:
   - `sidebarGroups`, `routes`, `sync`, `dashboardWidgets`, `accountingTabs`, `capabilities`, `i18n`.

5. **Add subfolders** for implementation: `pages/`, `dashboard/`, `accounting/`, `sheets/`, `rows/`, `views/`, `i18n/`.

6. **Backend routes** for the module's entities must:
   - Use `router.use(protect, requireModule('<yourModuleId>'))` at the top.
   - Use `getOwnerId = user.createdBy || user._id` for all queries.
   - Call `logDeletion(ownerId, '<entityType>', entityId)` after every soft-delete.

See [MODULES.md](../../../../MODULES.md), [PERMISSIONS.md](../../../../PERMISSIONS.md), [DATA_OWNERSHIP.md](../../../../DATA_OWNERSHIP.md) for the canonical rules.
