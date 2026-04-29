import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Skull, Building2 } from 'lucide-react';
import PageTitle from '@/components/ui/page-title';
import useLocalQuery from '@/hooks/useLocalQuery';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

// Condemnation totals over time, grouped by source supplier so the
// owner can see which farms are sending the worst birds (per the
// innovation idea in the design discussion). Each row aggregates
// DOA + condemned + reject counts across every truck from that
// supplier.
export default function CondemnationLossView() {
  const { t } = useTranslation();

  const truckEntries = useLocalQuery('truckEntries');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const bySupplier = useMemo(() => {
    const acc = {};
    for (const tr of truckEntries) {
      if (tr.deletedAt) continue;
      const sid = typeof tr.supplier === 'object' ? tr.supplier?._id : tr.supplier;
      if (!sid) continue;
      if (!acc[sid]) {
        acc[sid] = {
          supplierId: sid,
          expected: 0, doa: 0, condemnation: 0, bGrade: 0, shortage: 0, trucks: 0,
        };
      }
      const s = tr.sortation || {};
      acc[sid].expected += Number(tr.expectedQty) || 0;
      acc[sid].doa += Number(s.doa) || 0;
      acc[sid].condemnation += Number(s.condemnation) || 0;
      acc[sid].bGrade += Number(s.bGrade) || 0;
      acc[sid].shortage += Number(s.shortage) || 0;
      acc[sid].trucks += 1;
    }
    const list = Object.values(acc);
    for (const row of list) {
      const losses = row.doa + row.condemnation + row.bGrade + row.shortage;
      row.lossPct = row.expected > 0 ? (losses / row.expected) * 100 : 0;
      row.totalLosses = losses;
    }
    return list.sort((a, b) => b.lossPct - a.lossPct);
  }, [truckEntries]);

  const totals = useMemo(() => {
    let expected = 0; let doa = 0; let condemnation = 0; let bGrade = 0; let shortage = 0;
    for (const row of bySupplier) {
      expected += row.expected;
      doa += row.doa;
      condemnation += row.condemnation;
      bGrade += row.bGrade;
      shortage += row.shortage;
    }
    const losses = doa + condemnation + bGrade + shortage;
    return { expected, doa, condemnation, bGrade, shortage, losses, lossPct: expected > 0 ? (losses / expected) * 100 : 0 };
  }, [bySupplier]);

  return (
    <div className="space-y-4">
      <PageTitle
        title={t('accountingTabs.condemnationLoss', 'Condemnation Loss')}
        subtitle={t('accountingTabs.condemnationLossDesc', 'Losses per source supplier — flag chronically high-loss farms.')}
      />

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('processingJobs.doa', 'DOA')}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtInt(totals.doa)}</p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('processingJobs.condemned', 'Condemned')}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtInt(totals.condemnation)}</p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('processingJobs.bGrade', 'B-grade')}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtInt(totals.bGrade)}</p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('processingJobs.shortage', 'Shortage')}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtInt(totals.shortage)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-destructive/10 text-destructive rounded-md px-3 py-2 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">{t('reconciliation.lossesSubtotal', 'Losses')}</span>
            <span className="text-sm font-bold tabular-nums">{fmtInt(totals.losses)} ({totals.lossPct.toFixed(2)}%)</span>
          </div>
        </CardContent>
      </Card>

      {bySupplier.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <Skull className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t('accountingTabs.noLosses', 'No losses recorded')}</h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('accountingTabs.noLossesDesc', 'Loss totals appear here once trucks log sortation data.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {bySupplier.map((row) => {
              const supplier = businessesById[row.supplierId];
              const tone = row.lossPct >= 1 ? 'text-destructive' : row.lossPct >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
              return (
                <div key={row.supplierId} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{supplier?.companyName || '—'}</p>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      {row.trucks} {t('processingJobs.trucks', 'trucks').toLowerCase()}
                      {' · '}
                      {fmtInt(row.expected)} {t('reconciliation.expected', 'expected').toLowerCase()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold tabular-nums ${tone}`}>
                      {row.lossPct.toFixed(2)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtInt(row.totalLosses)} {t('reconciliation.lossesSubtotal', 'losses').toLowerCase()}
                    </p>
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
