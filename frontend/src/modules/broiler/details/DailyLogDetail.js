import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, Home, User, Clock, Camera } from 'lucide-react';
import db from '@/lib/db';
import { fmtDate, Row, DocRow, CARD_CLS, LABEL_CLS } from './shared';
import useLocalRecord from '@/hooks/useLocalRecord';
import { LOG_TYPE_ICONS } from '@/lib/constants';

const fmtDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

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

export default function DailyLogDetail({ logId, onEdit }) {
  const { t } = useTranslation();
  const log = useLocalRecord('dailyLogs', logId);

  const rawPhotos = (log?.photos || []).filter(Boolean);
  const docFingerprint = JSON.stringify(rawPhotos);
  const resolvedPhotos = useLiveQuery(async () => {
    const resolveMedia = async (doc) => {
      if (typeof doc === 'object' && doc.url) return doc;
      const id = typeof doc === 'string' ? doc : doc?._id;
      if (!id) return null;
      return (await db.media.get(id)) || null;
    };
    const resolved = await Promise.all(rawPhotos.map(resolveMedia));
    return resolved.filter(Boolean);
  }, [docFingerprint]) ?? [];

  const house = useLiveQuery(async () => {
    if (!log?.house) return null;
    const houseId = typeof log.house === 'object' ? log.house._id : log.house;
    return (await db.houses?.get(houseId)) ?? null;
  }, [log?.house]) ?? null;

  if (!log) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  const TypeIcon = LOG_TYPE_ICONS[log.logType];
  const houseName = house?.name || (typeof log.house === 'object' ? log.house?.name : null) || t('batches.house');

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant={TYPE_BADGE_VARIANTS[log.logType] || 'secondary'}
                className="text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider"
              >
                {TypeIcon && <TypeIcon className="h-3 w-3 mr-1" />}
                {t(`batches.operations.logTypes.${log.logType}`)}
              </Badge>
              {log.cycleDay && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-sm font-mono">
                  {t('batches.operations.cycleDay', { day: log.cycleDay })}
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold">{fmtDate(log.date)}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Home className="h-3 w-3" />
              <span>{houseName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit?.(log)} title={t('common.edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {log.logType === 'DAILY' && (
            <div className={CARD_CLS}>
              <div className="px-3 py-2.5 space-y-0.5">
                <Row label={t('batches.operations.deaths')} value={log.deaths != null ? `${log.deaths} ${t('batches.operations.deathsUnit')}` : '—'} />
                <Row label={t('batches.operations.feedKg')} value={log.feedKg != null ? `${log.feedKg} kg` : '—'} />
                <Row label={t('batches.operations.waterLiters')} value={log.waterLiters != null ? `${log.waterLiters} L` : '—'} />
              </div>
            </div>
          )}

          {log.logType === 'WEIGHT' && (
            <div className={CARD_CLS}>
              <div className="px-3 py-2.5 space-y-0.5">
                <Row label={t('batches.operations.averageWeight')} value={log.averageWeight != null ? `${log.averageWeight.toLocaleString('en-US')} g` : '—'} bold />
              </div>
            </div>
          )}

          {log.logType === 'ENVIRONMENT' && (
            <div className={CARD_CLS}>
              <div className="px-3 py-2.5 space-y-0.5">
                <Row label={t('batches.operations.temperature')} value={log.temperature != null ? `${log.temperature}°C` : '—'} />
                <Row label={t('batches.operations.humidity')} value={log.humidity != null ? `${log.humidity}%` : '—'} />
                <Row label={t('batches.operations.waterTDS')} value={log.waterTDS != null ? `${log.waterTDS} ppm` : '—'} />
                <Row label={t('batches.operations.waterPH')} value={log.waterPH != null ? `${log.waterPH}` : '—'} />
              </div>
            </div>
          )}

          {log.notes && (
            <div className="rounded-md bg-muted/30 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('batches.operations.notes')}</p>
              <p className="text-sm whitespace-pre-wrap">{log.notes}</p>
            </div>
          )}

          {resolvedPhotos.length > 0 && (
            <div className={CARD_CLS}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                {t('batches.operations.photos')}
              </div>
              <div className="divide-y">
                {resolvedPhotos.map((doc) => (
                  <DocRow key={doc._id} label={t('batches.operations.photos')} doc={doc} />
                ))}
              </div>
            </div>
          )}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className={LABEL_CLS}>{t('batches.operations.createdByLabel')}</span>
                <span className="text-sm ml-auto">{formatUserName(log.createdBy)}</span>
              </div>
              {log.updatedBy && (
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className={LABEL_CLS}>{t('batches.operations.updatedByLabel')}</span>
                  <span className="text-sm ml-auto">{formatUserName(log.updatedBy)}</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-1 pb-2">
            {t('batches.operations.createdLabel', 'Created')} {fmtDateTime(log.createdAt)}
            {' · '}
            {t('batches.operations.updatedLabel', 'Last Updated')} {fmtDateTime(log.updatedAt)}
          </p>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 justify-end pt-2 border-t px-6 pb-4 shrink-0">
        <Button onClick={() => onEdit?.(log)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t('batches.operations.editEntry')}
        </Button>
      </div>
    </div>
  );
}
