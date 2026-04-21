import { Bird, Layers } from 'lucide-react';
import { broilerCapabilities } from '@poultrymanager/shared/module-capabilities/broiler';

import BatchesPage from './pages/BatchesPage';
import BatchDetailLayout from './pages/BatchDetailLayout';
import BatchOverview from './pages/BatchOverview';
import BatchExpensesView from './pages/BatchExpensesView';
import BatchSourcesView from './pages/BatchSourcesView';
import BatchFeedOrdersView from './pages/BatchFeedOrdersView';
import BatchSalesView from './pages/BatchSalesView';
import BatchOperationsView from './pages/BatchOperationsView';
import BatchHouseOpsView from './pages/BatchHouseOpsView';

import BusinessExpensesView from './pages/business-scoped/BusinessExpensesView';
import BusinessSalesView from './pages/business-scoped/BusinessSalesView';
import BusinessFeedOrdersView from './pages/business-scoped/BusinessFeedOrdersView';
import BusinessSourcesView from './pages/business-scoped/BusinessSourcesView';

import AccountingSalesView from './accounting/AccountingSalesView';
import AccountingExpensesView from './accounting/AccountingExpensesView';

import BroilerKpiRow from './dashboard/BroilerKpiRow';
import BroilerActiveBatches from './dashboard/BroilerActiveBatches';
import BroilerFinancials from './dashboard/BroilerFinancials';

import WorkerHome from './screens/WorkerHome';

import broilerI18nEn from './i18n/en.json';

const broilerModule = {
  id: 'broiler',
  labelKey: 'modules.broiler',
  icon: Bird,
  color: { light: '#059669', dark: '#34d399' },

  sidebarGroups: [
    { key: 'batches', path: '/dashboard/batches', icon: Layers, capability: 'batch:read' },
  ],

  routes: [
    { path: '/dashboard/batches', element: BatchesPage, capability: 'batch:read' },
    {
      path: '/dashboard/batches/:id',
      element: BatchDetailLayout,
      capability: 'batch:read',
      children: [
        { index: true, element: BatchOverview },
        { path: 'expenses', element: BatchExpensesView, capability: 'expense:read' },
        { path: 'expenses/:eid', element: BatchExpensesView, capability: 'expense:read' },
        { path: 'sources', element: BatchSourcesView, capability: 'source:read' },
        { path: 'sources/:sid', element: BatchSourcesView, capability: 'source:read' },
        { path: 'feed-orders', element: BatchFeedOrdersView, capability: 'feedOrder:read' },
        { path: 'feed-orders/:fid', element: BatchFeedOrdersView, capability: 'feedOrder:read' },
        { path: 'sales', element: BatchSalesView, capability: 'saleOrder:read' },
        { path: 'sales/:saleId', element: BatchSalesView, capability: 'saleOrder:read' },
        { path: 'performance', element: BatchOperationsView, capability: 'dailyLog:read' },
        { path: 'performance/:houseId', element: BatchHouseOpsView, capability: 'dailyLog:read' },
        { path: 'performance/:houseId/:logId', element: BatchHouseOpsView, capability: 'dailyLog:read' },
      ],
    },
    {
      path: '/dashboard/directory/businesses/:id/expenses',
      element: BusinessExpensesView, capability: 'expense:read',
      businessScoped: true,
    },
    {
      path: '/dashboard/directory/businesses/:id/expenses/:eid',
      element: BusinessExpensesView, capability: 'expense:read',
      businessScoped: true,
    },
    {
      path: '/dashboard/directory/businesses/:id/sales',
      element: BusinessSalesView, capability: 'saleOrder:read',
      businessScoped: true,
    },
    {
      path: '/dashboard/directory/businesses/:id/sales/:saleId',
      element: BusinessSalesView, capability: 'saleOrder:read',
      businessScoped: true,
    },
    {
      path: '/dashboard/directory/businesses/:id/feed-orders',
      element: BusinessFeedOrdersView, capability: 'feedOrder:read',
      businessScoped: true,
    },
    {
      path: '/dashboard/directory/businesses/:id/feed-orders/:fid',
      element: BusinessFeedOrdersView, capability: 'feedOrder:read',
      businessScoped: true,
    },
    {
      path: '/dashboard/directory/businesses/:id/sources',
      element: BusinessSourcesView, capability: 'source:read',
      businessScoped: true,
    },
    {
      path: '/dashboard/directory/businesses/:id/sources/:sid',
      element: BusinessSourcesView, capability: 'source:read',
      businessScoped: true,
    },
  ],

  sync: {
    tables: [
      'batches', 'houses', 'sources', 'feedOrders', 'feedOrderItems',
      'saleOrders', 'expenses', 'dailyLogs', 'feedItems', 'transfers',
    ],
    dependsOn: ['businesses', 'contacts', 'farms', 'workers', 'media'],
    deletionTypes: [
      'batch', 'source', 'feedOrder', 'feedOrderItem', 'saleOrder',
      'expense', 'dailyLog', 'house', 'feedItem', 'transfer',
    ],
    mediaCategories: [
      'batch', 'source', 'expense', 'feedOrder', 'saleOrder', 'dailyLog',
    ],
    batchScoped: ['sources', 'expenses', 'feedOrders', 'saleOrders', 'dailyLogs'],
  },

  dashboardWidgets: [
    { id: 'broilerKpiRow',        component: BroilerKpiRow,        capability: 'batch:read',     order: 10, fullWidth: true },
    { id: 'broilerActiveBatches', component: BroilerActiveBatches, capability: 'batch:read',     order: 20, fullWidth: true },
    { id: 'broilerFinancials',    component: BroilerFinancials,    capability: 'saleOrder:read', order: 30, fullWidth: true },
  ],

  accountingTabs: [
    {
      id: 'sales',
      labelKey: 'dashboard.totalRevenue',
      component: AccountingSalesView,
      capability: 'saleOrder:read',
    },
    {
      id: 'expenses',
      labelKey: 'dashboard.totalExpenses',
      component: AccountingExpensesView,
      capability: 'expense:read',
    },
  ],

  roleDashboards: {
    ground_staff: WorkerHome,
  },

  // Capability matrix is the single source of truth at
  // shared/modules/broiler/capabilities.js so the backend
  // (userCan / protect) and both clients see identical actions.
  capabilities: broilerCapabilities,

  i18n: {
    en: broilerI18nEn,
  },
};

export default broilerModule;
