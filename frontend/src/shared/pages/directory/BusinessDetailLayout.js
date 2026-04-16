import { useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Pencil, Trash2, MapPin, FileText } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import useLocalRecord from '@/hooks/useLocalRecord';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import BusinessEditSheet from '@/shared/sheets/BusinessEditSheet';
import { useToast } from '@/components/ui/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const { toast } = useToast();

  const business = useLocalRecord('businesses', id);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { mutate: deleteBiz, isPending: isDeleting } = useOfflineMutation('businesses');

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('businesses.title')}</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/directory/businesses')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('businesses.backToBusinesses', 'Back to Businesses')}
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
    breadcrumbs.push({ label: t(SEGMENT_LABELS[subView]) });
  }

  const isTrader = business.businessType !== 'SUPPLIER';

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => {
          if (subView) navigate(basePath);
          else navigate('/dashboard/directory/businesses');
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="relative shrink-0 mt-0.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-heading font-bold tracking-tight">{business.companyName}</h1>
            <Badge variant={isTrader ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {isTrader ? t('businesses.trader') : t('businesses.supplier')}
            </Badge>
            {business.isAccountBusiness && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t('businesses.yourBusiness')}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1 flex-wrap">
            {business.address?.formattedAddress && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{business.address.formattedAddress}</span>
              </span>
            )}
            {business.trnNumber && (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>TRN: {business.trnNumber}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 mt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.edit')}</TooltipContent>
          </Tooltip>
          {!business.isAccountBusiness && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.delete')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <Outlet context={{ business }} />

      <BusinessEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        editingBusiness={business}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('businesses.deleteTitle', 'Delete Business')}
        description={t('businesses.deleteWarning', 'This will permanently delete this business and cannot be undone.')}
        onConfirm={() => deleteBiz(
          { action: 'delete', id: business._id },
          {
            onSuccess: () => {
              setDeleteOpen(false);
              toast({ title: t('businesses.businessDeleted') });
              navigate('/dashboard/directory/businesses');
            },
          },
        )}
        isPending={isDeleting}
      />
    </div>
  );
}
