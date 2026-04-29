import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, AlertTriangle, Boxes, Drumstick,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeReconciliation, varianceTone } from '@/modules/slaughterhouse/lib/reconciliation';
import {
  canMarkPackingComplete, canCloseJob, canReopen,
} from '@/modules/slaughterhouse/lib/jobStatus';
import ApproveAndCloseSheet from '@/modules/slaughterhouse/sheets/ApproveAndCloseSheet';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');
const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Row({ label, value, bold, tone, indent }) {
  return (
    <div className={cn('flex justify-between py-1', indent && 'pl-4 text-muted-foreground')}>
      <span className="text-sm">{label}</span>
      <span
        className={cn(
          'text-sm tabular-nums',
          bold && 'font-semibold',
          tone === 'destructive' && 'text-destructive',
          tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// Live reconciliation snapshot — the same identities the printed
// Wahat / Fakhr reports show, but recomputed from Dexie on every save.
// "Mark Packing Complete" and "Approve & Close" are the manual flips
// the operator can apply from here.
export default function JobReconciliationView() {
  const { t } = useTranslation();
  const ctx = useOutletContext() || {};
  const {
    job, liveStatus,
    truckEntries = [],
    productionBoxes = [],
    productionPortions = [],
    productionGiblets = [],
  } = ctx;

  const [closeSheetOpen, setCloseSheetOpen] = useState(false);

  const recon = useMemo(
    () => computeReconciliation({
      truckEntries,
      productionBoxes,
      productionPortions,
      productionGiblets,
    }),
    [truckEntries, productionBoxes, productionPortions, productionGiblets],
  );

  const tone = varianceTone(recon.variance);
  const balanceLabel = recon.isBalanced
    ? t('reconciliation.balanceOk', 'Balanced')
    : t('reconciliation.balanceVariance', 'Variance {{value}}', {
      value: recon.variance > 0 ? `+${fmtInt(recon.variance)}` : fmtInt(recon.variance),
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold">{t('reconciliation.balance', 'Balance')}</h2>
            <Badge
              variant={recon.isBalanced ? 'outline' : 'destructive'}
              className={cn(
                'gap-1.5 text-xs',
                tone === 'minor' && 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
                tone === 'warning' && 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100',
              )}
            >
              {recon.isBalanced
                ? <CheckCircle2 className="h-3 w-3" />
                : <AlertTriangle className="h-3 w-3" />}
              {balanceLabel}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-0">
            <Row label={t('reconciliation.expected', 'Expected')} value={fmtInt(recon.expectedQty)} bold />
            {recon.doa > 0 && <Row label={t('sortation.doa', 'DOA')} value={`-${fmtInt(recon.doa)}`} indent tone="destructive" />}
            {recon.condemnation > 0 && <Row label={t('sortation.condemned', 'Condemned')} value={`-${fmtInt(recon.condemnation)}`} indent tone="destructive" />}
            {recon.bGrade > 0 && <Row label={t('sortation.bGrade', 'B-grade')} value={`-${fmtInt(recon.bGrade)}`} indent tone="destructive" />}
            {recon.shortage > 0 && <Row label={t('sortation.shortage', 'Shortage')} value={`-${fmtInt(recon.shortage)}`} indent tone="destructive" />}
            <Separator className="my-1" />
            <Row label={t('reconciliation.netToLine', 'Net to line')} value={fmtInt(recon.netToLine)} bold />
            <Row label={t('reconciliation.produced', 'Produced')} value={fmtInt(recon.wholeBirdsPacked)} bold tone="success" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold">
            {t('processingJobs.yield', 'Yield')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t('reconciliation.yieldAvgDressedKg', 'Avg dressed weight')}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">
                {recon.avgDressedKg != null ? `${fmtKg(recon.avgDressedKg)} kg` : '—'}
              </p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t('reconciliation.yieldGibletsRatio', 'Giblets ratio')}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">
                {recon.gibletsRatio != null ? `${(recon.gibletsRatio * 100).toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>

          <Separator className="my-2" />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Boxes className="h-3 w-3" />
                {t('production.wholeChickens', 'Whole Chickens')}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">
                {fmtKg(recon.wholeKgPacked)} kg
              </p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Drumstick className="h-3 w-3" />
                {t('production.portions', 'Portions')} + {t('production.giblets', 'Giblets')}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">
                {fmtKg(recon.trayKg)} kg
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 justify-end">
        {canMarkPackingComplete(liveStatus) ? (
          <Button
            variant="outline"
            onClick={() => setCloseSheetOpen(true)}
          >
            {t('reconciliation.markPackingComplete', 'Mark Packing Complete')}
          </Button>
        ) : null}
        {canCloseJob(liveStatus) ? (
          <Button onClick={() => setCloseSheetOpen(true)}>
            {t('reconciliation.closeJob', 'Close Job')}
          </Button>
        ) : null}
        {canReopen(liveStatus) ? (
          <Button variant="outline" onClick={() => setCloseSheetOpen(true)}>
            {t('reconciliation.reopen', 'Reopen for Packing')}
          </Button>
        ) : null}
      </div>

      <ApproveAndCloseSheet
        open={closeSheetOpen}
        onOpenChange={setCloseSheetOpen}
        job={job}
        reconciliation={recon}
      />
    </div>
  );
}
