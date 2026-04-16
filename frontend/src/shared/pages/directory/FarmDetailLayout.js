import { useMemo, useState } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Warehouse, Pencil, Trash2, MapPin, Building2,
} from 'lucide-react';
import { LuEgg, LuEggFried, LuFactory, LuTrees } from 'react-icons/lu';
import { PiBird } from 'react-icons/pi';
import Breadcrumb from '@/components/Breadcrumb';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const FARM_TYPE_ICONS = {
  hatchery: LuEgg,
  broiler: PiBird,
  free_range: LuTrees,
  layer_eggs: LuEggFried,
  slaughterhouse: LuFactory,
};

export default function FarmDetailLayout() {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const farm = useLocalRecord('farms', farmId);
  const allHouses = useLocalQuery('houses');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: deleteFarm, isPending: isDeleting } = useOfflineMutation('farms');

  const houses = useMemo(
    () => allHouses
      .filter((h) => (h.farm?._id || h.farm) === farmId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allHouses, farmId],
  );

  if (!farm) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('farms.title')}</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/directory/farms')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('farms.backToFarms', 'Back to Farms')}
        </Button>
      </div>
    );
  }

  const TypeIcon = FARM_TYPE_ICONS[farm.farmType] || FARM_TYPE_ICONS.broiler;
  const businessName = farm.business?.companyName || '';
  const businessId = farm.business?._id || farm.business;

  const breadcrumbs = [
    { label: t('nav.directory'), to: '/dashboard/directory' },
    { label: t('farms.title'), to: '/dashboard/directory/farms' },
    { label: farm.farmName },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/dashboard/directory/farms')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="relative shrink-0 mt-0.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <TypeIcon className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-heading font-bold tracking-tight">{farm.farmName}</h1>
            {farm.nickname && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{farm.nickname}</Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
              {t(`farms.farmTypes.${farm.farmType || 'broiler'}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1 flex-wrap">
            {businessName && (
              <button
                onClick={() => businessId && navigate(`/dashboard/directory/businesses/${businessId}`)}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{businessName}</span>
              </button>
            )}
            {farm.location?.placeName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{farm.location.placeName}</span>
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
                onClick={() => navigate('/dashboard/directory/farms', { state: { editFarmId: farm._id } })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.edit')}</TooltipContent>
          </Tooltip>
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
        </div>
      </div>

      <Outlet context={{ farm, houses }} />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('farms.deleteFarmTitle', 'Delete Farm')}
        description={t('farms.deleteFarmWarning', 'This will permanently delete this farm and cannot be undone.')}
        onConfirm={() => deleteFarm(
          { action: 'delete', id: farm._id },
          {
            onSuccess: () => {
              setDeleteOpen(false);
              toast({ title: t('farms.farmDeleted') });
              navigate('/dashboard/directory/farms');
            },
          },
        )}
        isPending={isDeleting}
      />
    </div>
  );
}
