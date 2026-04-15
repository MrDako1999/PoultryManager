import { useState, useMemo } from 'react';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useForm } from 'react-hook-form';
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
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Warehouse,
  Search,
  X,
  RotateCcw,
  Link,
  MapPin,
  Building2,
  Home,
} from 'lucide-react';
import { LuEgg, LuEggFried, LuFactory, LuTrees } from 'react-icons/lu';
import { PiBird } from 'react-icons/pi';
import FileUpload from '@/components/FileUpload';
import LogoUpload from '@/components/LogoUpload';
import DocumentsManager from '@/components/DocumentsManager';
import SearchableSelect from '@/components/SearchableSelect';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import FarmLocationPicker from '@/components/FarmLocationPicker';
import HouseConfigurator from '@/components/HouseConfigurator';
import QuickAddBusinessSheet from '@/components/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import InfoTip from '@/components/InfoTip';
import useFormGuard from '@/hooks/useFormGuard';
import usePersistedState from '@/hooks/usePersistedState';
import api from '@/lib/api';

const FARM_TYPES = ['hatchery', 'broiler', 'free_range', 'layer_eggs', 'slaughterhouse'];
const FARM_TYPE_ICONS = {
  hatchery: LuEgg,
  broiler: PiBird,
  free_range: LuTrees,
  layer_eggs: LuEggFried,
  slaughterhouse: LuFactory,
};

const farmSchema = z.object({
  farmName: z.string().min(1, 'Farm name is required'),
  farmType: z.enum(FARM_TYPES),
  nickname: z.string()
    .optional()
    .refine((val) => !val || (val.length >= 3 && val.length <= 8), {
      message: 'Nickname must be 3–8 characters',
    })
    .transform((val) => (val ? val.toUpperCase() : val)),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

const defaultValues = {
  farmName: '',
  farmType: 'broiler',
  nickname: '',
  tradeLicenseNumber: '',
  trnNumber: '',
};

export default function FarmsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState(null);
  const [linkedBusinessId, setLinkedBusinessId] = useState(null);
  const [logoMedia, setLogoMedia] = useState(null);
  const [trnCertMedia, setTrnCertMedia] = useState(null);
  const [tradeLicenseMedia, setTradeLicenseMedia] = useState(null);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});
  const [location, setLocation] = useState({ lat: null, lng: null, placeName: '' });
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');
  const [formHouses, setFormHouses] = useState([]);
  const [existingHouseIds, setExistingHouseIds] = useState([]);

  const farmsList = useLocalQuery('farms');
  const allHouses = useLocalQuery('houses');
  const businesses = useLocalQuery('businesses');

  const [search, setSearch] = usePersistedState('dir-farms-search', '');
  const [typeFilter, setTypeFilter] = usePersistedState('dir-farms-type', []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty: formIsDirty },
  } = useForm({
    resolver: zodResolver(farmSchema),
    defaultValues,
  });

  const watchedFarmName = watch('farmName');
  const watchedFarmType = watch('farmType') || 'broiler';
  const farmTypeOptions = useMemo(
    () =>
      FARM_TYPES.map((type) => ({
        value: type,
        label: t(`farms.farmTypes.${type}`),
        Icon: FARM_TYPE_ICONS[type],
      })),
    [t]
  );

  const typeFilterOptions = useMemo(
    () =>
      FARM_TYPES.map((type) => ({
        value: type,
        label: t(`farms.farmTypes.${type}`),
      })),
    [t]
  );

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const housesByFarm = useMemo(() => {
    const map = {};
    allHouses.forEach((h) => {
      const farmId = h.farm?._id || h.farm;
      if (!farmId) return;
      if (!map[farmId]) map[farmId] = [];
      map[farmId].push(h);
    });
    return map;
  }, [allHouses]);

  const { mutate: saveFarm, isPending: isSaving } = useOfflineMutation('farms');
  const { mutate: deleteFarm } = useOfflineMutation('farms');
  const { mutate: saveHouse } = useOfflineMutation('houses');
  const { mutate: deleteHouse } = useOfflineMutation('houses');

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingFarm(null);
    setLinkedBusinessId(null);
    setLogoMedia(null);
    setTrnCertMedia(null);
    setTradeLicenseMedia(null);
    setOtherDocs([]);
    setMediaMap({});
    setLocation({ lat: null, lng: null, placeName: '' });
    setResolvedAddress(null);
    setFormHouses([]);
    setExistingHouseIds([]);
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
    setEditingFarm(null);
    setLinkedBusinessId(null);
    setLogoMedia(null);
    setTrnCertMedia(null);
    setTradeLicenseMedia(null);
    setOtherDocs([]);
    setMediaMap({});
    setLocation({ lat: null, lng: null, placeName: '' });
    setResolvedAddress(null);
    setFormHouses([]);
    setExistingHouseIds([]);
    reset(defaultValues);
    setSheetOpen(true);
    armGuard();
  };

  const openEditSheet = async (farm) => {
    resetGuard();
    setEditingFarm(farm);
    setLinkedBusinessId(farm.business?._id || farm.business || null);
    setLocation(farm.location || { lat: null, lng: null, placeName: '' });
    reset({
      farmName: farm.farmName,
      farmType: farm.farmType || 'broiler',
      nickname: farm.nickname || '',
      tradeLicenseNumber: farm.business?.tradeLicenseNumber || '',
      trnNumber: farm.business?.trnNumber || '',
    });

    const farmHouses = (housesByFarm[farm._id] || [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((h) => ({ _id: h._id, name: h.name, capacity: h.capacity }));
    setFormHouses(farmHouses);
    setExistingHouseIds(farmHouses.map((h) => h._id));

    try {
      const { data: fullFarm } = await api.get(`/farms/${farm._id}`);
      setLogoMedia(fullFarm.logo || null);

      const biz = fullFarm.business;
      setTrnCertMedia(biz?.trnCertificate || null);
      setTradeLicenseMedia(biz?.tradeLicense || null);

      if (biz) {
        setValue('tradeLicenseNumber', biz.tradeLicenseNumber || '', { shouldDirty: false });
        setValue('trnNumber', biz.trnNumber || '', { shouldDirty: false });
      }

      if (fullFarm.location && fullFarm.location.lat != null && fullFarm.location.lng != null) {
        setLocation(fullFarm.location);
      }

      const map = {};
      if (fullFarm.otherDocs) {
        fullFarm.otherDocs.forEach((doc) => {
          if (doc.media_id && typeof doc.media_id === 'object') {
            map[doc.media_id._id] = doc.media_id;
          }
        });
      }
      setMediaMap(map);
      setOtherDocs(
        (fullFarm.otherDocs || []).map((d) => ({
          name: d.name,
          media_id: d.media_id?._id ?? d.media_id,
        }))
      );
    } catch {
      setLogoMedia(null);
      setTrnCertMedia(null);
      setTradeLicenseMedia(null);
      setOtherDocs([]);
      setMediaMap({});
    }

    setSheetOpen(true);
    armGuard();
  };

  const usedBusinessIds = useMemo(
    () => new Set(
      farmsList
        .filter((f) => !editingFarm || f._id !== editingFarm._id)
        .map((f) => f.business?._id || f.business)
        .filter(Boolean)
    ),
    [farmsList, editingFarm]
  );

  const businessOptions = useMemo(
    () =>
      businesses
        .filter((b) => !usedBusinessIds.has(b._id))
        .map((b) => ({
          value: b._id,
          label: b.companyName,
          description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
        })),
    [businesses, usedBusinessIds]
  );

  const handleBusinessSelect = async (businessId) => {
    if (!businessId) {
      setLinkedBusinessId(null);
      reset(defaultValues);
      setLogoMedia(null);
      setTrnCertMedia(null);
      setTradeLicenseMedia(null);
      markDirty();
      return;
    }

    setLinkedBusinessId(businessId);

    const biz = businesses.find((b) => b._id === businessId);
    if (biz) {
      setValue('farmName', biz.companyName || '', { shouldDirty: true });
      setValue('tradeLicenseNumber', biz.tradeLicenseNumber || '', { shouldDirty: true });
      setValue('trnNumber', biz.trnNumber || '', { shouldDirty: true });
    }

    try {
      const { data: fullBiz } = await api.get(`/businesses/${businessId}`);
      if (fullBiz.logo) setLogoMedia(fullBiz.logo);
      if (fullBiz.trnCertificate) setTrnCertMedia(fullBiz.trnCertificate);
      if (fullBiz.tradeLicense) setTradeLicenseMedia(fullBiz.tradeLicense);
    } catch {}

    markDirty();
  };

  const clearLinkedBusiness = () => {
    setLinkedBusinessId(null);
    if (!editingFarm) {
      reset(defaultValues);
      setLogoMedia(null);
      setTrnCertMedia(null);
      setTradeLicenseMedia(null);
    }
    markDirty();
  };

  const saveHousesForFarm = (farmId) => {
    const currentIds = formHouses.filter((h) => h._id).map((h) => h._id);
    const removedIds = existingHouseIds.filter((id) => !currentIds.includes(id));

    removedIds.forEach((id) => {
      deleteHouse({ action: 'delete', id });
    });

    formHouses.forEach((h, i) => {
      if (h._id) {
        saveHouse({
          action: 'update',
          id: h._id,
          data: { name: h.name, capacity: h.capacity, sortOrder: i },
        });
      } else {
        saveHouse({
          action: 'create',
          data: { farm: farmId, name: h.name, capacity: h.capacity, sortOrder: i },
        });
      }
    });
  };

  const onSubmit = (formData) => {
    const payload = {
      ...formData,
      logo: logoMedia?._id || null,
      trnCertificate: trnCertMedia?._id || null,
      tradeLicense: tradeLicenseMedia?._id || null,
      location,
      otherDocs,
    };

    if (editingFarm) {
      payload.business = linkedBusinessId || null;
      saveFarm(
        { action: 'update', id: editingFarm._id, data: payload },
        {
          onSuccess: () => {
            saveHousesForFarm(editingFarm._id);
            closeSheet();
            toast({ title: t('farms.farmUpdated') });
          },
        }
      );
    } else {
      if (linkedBusinessId) payload.existingBusinessId = linkedBusinessId;
      if (resolvedAddress) payload.businessAddress = resolvedAddress;
      saveFarm(
        { action: 'create', data: payload },
        {
          onSuccess: (newFarm) => {
            saveHousesForFarm(newFarm._id);
            closeSheet();
            toast({ title: t('farms.farmCreated') });
          },
        }
      );
    }
  };

  const isMutating = isSaving;

  const filePrefix = useMemo(() => {
    if (!watchedFarmName) return '';
    return watchedFarmName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') + '_';
  }, [watchedFarmName]);

  const filtered = useMemo(() => {
    let list = farmsList;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.farmName?.toLowerCase().includes(q) ||
          f.nickname?.toLowerCase().includes(q) ||
          f.business?.tradeLicenseNumber?.toLowerCase().includes(q) ||
          f.business?.trnNumber?.toLowerCase().includes(q)
      );
    }

    if (typeFilter.length > 0) {
      list = list.filter((f) => typeFilter.includes(f.farmType || 'broiler'));
    }

    return list;
  }, [farmsList, search, typeFilter]);

  const hasFilters = !!(search || typeFilter.length);

  const resetFilters = () => {
    setSearch('');
    setTypeFilter([]);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t('farms.title', 'Farms')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('farms.subtitle', 'Manage your farms')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground leading-none">{t('farms.totalFarms', 'Total')}</p>
                  <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
                </div>
              </div>
              <Button onClick={openCreateSheet} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('farms.addFarm', 'Add Farm')}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('farms.searchPlaceholder', 'Search farms...')}
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
              options={typeFilterOptions}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder={t('farms.farmType', 'Farm Type')}
              className="flex-1 min-w-0 max-w-[220px]"
            />
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {farmsList.length} {t('farms.title', 'farms').toLowerCase()}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {filtered.length === 0 && !hasFilters ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Warehouse className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('farms.noFarms')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('farms.noFarmsDesc')}</p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('farms.addFirstFarm')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noResults')}</p>
          ) : (
            filtered.map((farm) => {
              const TypeIcon = FARM_TYPE_ICONS[farm.farmType] || FARM_TYPE_ICONS.broiler;
              return (
                <div key={farm._id} className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <TypeIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{farm.farmName}</p>
                      {farm.nickname && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{farm.nickname}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                        {t(`farms.farmTypes.${farm.farmType || 'broiler'}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {farm.business?.companyName && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {farm.business.companyName}
                        </span>
                      )}
                      {(() => {
                        const fh = housesByFarm[farm._id];
                        if (!fh || fh.length === 0) return null;
                        const total = fh.reduce((s, h) => s + (h.capacity || 0), 0);
                        return (
                          <span className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {fh.length} {fh.length === 1 ? t('farms.house', 'house') : t('farms.housesPlural', 'houses')} · {total.toLocaleString()} {t('farms.birds', 'birds')}
                          </span>
                        );
                      })()}
                      {farm.business?.trnNumber && <span>TRN: {farm.business.trnNumber}</span>}
                    </div>
                    {farm.location?.lat != null && farm.location?.lng != null && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate">
                          {farm.location.placeName
                            ? `${farm.location.placeName} (${farm.location.lat.toFixed(4)}, ${farm.location.lng.toFixed(4)})`
                            : `${farm.location.lat.toFixed(4)}, ${farm.location.lng.toFixed(4)}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditSheet(farm)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteFarm(
                        { action: 'delete', id: farm._id },
                        { onSuccess: () => toast({ title: t('farms.farmDeleted') }) }
                      )}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingFarm ? t('farms.editFarm') : t('farms.addFarm')}</SheetTitle>
            <SheetDescription>{editingFarm ? t('farms.editFarmDesc') : t('farms.addFarmDesc')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="farm-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>{linkedBusinessId ? t('farms.linkedBusiness') : t('farms.linkBusiness')}</Label>
                  <InfoTip>{t('farms.linkBusinessHint')}</InfoTip>
                </div>
                {linkedBusinessId ? (
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Link className="h-4 w-4 shrink-0 text-primary" />
                    <span className="flex-1 text-sm truncate">{businesses.find((b) => b._id === linkedBusinessId)?.companyName || t('farms.linkedBusiness')}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{t('farms.linked')}</Badge>
                    <button type="button" onClick={clearLinkedBusiness} className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <SearchableSelect options={businessOptions} value="" onChange={handleBusinessSelect} placeholder={t('farms.searchExistingBusiness')} searchPlaceholder={t('farms.searchBusinessPlaceholder')} emptyMessage={t('common.noResults')} createLabel={t('businesses.addBusiness')} onCreate={(name) => { setQabName(name || ''); setQabOpen(true); }} />
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('farms.farmIdentitySection')}</p>
                <InfoTip>{t('farms.farmIdentityHint')}</InfoTip>
              </div>

              <div className="space-y-2">
                <Label>{t('farms.logo')}</Label>
                <LogoUpload value={logoMedia} onUpload={(media) => { setLogoMedia(media); markDirty(); }} onRemove={() => { setLogoMedia(null); markDirty(); }} entityType="farm" entityId={editingFarm?._id} category="farms" customPrefix={filePrefix ? `${filePrefix}Logo_` : ''} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fm-farmName">{t('farms.farmName')}</Label>
                <Input id="fm-farmName" {...register('farmName')} disabled={!!linkedBusinessId} className={linkedBusinessId ? 'opacity-60' : ''} />
                {errors.farmName && <p className="text-sm text-destructive">{errors.farmName.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>{t('farms.farmType')}</Label>
                  <InfoTip>{t('farms.farmTypeHint')}</InfoTip>
                </div>
                <input type="hidden" {...register('farmType')} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {farmTypeOptions.map(({ value, label, Icon }) => {
                    const selected = watchedFarmType === value;
                    return (
                      <button key={value} type="button" onClick={() => setValue('farmType', value, { shouldDirty: true })} className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center transition-colors ${selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-input bg-background hover:bg-accent/50'}`}>
                        <Icon className={`h-6 w-6 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-xs font-medium leading-tight ${selected ? 'text-primary' : 'text-foreground'}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="fm-nickname">{t('farms.nickname')}</Label>
                  <InfoTip>{t('farms.nicknameHint')}</InfoTip>
                </div>
                <Input id="fm-nickname" {...register('nickname', { onChange: (e) => { e.target.value = e.target.value.toUpperCase(); } })} maxLength={8} placeholder={t('farms.nicknamePlaceholder')} className="uppercase" />
                {errors.nickname && <p className="text-sm text-destructive">{errors.nickname.message}</p>}
              </div>

              <HouseConfigurator
                houses={formHouses}
                onChange={(updated) => { setFormHouses(updated); markDirty(); }}
              />

              <Separator />

              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('farms.licensingSection')}</p>
                <InfoTip>{t('farms.licensingHint')}</InfoTip>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fm-tradeLicense">{t('farms.tradeLicenseNumber')}</Label>
                  <Input id="fm-tradeLicense" {...register('tradeLicenseNumber')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fm-trn">{t('farms.trnNumber')}</Label>
                  <Input id="fm-trn" {...register('trnNumber')} />
                </div>
              </div>

              <FileUpload label={t('farms.trnCertificate')} value={trnCertMedia} onUpload={(media) => { setTrnCertMedia(media); markDirty(); }} onRemove={() => { setTrnCertMedia(null); markDirty(); }} entityType="farm" entityId={editingFarm?._id} category="farms" mediaType="document" customPrefix={filePrefix ? `${filePrefix}TRN_Cert_` : ''} accept={{ 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }} />

              <FileUpload label={t('farms.tradeLicense')} value={tradeLicenseMedia} onUpload={(media) => { setTradeLicenseMedia(media); markDirty(); }} onRemove={() => { setTradeLicenseMedia(null); markDirty(); }} entityType="farm" entityId={editingFarm?._id} category="farms" mediaType="document" customPrefix={filePrefix ? `${filePrefix}Trade_License_` : ''} accept={{ 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }} />

              <Separator />

              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('farms.locationSection')}</p>
                <InfoTip>{t('farms.locationHint')}</InfoTip>
              </div>

              <FarmLocationPicker lat={location.lat} lng={location.lng} placeName={location.placeName} markerLabel={watchedFarmName || ''} onChange={(loc) => { setLocation(loc); markDirty(); }} onAddressResolved={(addr) => setResolvedAddress(addr)} />

              <Separator />

              <DocumentsManager entityType="farm" entityId={editingFarm?._id} category="farms" documents={otherDocs} mediaMap={mediaMap} onDocumentsChange={(docs, map) => { setOtherDocs(docs); setMediaMap(map); markDirty(); }} />
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>{t('common.cancel')}</Button>
            <Button type="submit" form="farm-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFarm ? t('common.save') : t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog open={confirmOpen} onOpenChange={setConfirmOpen} onDiscard={closeSheet} />

      <QuickAddBusinessSheet
        open={qabOpen}
        onOpenChange={setQabOpen}
        onCreated={(newBiz) => {
          setLinkedBusinessId(newBiz._id);
          setValue('farmName', newBiz.companyName || '', { shouldDirty: true });
          setValue('tradeLicenseNumber', newBiz.tradeLicenseNumber || '', { shouldDirty: true });
          setValue('trnNumber', newBiz.trnNumber || '', { shouldDirty: true });
          if (newBiz.logo) setLogoMedia(newBiz.logo);
          if (newBiz.trnCertificate) setTrnCertMedia(newBiz.trnCertificate);
          if (newBiz.tradeLicense) setTradeLicenseMedia(newBiz.tradeLicense);
          markDirty();
        }}
        initialName={qabName}
      />
    </>
  );
}
