import { useTranslation } from 'react-i18next';
import { Layers, Bird, TrendingDown, DollarSign, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/stores/authStore';

const kpiCards = [
  {
    key: 'activeBatches',
    icon: Layers,
    value: '—',
    change: null,
  },
  {
    key: 'totalBirds',
    icon: Bird,
    value: '—',
    change: null,
  },
  {
    key: 'mortalityRate',
    icon: TrendingDown,
    value: '—',
    change: null,
  },
  {
    key: 'revenue',
    icon: DollarSign,
    value: '—',
    change: null,
  },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          {t('dashboard.welcome', { name: user?.firstName || '' })}
        </h1>
        <p className="text-muted-foreground">{t('dashboard.overview')}</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ key, icon: Icon, value }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`dashboard.${key}`)}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('dashboard.noData')}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {t('dashboard.noDataDesc')}
          </p>
          <Button>
            {t('dashboard.createFirstBatch')}
            <ArrowRight className="ml-2 h-4 w-4 rtl:ml-0 rtl:mr-2 rtl:rotate-180" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
