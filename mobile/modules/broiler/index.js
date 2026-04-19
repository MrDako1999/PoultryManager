import { Bird, Layers, Calculator, ClipboardList } from 'lucide-react-native';
import broilerI18nEn from './i18n/en.json';
import BroilerKpiHero from './dashboard/BroilerKpiHero';
import BroilerActiveBatches from './dashboard/BroilerActiveBatches';
import useBroilerQuickStats from './dashboard/broilerQuickStats';
import BroilerSalesView from './accounting/BroilerSalesView';
import BroilerExpensesView from './accounting/BroilerExpensesView';
import WorkerHome from './screens/WorkerHome';

const broilerModule = {
  id: 'broiler',
  labelKey: 'modules.broiler',
  icon: Bird,
  color: { light: '#059669', dark: '#34d399' },

  tabs: [
    {
      name: 'batches',
      labelKey: 'nav.batches',
      icon: Layers,
      capability: 'batch:read',
    },
  ],

  routes: [
    { path: 'batch/[id]', capability: 'batch:read' },
    { path: 'batch/[id]/sources', capability: 'source:read' },
    { path: 'batch/[id]/feed-orders', capability: 'feedOrder:read' },
    { path: 'batch/[id]/expenses', capability: 'expense:read' },
    { path: 'batch/[id]/sales', capability: 'saleOrder:read' },
    { path: 'batch/[id]/daily-logs', capability: 'dailyLog:read' },
  ],

  sync: {
    tables: [
      'batches',
      'houses',
      'sources',
      'feedOrders',
      'feedOrderItems',
      'saleOrders',
      'expenses',
      'dailyLogs',
      'feedItems',
      'transfers',
    ],
    dependsOn: ['businesses', 'contacts', 'farms', 'workers', 'media'],
    deletionTypes: [
      'batch',
      'source',
      'feedOrder',
      'feedOrderItem',
      'saleOrder',
      'expense',
      'dailyLog',
      'house',
      'feedItem',
      'transfer',
    ],
    mediaCategories: [
      'batch',
      'source',
      'expense',
      'feedOrder',
      'saleOrder',
      'dailyLog',
    ],
    batchScoped: ['sources', 'expenses', 'feedOrders', 'saleOrders', 'dailyLogs'],
  },

  dashboardWidgets: [
    {
      id: 'broilerKpiHero',
      component: BroilerKpiHero,
      capability: 'batch:read',
      order: 10,
      fullWidth: true,
    },
    {
      id: 'broilerActiveBatches',
      component: BroilerActiveBatches,
      capability: 'batch:read',
      order: 20,
      fullWidth: true,
    },
  ],

  useDashboardQuickStats: useBroilerQuickStats,

  roleDashboards: {
    ground_staff: WorkerHome,
  },

  accountingViews: [
    {
      id: 'sales',
      // Broiler i18n bundle defines this under `accounting.salesTab` and is
      // deep-merged into the global `accounting` namespace at module-init
      // time, so the key resolves at root. The previous
      // `modules.broiler.accounting.salesTab` collided with the module's
      // display-name namespace and never resolved — labels fell back to
      // lowercase `id` ('sales' / 'expenses').
      labelKey: 'accounting.salesTab',
      icon: Calculator,
      capability: 'saleOrder:read',
      component: BroilerSalesView,
    },
    {
      id: 'expenses',
      labelKey: 'accounting.expensesTab',
      icon: ClipboardList,
      capability: 'expense:read',
      component: BroilerExpensesView,
    },
  ],

  capabilities: {
    owner: ['*'],
    manager: [
      'batch:*', 'source:*', 'feedOrder:*', 'saleOrder:*', 'expense:*',
      'dailyLog:*', 'house:*', 'farm:*', 'worker:*', 'contact:*',
      'business:*', 'feedItem:*', 'transfer:*',
    ],
    accountant: [
      'batch:read', 'source:read', 'feedOrder:*', 'saleOrder:*', 'expense:*',
      'business:read', 'contact:read', 'transfer:*',
    ],
    veterinarian: [
      'batch:read', 'house:read', 'farm:read', 'worker:read', 'contact:read',
      'business:read', 'dailyLog:read', 'dailyLog:create:WEIGHT',
      'dailyLog:create:ENVIRONMENT', 'dailyLog:update:own',
    ],
    ground_staff: [
      'batch:read', 'house:read:assigned', 'dailyLog:create',
      'dailyLog:read:own', 'dailyLog:update:own', 'farm:read',
    ],
    viewer: [
      'batch:read', 'source:read', 'feedOrder:read', 'saleOrder:read',
      'expense:read', 'dailyLog:read', 'house:read', 'farm:read',
      'worker:read', 'contact:read', 'business:read', 'feedItem:read',
      'transfer:read',
    ],
  },

  i18n: {
    en: broilerI18nEn,
  },
};

export default broilerModule;
