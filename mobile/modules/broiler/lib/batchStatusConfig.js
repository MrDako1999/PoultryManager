import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleDashed,
  CircleDot,
} from 'lucide-react-native';

export const STATUS_CONFIG = {
  NEW: {
    icon: CircleDashed,
    iconColor: 'hsl(150, 10%, 45%)',
    bg: 'bg-muted',
  },
  IN_PROGRESS: {
    icon: Clock,
    iconColor: '#d97706',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  COMPLETE: {
    icon: CheckCircle2,
    iconColor: '#059669',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  DELAYED: {
    icon: AlertTriangle,
    iconColor: '#dc2626',
    bg: 'bg-red-100 dark:bg-red-900/40',
  },
  OTHER: {
    icon: CircleDot,
    iconColor: 'hsl(150, 10%, 45%)',
    bg: 'bg-muted',
  },
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.OTHER;
}
