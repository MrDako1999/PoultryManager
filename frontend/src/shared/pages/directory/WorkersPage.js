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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  UserPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Search,
  FileText,
  X,
  RotateCcw,
  Link,
  SquarePen,
  Shield,
  ClipboardCheck,
  Hammer,
  Truck,
  CircleEllipsis,
} from 'lucide-react';
import InfoTip from '@/components/InfoTip';
import PhoneInput from '@/components/PhoneInput';
import FileUpload from '@/components/FileUpload';
import AvatarUpload from '@/components/AvatarUpload';
import DocumentsManager from '@/components/DocumentsManager';
import SearchableSelect from '@/components/SearchableSelect';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import ContactEditSheet from '@/shared/sheets/ContactEditSheet';
import QuickAddContactSheet from '@/shared/sheets/QuickAddContactSheet';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import usePersistedState from '@/hooks/usePersistedState';
import countries, { priorityCountries, otherCountries } from '@/lib/countries';
import api from '@/lib/api';

const countryOptions = otherCountries.map((c) => ({
  value: c.code,
  label: c.name,
  icon: c.flag,
}));
const priorityCountryOptions = priorityCountries.map((c) => ({
  value: c.code,
  label: c.name,
  icon: c.flag,
}));

const WORKER_ROLES = ['manager', 'supervisor', 'labourer', 'driver', 'other'];
const WORKER_ROLE_ICONS = {
  manager: Shield,
  supervisor: ClipboardCheck,
  labourer: Hammer,
  driver: Truck,
  other: CircleEllipsis,
};

const workerSchema = z.object({
  role: z.enum(WORKER_ROLES),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  compensation: z.string().optional()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = parseFloat(val.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : num;
    }),
  emiratesIdNumber: z.string().optional(),
  emiratesIdExpiry: z.string().optional(),
  passportNumber: z.string().optional(),
  passportCountry: z.string().optional(),
  passportExpiry: z.string().optional(),
});

const defaultValues = {
  role: 'labourer',
  firstName: '',
  lastName: '',
  phone: '',
  compensation: '',
  emiratesIdNumber: '',
  emiratesIdExpiry: '',
  passportNumber: '',
  passportCountry: '',
  passportExpiry: '',
};

export default function WorkersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [linkedContactId, setLinkedContactId] = useState(null);
  const [photoMedia, setPhotoMedia] = useState(null);
  const [eidFrontMedia, setEidFrontMedia] = useState(null);
  const [eidBackMedia, setEidBackMedia] = useState(null);
  const [visaMedia, setVisaMedia] = useState(null);
  const [passportPageMedia, setPassportPageMedia] = useState(null);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [quickContactName, setQuickContactName] = useState('');
  const [workerToDelete, setWorkerToDelete] = useState(null);

  const workers = useLocalQuery('workers');
  const contacts = useLocalQuery('contacts');

  const [search, setSearch] = usePersistedState('dir-workers-search', '');
  const [roleFilter, setRoleFilter] = usePersistedState('dir-workers-role', []);

  const usedContactIds = useMemo(
    () => new Set(workers.map((w) => w.contact?._id || w.contact).filter(Boolean)),
    [workers]
  );

  const contactOptions = useMemo(
    () =>
      contacts
        .filter((c) => !usedContactIds.has(c._id))
        .map((c) => ({
          value: c._id,
          label: `${c.firstName} ${c.lastName}`,
          description: c.email || c.phone || '',
        })),
    [contacts, usedContactIds]
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
    resolver: zodResolver(workerSchema),
    defaultValues,
  });

  const watchedRole = watch('role') || 'labourer';

  const roleOptions = useMemo(
    () =>
      WORKER_ROLES.map((role) => ({
        value: role,
        label: t(`workers.workerRoles.${role}`),
        Icon: WORKER_ROLE_ICONS[role],
      })),
    [t]
  );

  const roleFilterOptions = useMemo(
    () =>
      WORKER_ROLES.map((role) => ({
        value: role,
        label: t(`workers.workerRoles.${role}`),
      })),
    [t]
  );

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const { mutate: saveWorker, isPending: isSaving } = useOfflineMutation('workers');
  const { mutate: deleteWorker, isPending: isDeleting } = useOfflineMutation('workers');

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingWorker(null);
    setLinkedContactId(null);
    setPhotoMedia(null);
    setEidFrontMedia(null);
    setEidBackMedia(null);
    setVisaMedia(null);
    setPassportPageMedia(null);
    setOtherDocs([]);
    setMediaMap({});
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
    setEditingWorker(null);
    setLinkedContactId(null);
    setPhotoMedia(null);
    setEidFrontMedia(null);
    setEidBackMedia(null);
    setVisaMedia(null);
    setPassportPageMedia(null);
    setOtherDocs([]);
    setMediaMap({});
    reset(defaultValues);
    setSheetOpen(true);
    armGuard();
  };

  const openEditSheet = async (worker) => {
    resetGuard();
    setEditingWorker(worker);
    setLinkedContactId(worker.contact?._id || worker.contact || null);
    reset({
      role: worker.role || 'labourer',
      firstName: worker.firstName,
      lastName: worker.lastName,
      phone: worker.phone || '',
      compensation: worker.compensation != null ? Number(worker.compensation).toLocaleString() : '',
      emiratesIdNumber: worker.emiratesIdNumber || '',
      emiratesIdExpiry: worker.emiratesIdExpiry || '',
      passportNumber: worker.passportNumber || '',
      passportCountry: worker.passportCountry || '',
      passportExpiry: worker.passportExpiry || '',
    });

    try {
      const { data: full } = await api.get(`/workers/${worker._id}`);
      setPhotoMedia(full.photo || null);
      setEidFrontMedia(full.eidFront || null);
      setEidBackMedia(full.eidBack || null);
      setVisaMedia(full.visa || null);
      setPassportPageMedia(full.passportPage || null);

      const map = {};
      if (full.otherDocs) {
        full.otherDocs.forEach((doc) => {
          if (doc.media_id && typeof doc.media_id === 'object') {
            map[doc.media_id._id] = doc.media_id;
          }
        });
      }
      setMediaMap(map);
      setOtherDocs(
        (full.otherDocs || []).map((d) => ({
          name: d.name,
          media_id: d.media_id?._id ?? d.media_id,
        }))
      );
    } catch {
      setPhotoMedia(null);
      setEidFrontMedia(null);
      setEidBackMedia(null);
      setVisaMedia(null);
      setPassportPageMedia(null);
      setOtherDocs([]);
      setMediaMap({});
    }

    setSheetOpen(true);
    armGuard();
  };

  const handleContactSelect = (contactId) => {
    if (!contactId) {
      setLinkedContactId(null);
      reset({ ...defaultValues });
      markDirty();
      return;
    }
    const contact = contacts.find((c) => c._id === contactId);
    if (contact) {
      setLinkedContactId(contactId);
      setValue('firstName', contact.firstName || '', { shouldDirty: true });
      setValue('lastName', contact.lastName || '', { shouldDirty: true });
      setValue('phone', contact.phone || '', { shouldDirty: true });
      setPhotoMedia(contact.photo || null);
      markDirty();
    }
  };

  const clearLinkedContact = () => {
    setLinkedContactId(null);
    setPhotoMedia(null);
    markDirty();
  };

  const onSubmit = (formData) => {
    const payload = {
      ...formData,
      role: formData.role || 'labourer',
      photo: photoMedia?._id || null,
      eidFront: eidFrontMedia?._id || null,
      eidBack: eidBackMedia?._id || null,
      visa: visaMedia?._id || null,
      passportPage: passportPageMedia?._id || null,
      otherDocs,
    };

    if (!editingWorker && linkedContactId) {
      payload.existingContactId = linkedContactId;
    }

    if (editingWorker) {
      saveWorker(
        { action: 'update', id: editingWorker._id, data: payload },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('workers.workerUpdated') });
          },
        }
      );
    } else {
      saveWorker(
        { action: 'create', data: payload },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('workers.workerCreated') });
          },
        }
      );
    }
  };

  const handleContactSaved = async () => {
    if (editingWorker && linkedContactId) {
      try {
        const { data: contact } = await api.get(`/contacts/${linkedContactId}`);
        if (contact.photo) setPhotoMedia(contact.photo);
        else setPhotoMedia(null);
        setValue('firstName', contact.firstName || '', { shouldDirty: false });
        setValue('lastName', contact.lastName || '', { shouldDirty: false });
        setValue('phone', contact.phone || '', { shouldDirty: false });
      } catch {}
    }
  };

  const isMutating = isSaving;

  const filtered = useMemo(() => {
    let list = workers;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          w.firstName?.toLowerCase().includes(q) ||
          w.lastName?.toLowerCase().includes(q) ||
          w.phone?.includes(q) ||
          w.emiratesIdNumber?.toLowerCase().includes(q) ||
          w.passportNumber?.toLowerCase().includes(q)
      );
    }

    if (roleFilter.length > 0) {
      list = list.filter((w) => roleFilter.includes(w.role || 'labourer'));
    }

    return list;
  }, [workers, search, roleFilter]);

  const hasFilters = !!(search || roleFilter.length);

  const resetFilters = () => {
    setSearch('');
    setRoleFilter([]);
  };

  const uploadAccept = {
    'application/pdf': ['.pdf'],
    'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t('workers.title', 'Workers')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('workers.subtitle', 'Manage your workforce')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground leading-none">{t('workers.totalWorkers', 'Total')}</p>
                  <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
                </div>
              </div>
              <Button onClick={openCreateSheet} size="sm" className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                {t('workers.addWorker', 'Add Worker')}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('workers.searchPlaceholder', 'Search workers...')}
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

          <div className="flex items-center gap-2">
            <SearchableMultiSelect
              variant="dropdown"
              options={roleFilterOptions}
              value={roleFilter}
              onChange={setRoleFilter}
              placeholder={t('workers.role', 'Role')}
              className="flex-1 min-w-0 max-w-[220px]"
            />
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {workers.length} {t('workers.title', 'workers').toLowerCase()}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {filtered.length === 0 && !hasFilters ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('workers.noWorkers')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('workers.noWorkersDesc')}
              </p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t('workers.addFirstWorker')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('common.noResults')}
            </p>
          ) : (
            filtered.map((worker) => (
              <div
                key={worker._id}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {(worker.photo?.url || worker.contact?.photo?.url) && (
                    <AvatarImage src={worker.photo?.url || worker.contact.photo.url} alt={`${worker.firstName} ${worker.lastName}`} />
                  )}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {`${worker.firstName?.[0] || ''}${worker.lastName?.[0] || ''}`.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">
                      {worker.firstName} {worker.lastName}
                    </p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                      {t(`workers.workerRoles.${worker.role || 'labourer'}`)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {worker.phone && <span className="truncate">{worker.phone}</span>}
                    {worker.emiratesIdNumber && (
                      <Badge variant="secondary" className="text-xs">
                        EID: {worker.emiratesIdNumber}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {worker.passportCountry && (
                      <span className="text-xs text-muted-foreground">
                        {countries.find((c) => c.code === worker.passportCountry)?.flag}{' '}
                        {countries.find((c) => c.code === worker.passportCountry)?.name || worker.passportCountry}
                      </span>
                    )}
                    {worker.otherDocs?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {worker.otherDocs.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditSheet(worker)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setWorkerToDelete(worker)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
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
              {editingWorker ? t('workers.editWorker') : t('workers.addWorker')}
            </SheetTitle>
            <SheetDescription>
              {editingWorker ? t('workers.editWorkerDesc') : t('workers.addWorkerDesc')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="worker-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <AvatarUpload
                value={photoMedia}
                onUpload={(media) => { setPhotoMedia(media); markDirty(); }}
                onRemove={() => { setPhotoMedia(null); markDirty(); }}
                entityType="worker"
                entityId={editingWorker?._id}
                category="workers"
                disabled={!!linkedContactId}
                fallback={<Users className="h-8 w-8" />}
              />
              {linkedContactId && (
                <div className="flex justify-center">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setContactSheetOpen(true)}>
                    <SquarePen className="h-3.5 w-3.5" />
                    {t('workers.editContact')}
                  </Button>
                </div>
              )}

              <Separator />

              {!editingWorker && (
                <div className="space-y-2">
                  <Label>{t('workers.linkContact')}</Label>
                  {linkedContactId ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <Link className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 text-sm truncate">
                        {contacts.find((c) => c._id === linkedContactId)
                          ? `${contacts.find((c) => c._id === linkedContactId).firstName} ${contacts.find((c) => c._id === linkedContactId).lastName}`
                          : t('workers.linkedContact')}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{t('workers.linked')}</Badge>
                      <button
                        type="button"
                        onClick={clearLinkedContact}
                        className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={contactOptions}
                      value=""
                      onChange={handleContactSelect}
                      placeholder={t('workers.searchExistingContact')}
                      searchPlaceholder={t('workers.searchContactPlaceholder')}
                      emptyMessage={t('common.noResults')}
                      createLabel={t('workers.addNewContact')}
                      onCreate={(name) => {
                        setQuickContactName(name || '');
                        setQuickContactOpen(true);
                      }}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">{t('workers.linkContactHint')}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wk-firstName">{t('workers.firstName')}</Label>
                  <Input id="wk-firstName" {...register('firstName')} disabled={!!linkedContactId} className={linkedContactId ? 'opacity-60' : ''} />
                  {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wk-lastName">{t('workers.lastName')}</Label>
                  <Input id="wk-lastName" {...register('lastName')} disabled={!!linkedContactId} className={linkedContactId ? 'opacity-60' : ''} />
                  {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('workers.phone')}</Label>
                <Controller name="phone" control={control} render={({ field }) => (<PhoneInput value={field.value} onChange={field.onChange} disabled={!!linkedContactId} />)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>{t('workers.role')}</Label>
                  <InfoTip>{t('workers.roleHint')}</InfoTip>
                </div>
                <input type="hidden" {...register('role')} />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {roleOptions.map(({ value, label, Icon }) => {
                    const selected = watchedRole === value;
                    return (
                      <button key={value} type="button" onClick={() => setValue('role', value, { shouldDirty: true })} className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors ${selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-input bg-background hover:bg-accent/50'}`}>
                        <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-xs font-medium leading-tight ${selected ? 'text-primary' : 'text-foreground'}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wk-compensation">{t('workers.compensation')}</Label>
                <Input id="wk-compensation" inputMode="numeric" {...register('compensation', { onChange: (e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); e.target.value = raw ? Number(raw).toLocaleString() : ''; } })} placeholder={t('workers.compensationPlaceholder')} />
              </div>

              <Separator />

              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('workers.uaeResidencySection')}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wk-eid">{t('workers.emiratesIdNumber')}</Label>
                  <Input id="wk-eid" {...register('emiratesIdNumber')} placeholder="784-XXXX-XXXXXXX-X" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wk-eidExpiry">{t('workers.emiratesIdExpiry')}</Label>
                  <Input id="wk-eidExpiry" type="date" {...register('emiratesIdExpiry')} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FileUpload label={t('workers.eidFront')} value={eidFrontMedia} onUpload={(media) => { setEidFrontMedia(media); markDirty(); }} onRemove={() => { setEidFrontMedia(null); markDirty(); }} entityType="worker" entityId={editingWorker?._id} category="workers" mediaType="document" accept={uploadAccept} />
                <FileUpload label={t('workers.eidBack')} value={eidBackMedia} onUpload={(media) => { setEidBackMedia(media); markDirty(); }} onRemove={() => { setEidBackMedia(null); markDirty(); }} entityType="worker" entityId={editingWorker?._id} category="workers" mediaType="document" accept={uploadAccept} />
              </div>

              <FileUpload label={t('workers.visa')} value={visaMedia} onUpload={(media) => { setVisaMedia(media); markDirty(); }} onRemove={() => { setVisaMedia(null); markDirty(); }} entityType="worker" entityId={editingWorker?._id} category="workers" mediaType="document" accept={uploadAccept} />

              <Separator />

              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('workers.passportSection')}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wk-passport">{t('workers.passportNumber')}</Label>
                  <Input id="wk-passport" {...register('passportNumber')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wk-passportExpiry">{t('workers.passportExpiry')}</Label>
                  <Input id="wk-passportExpiry" type="date" {...register('passportExpiry')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('workers.passportCountry')}</Label>
                <Controller name="passportCountry" control={control} render={({ field }) => (<SearchableSelect options={countryOptions} priorityOptions={priorityCountryOptions} value={field.value} onChange={field.onChange} placeholder={t('workers.selectCountry')} searchPlaceholder={t('workers.searchCountry')} emptyMessage={t('common.noResults')} />)} />
              </div>

              <FileUpload label={t('workers.passportPage')} value={passportPageMedia} onUpload={(media) => { setPassportPageMedia(media); markDirty(); }} onRemove={() => { setPassportPageMedia(null); markDirty(); }} entityType="worker" entityId={editingWorker?._id} category="workers" mediaType="document" accept={uploadAccept} />

              <Separator />

              <DocumentsManager entityType="worker" entityId={editingWorker?._id} category="workers" documents={otherDocs} mediaMap={mediaMap} onDocumentsChange={(docs, map) => { setOtherDocs(docs); setMediaMap(map); markDirty(); }} />
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>{t('common.cancel')}</Button>
            <Button type="submit" form="worker-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingWorker ? t('common.save') : t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog open={confirmOpen} onOpenChange={setConfirmOpen} onDiscard={closeSheet} />

      <ConfirmDeleteDialog
        open={!!workerToDelete}
        onOpenChange={(open) => !open && setWorkerToDelete(null)}
        title={t('workers.deleteTitle')}
        description={t('workers.deleteWarning')}
        onConfirm={() => workerToDelete && deleteWorker(
          { action: 'delete', id: workerToDelete._id },
          { onSuccess: () => { setWorkerToDelete(null); toast({ title: t('workers.workerDeleted') }); } }
        )}
        isPending={isDeleting}
      />

      {linkedContactId && (
        <ContactEditSheet open={contactSheetOpen} onOpenChange={setContactSheetOpen} contactId={linkedContactId} onSaved={handleContactSaved} />
      )}

      <QuickAddContactSheet
        open={quickContactOpen}
        onOpenChange={setQuickContactOpen}
        initialName={quickContactName}
        onCreated={(newContact) => {
          setLinkedContactId(newContact._id);
          setValue('firstName', newContact.firstName || '', { shouldDirty: true });
          setValue('lastName', newContact.lastName || '', { shouldDirty: true });
          setValue('phone', newContact.phone || '', { shouldDirty: true });
          if (newContact.photo) setPhotoMedia(newContact.photo);
          markDirty();
        }}
      />
    </>
  );
}
