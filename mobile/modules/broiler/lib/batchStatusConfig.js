import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleDashed,
  CircleDot,
} from 'lucide-react-native';

// Solid (fully opaque) pin backgrounds. The previous NativeWind classes
// used `dark:bg-*-900/40` (40% alpha) which let the avatar tile colour
// bleed through and made the pin look hollow against the green avatar.
// These tones match the lucide icon colours but stay legible on every
// surface (elevated card, hero gradient, list row).
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
