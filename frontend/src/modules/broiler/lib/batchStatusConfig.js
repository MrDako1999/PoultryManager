import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleDashed,
  CircleDot,
} from 'lucide-react';

// Web port of mobile/modules/broiler/lib/batchStatusConfig.js. The pin
// backgrounds are FULLY OPAQUE — the mobile note about translucent NativeWind
// classes letting the avatar tile bleed through applies on web too: when the
// pin sits over the brand-green BatchAvatar tile, semi-transparent backgrounds
// turn muddy. Lucide-palette hexes that match the icon colour at high
// contrast on every surface (elevated card, sheet, list row, hero gradient).
export const STATUS_CONFIG = {
  NEW: {
    icon: CircleDashed,
    iconColor: 'hsl(150, 10%, 45%)',
    pinBgLight: 'hsl(150, 10%, 88%)',
    pinBgDark: 'hsl(150, 12%, 32%)',
  },
  IN_PROGRESS: {
    icon: Clock,
    iconColor: '#d97706',
    pinBgLight: '#fef3c7',
    pinBgDark: '#3a2a0d',
  },
  COMPLETE: {
    icon: CheckCircle2,
    iconColor: '#059669',
    pinBgLight: '#d1fae5',
    pinBgDark: '#0e2e21',
  },
  DELAYED: {
    icon: AlertTriangle,
    iconColor: '#dc2626',
    pinBgLight: '#fee2e2',
    pinBgDark: '#3a1010',
  },
  OTHER: {
    icon: CircleDot,
    iconColor: 'hsl(150, 10%, 45%)',
    pinBgLight: 'hsl(150, 10%, 88%)',
    pinBgDark: 'hsl(150, 12%, 32%)',
  },
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.OTHER;
}
