// Module template — copy this folder to modules/<yourModuleId>/ and fill in the details.
// Register the module in frontend/src/modules/registry.js by importing and adding it to MODULES.
//
// Replace all occurrences of `_template` / `Template` with your module id (camelCase).
import { Package } from 'lucide-react';
// import templateI18nEn from './i18n/en.json';

const templateModule = {
  id: '_template',
  labelKey: 'modules._template',
  icon: Package,
  color: { light: '#475569', dark: '#94a3b8' },

  // Sidebar items this module contributes. Each item is rendered under a
  // module group in the sidebar, or promoted to top-level navItems.
  sidebarGroups: [
    // { key: 'widgets', path: '/dashboard/widgets', icon: Package, capability: 'widget:read' },
  ],

  // React Router routes contributed by this module. Supports nested `children`.
  // Each route is wrapped in <RequireCapability> using its `capability` value.
  routes: [
    // { path: '/dashboard/widgets', element: WidgetsPage, capability: 'widget:read' },
  ],

  // Local sync configuration. Same contract as mobile.
  sync: {
    tables: [],
    dependsOn: [],
    deletionTypes: [],
    mediaCategories: [],
    batchScoped: [],
  },

  // Widgets contributed to the Dashboard shell. Iterated per visible module,
  // filtered by capability, sorted by `order`.
  dashboardWidgets: [
    // { id: 'myWidget', component: MyWidget, capability: 'widget:read', order: 10, fullWidth: true },
  ],

  // Role-specific full-screen dashboard override. Keys are role ids.
  roleDashboards: {
    // ground_staff: MyWorkerHome,
  },

  // Tabs contributed to the Accounting shell.
  accountingTabs: [
    // { id: 'sales', labelKey: 'modules._template.accounting.salesTab',
    //   component: MySalesView, capability: 'sale:read' },
  ],

  // Role -> action-string list. Merged with defaults from shared/permissions.js.
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
