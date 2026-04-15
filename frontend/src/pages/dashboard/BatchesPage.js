import { useState, useMemo } from 'react';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Layers,
  Search,
  Eye,
  Calendar,
  Warehouse,
  Home,
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import QuickAddFarmDialog from '@/components/QuickAddFarmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import { formatDateForInput } from '@/lib/format';

const BATCH_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETE', 'DELAYED', 'OTHER'];

const STATUS_VARIANTS = {
  NEW: 'secondary',
  IN_PROGRESS: 'default',
  COMPLETE: 'outline',
  DELAYED: 'destructive',
  OTHER: 'secondary',
};

const batchSchema = z.object({
  farm: z.string().min(1, 'Farm is required'),
  startDate: z.string().min(1, 'Start date is required'),
  status: z.enum(BATCH_STATUSES),
});

const defaultValues = {
  farm: '',
  startDate: '',
  status: 'NEW',
};

function formatBatchDate(dateStr) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

export default function BatchesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [farmFilter, setFarmFilter] = useState('');
  const [batchToDelete, setBatchToDelete] = useState(null);
  const [quickFarmOpen, setQuickFarmOpen] = useState(false);
  const [quickFarmName, setQuickFarmName] = useState('');
  const [selectedHouses, setSelectedHouses] = useState([]);

  const allBatches = useLocalQuery('batches');
  const farms = useLocalQuery('farms');
  const allHouses = useLocalQuery('houses');
  const isLoading = false;

  const farmsById = useMemo(
    () => Object.fromEntries(farms.map((f) => [f._id, f])),
    [farms]
  );

  const resolveFarm = (batch) => {
    if (batch.farm && typeof batch.farm === 'object') return batch.farm;
    return farmsById[batch.farm] || null;
  };

  const batchesList = useMemo(() => {
    if (!farmFilter) return allBatches;
    return allBatches.filter((b) => (b.farm?._id ?? b.farm) === farmFilter);
  }, [allBatches, farmFilter]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty: formIsDirty },
  } = useForm({
    resolver: zodResolver(batchSchema),
    defaultValues,
  });

  const watchedFarm = watch('farm');
  const watchedStartDate = watch('startDate');

  const housesForFarm = useMemo(
    () => allHouses
      .filter((h) => (h.farm?._id || h.farm) === watchedFarm)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allHouses, watchedFarm]
  );

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const farmOptions = useMemo(
    () =>
      farms.map((f) => ({
        value: f._id,
        label: f.farmName,
        description: f.nickname || '',
      })),
    [farms]
  );

  const farmFilterOptions = useMemo(
    () => [
      { value: '', label: t('common.all') },
      ...farms.map((f) => ({
        value: f._id,
        label: f.farmName,
        description: f.nickname || '',
      })),
    ],
    [farms, t]
  );

  const statusOptions = useMemo(
    () =>
      BATCH_STATUSES.map((s) => ({
        value: s,
        label: t(`batches.statuses.${s}`),
      })),
    [t]
  );

  const batchNamePreview = useMemo(() => {
    if (!watchedFarm || !watchedStartDate) return '';
    const farm = farms.find((f) => f._id === watchedFarm);
    if (!farm) return '';
    const nickname = farm.nickname || farm.farmName.substring(0, 8).toUpperCase();
    const dateStr = formatBatchDate(watchedStartDate);
    const seq = editingBatch ? editingBatch.sequenceNumber : '?';
    return `${nickname}-${dateStr}-B${seq}`;
  }, [watchedFarm, watchedStartDate, farms, editingBatch]);

  const { mutate: saveBatch, isPending: isSaving } = useOfflineMutation('batches');
  const { mutate: deleteBatch, isPending: isDeleting } = useOfflineMutation('batches');

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingBatch(null);
    setSelectedHouses([]);
    resetGuard();
    reset(defaultValues);
  };

  const tryClose = () => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  const openCreateSheet = () => {
    resetGuard();
    setEditingBatch(null);
    setSelectedHouses([]);
    reset(defaultValues);
    setSheetOpen(true);
    armGuard();
  };

  const openEditSheet = (batch) => {
    resetGuard();
    setEditingBatch(batch);
    reset({
      farm: batch.farm?._id ?? batch.farm,
      startDate: formatDateForInput(batch.startDate),
      status: batch.status || 'NEW',
    });
    setSelectedHouses(
      (batch.houses || []).map((h) => ({
        house: h.house?._id || h.house,
        quantity: h.quantity || 0,
      }))
    );
    setSheetOpen(true);
    armGuard();
  };

  const onSubmit = (formData) => {
    const housesPayload = selectedHouses.filter((h) => h.quantity > 0);

    if (editingBatch) {
      saveBatch(
        {
          action: 'update',
          id: editingBatch._id,
          data: { startDate: formData.startDate, status: formData.status, houses: housesPayload },
        },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('batches.batchUpdated') });
          },
        }
      );
    } else {
      saveBatch(
        {
          action: 'create',
          data: { farm: formData.farm, startDate: formData.startDate, status: formData.status, houses: housesPayload },
        },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('batches.batchCreated') });
          },
        }
      );
    }
  };

  const isMutating = isSaving;

  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batchesList;
    const q = searchQuery.toLowerCase();
    return batchesList.filter((b) => {
      if (b.batchName?.toLowerCase().includes(q)) return true;
      const farm = resolveFarm(b);
      return farm?.farmName?.toLowerCase().includes(q) ||
        farm?.nickname?.toLowerCase().includes(q);
    });
  }, [batchesList, searchQuery]);

  const deleteWarning = useMemo(() => {
    if (!batchToDelete) return '';
    const parts = [];
    if (batchToDelete._sourcesCount > 0) {
      parts.push(`${batchToDelete._sourcesCount} source ${batchToDelete._sourcesCount === 1 ? 'entry' : 'entries'}`);
    }
    if (batchToDelete._expensesCount > 0) {
      parts.push(`${batchToDelete._expensesCount} ${batchToDelete._expensesCount === 1 ? 'expense' : 'expenses'}`);
    }
    if (parts.length > 0) {
      return t('batches.deleteWarningWithCounts', { items: parts.join(' and ') });
    }
    return t('batches.deleteWarning');
  }, [batchToDelete, t]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('batches.title')}</CardTitle>
              <CardDescription>{t('batches.subtitle')}</CardDescription>
            </div>
            <Button onClick={openCreateSheet} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('batches.addBatch')}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(batchesList.length > 0 || farmFilter) && (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('batches.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="w-48 shrink-0">
                <SearchableSelect
                  options={farmFilterOptions}
                  value={farmFilter}
                  onChange={setFarmFilter}
                  placeholder={t('batches.filterByFarm')}
                  searchPlaceholder={t('batches.searchFarm')}
                />
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBatches.length === 0 && !searchQuery && !farmFilter ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Layers className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('batches.noBatches')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('batches.noBatchesDesc')}
              </p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('batches.addFirstBatch')}
              </Button>
            </div>
          ) : filteredBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('common.noResults')}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredBatches.map((batch) => {
                const farm = resolveFarm(batch);
                const displayName = batch.batchName || (farm
                  ? `${farm.nickname || farm.farmName.substring(0, 8).toUpperCase()}-${batch.startDate ? formatBatchDate(batch.startDate) : '?'}`
                  : t('batches.addBatch'));
                return (
                <div
                  key={batch._id}
                  className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50 cursor-pointer"
                  onClick={() => navigate(`/dashboard/batches/${batch._id}`)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{displayName}</p>
                      <Badge variant={STATUS_VARIANTS[batch.status] || 'secondary'} className="text-[10px] px-1.5 py-0">
                        {t(`batches.statuses.${batch.status}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {farm?.farmName && (
                        <span className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3" />
                          {farm.farmName}
                        </span>
                      )}
                      {batch.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(batch.startDate).toLocaleDateString()}
                        </span>
                      )}
                      {(batch._sourcesCount > 0 || batch._expensesCount > 0) && (
                        <span className="text-xs">
                          {batch._sourcesCount > 0 && `${batch._sourcesCount} sources`}
                          {batch._sourcesCount > 0 && batch._expensesCount > 0 && ' · '}
                          {batch._expensesCount > 0 && `${batch._expensesCount} expenses`}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/batches/${batch._id}`); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t('common.view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditSheet(batch); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setBatchToDelete(batch); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingBatch ? t('batches.editBatch') : t('batches.addBatch')}
            </SheetTitle>
            <SheetDescription>
              {editingBatch ? t('batches.editBatchDesc') : t('batches.addBatchDesc')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="batch-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label>{t('batches.farm')}</Label>
                <input type="hidden" {...register('farm')} />
                <SearchableSelect
                  options={farmOptions}
                  value={watchedFarm}
                  onChange={(val) => setValue('farm', val, { shouldDirty: true })}
                  placeholder={t('batches.selectFarm')}
                  searchPlaceholder={t('batches.searchFarm')}
                  emptyMessage={t('common.noResults')}
                  disabled={!!editingBatch}
                  createLabel={t('batches.addNewFarm')}
                  onCreate={!editingBatch ? (name) => {
                    setQuickFarmName(name || '');
                    setQuickFarmOpen(true);
                  } : undefined}
                />
                {errors.farm && (
                  <p className="text-sm text-destructive">{errors.farm.message}</p>
                )}
              </div>

              {watchedFarm && housesForFarm.length > 0 && (
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
                              markDirty();
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
                                markDirty();
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

              <div className="space-y-2">
                <Label htmlFor="b-startDate">{t('batches.startDate')}</Label>
                <Input
                  id="b-startDate"
                  type="date"
                  {...register('startDate')}
                />
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

              {batchNamePreview && (
                <div className="space-y-2">
                  <Label>{t('batches.batchName')}</Label>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/50">
                    <span className="text-sm font-mono font-medium">{batchNamePreview}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {t('batches.autoGenerated')}
                    </Badge>
                  </div>
                </div>
              )}
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="batch-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBatch ? t('common.save') : t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={!!batchToDelete}
        onOpenChange={(open) => !open && setBatchToDelete(null)}
        title={t('batches.deleteTitle')}
        description={deleteWarning}
        onConfirm={() => batchToDelete && deleteBatch(
          { action: 'delete', id: batchToDelete._id },
          {
            onSuccess: () => {
              setBatchToDelete(null);
              toast({ title: t('batches.batchDeleted') });
            },
          }
        )}
        isPending={isDeleting}
      />

      <ConfirmDiscardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={closeSheet}
      />

      <QuickAddFarmDialog
        open={quickFarmOpen}
        onOpenChange={setQuickFarmOpen}
        initialName={quickFarmName}
        onCreated={(newFarm) => {
          setValue('farm', newFarm._id, { shouldDirty: true });
        }}
      />
    </>
  );
}
