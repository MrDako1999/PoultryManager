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
  Bird,
  Scale,
} from 'lucide-react-native';

export const DOC_ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
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

export const PART_TYPES = [
  'LIVER', 'GIZZARD', 'HEART', 'BREAST', 'LEG', 'WING',
  'BONE', 'THIGH', 'DRUMSTICK', 'BONELESS_THIGH', 'NECK', 'MINCE',
];

export const SALE_METHODS = ['SLAUGHTERED', 'LIVE_BY_PIECE', 'LIVE_BY_WEIGHT'];

export const SALE_METHOD_ICONS = {
  SLAUGHTERED: Scissors,
  LIVE_BY_PIECE: Bird,
  LIVE_BY_WEIGHT: Scale,
};

export const SALE_INVOICE_TYPES = ['VAT_INVOICE', 'CASH_MEMO'];

export const SALE_INVOICE_TYPE_ICONS = {
  VAT_INVOICE: FileText,
  CASH_MEMO: Receipt,
};

export const COUNTRY_VAT_MAP = {
  AE: { name: 'United Arab Emirates', vatRate: 5, currency: 'AED' },
  SA: { name: 'Saudi Arabia', vatRate: 15, currency: 'SAR' },
  BH: { name: 'Bahrain', vatRate: 10, currency: 'BHD' },
  OM: { name: 'Oman', vatRate: 5, currency: 'OMR' },
  KW: { name: 'Kuwait', vatRate: 0, currency: 'KWD' },
  QA: { name: 'Qatar', vatRate: 0, currency: 'QAR' },
};
