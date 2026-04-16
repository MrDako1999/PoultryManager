// Module template — copy this folder to modules/<yourModuleId>/ and fill in the details.
// Register the module in mobile/modules/registry.js by importing and adding it to MODULES.
//
// Replace all occurrences of `_template` / `Template` with your module id (camelCase).
import { Package } from 'lucide-react-native';
// import templateI18nEn from './i18n/en.json';

const templateModule = {
  id: '_template',
  labelKey: 'modules._template',
  icon: Package,
  color: { light: '#475569', dark: '#94a3b8' },

  // Tabs this module contributes to the primary bottom tab bar.
  // Each tab must correspond to a physical file under app/(app)/(tabs)/<name>.js
  // (a thin re-export) or be mapped elsewhere in the layout.
  tabs: [
    // { name: 'widgets', labelKey: 'nav.widgets', icon: Package, capability: 'widget:read' },
  ],

  // Route-level capability gates for deep routes. The router doesn't enforce these
  // automatically — wrap the screen with <RequireCapability> (web) or check with
  // useCapabilities inside the screen (mobile).
  routes: [
    // { path: 'widget/[id]', capability: 'widget:read' },
  ],

  // Local sync: what tables this module owns and depends on, plus cross-cutting hooks.
  sync: {
    tables: [
      // Tables the module declares as its own. They only sync when this module
      // is visible to the user. Register SQLite migrations for these tables via
      // `registerModuleMigrations` in mobile/lib/db.js (call from module bootstrap).
    ],
    dependsOn: [
      // Shared tables this module needs already loaded to resolve references.
      // Common shared tables: businesses, contacts, farms, workers, media.
    ],
    deletionTypes: [
      // Entity type strings used in the `DeletionLog` feed. Must match what
      // backend routes pass to `logDeletion(ownerId, type, id)`.
    ],
    mediaCategories: [
      // Allowed S3 `category` values for this module's uploads. Kept declarative
      // so the catalog of valid media paths is obvious at a glance.
    ],
    batchScoped: [
      // Tables that behave like broiler's batch-scoped ledger (syncAll=true on
      // first sync so no rows are dropped by the updatedSince filter).
    ],
  },

  // Widgets contributed to the main Dashboard tab. The dashboard tab iterates
  // every visible module's widgets, filters by capability, and renders in order.
  dashboardWidgets: [
    // { id: 'myWidget', component: MyWidget, capability: 'widget:read', order: 10 },
  ],

  // If your module has a role-specific "home" screen (e.g. WorkerHome for
  // ground_staff), return it here and the dashboard tab will render it instead.
  roleDashboards: {
    // ground_staff: MyWorkerHome,
  },

  // Views contributed to the Accounting tab. Each gets its own tab within the
  // accounting shell, gated by capability.
  accountingViews: [
    // { id: 'sales', labelKey: 'modules._template.accounting.salesTab',
    //   component: MySalesView, capability: 'sale:read' },
  ],

  // Role -> action-string list. Merged with the global role defaults from
  // shared/permissions.js. Add narrower actions here that only make sense
  // when this module is active.
  capabilities: {
    owner: ['*'],
    manager: [],
    accountant: [],
    veterinarian: [],
    ground_staff: [],
    viewer: [],
  },

  // i18n bundles merged under `modules.<id>.*` at app boot.
  i18n: {
    // en: templateI18nEn,
  },
};

export default templateModule;
