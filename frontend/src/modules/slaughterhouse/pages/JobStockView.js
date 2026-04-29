import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Snowflake } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import ExpiryBadge from '@/modules/slaughterhouse/components/ExpiryBadge';
import { formatBandLabel } from '@/modules/slaughterhouse/lib/defaultWeightBands';

const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

// Filtered slice of cold store showing items produced from THIS job.
// Reads from stockUnits with sourceId === productionRowId for any of
// the job's production rows. Stock units are produced only from rows
// with allocation === 'STOCK'.
export default function JobStockView() {
  const { id } = useParams();
  const { t } = useTranslation();

  const stockUnits = useLocalQuery('stockUnits');
  const productionBoxes = useLocalQuery('productionBoxes', { job: id });
  const productionPortions = useLocalQuery('productionPortions', { job: id });
  const productionGiblets = useLocalQuery('productionGiblets', { job: id });
  const storageLocations = useLocalQuery('storageLocations');

  const sourceIds = useMemo(() => {
    const ids = new Set();
    [productionBoxes, productionPortions, productionGiblets].forEach((rows) => {
      for (const r of rows) {
        if (!r.deletedAt) ids.add(r._id);
      }
    });
    return ids;
  }, [productionBoxes, productionPortions, productionGiblets]);

  const locationsById = useMemo(
    () => Object.fromEntries(storageLocations.map((l) => [l._id, l])),
    [storageLocations],
  );

  const visibleStock = useMemo(
    () => stockUnits
      .filter((u) => !u.deletedAt && sourceIds.has(u.sourceId))
      .sort((a, b) => {
        const aT = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bT = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aT - bT;
      }),
    [stockUnits, sourceIds],
  );

  if (visibleStock.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
            <Snowflake className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">{t('stock.noStock', 'No stock on hand')}</h3>
          <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
            {t('stock.noStockDesc', 'Boxes, portions and giblets allocated to STOCK appear here as soon as they are packed.')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {visibleStock.map((u) => {
          const loc = locationsById[typeof u.location === 'object' ? u.location?._id : u.location];
          const sourceLabel = u.sourceType === 'box'
            ? formatBandLabel(u.weightBandGrams)
            : t(`production.partTypes.${u.partType}`, u.partType || u.sourceType);
          return (
            <div key={u._id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium truncate">{sourceLabel}</p>
                  <ExpiryBadge expiresAt={u.expiresAt} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {loc?.name || t('stock.byLocation', 'Location')}
                  {' · '}
                  {fmtInt(u.qtyAvailable)} {t('stock.qtyAvailable', 'Available').toLowerCase()}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm font-medium tabular-nums">
                {fmtKg(u.weightKg)} kg
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
