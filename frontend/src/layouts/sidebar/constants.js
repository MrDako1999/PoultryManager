import {
  LayoutDashboard,
  HeartPulse,
  ShoppingCart,
  Receipt,
  Warehouse,
  Building2,
  ContactRound,
  Users,
  Wheat,
  BookOpen,
  Calculator,
  Landmark,
  BadgePercent,
} from 'lucide-react';

export const SIDEBAR_WIDTH = 'w-64';
export const SIDEBAR_COLLAPSED_WIDTH = 'w-[68px]';
export const SIDEBAR_WIDTH_PX = '16rem';
export const SIDEBAR_COLLAPSED_WIDTH_PX = '68px';
export const STORAGE_KEY = 'sidebar-collapsed';

/**
 * Build the sidebar layout from the module registry + current capabilities.
 * Returns `{ navItems, navGroups }` where each entry is filtered by capability
 * and contributed items come from every visible module.
 *
 * Composition order:
 *   1. Dashboard (always-on)
 *   2. Per-module sidebar groups (from `module.sidebarGroups`) — scoped
 *      to `visibleModules`, which the Sidebar narrows to just the active
 *      module so the picker swaps the module-contributed nav cleanly.
 *   3. Directory group (always-on, children gated by per-entity capability)
 *   4. Accounting group (present when any module in `allModules` has at
 *      least one readable accounting tab — children still gated
 *      individually). Uses `allModules` so the accounting tab stays
 *      visible across module switches.
 *   5. (Settings is rendered separately from these lists)
 */
export function buildSidebar({ visibleModules = [], allModules = null, modules = {}, can }) {
  const accountingScope = Array.isArray(allModules) ? allModules : visibleModules;
  const gate = typeof can === 'function' ? can : () => true;

  const navItems = [
    { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
  ];

  for (const moduleId of visibleModules) {
    const mod = modules[moduleId];
    for (const item of mod?.sidebarGroups || []) {
      if (item.capability && !gate(item.capability)) continue;
      navItems.push({ ...item, moduleId });
    }
  }

  // Health placeholder currently exists as a shell-level route; hidden entirely
  // for non-owners because it's unimplemented. Revisit when a real module owns it.
  if (gate('*')) {
    navItems.push({ key: 'health', path: '/dashboard/health', icon: HeartPulse });
  }

  const navGroups = [];

  // Directory — cross-module; each child gated by its own capability.
  const directoryChildren = [
    { key: 'farms', path: '/dashboard/directory/farms', icon: Warehouse, capability: 'farm:read' },
    { key: 'businesses', path: '/dashboard/directory/businesses', icon: Building2, capability: 'business:read' },
    { key: 'contacts', path: '/dashboard/directory/contacts', icon: ContactRound, capability: 'contact:read' },
    { key: 'workers', path: '/dashboard/directory/workers', icon: Users, capability: 'worker:read' },
    { key: 'feed', path: '/dashboard/directory/feed', icon: Wheat, capability: 'feedItem:read' },
  ].filter((c) => gate(c.capability));

  if (directoryChildren.length > 0) {
    navGroups.push({
      key: 'directory',
      path: '/dashboard/directory',
      icon: BookOpen,
      children: directoryChildren,
    });
  }

  // Accounting — only if at least one module contributes a readable accounting tab.
  const hasAccountingAccess = accountingScope.some((moduleId) => {
    const tabs = modules[moduleId]?.accountingTabs || [];
    return tabs.some((t) => !t.capability || gate(t.capability));
  });

  if (hasAccountingAccess) {
    const accChildren = [
      { key: 'sales', path: '/dashboard/accounting/sales', icon: ShoppingCart, capability: 'saleOrder:read' },
      { key: 'expenses', path: '/dashboard/accounting/expenses', icon: Receipt, capability: 'expense:read' },
      { key: 'vat', path: '/dashboard/accounting/vat', icon: BadgePercent, capability: '*' },
      { key: 'corporateTax', path: '/dashboard/accounting/corporate-tax', icon: Landmark, capability: '*' },
    ].filter((c) => gate(c.capability));

    if (accChildren.length > 0) {
      navGroups.push({
        key: 'accounting',
        path: '/dashboard/accounting',
        icon: Calculator,
        children: accChildren,
      });
    }
  }

  return { navItems, navGroups };
}
