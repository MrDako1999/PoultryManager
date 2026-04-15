import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2 } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import useLocalRecord from '@/hooks/useLocalRecord';

const SEGMENT_LABELS = {
  expenses: 'batches.expensesTab',
  sources: 'batches.sourcesTab',
  'feed-orders': 'batches.feedOrdersTab',
  sales: 'batches.salesTab',
};

export default function BusinessDetailLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const business = useLocalRecord('businesses', id);

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('businesses.title')}</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/directory/businesses')}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('businesses.title')}
        </Button>
      </div>
    );
  }

  const basePath = `/dashboard/directory/businesses/${id}`;
  const pathAfterBusiness = location.pathname.split(basePath)[1] || '';
  const segments = pathAfterBusiness.split('/').filter(Boolean);
  const subView = segments[0];

  const breadcrumbs = [
    { label: t('nav.directory'), to: '/dashboard/directory' },
    { label: t('businesses.title'), to: '/dashboard/directory/businesses' },
    { label: business.companyName, to: basePath },
  ];

  if (subView && SEGMENT_LABELS[subView]) {
    breadcrumbs.push({
      label: t(SEGMENT_LABELS[subView]),
    });
  }

  const isTrader = business.businessType !== 'SUPPLIER';

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => {
          if (subView) {
            navigate(basePath);
          } else {
            navigate('/dashboard/directory/businesses');
          }
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold tracking-tight">{business.companyName}</h1>
            <Badge variant={isTrader ? 'default' : 'secondary'}>
              {isTrader ? t('businesses.trader') : t('businesses.supplier')}
            </Badge>
            {business.isAccountBusiness && (
              <Badge variant="outline">{t('businesses.yourBusiness')}</Badge>
            )}
          </div>
          {business.address?.formattedAddress && (
            <p className="text-sm text-muted-foreground mt-1">{business.address.formattedAddress}</p>
          )}
        </div>
      </div>

      <Outlet context={{ business }} />
    </div>
  );
}
