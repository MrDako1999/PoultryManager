import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers, Bird, Skull, Wheat, Warehouse, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import useCapabilities from '@/hooks/useCapabilities';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BroilerActiveBatches() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useCapabilities();

  const batches = useLocalQuery('batches');
  const dailyLogs = useLocalQuery('dailyLogs');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'IN_PROGRESS'),
    [batches],
  );

  const batchCards = useMemo(() => {
    const activeBatchIds = new Set(activeBatches.map((b) => b._id));
    const deathsByBatch = {};
    const feedByBatch = {};

    dailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch._id : log.batch;
      if (!activeBatchIds.has(batchId)) return;
      if (log.deaths) deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + log.deaths;
      if (log.feedKg) feedByBatch[batchId] = (feedByBatch[batchId] || 0) + log.feedKg;
    });

    return activeBatches.map((b) => {
      const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
      const deaths = deathsByBatch[b._id] || 0;
      const remaining = initial - deaths;
      const mortality = initial > 0 ? ((deaths / initial) * 100).toFixed(1) : '0.0';
      const feed = feedByBatch[b._id] || 0;
      const dayCount = b.startDate
        ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
        : 0;

      return {
        _id: b._id,
        batchName: b.batchName,
        farmName: b.farm?.farmName || b.farm?.nickname || '',
        dayCount,
        initial,
        remaining,
        mortality,
        feed,
      };
    });
  }, [activeBatches, dailyLogs]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t('dashboard.activeBatchesTitle')}</h2>
      {batchCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('dashboard.noActiveBatches')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {t('dashboard.noActiveBatchesDesc')}
            </p>
            {can('batch:create') && (
              <Button onClick={() => navigate('/dashboard/batches', { state: { openNew: true } })}>
                {t('dashboard.createFirstBatch')}
                <ArrowRight className="ml-2 h-4 w-4 rtl:ml-0 rtl:mr-2 rtl:rotate-180" />
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {batchCards.map((b) => (
            <Card
              key={b._id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => navigate(`/dashboard/batches/${b._id}`)}
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{b.batchName}</p>
                    {b.farmName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Warehouse className="h-3 w-3 shrink-0" />
                        <span className="truncate">{b.farmName}</span>
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">
                    <Calendar className="h-3 w-3" />
                    {t('dashboard.dayN', { n: b.dayCount })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1.5">
                    <Bird className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">{t('dashboard.birds')}</p>
                      <p className="text-sm font-semibold tabular-nums">{b.remaining.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Skull className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">{t('dashboard.mortality')}</p>
                      <p className="text-sm font-semibold tabular-nums">{b.mortality}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wheat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">{t('dashboard.feedConsumed')}</p>
                      <p className="text-sm font-semibold tabular-nums">{b.feed.toLocaleString()} kg</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
