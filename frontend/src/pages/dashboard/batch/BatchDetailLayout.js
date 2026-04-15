import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Layers, Warehouse, Calendar } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import useLocalRecord from '@/hooks/useLocalRecord';
import { STATUS_VARIANTS } from '@/lib/constants';

const SEGMENT_LABELS = {
  expenses: 'batches.expensesTab',
  sources: 'batches.sourcesTab',
  'feed-orders': 'batches.feedOrdersTab',
  sales: 'batches.salesTab',
  operations: 'batches.operationsTab',
};

export default function BatchDetailLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const batch = useLocalRecord('batches', id);

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Layers className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('batches.notFound')}</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/batches')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('batches.backToBatches')}
        </Button>
      </div>
    );
  }

  const pathAfterBatch = location.pathname.split(`/batches/${id}`)[1] || '';
  const segments = pathAfterBatch.split('/').filter(Boolean);
  const subView = segments[0];

  const breadcrumbs = [
    { label: t('batches.title', 'Batches'), to: '/dashboard/batches' },
    { label: batch.batchName, to: `/dashboard/batches/${id}` },
  ];

  if (subView && SEGMENT_LABELS[subView]) {
    breadcrumbs.push({
      label: t(SEGMENT_LABELS[subView]),
      to: `/dashboard/batches/${id}/${subView}`,
    });

    if (subView === 'operations' && segments[1]) {
      const houseEntry = (batch.houses || []).find((e) => {
        const hId = typeof e.house === 'object' ? e.house._id : e.house;
        return hId === segments[1];
      });
      const houseName = houseEntry
        ? (typeof houseEntry.house === 'object' ? houseEntry.house.name : null) || t('batches.house')
        : t('batches.house');
      breadcrumbs.push({
        label: houseName,
        to: `/dashboard/batches/${id}/operations/${segments[1]}`,
      });
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => {
          if (subView) {
            navigate(`/dashboard/batches/${id}`);
          } else {
            navigate('/dashboard/batches');
          }
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold tracking-tight">{batch.batchName}</h1>
            <Badge variant={STATUS_VARIANTS[batch.status] || 'secondary'}>
              {t(`batches.statuses.${batch.status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {batch.farm?.farmName && (
              <span className="flex items-center gap-1">
                <Warehouse className="h-3.5 w-3.5" />
                {batch.farm.farmName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(batch.startDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <Tabs
        value={subView === 'operations' ? 'operations' : 'overview'}
        onValueChange={(val) => {
          if (val === 'overview') navigate(`/dashboard/batches/${id}`);
          else navigate(`/dashboard/batches/${id}/${val}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="overview">{t('batches.overviewTab')}</TabsTrigger>
          <TabsTrigger value="operations">{t('batches.operationsTab')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Outlet context={{ batch }} />
    </div>
  );
}
