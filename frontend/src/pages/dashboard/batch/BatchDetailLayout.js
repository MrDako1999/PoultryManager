import { useMemo, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Layers,
  Warehouse,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleDashed,
  CircleDot,
  Pencil,
  Trash2,
  Loader2,
  Home,
} from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import SearchableSelect from '@/components/SearchableSelect';
import { useToast } from '@/components/ui/use-toast';
import { formatDateForInput } from '@/lib/format';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const STATUS_CONFIG = {
  NEW: { icon: CircleDashed, color: 'text-muted-foreground', bg: 'bg-muted', label: 'secondary' },
  IN_PROGRESS: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  COMPLETE: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  DELAYED: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  OTHER: { icon: CircleDot, color: 'text-muted-foreground', bg: 'bg-muted' },
};

const BATCH_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETE', 'DELAYED', 'OTHER'];

const editSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  status: z.enum(BATCH_STATUSES),
});

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

  const { toast } = useToast();
  const batch = useLocalRecord('batches', id);
  const saleOrders = useLocalQuery('saleOrders', { batch: id });
  const allHouses = useLocalQuery('houses');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedHouses, setSelectedHouses] = useState([]);
  const { mutate: deleteBatch, isPending: isDeleting } = useOfflineMutation('batches');
  const { mutate: saveBatch, isPending: isSaving } = useOfflineMutation('batches');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: { startDate: '', status: 'NEW' },
  });

  const farmId = batch?.farm?._id || batch?.farm;
  const housesForFarm = useMemo(
    () => allHouses
      .filter((h) => (h.farm?._id || h.farm) === farmId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allHouses, farmId]
  );

  const statusOptions = useMemo(
    () => BATCH_STATUSES.map((s) => ({ value: s, label: t(`batches.statuses.${s}`) })),
    [t]
  );

  const openEditSheet = () => {
    reset({
      startDate: formatDateForInput(batch.startDate),
      status: batch.status || 'NEW',
    });
    setSelectedHouses(
      (batch.houses || []).map((h) => ({
        house: h.house?._id || h.house,
        quantity: h.quantity || 0,
      }))
    );
    setEditOpen(true);
  };

  const onEditSubmit = (formData) => {
    const housesPayload = selectedHouses.filter((h) => h.quantity > 0);
    saveBatch(
      {
        action: 'update',
        id: batch._id,
        data: { startDate: formData.startDate, status: formData.status, houses: housesPayload },
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast({ title: t('batches.batchUpdated') });
        },
      }
    );
  };

  const dayCount = useMemo(() => {
    if (!batch?.startDate) return null;
    const start = new Date(batch.startDate);
    if (batch.status === 'COMPLETE') {
      let lastSale = null;
      saleOrders.forEach((s) => {
        if (s.saleDate) {
          const d = new Date(s.saleDate);
          if (!lastSale || d > lastSale) lastSale = d;
        }
      });
      return { days: Math.max(0, Math.floor(((lastSale || start) - start) / 86400000)), completed: true };
    }
    return { days: Math.max(0, Math.floor((Date.now() - start) / 86400000)), completed: false };
  }, [batch?.startDate, batch?.status, saleOrders]);

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

      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => {
          if (subView) {
            navigate(`/dashboard/batches/${id}`);
          } else {
            navigate('/dashboard/batches');
          }
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {(() => {
          const farm = batch.farm;
          const avatarLetter = ((typeof farm === 'object' ? farm?.nickname || farm?.farmName : '') || '?')[0].toUpperCase();
          const batchNum = batch.sequenceNumber ?? '';
          const status = STATUS_CONFIG[batch.status] || STATUS_CONFIG.OTHER;
          const StatusIcon = status.icon;
          return (
            <div className="relative shrink-0 mt-0.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-primary leading-none">{avatarLetter}{batchNum}</span>
              </div>
              <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${status.bg} ring-2 ring-background`}>
                <StatusIcon className={`h-3 w-3 ${status.color}`} />
              </div>
            </div>
          );
        })()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold tracking-tight">{batch.batchName}</h1>
            {(() => {
              const status = STATUS_CONFIG[batch.status] || STATUS_CONFIG.OTHER;
              const StatusIcon = status.icon;
              return (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {t(`batches.statuses.${batch.status}`)}
                </span>
              );
            })()}
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
            {dayCount && (
              <span className="tabular-nums font-medium">
                {dayCount.completed ? `${dayCount.days} days` : `Day ${dayCount.days}`}
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
                onClick={openEditSheet}
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

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('batches.editBatch')}</SheetTitle>
            <SheetDescription>{t('batches.editBatchDesc')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="batch-edit-form" onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="be-startDate">{t('batches.startDate')}</Label>
                <Input id="be-startDate" type="date" {...register('startDate')} />
                {errors.startDate && (
                  <p className="text-sm text-destructive">{errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('batches.status')}</Label>
                <input type="hidden" {...register('status')} />
                <SearchableSelect
                  options={statusOptions}
                  value={watch('status')}
                  onChange={(val) => setValue('status', val, { shouldDirty: true })}
                  placeholder={t('batches.selectStatus')}
                />
              </div>

              {housesForFarm.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('batches.selectHouses', 'Houses')}</Label>
                  <div className="space-y-2 rounded-lg border p-3">
                    {housesForFarm.map((house) => {
                      const entry = selectedHouses.find((s) => s.house === house._id);
                      const isChecked = !!entry;
                      return (
                        <div key={house._id} className="flex items-center gap-3">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedHouses((prev) => [...prev, { house: house._id, quantity: house.capacity }]);
                              } else {
                                setSelectedHouses((prev) => prev.filter((s) => s.house !== house._id));
                              }
                            }}
                          />
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{house.name}</span>
                            <span className="text-xs text-muted-foreground">({house.capacity.toLocaleString()} cap)</span>
                          </div>
                          {isChecked && (
                            <Input
                              inputMode="numeric"
                              value={entry.quantity === 0 ? '' : entry.quantity.toLocaleString()}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                const num = raw ? parseInt(raw, 10) : 0;
                                setSelectedHouses((prev) =>
                                  prev.map((s) => s.house === house._id ? { ...s, quantity: num } : s)
                                );
                              }}
                              className="w-24 h-8 text-sm tabular-nums"
                              placeholder={t('batches.qty', 'Qty')}
                            />
                          )}
                        </div>
                      );
                    })}
                    {selectedHouses.length > 0 && (
                      <div className="flex justify-end pt-1 border-t mt-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t('batches.totalBirds', 'Total')}: {selectedHouses.reduce((s, h) => s + (h.quantity || 0), 0).toLocaleString()} {t('farms.birds', 'birds')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="batch-edit-form" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('batches.deleteTitle')}
        description={t('batches.deleteWarning')}
        onConfirm={() => deleteBatch(
          { action: 'delete', id: batch._id },
          {
            onSuccess: () => {
              setDeleteOpen(false);
              toast({ title: t('batches.batchDeleted') });
              navigate('/dashboard/batches');
            },
          }
        )}
        isPending={isDeleting}
      />
    </div>
  );
}
