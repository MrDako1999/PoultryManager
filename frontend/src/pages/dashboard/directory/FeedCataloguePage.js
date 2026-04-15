// TODO: FeedCatalogueBase - see FEED_CATALOGUE_BASE.md
import { useState, useMemo } from 'react';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Wheat,
  Search,
  X,
  RotateCcw,
  CircleEllipsis,
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import QuickAddBusinessSheet from '@/components/QuickAddBusinessSheet';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import InfoTip from '@/components/InfoTip';
import useFormGuard from '@/hooks/useFormGuard';
import usePersistedState from '@/hooks/usePersistedState';
import { parseNum } from '@/lib/format';
import { FEED_TYPES, FEED_TYPE_ICONS, DOC_ACCEPT } from '@/lib/constants';

const QUANTITY_UNITS = ['KG', 'LB', 'G', 'TON'];

const feedItemSchema = z.object({
  feedCompany: z.string().min(1, 'Feed company is required'),
  feedDescription: z.string().min(1, 'Feed description is required'),
  feedType: z.enum(FEED_TYPES),
  pricePerQty: z
    .string()
    .optional()
    .transform((val) => parseNum(val)),
  quantitySize: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseNum(val);
      return num > 0 ? num : 50;
    }),
  quantityUnit: z.enum(QUANTITY_UNITS).default('KG'),
  isActive: z.boolean().default(true),
});

const feedDefaults = {
  feedCompany: '',
  feedDescription: '',
  feedType: 'STARTER',
  pricePerQty: '',
  quantitySize: '50',
  quantityUnit: 'KG',
  isActive: true,
};

export default function FeedCataloguePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [bizSheetOpen, setBizSheetOpen] = useState(false);
  const [bizSheetInitialName, setBizSheetInitialName] = useState('');

  const feedItems = useLocalQuery('feedItems');
  const businesses = useLocalQuery('businesses');
  const accountingList = useLocalQuery('settings', { key: 'accounting' });
  const accounting = accountingList[0];

  const vatRate = accounting?.vatRate ?? 5;
  const currency = accounting?.currency || 'AED';

  const [search, setSearch] = usePersistedState('dir-feed-search', '');
  const [feedTypeFilter, setFeedTypeFilter] = usePersistedState('dir-feed-type', []);

  const businessOptions = useMemo(
    () =>
      businesses.map((b) => ({
        value: b._id,
        label: b.companyName,
        description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
      })),
    [businesses]
  );

  const feedTypeOptions = useMemo(
    () =>
      FEED_TYPES.map((ft) => ({
        value: ft,
        label: t(`feed.feedTypes.${ft}`),
        icon: FEED_TYPE_ICONS[ft],
      })),
    [t]
  );

  const feedTypeFilterOptions = useMemo(
    () =>
      FEED_TYPES.map((ft) => ({
        value: ft,
        label: t(`feed.feedTypes.${ft}`),
      })),
    [t]
  );

  const unitOptions = useMemo(
    () =>
      QUANTITY_UNITS.map((u) => ({
        value: u,
        label: t(`feed.quantityUnits.${u}`),
      })),
    [t]
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isDirty: formIsDirty },
  } = useForm({
    resolver: zodResolver(feedItemSchema),
    defaultValues: feedDefaults,
  });

  const watchedPrice = watch('pricePerQty');

  const priceNum = parseNum(watchedPrice);
  const fSubtotal = priceNum;
  const fVat = fSubtotal * (vatRate / 100);
  const fGrandTotal = fSubtotal + fVat;

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const { mutate: saveFeedItem, isPending: isSaving } = useOfflineMutation('feedItems');
  const { mutate: deleteFeedItem, isPending: isDeleting } = useOfflineMutation('feedItems');

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingItem(null);
    resetGuard();
    reset(feedDefaults);
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
    setEditingItem(null);
    reset(feedDefaults);
    setSheetOpen(true);
    armGuard();
  };

  const openEditSheet = (item) => {
    resetGuard();
    setEditingItem(item);
    reset({
      feedCompany: item.feedCompany?._id || item.feedCompany || '',
      feedDescription: item.feedDescription || '',
      feedType: item.feedType || 'STARTER',
      pricePerQty: item.pricePerQty
        ? Number(item.pricePerQty).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '',
      quantitySize: item.quantitySize ? String(item.quantitySize) : '50',
      quantityUnit: item.quantityUnit || 'KG',
      isActive: item.isActive !== undefined ? item.isActive : true,
    });
    setSheetOpen(true);
    armGuard();
  };

  const onSubmit = (formData) => {
    const payload = {
      ...formData,
      subtotal: fSubtotal,
      vatAmount: fVat,
      grandTotal: fGrandTotal,
    };

    if (editingItem) {
      saveFeedItem(
        { action: 'update', id: editingItem._id, data: payload },
        { onSuccess: () => { closeSheet(); toast({ title: t('feed.feedItemUpdated') }); } }
      );
    } else {
      saveFeedItem(
        { action: 'create', data: payload },
        { onSuccess: () => { closeSheet(); toast({ title: t('feed.feedItemCreated') }); } }
      );
    }
  };

  const openBizSheet = (companyName = '') => {
    setBizSheetInitialName(companyName);
    setBizSheetOpen(true);
  };

  const handleBizCreated = (newBiz) => {
    setValue('feedCompany', newBiz._id, { shouldDirty: true });
    markDirty();
  };

  const isMutating = isSaving;

  const filtered = useMemo(() => {
    let list = feedItems;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.feedDescription?.toLowerCase().includes(q) ||
          item.feedCompany?.companyName?.toLowerCase().includes(q)
      );
    }

    if (feedTypeFilter.length > 0) {
      list = list.filter((item) => feedTypeFilter.includes(item.feedType));
    }

    return list;
  }, [feedItems, search, feedTypeFilter]);

  const groupedItems = useMemo(() => {
    const groups = {};
    filtered.forEach((item) => {
      const companyName = item.feedCompany?.companyName || 'Unknown Company';
      if (!groups[companyName]) groups[companyName] = [];
      groups[companyName].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const hasFilters = !!(search || feedTypeFilter.length);

  const resetFilters = () => {
    setSearch('');
    setFeedTypeFilter([]);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t('feed.title', 'Feed Catalogue')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('feed.subtitle', 'Manage your feed items')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <Wheat className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground leading-none">{t('feed.totalItems', 'Total')}</p>
                  <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
                </div>
              </div>
              <Button onClick={openCreateSheet} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('feed.addFeedItem', 'Add Feed Item')}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('feed.searchPlaceholder', 'Search feed items...')}
                className="pl-8 h-9 bg-white dark:bg-card"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0" onClick={resetFilters} disabled={!hasFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <SearchableMultiSelect
              variant="dropdown"
              options={feedTypeFilterOptions}
              value={feedTypeFilter}
              onChange={setFeedTypeFilter}
              placeholder={t('feed.feedType', 'Feed Type')}
              className="flex-1 min-w-0 max-w-[220px]"
            />
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {feedItems.length} {t('feed.title', 'feed items').toLowerCase()}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 && !hasFilters ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Wheat className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('feed.noFeedItems')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('feed.noFeedItemsDesc')}</p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('feed.addFirstFeedItem')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noResults')}</p>
          ) : (
            <div className="space-y-6">
              {groupedItems.map(([companyName, items]) => (
                <div key={companyName}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2 px-1">
                    {companyName}
                  </p>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const TypeIcon = FEED_TYPE_ICONS[item.feedType] || CircleEllipsis;
                      return (
                        <div
                          key={item._id}
                          className={`flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50 ${
                            !item.isActive ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <TypeIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{item.feedDescription}</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {t(`feed.feedTypes.${item.feedType}`)}
                              </Badge>
                              {!item.isActive && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {t('feed.inactiveLabel')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                              <span>
                                {currency}{' '}
                                {item.grandTotal?.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                / {item.quantitySize}
                                {item.quantityUnit}
                              </span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditSheet(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setItemToDelete(item)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingItem ? t('feed.editFeedItem') : t('feed.addFeedItem')}</SheetTitle>
            <SheetDescription>{editingItem ? t('feed.editFeedItemDesc') : t('feed.addFeedItemDesc')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="feed-item-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label>{t('feed.feedCompany')}</Label>
                <Controller
                  name="feedCompany"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect options={businessOptions} value={field.value} onChange={field.onChange} placeholder={t('feed.selectCompany')} searchPlaceholder={t('feed.searchCompany')} emptyMessage={t('common.noResults')} createLabel={t('feed.addNewCompany')} onCreate={(name) => openBizSheet(name)} />
                  )}
                />
                {errors.feedCompany && <p className="text-sm text-destructive">{errors.feedCompany.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fi-description">{t('feed.feedDescription')}</Label>
                <Input id="fi-description" {...register('feedDescription')} placeholder={t('feed.feedDescriptionPlaceholder')} />
                {errors.feedDescription && <p className="text-sm text-destructive">{errors.feedDescription.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>{t('feed.feedType')}</Label>
                  <InfoTip>{t('feed.feedTypeHint')}</InfoTip>
                </div>
                <Controller name="feedType" control={control} render={({ field }) => (<EnumButtonSelect options={feedTypeOptions} value={field.value} onChange={field.onChange} columns={4} />)} />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="fi-price">{t('feed.pricePerQty')}</Label>
                <Input id="fi-price" inputMode="decimal" {...register('pricePerQty', { onChange: (e) => { const raw = e.target.value.replace(/[^0-9.]/g, ''); const parts = raw.split('.'); const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw; e.target.value = sanitized; } })} placeholder={t('feed.pricePerQtyPlaceholder')} />
              </div>

              <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="fi-qtySize">{t('feed.quantitySize')}</Label>
                    <InfoTip>{t('feed.quantitySizeHint')}</InfoTip>
                  </div>
                  <Input id="fi-qtySize" inputMode="numeric" {...register('quantitySize', { onChange: (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); } })} placeholder={t('feed.quantitySizePlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('feed.quantityUnit')}</Label>
                  <Controller name="quantityUnit" control={control} render={({ field }) => (<SearchableSelect options={unitOptions} value={field.value} onChange={field.onChange} placeholder={t('feed.quantityUnit')} searchPlaceholder={t('common.search')} emptyMessage={t('common.noResults')} className="w-[100px]" />)} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="fi-active">{t('feed.isActive')}</Label>
                </div>
                <Controller name="isActive" control={control} render={({ field }) => (<Switch id="fi-active" checked={field.value} onCheckedChange={field.onChange} />)} />
              </div>

              <Separator />

              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('feed.subtotal')}</span>
                  <span className="font-medium">{currency} {fSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('feed.vat')} ({vatRate}%)
                    {fSubtotal > 0 && (<span className="text-xs ml-1">({fSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} × {vatRate}%)</span>)}
                  </span>
                  <span className="font-medium">{currency} {fVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t('feed.totalPerUnit')}</span>
                  <span>{currency} {fGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>{t('common.cancel')}</Button>
            <Button type="submit" form="feed-item-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? t('common.save') : t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <QuickAddBusinessSheet open={bizSheetOpen} onOpenChange={setBizSheetOpen} onCreated={handleBizCreated} initialName={bizSheetInitialName} />

      <ConfirmDiscardDialog open={confirmOpen} onOpenChange={setConfirmOpen} onDiscard={closeSheet} />

      <ConfirmDeleteDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title={t('feed.deleteTitle')}
        description={t('feed.deleteWarning')}
        onConfirm={() => itemToDelete && deleteFeedItem(
          { action: 'delete', id: itemToDelete._id },
          { onSuccess: () => { setItemToDelete(null); toast({ title: t('feed.feedItemDeleted') }); } }
        )}
        isPending={isDeleting}
      />
    </>
  );
}
