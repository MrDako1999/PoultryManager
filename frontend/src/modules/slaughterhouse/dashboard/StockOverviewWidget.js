import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Snowflake, AlertTriangle, Boxes, Drumstick, Heart } from 'lucide-react';
import useSlaughterhouseDashboardStats from './useSlaughterhouseDashboardStats';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');
const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export default function StockOverviewWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { coldStore } = useSlaughterhouseDashboardStats('today');

  const expiringSoon = (coldStore.critical || 0) + (coldStore.expired || 0);

  return (
    <section>
      <Eyebrow className="mb-2 ms-1.5">{t('dashboard.stockOverview', 'Stock Overview')}</Eyebrow>

      <Card>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/cold-store')}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left border-b"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Snowflake className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-medium">
                  {fmtInt(coldStore.totalUnits)} {t('processingJobs.title', 'units').toLowerCase()}
                  {' · '}
                  {fmtKg(coldStore.totalKg)} kg
                </p>
              </div>
              {expiringSoon > 0 ? (
                <Badge variant="destructive" className="mt-1 gap-1 text-[10px]">
                  <AlertTriangle className="h-3 w-3" />
                  {t('stock.expiringSoon', '{{count}} item(s) expire in <24h', { count: expiringSoon })}
                </Badge>
              ) : null}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="grid grid-cols-3 divide-x">
            <div className="px-4 py-3 text-center">
              <Boxes className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                {t('dashboard.boxesOnHand', 'Boxes')}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtInt(coldStore.boxesUnits)}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <Drumstick className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                {t('dashboard.portionsOnHand', 'Portions')}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtInt(coldStore.portionUnits)}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <Heart className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                {t('dashboard.gibletsOnHand', 'Giblets')}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtInt(coldStore.gibletUnits)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
