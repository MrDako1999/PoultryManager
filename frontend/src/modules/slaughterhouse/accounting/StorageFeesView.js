import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Snowflake } from 'lucide-react';
import PageTitle from '@/components/ui/page-title';
import useLocalQuery from '@/hooks/useLocalQuery';

const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// Storage-fee accruals per owner — for the toll-processing model where
// the slaughterhouse charges customers for cold-store occupancy.
// Frontend-only stub: shows totals per owner (kg in stock × age days)
// as a placeholder for the future fee schedule. When the backend
// lands, swap in real fee computation.
export default function StorageFeesView() {
  const { t } = useTranslation();

  const stockUnits = useLocalQuery('stockUnits');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const byOwner = useMemo(() => {
    const acc = {};
    const now = Date.now();
    for (const u of stockUnits) {
      if (u.deletedAt) continue;
      const owner = typeof u.owner === 'object' ? u.owner?._id : u.owner;
      if (!owner) continue;
      if (!acc[owner]) acc[owner] = { ownerId: owner, totalKg: 0, units: 0, ageHours: 0 };
      acc[owner].totalKg += Number(u.weightKg) || 0;
      acc[owner].units += Number(u.qtyAvailable) || 0;
      const packagedAt = u.packagedAt ? new Date(u.packagedAt).getTime() : now;
      acc[owner].ageHours += Math.max(0, (now - packagedAt) / (1000 * 60 * 60));
    }
    return Object.values(acc).sort((a, b) => b.totalKg - a.totalKg);
  }, [stockUnits]);

  return (
    <div className="space-y-4">
      <PageTitle
        title={t('accountingTabs.storageFees', 'Storage Fees')}
        subtitle={t('accountingTabs.storageFeesDesc', 'Cold-store occupancy per owner.')}
      />

      {byOwner.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <Snowflake className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t('stock.noStock', 'No stock on hand')}</h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('accountingTabs.storageFeesEmpty', 'Storage-fee accruals appear here once you start storing stock for customers.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {byOwner.map((row) => {
              const owner = businessesById[row.ownerId];
              const avgAgeHours = row.units > 0 ? row.ageHours / row.units : 0;
              return (
                <div key={row.ownerId} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Snowflake className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{owner?.companyName || '—'}</p>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      {row.units} {t('stock.qtyAvailable', 'units').toLowerCase()}
                      {' · '}
                      {(avgAgeHours / 24).toFixed(1)} {t('common.daysAvg', 'days avg')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm font-medium tabular-nums">
                    {fmtKg(row.totalKg)} kg
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
