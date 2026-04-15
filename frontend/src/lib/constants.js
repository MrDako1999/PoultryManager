/**
 * Shared domain constants.
 *
 * Any enum, config object, or icon map used in two or more files
 * belongs here. Keeps a single source of truth and avoids drift
 * between files that define the same constant independently.
 */

import {
  FileText,
  Receipt,
  FileX,
  Sprout,
  TrendingUp,
  Target,
  CircleEllipsis,
  Wrench,
  HardHat,
  Zap,
  Fuel,
  UtensilsCrossed,
  Home,
  Package,
  Scissors,
  Heart,
  Wheat,
  Egg,
  ClipboardList,
  Weight,
  Thermometer,
} from 'lucide-react';

export const DOC_ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export const INVOICE_TYPES = ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'];

export const INVOICE_TYPE_ICONS = {
  TAX_INVOICE: FileText,
  CASH_MEMO: Receipt,
  NO_INVOICE: FileX,
};

export const EXPENSE_CATEGORIES = [
  'MAINTENANCE', 'LABOUR', 'UTILITIES',
  'FUEL', 'CONSUMABLES', 'RENT',
  'ANIMAL_PROCESSING', 'ANIMAL_WELFARE', 'FEED',
  'SOURCE', 'ASSETS', 'OTHERS',
];

export const EXPENSE_CATEGORY_ICONS = {
  MAINTENANCE: Wrench,
  LABOUR: HardHat,
  UTILITIES: Zap,
  FUEL: Fuel,
  CONSUMABLES: UtensilsCrossed,
  RENT: Home,
  ANIMAL_PROCESSING: Scissors,
  ANIMAL_WELFARE: Heart,
  FEED: Wheat,
  SOURCE: Egg,
  ASSETS: Package,
  OTHERS: CircleEllipsis,
};

export const FEED_TYPES = ['STARTER', 'GROWER', 'FINISHER', 'OTHER'];

export const FEED_TYPE_ICONS = {
  STARTER: Sprout,
  GROWER: TrendingUp,
  FINISHER: Target,
  OTHER: CircleEllipsis,
};

export const STATUS_VARIANTS = {
  NEW: 'secondary',
  IN_PROGRESS: 'default',
  COMPLETE: 'outline',
  DELAYED: 'destructive',
  OTHER: 'secondary',
};

export const LOG_TYPES = ['DAILY', 'WEIGHT', 'ENVIRONMENT'];

export const LOG_TYPE_ICONS = {
  DAILY: ClipboardList,
  WEIGHT: Weight,
  ENVIRONMENT: Thermometer,
};

export const COUNTRY_VAT_MAP = {
  AE: { name: 'United Arab Emirates', vatRate: 5, currency: 'AED' },
  SA: { name: 'Saudi Arabia', vatRate: 15, currency: 'SAR' },
  BH: { name: 'Bahrain', vatRate: 10, currency: 'BHD' },
  OM: { name: 'Oman', vatRate: 5, currency: 'OMR' },
  KW: { name: 'Kuwait', vatRate: 0, currency: 'KWD' },
  QA: { name: 'Qatar', vatRate: 0, currency: 'QAR' },
};
