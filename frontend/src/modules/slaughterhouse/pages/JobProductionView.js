import { useState, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Boxes, Drumstick, Heart } from 'lucide-react';
import ProductionBoxSheet from '@/modules/slaughterhouse/sheets/ProductionBoxSheet';
import ProductionPortionSheet from '@/modules/slaughterhouse/sheets/ProductionPortionSheet';
import ProductionGibletSheet from '@/modules/slaughterhouse/sheets/ProductionGibletSheet';
import { formatBandLabel } from '@/modules/slaughterhouse/lib/defaultWeightBands';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');
const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Production tab. Three sub-tabs (Whole / Portions / Giblets), each
// listing rows produced for the job with totals and an Add button.
export default function JobProductionView() {
  const { id } = useParams();
  const { t } = useTranslation();
  const {
    productionBoxes = [],
    productionPortions = [],
    productionGiblets = [],
  } = useOutletContext() || {};

  const [boxSheetOpen, setBoxSheetOpen] = useState(false);
  const [portionSheetOpen, setPortionSheetOpen] = useState(false);
  const [gibletSheetOpen, setGibletSheetOpen] = useState(false);

  const liveBoxes = useMemo(
    () => productionBoxes
      .filter((b) => !b.deletedAt)
      .sort((a, b) => (Number(a.weightBandGrams) || 0) - (Number(b.weightBandGrams) || 0)),
    [productionBoxes],
  );
  const livePortions = useMemo(
    () => productionPortions.filter((p) => !p.deletedAt),
    [productionPortions],
  );
  const liveGiblets = useMemo(
    () => productionGiblets.filter((g) => !g.deletedAt),
    [productionGiblets],
  );

  const totals = useMemo(() => {
    const boxesTotalBirds = liveBoxes.reduce((s, b) => {
      const computed = Number(b.boxQty || 0) * Number(b.birdsPerBox || 0);
      return s + (b.totalBirds != null ? Number(b.totalBirds) : computed);
    }, 0);
    const boxesTotalKg = liveBoxes.reduce((s, b) => {
      if (b.totalKg != null) return s + Number(b.totalKg);
      return s + Number(b.boxQty || 0) * Number(b.birdsPerBox || 0) * (Number(b.weightBandGrams || 0) / 1000);
    }, 0);
    const portionsKg = livePortions.reduce((s, p) => {
      if (p.totalKg != null) return s + Number(p.totalKg);
      return s + Number(p.trayCount || 0) * Number(p.weightPerTray || 0);
    }, 0);
    const gibletsKg = liveGiblets.reduce((s, g) => {
      if (g.totalKg != null) return s + Number(g.totalKg);
      return s + Number(g.trayCount || 0) * Number(g.weightPerTray || 0);
    }, 0);
    return { boxesTotalBirds, boxesTotalKg, portionsKg, gibletsKg };
  }, [liveBoxes, livePortions, liveGiblets]);

  return (
    <Tabs defaultValue="boxes" className="space-y-3">
      <TabsList>
        <TabsTrigger value="boxes" className="gap-1.5">
          <Boxes className="h-3.5 w-3.5" />
          {t('production.wholeChickens', 'Whole Chickens')}
        </TabsTrigger>
        <TabsTrigger value="portions" className="gap-1.5">
          <Drumstick className="h-3.5 w-3.5" />
          {t('production.portions', 'Portions')}
        </TabsTrigger>
        <TabsTrigger value="giblets" className="gap-1.5">
          <Heart className="h-3.5 w-3.5" />
          {t('production.giblets', 'Giblets')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="boxes" className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground tabular-nums">
            {fmtInt(totals.boxesTotalBirds)} {t('production.totalBirds', 'Total birds').toLowerCase()}
            {' · '}
            {fmtKg(totals.boxesTotalKg)} {t('production.totalKg', 'Total kg').toLowerCase()}
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setBoxSheetOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t('production.addBox', 'Add box')}
          </Button>
        </div>

        {liveBoxes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
                <Boxes className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">{t('production.noBoxes', 'No boxes packed yet')}</h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                {t('production.noBoxesDesc', 'Tap a weight band below to add the first box.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {liveBoxes.map((box) => {
                const totalBirds = box.totalBirds != null
                  ? Number(box.totalBirds)
                  : Number(box.boxQty || 0) * Number(box.birdsPerBox || 0);
                const totalKg = box.totalKg != null
                  ? Number(box.totalKg)
                  : totalBirds * (Number(box.weightBandGrams || 0) / 1000);
                return (
                  <div key={box._id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <span className="text-xs font-semibold tabular-nums">
                        {formatBandLabel(box.weightBandGrams)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium tabular-nums">{fmtInt(box.boxQty)} × {fmtInt(box.birdsPerBox)}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {t(`production.allocations.${box.allocation}`, box.allocation)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {fmtInt(totalBirds)} {t('production.totalBirds', 'birds').toLowerCase()}
                        {' · '}
                        {fmtKg(totalKg)} {t('production.totalKg', 'kg').toLowerCase()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="portions" className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground tabular-nums">
            {fmtKg(totals.portionsKg)} {t('production.totalKg', 'Total kg').toLowerCase()}
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setPortionSheetOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t('production.addPortion', 'Add portion')}
          </Button>
        </div>

        {livePortions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
                <Drumstick className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">{t('production.noPortions', 'No portion trays yet')}</h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                {t('production.noPortionsDesc', 'Tap a part type below to add the first tray.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {livePortions.map((p) => {
                const totalKg = p.totalKg != null ? Number(p.totalKg) : Number(p.trayCount || 0) * Number(p.weightPerTray || 0);
                return (
                  <div key={p._id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {t(`production.partTypes.${p.partType}`, p.partType)}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {t(`production.allocations.${p.allocation}`, p.allocation)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {fmtInt(p.trayCount)} {t('production.trayCount', 'trays').toLowerCase()}
                        {' · '}
                        {fmtKg(p.weightPerTray)} {t('production.weightPerTray', 'kg/tray').toLowerCase()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm font-medium tabular-nums">
                      {fmtKg(totalKg)} kg
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="giblets" className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground tabular-nums">
            {fmtKg(totals.gibletsKg)} {t('production.totalKg', 'Total kg').toLowerCase()}
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setGibletSheetOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t('production.addGiblet', 'Add giblet')}
          </Button>
        </div>

        {liveGiblets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
                <Heart className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">{t('production.noGiblets', 'No giblet trays yet')}</h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                {t('production.noGibletsDesc', 'Tap a giblet type below to add the first tray.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {liveGiblets.map((g) => {
                const totalKg = g.totalKg != null ? Number(g.totalKg) : Number(g.trayCount || 0) * Number(g.weightPerTray || 0);
                return (
                  <div key={g._id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {t(`production.giblets.${g.partType}`, g.partType)}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {t(`production.allocations.${g.allocation}`, g.allocation)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {fmtInt(g.trayCount)} {t('production.trayCount', 'trays').toLowerCase()}
                        {' · '}
                        {fmtKg(g.weightPerTray)} {t('production.weightPerTray', 'kg/tray').toLowerCase()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm font-medium tabular-nums">
                      {fmtKg(totalKg)} kg
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <ProductionBoxSheet open={boxSheetOpen} onOpenChange={setBoxSheetOpen} jobId={id} />
      <ProductionPortionSheet open={portionSheetOpen} onOpenChange={setPortionSheetOpen} jobId={id} />
      <ProductionGibletSheet open={gibletSheetOpen} onOpenChange={setGibletSheetOpen} jobId={id} />
    </Tabs>
  );
}
