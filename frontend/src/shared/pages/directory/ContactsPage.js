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
  ContactRound,
  Search,
  X,
  RotateCcw,
  Building2,
  Users,
} from 'lucide-react';
import AvatarUpload from '@/components/AvatarUpload';
import PhoneInput from '@/components/PhoneInput';
import DocumentsManager from '@/components/DocumentsManager';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import usePersistedState from '@/hooks/usePersistedState';
import api from '@/lib/api';

const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  notes: z.string().optional(),
});

export default function ContactsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [quickAddBusinessOpen, setQuickAddBusinessOpen] = useState(false);
  const [photoMedia, setPhotoMedia] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});

  const contacts = useLocalQuery('contacts');
  const businesses = useLocalQuery('businesses');

  const [search, setSearch] = usePersistedState('dir-contacts-search', '');
  const [bizFilter, setBizFilter] = usePersistedState('dir-contacts-biz', []);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isDirty: formIsDirty },
  } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      notes: '',
    },
  });

  const watchedFirstName = watch('firstName');
  const watchedLastName = watch('lastName');

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const { mutate: saveContact, isPending: isSaving } = useOfflineMutation('contacts');
  const { mutate: deleteContact, isPending: isDeleting } = useOfflineMutation('contacts');

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingContact(null);
    setSelectedBusinesses([]);
    setPhotoMedia(null);
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
    setEditingContact(null);
    setSelectedBusinesses([]);
    setPhotoMedia(null);
    setOtherDocs([]);
    setMediaMap({});
    reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      notes: '',
    });
    setSheetOpen(true);
    armGuard();
  };

  const openEditSheet = async (contact) => {
    resetGuard();
    setEditingContact(contact);
    setSelectedBusinesses(contact.businesses?.map((b) => b._id || b) || []);
    setPhotoMedia(contact.photo || null);
    reset({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || '',
      phone: contact.phone || '',
      jobTitle: contact.jobTitle || '',
      notes: contact.notes || '',
    });

    try {
      const { data: fullContact } = await api.get(`/contacts/${contact._id}`);
      if (fullContact.photo) setPhotoMedia(fullContact.photo);

      const { data: media } = await api.get('/media', {
        params: { entityType: 'contact', entityId: contact._id },
      });
      const map = {};
      media.forEach((m) => { map[m._id] = m; });
      setMediaMap(map);
      setOtherDocs(media.map((m) => ({ name: m.original_filename || m.filename, media_id: m._id })));
    } catch {
      setOtherDocs([]);
      setMediaMap({});
    }

    setSheetOpen(true);
    armGuard();
  };

  const onSubmit = (formData) => {
    const payload = {
      ...formData,
      photo: photoMedia?._id || null,
      businesses: selectedBusinesses,
    };

    if (editingContact) {
      saveContact(
        { action: 'update', id: editingContact._id, data: payload },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('contacts.contactUpdated') });
          },
        }
      );
    } else {
      saveContact(
        { action: 'create', data: payload },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('contacts.contactCreated') });
          },
        }
      );
    }
  };

  const businessOptions = useMemo(
    () =>
      businesses.map((b) => ({
        value: b._id,
        label: b.companyName,
        description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
      })),
    [businesses]
  );

  const contactBizOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    contacts.forEach((c) => {
      (c.businesses || []).forEach((b) => {
        const id = b._id || b;
        if (!id || seen.has(id)) return;
        seen.add(id);
        const biz = businesses.find((bz) => bz._id === id);
        opts.push({ value: id, label: b.companyName || biz?.companyName || id });
      });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [contacts, businesses]);

  const handleQuickBusinessCreated = (newBusiness) => {
    setSelectedBusinesses((prev) => [...prev, newBusiness._id]);
    markDirty();
  };

  const isMutating = isSaving;

  const filtered = useMemo(() => {
    let list = contacts;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.firstName?.toLowerCase().includes(q) ||
          c.lastName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
      );
    }

    if (bizFilter.length > 0) {
      list = list.filter((c) =>
        (c.businesses || []).some((b) => bizFilter.includes(b._id || b))
      );
    }

    return list;
  }, [contacts, search, bizFilter]);

  const hasFilters = !!(search || bizFilter.length);

  const resetFilters = () => {
    setSearch('');
    setBizFilter([]);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t('contacts.title', 'Contacts')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('contacts.subtitle', 'Manage your contacts directory')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <ContactRound className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground leading-none">{t('contacts.totalContacts', 'Total')}</p>
                  <p className="text-sm font-semibold tabular-nums">{filtered.length}</p>
                </div>
              </div>
              <Button onClick={openCreateSheet} size="sm" className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                {t('contacts.addContact', 'Add Contact')}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('contacts.searchPlaceholder', 'Search contacts...')}
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
              options={contactBizOptions}
              value={bizFilter}
              onChange={setBizFilter}
              placeholder={t('contacts.associatedBusinesses', 'Business')}
              className="flex-1 min-w-0 max-w-[220px]"
            />
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {contacts.length} {t('contacts.title', 'contacts').toLowerCase()}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {filtered.length === 0 && !hasFilters ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ContactRound className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('contacts.noContacts')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('contacts.noContactsDesc')}
              </p>
              <Button onClick={openCreateSheet} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t('contacts.addFirstContact')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('common.noResults')}
            </p>
          ) : (
            filtered.map((contact) => (
              <div
                key={contact._id}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {contact.photo?.url && (
                    <AvatarImage src={contact.photo.url} alt={`${contact.firstName} ${contact.lastName}`} />
                  )}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {`${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </p>
                    {contact.jobTitle && (
                      <Badge variant="secondary">{contact.jobTitle}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {contact.email && <span className="truncate">{contact.email}</span>}
                    {contact.phone && <span className="truncate">{contact.phone}</span>}
                  </div>
                  {contact.businesses?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {contact.businesses.map((b) => b.companyName || b).join(', ')}
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
                    <DropdownMenuItem onClick={() => openEditSheet(contact)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setContactToDelete(contact)}
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
              {editingContact ? t('contacts.editContact') : t('contacts.addContact')}
            </SheetTitle>
            <SheetDescription>
              {editingContact ? t('contacts.editContactDesc') : t('contacts.addContactDesc')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="contact-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <AvatarUpload
                value={photoMedia}
                onUpload={(media) => { setPhotoMedia(media); markDirty(); }}
                onRemove={() => { setPhotoMedia(null); markDirty(); }}
                entityType="contact"
                entityId={editingContact?._id}
                category="contacts"
                fallback={
                  (watchedFirstName?.[0] || '') + (watchedLastName?.[0] || '')
                    ? `${watchedFirstName?.[0] || ''}${watchedLastName?.[0] || ''}`.toUpperCase()
                    : <Users className="h-8 w-8" />
                }
              />

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ct-firstName">{t('contacts.firstName')}</Label>
                  <Input id="ct-firstName" {...register('firstName')} />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ct-lastName">{t('contacts.lastName')}</Label>
                  <Input id="ct-lastName" {...register('lastName')} />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ct-email">{t('contacts.email')}</Label>
                <Input id="ct-email" type="email" {...register('email')} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('contacts.phone')}</Label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ct-jobTitle">{t('contacts.jobTitle')}</Label>
                <Input id="ct-jobTitle" {...register('jobTitle')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ct-notes">{t('contacts.notes')}</Label>
                <textarea
                  id="ct-notes"
                  {...register('notes')}
                  rows={3}
                  placeholder={t('contacts.notesPlaceholder')}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('contacts.associatedBusinesses')}</Label>
                <SearchableMultiSelect
                  options={businessOptions}
                  value={selectedBusinesses}
                  onChange={(val) => { setSelectedBusinesses(val); markDirty(); }}
                  placeholder={t('contacts.selectBusinesses')}
                  searchPlaceholder={t('contacts.searchBusinesses')}
                  emptyMessage={t('common.noResults')}
                  createLabel={t('contacts.addNewBusiness')}
                  onCreate={() => setQuickAddBusinessOpen(true)}
                />
              </div>

              {editingContact && (
                <>
                  <Separator />
                  <DocumentsManager
                    entityType="contact"
                    entityId={editingContact._id}
                    category="contacts"
                    documents={otherDocs}
                    mediaMap={mediaMap}
                    onDocumentsChange={(docs, map) => {
                      setOtherDocs(docs);
                      setMediaMap(map);
                      markDirty();
                    }}
                  />
                </>
              )}
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="contact-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingContact ? t('common.save') : t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={closeSheet}
      />

      <ConfirmDeleteDialog
        open={!!contactToDelete}
        onOpenChange={(open) => !open && setContactToDelete(null)}
        title={t('contacts.deleteTitle')}
        description={t('contacts.deleteWarning')}
        onConfirm={() => contactToDelete && deleteContact(
          { action: 'delete', id: contactToDelete._id },
          {
            onSuccess: () => {
              setContactToDelete(null);
              toast({ title: t('contacts.contactDeleted') });
            },
          }
        )}
        isPending={isDeleting}
      />

      <QuickAddBusinessSheet
        open={quickAddBusinessOpen}
        onOpenChange={setQuickAddBusinessOpen}
        onCreated={handleQuickBusinessCreated}
      />
    </>
  );
}
