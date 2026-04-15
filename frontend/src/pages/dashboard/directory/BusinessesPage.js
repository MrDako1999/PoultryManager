import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Building2,
  Search,
  X,
  RotateCcw,
  ContactRound,
  FileText,
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import LogoUpload from '@/components/LogoUpload';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import DocumentsManager from '@/components/DocumentsManager';
import InfoTip from '@/components/InfoTip';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import QuickAddContactSheet from '@/components/QuickAddContactSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import usePersistedState from '@/hooks/usePersistedState';
import useAuthStore from '@/stores/authStore';
import api from '@/lib/api';

const BUSINESS_TYPES = ['TRADER', 'SUPPLIER'];

const businessSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

export default function BusinessesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [quickAddContactOpen, setQuickAddContactOpen] = useState(false);
  const [logoMedia, setLogoMedia] = useState(null);
  const [address, setAddress] = useState(null);
  const [trnCertMedia, setTrnCertMedia] = useState(null);
  const [tradeLicenseMedia, setTradeLicenseMedia] = useState(null);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});

  const businessesList = useLocalQuery('businesses');
  const contacts = useLocalQuery('contacts');

  const [search, setSearch] = usePersistedState('dir-biz-search', '');
  const [typeFilter, setTypeFilter] = usePersistedState('dir-biz-type', []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty: formIsDirty },
  } = useForm({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      companyName: '',
      tradeLicenseNumber: '',
      trnNumber: '',
    },
  });

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const { mutate: saveBusiness, isPending: isSaving } = useOfflineMutation('businesses');
  const { mutate: deleteBusiness } = useOfflineMutation('businesses');

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingBusiness(null);
    setSelectedContacts([]);
    setLogoMedia(null);
    setAddress(null);
    setTrnCertMedia(null);
    setTradeLicenseMedia(null);
    setOtherDocs([]);
    setMediaMap({});
    resetGuard();
    reset();
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
    setEditingBusiness(null);
    setSelectedContacts([]);
    setLogoMedia(null);
    setAddress(null);
    setTrnCertMedia(null);
    setTradeLicenseMedia(null);
    setOtherDocs([]);
    setMediaMap({});
    reset({
      companyName: '',
      tradeLicenseNumber: '',
      trnNumber: '',
    });
    setSheetOpen(true);
    armGuard();
  };

  const openEditSheet = async (business) => {
    resetGuard();
    setEditingBusiness(business);
    setSelectedContacts(business.contacts?.map((c) => c._id || c) || []);
    reset({
      companyName: business.companyName,
      tradeLicenseNumber: business.tradeLicenseNumber || '',
      trnNumber: business.trnNumber || '',
    });

    try {
      const { data: fullBiz } = await api.get(`/businesses/${business._id}`);
      setLogoMedia(fullBiz.logo || null);
      setAddress(fullBiz.address || null);
      setTrnCertMedia(fullBiz.trnCertificate || null);
      setTradeLicenseMedia(fullBiz.tradeLicense || null);

      const map = {};
      if (fullBiz.otherDocs) {
        fullBiz.otherDocs.forEach((doc) => {
          if (doc.media_id && typeof doc.media_id === 'object') {
            map[doc.media_id._id] = doc.media_id;
          }
        });
      }
      setMediaMap(map);
      setOtherDocs(
        (fullBiz.otherDocs || []).map((d) => ({
          name: d.name,
          media_id: d.media_id?._id ?? d.media_id,
        }))
      );
    } catch {
      setLogoMedia(null);
      setAddress(null);
      setTrnCertMedia(null);
      setTradeLicenseMedia(null);
      setOtherDocs([]);
      setMediaMap({});
    }

    setSheetOpen(true);
    armGuard();
  };

  const onSubmit = (formData) => {
    const payload = {
      ...formData,
      logo: logoMedia?._id || null,
      address: address || {},
      contacts: selectedContacts,
      trnCertificate: trnCertMedia?._id || null,
      tradeLicense: tradeLicenseMedia?._id || null,
      otherDocs,
    };

    if (editingBusiness) {
      saveBusiness(
        { action: 'update', id: editingBusiness._id, data: payload },
        {
          onSuccess: () => {
            checkAuth();
            closeSheet();
            toast({ title: t('businesses.businessUpdated') });
          },
        }
      );
    } else {
      saveBusiness(
        { action: 'create', data: payload },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('businesses.businessCreated') });
          },
        }
      );
    }
  };

  const contactOptions = useMemo(
    () =>
      contacts.map((c) => ({
        value: c._id,
        label: `${c.firstName} ${c.lastName}`,
        description: c.email || '',
      })),
    [contacts]
  );

  const handleQuickContactCreated = (newContact) => {
    setSelectedContacts((prev) => [...prev, newContact._id]);
    markDirty();
  };

  const isMutating = isSaving;

  const typeOptions = useMemo(
    () => BUSINESS_TYPES.map((bt) => ({
      value: bt,
      label: t(`businesses.types.${bt}`, bt === 'TRADER' ? 'Trader' : 'Supplier'),
    })),
    [t],
  );

  const filtered = useMemo(() => {
    let list = businessesList;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.companyName?.toLowerCase().includes(q) ||
          b.tradeLicenseNumber?.toLowerCase().includes(q) ||
          b.trnNumber?.toLowerCase().includes(q)
      );
    }

    if (typeFilter.length > 0) {
      list = list.filter((b) => typeFilter.includes(b.businessType || 'TRADER'));
    }

    return [...list].sort((a, b) => (b.isAccountBusiness ? 1 : 0) - (a.isAccountBusiness ? 1 : 0));
  }, [businessesList, search, typeFilter]);

  const hasFilters = !!(search || typeFilter.length);

  const resetFilters = () => {
    setSearch('');
    setTypeFilter([]);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="pb-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t('businesses.title', 'Businesses')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('businesses.subtitle', 'Manage your business directory')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground leading-none">{t('businesses.totalBusinesses', 'Total')}</p>
                  <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
                </div>
              </div>
              <Button onClick={openCreateSheet} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('businesses.addBusiness', 'Add Business')}
              </Button>
            </div>
          </div>

          {/* Search + Reset */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('businesses.searchPlaceholder', 'Search businesses...')}
                className="pl-8 h-9 bg-white dark:bg-card"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs shrink-0"
              onClick={resetFilters}
              disabled={!hasFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2">
            <SearchableMultiSelect
              variant="dropdown"
              options={typeOptions}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder={t('businesses.businessType', 'Business Type')}
              className="flex-1 min-w-0 max-w-[220px]"
            />
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {businessesList.length} {t('businesses.title', 'businesses').toLowerCase()}
            </p>
          )}
        </div>

        {/* Business list */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {filtered.length === 0 && !hasFilters ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('businesses.noBusinesses')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('businesses.noBusinessesDesc')}
              </p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('businesses.addFirstBusiness')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('common.noResults')}
            </p>
          ) : (
            filtered.map((biz) => (
              <div
                key={biz._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/directory/businesses/${biz._id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/dashboard/directory/businesses/${biz._id}`); }}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50 cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{biz.companyName}</p>
                    {biz.isAccountBusiness && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        {t('businesses.yourBusiness')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {biz.trnNumber && <span>TRN: {biz.trnNumber}</span>}
                    {biz.tradeLicenseNumber && <span>TL: {biz.tradeLicenseNumber}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {biz.contacts?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <ContactRound className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {biz.contacts.length}
                        </span>
                      </div>
                    )}
                    {biz.otherDocs?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {biz.otherDocs.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditSheet(biz)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    {!biz.isAccountBusiness && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteBusiness(
                            { action: 'delete', id: biz._id },
                            { onSuccess: () => toast({ title: t('businesses.businessDeleted') }) }
                          )}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingBusiness ? t('businesses.editBusiness') : t('businesses.addBusiness')}
            </SheetTitle>
            <SheetDescription>
              {editingBusiness ? t('businesses.editBusinessDesc') : t('businesses.addBusinessDesc')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="business-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="bz-companyName">{t('businesses.companyName')}</Label>
                <Input id="bz-companyName" {...register('companyName')} />
                {errors.companyName && (
                  <p className="text-sm text-destructive">{errors.companyName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('businesses.logo')}</Label>
                <LogoUpload
                  value={logoMedia}
                  onUpload={(media) => { setLogoMedia(media); markDirty(); }}
                  onRemove={() => { setLogoMedia(null); markDirty(); }}
                  entityType="business"
                  entityId={editingBusiness?._id}
                  category="businesses"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bz-tradeLicense">{t('businesses.tradeLicenseNumber')}</Label>
                  <Input id="bz-tradeLicense" {...register('tradeLicenseNumber')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bz-trn">{t('businesses.trnNumber')}</Label>
                  <Input id="bz-trn" {...register('trnNumber')} />
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('businesses.addressSection')}
                </p>
                <InfoTip>{t('businesses.addressSectionHint')}</InfoTip>
              </div>

              <AddressAutocomplete
                value={address}
                onChange={(addr) => { setAddress(addr); markDirty(); }}
              />

              <Separator />

              <FileUpload
                label={t('businesses.trnCertificate')}
                value={trnCertMedia}
                onUpload={(media) => { setTrnCertMedia(media); markDirty(); }}
                onRemove={() => { setTrnCertMedia(null); markDirty(); }}
                entityType="business"
                entityId={editingBusiness?._id}
                category="businesses"
                mediaType="document"
                accept={{
                  'application/pdf': ['.pdf'],
                  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
                }}
              />

              <FileUpload
                label={t('businesses.tradeLicense')}
                value={tradeLicenseMedia}
                onUpload={(media) => { setTradeLicenseMedia(media); markDirty(); }}
                onRemove={() => { setTradeLicenseMedia(null); markDirty(); }}
                entityType="business"
                entityId={editingBusiness?._id}
                category="businesses"
                mediaType="document"
                accept={{
                  'application/pdf': ['.pdf'],
                  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
                }}
              />

              <Separator />

              <div className="space-y-2">
                <Label>{t('businesses.associatedContacts')}</Label>
                <SearchableMultiSelect
                  options={contactOptions}
                  value={selectedContacts}
                  onChange={(val) => { setSelectedContacts(val); markDirty(); }}
                  placeholder={t('businesses.selectContacts')}
                  searchPlaceholder={t('businesses.searchContacts')}
                  emptyMessage={t('common.noResults')}
                  createLabel={t('businesses.addNewContact')}
                  onCreate={() => setQuickAddContactOpen(true)}
                />
              </div>

              <Separator />

              <DocumentsManager
                entityType="business"
                entityId={editingBusiness?._id}
                category="businesses"
                documents={otherDocs}
                mediaMap={mediaMap}
                onDocumentsChange={(docs, map) => {
                  setOtherDocs(docs);
                  setMediaMap(map);
                  markDirty();
                }}
              />
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="business-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBusiness ? t('common.save') : t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={closeSheet}
      />

      <QuickAddContactSheet
        open={quickAddContactOpen}
        onOpenChange={setQuickAddContactOpen}
        onCreated={handleQuickContactCreated}
      />
    </>
  );
}
