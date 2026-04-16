import {
  LayoutDashboard,
  Layers,
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

export const navItems = [
  { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
  { key: 'batches', path: '/dashboard/batches', icon: Layers },
  { key: 'health', path: '/dashboard/health', icon: HeartPulse },
];

export const navGroups = [
  {
    key: 'directory',
    path: '/dashboard/directory',
    icon: BookOpen,
    children: [
      { key: 'farms', path: '/dashboard/directory/farms', icon: Warehouse },
      { key: 'businesses', path: '/dashboard/directory/businesses', icon: Building2 },
      { key: 'contacts', path: '/dashboard/directory/contacts', icon: ContactRound },
      { key: 'workers', path: '/dashboard/directory/workers', icon: Users },
      { key: 'feed', path: '/dashboard/directory/feed', icon: Wheat },
    ],
  },
  {
    key: 'accounting',
    path: '/dashboard/accounting',
    icon: Calculator,
    children: [
      { key: 'sales', path: '/dashboard/accounting/sales', icon: ShoppingCart },
      { key: 'expenses', path: '/dashboard/accounting/expenses', icon: Receipt },
      { key: 'vat', path: '/dashboard/accounting/vat', icon: BadgePercent },
      { key: 'corporateTax', path: '/dashboard/accounting/corporate-tax', icon: Landmark },
    ],
  },
];
