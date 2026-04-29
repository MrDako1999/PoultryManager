import { Factory, ClipboardList, Snowflake, Truck } from 'lucide-react';
import { slaughterhouseCapabilities } from '@poultrymanager/shared/module-capabilities/slaughterhouse';

import ProcessingJobsPage from './pages/ProcessingJobsPage';
import JobDetailLayout from './pages/JobDetailLayout';
import JobTrucksView from './pages/JobTrucksView';
import JobSortationView from './pages/JobSortationView';
import JobProductionView from './pages/JobProductionView';
import JobStockView from './pages/JobStockView';
import JobReconciliationView from './pages/JobReconciliationView';
import JobInvoiceView from './pages/JobInvoiceView';
import ColdStorePage from './pages/ColdStorePage';
import HandoversPage from './pages/HandoversPage';

import ProcessingKpiHero from './dashboard/ProcessingKpiHero';
import LiveLineWidget from './dashboard/LiveLineWidget';
import StockOverviewWidget from './dashboard/StockOverviewWidget';

import GateClerkHome from './screens/GateClerkHome';
import ReceivingWorkerHome from './screens/ReceivingWorkerHome';
import PackingWorkerHome from './screens/PackingWorkerHome';
import ColdStoreHome from './screens/ColdStoreHome';
import DispatchHome from './screens/DispatchHome';

import ProcessingIncomeView from './accounting/ProcessingIncomeView';
import StorageFeesView from './accounting/StorageFeesView';
import CondemnationLossView from './accounting/CondemnationLossView';

import slaughterhouseI18nEn from './i18n/en.json';

const slaughterhouseModule = {
  id: 'slaughterhouse',
  labelKey: 'modules.slaughterhouse',
  icon: Factory,
  color: { light: '#dc2626', dark: '#f87171' },

  // Sidebar entries — three top-level sections inside the slaughterhouse
  // workspace. Routes always mount; the sidebar filters them through the
  // active module so the broiler workspace doesn't show these.
  sidebarGroups: [
    {
      key: 'processing-jobs',
      path: '/dashboard/processing-jobs',
      icon: ClipboardList,
      capability: 'processingJob:read',
    },
    {
      key: 'cold-store',
      path: '/dashboard/cold-store',
      icon: Snowflake,
      capability: 'stockUnit:read',
    },
    {
      key: 'handovers',
      path: '/dashboard/handovers',
      icon: Truck,
      capability: 'handover:read',
    },
  ],

  routes: [
    { path: '/dashboard/processing-jobs', element: ProcessingJobsPage, capability: 'processingJob:read' },
    {
      path: '/dashboard/processing-jobs/:id',
      element: JobDetailLayout,
      capability: 'processingJob:read',
      children: [
        { index: true, element: JobTrucksView },
        { path: 'sortation', element: JobSortationView, capability: 'truckEntry:read' },
        { path: 'sortation/:truckId', element: JobSortationView, capability: 'truckEntry:read' },
        { path: 'production', element: JobProductionView, capability: 'productionBox:read' },
        { path: 'stock', element: JobStockView, capability: 'stockUnit:read' },
        { path: 'reconciliation', element: JobReconciliationView, capability: 'processingJob:read' },
        { path: 'invoice', element: JobInvoiceView, capability: 'processingInvoice:read' },
      ],
    },
    { path: '/dashboard/cold-store', element: ColdStorePage, capability: 'stockUnit:read' },
    { path: '/dashboard/handovers', element: HandoversPage, capability: 'handover:read' },
    { path: '/dashboard/handovers/:id', element: HandoversPage, capability: 'handover:read' },
  ],

  // Local-first sync configuration. ENTITY_API_MAP entries for these
  // tables are intentionally null in frontend/src/lib/db.js while we
  // build the frontend in isolation — see the offline-first section of
  // the slaughterhouse plan. Adding API paths later turns syncing on
  // without changing this contract.
  sync: {
    tables: [
      'processingJobs', 'truckEntries',
      'productionBoxes', 'productionPortions', 'productionGiblets',
      'stockUnits', 'stockMovements',
      'handovers', 'handoverItems',
      'processingInvoices', 'priceLists', 'storageLocations',
    ],
    dependsOn: ['businesses', 'contacts', 'workers', 'media'],
    deletionTypes: [
      'processingJob', 'truckEntry',
      'productionBox', 'productionPortion', 'productionGiblet',
      'stockUnit', 'handover', 'handoverItem',
      'processingInvoice', 'priceList', 'storageLocation',
    ],
    mediaCategories: [
      'processingJob', 'truckEntry', 'productionBox',
      'handover', 'processingInvoice',
    ],
    // The slaughterhouse equivalent of broiler's `batchScoped` — these
    // tables fall under a parent processingJob and are cleared when the
    // parent's full-resync flag is requested by the sync engine.
    jobScoped: [
      'truckEntries', 'productionBoxes', 'productionPortions',
      'productionGiblets',
    ],
  },

  // Dashboard widgets — owner mission-control. ProcessingKpiHero
  // owns the headline numbers and scope toggle (mirrors BroilerKpiHero
  // pattern); LiveLineWidget surfaces the active queue + on-line jobs
  // (mirrors BroilerActiveBatches); StockOverviewWidget shows totals
  // + an expiry alert chip.
  dashboardWidgets: [
    { id: 'processingKpiHero',  component: ProcessingKpiHero,  capability: 'processingJob:read', order: 10, fullWidth: true },
    { id: 'liveLineWidget',     component: LiveLineWidget,     capability: 'processingJob:read', order: 20, fullWidth: true },
    { id: 'stockOverviewWidget', component: StockOverviewWidget, capability: 'stockUnit:read',  order: 30, fullWidth: true },
  ],

  // Accounting tabs — surface in the cross-module Accounting page
  // when slaughterhouse is the active module. Capabilities filter
  // each tab independently so accountants and the owner see what
  // they're entitled to.
  accountingTabs: [
    {
      id: 'processingIncome',
      labelKey: 'accountingTabs.processingIncome',
      component: ProcessingIncomeView,
      capability: 'processingInvoice:read',
    },
    {
      id: 'storageFees',
      labelKey: 'accountingTabs.storageFees',
      component: StorageFeesView,
      capability: 'stockUnit:read',
    },
    {
      id: 'condemnationLoss',
      labelKey: 'accountingTabs.condemnationLoss',
      component: CondemnationLossView,
      capability: 'truckEntry:read',
    },
  ],

  // Role-scoped landing pages — replace the default dashboard for
  // operational sub-users (the supervisor + owner + manager use the
  // default dashboard with widgets above). Mirrors broiler's
  // roleDashboards.ground_staff -> WorkerHome pattern.
  roleDashboards: {
    gate_clerk:        GateClerkHome,
    receiving_worker:  ReceivingWorkerHome,
    packing_worker:    PackingWorkerHome,
    cold_store_user:   ColdStoreHome,
    dispatch_user:     DispatchHome,
  },

  capabilities: slaughterhouseCapabilities,

  i18n: {
    en: slaughterhouseI18nEn,
  },
};

export default slaughterhouseModule;
