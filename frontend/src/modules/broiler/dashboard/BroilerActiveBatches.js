import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import BatchCard from '@/modules/broiler/components/BatchCard';

// Web port of mobile/modules/broiler/dashboard/BroilerActiveBatches.js.
// One-pass aggregation over dailyLogs, then sort cards by descending
// mortality so the worst-performing batches surface to the top of the
// dashboard. Single-column stack with a 2pt rounded divider between cards
// matches the mobile recipe; the divider lives in the inter-card gap rather
// than as a card-edge stroke so the cards still read as discrete tiles.
export default function BroilerActiveBatches() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useCapabilities();
  const canCreate = can('batch:create');

  const batches = useLocalQuery('batches');
  const dailyLogs = useLocalQuery('dailyLogs');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'IN_PROGRESS'),
    [batches],
  );

  const deathsByBatch = useMemo(() => {
    const acc = {};
    const activeIds = new Set(activeBatches.map((b) => b._id));
    dailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY' || !log.deaths) return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!activeIds.has(batchId)) return;
      acc[batchId] = (acc[batchId] || 0) + log.deaths;
    });
    return acc;
  }, [activeBatches, dailyLogs]);

  // Sort by descending mortality so the cards needing attention surface
  // first. Same rule as the mobile dashboard.
  const sorted = useMemo(() => {
    return [...activeBatches]
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
        return { batch: b, deaths, mortalityPct };
      })
      .sort((a, b) => b.mortalityPct - a.mortalityPct);
  }, [activeBatches, deathsByBatch]);

  if (sorted.length === 0) {
    return (
      <section>
        <Eyebrow className="mb-2 ms-1.5">
          {t('dashboard.activeBatchesTitle', 'Active Batches')}
        </Eyebrow>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {t('dashboard.noActiveBatches', 'No active batches')}
            </h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('dashboard.noActiveBatchesDesc')}
            </p>
            {canCreate ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/dashboard/batches', { state: { openNew: true } })}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('dashboard.createFirstBatch', 'Create First Batch')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <Eyebrow className="mb-2 ms-1.5">
        {t('dashboard.activeBatchesTitle', 'Active Batches')}
      </Eyebrow>
      <div>
        {sorted.map(({ batch, deaths }, idx) => (
          <div key={batch._id}>
            {idx > 0 ? (
              // 2pt rounded divider in the gap between cards. Uses the
              // elevated-card-border token (the strongest border tone) sized
              // up so it carries against the page background. Mobile parity:
              // the divider lives in inter-card whitespace, NOT on the card.
              <div
                aria-hidden="true"
                className="mx-1 my-3 h-0.5 rounded-full bg-elevatedCard-border"
              />
            ) : null}
            <BatchCard batch={batch} deaths={deaths} variant="default" />
          </div>
        ))}
      </div>
    </section>
  );
}
