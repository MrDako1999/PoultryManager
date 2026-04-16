import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';
import EntityRowBase from '@/shared/rows/EntityRowBase';
import { LOG_TYPE_ICONS } from '@/lib/constants';

const TYPE_BADGE_VARIANTS = {
  DAILY: 'default',
  WEIGHT: 'secondary',
  ENVIRONMENT: 'outline',
};

function formatUserName(user) {
  if (!user) return '—';
  if (typeof user === 'object') return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
  return String(user);
}

function LogSummary({ log, t }) {
  switch (log.logType) {
    case 'DAILY': {
      const parts = [];
      if (log.deaths != null) parts.push(`${log.deaths} ${t('batches.operations.deathsUnit')}`);
      if (log.feedKg != null) parts.push(`${log.feedKg} kg`);
      if (log.waterLiters != null) parts.push(`${log.waterLiters} L`);
      return <span>{parts.join(' · ') || '—'}</span>;
    }
    case 'WEIGHT':
      return <span>{log.averageWeight != null ? `${log.averageWeight.toLocaleString()}g` : '—'}</span>;
    case 'ENVIRONMENT': {
      const parts = [];
      if (log.temperature != null) parts.push(`${log.temperature}°C`);
      if (log.humidity != null) parts.push(`${log.humidity}%`);
      if (log.waterTDS != null) parts.push(`TDS ${log.waterTDS}`);
      if (log.waterPH != null) parts.push(`pH ${log.waterPH}`);
      return <span>{parts.join(' · ') || '—'}</span>;
    }
    default:
      return <span>—</span>;
  }
}

export default function DailyLogRow({ log, onClick, selected, t }) {
  const TypeIcon = LOG_TYPE_ICONS[log.logType];

  return (
    <EntityRowBase onClick={onClick} selected={selected}>
      <div className="mt-0.5 shrink-0">
        {TypeIcon && <TypeIcon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={TYPE_BADGE_VARIANTS[log.logType] || 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
            {t(`batches.operations.logTypes.${log.logType}`)}
          </Badge>
          <span className="text-sm font-medium truncate">
            <LogSummary log={log} t={t} />
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
          {log.cycleDay && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
              {t('batches.operations.cycleDay', { day: log.cycleDay })}
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {formatUserName(log.createdBy)}
          </span>
        </div>
      </div>
    </EntityRowBase>
  );
}
