import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import AvatarUpload from '@/components/AvatarUpload';
import PhoneInput from '@/components/PhoneInput';
import DocumentsManager from '@/components/DocumentsManager';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import api from '@/lib/api';

const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  notes: z.string().optional(),
});

export default function ContactEditSheet({ open, onOpenChange, contactId, onSaved }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [photoMedia, setPhotoMedia] = useState(null);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [quickAddBusinessOpen, setQuickAddBusinessOpen] = useState(false);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});

  const businesses = useLocalQuery('businesses');

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

  const { confirmOpen, setConfirmOpen, isDirty, markDirty, resetGuard, armGuard } =
    useFormGuard(formIsDirty);

  const watchedFirstName = watch('firstName');
  const watchedLastName = watch('lastName');

  const closeSheet = () => {
    resetGuard();
    onOpenChange(false);
  };

  const tryClose = () => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  useEffect(() => {
    if (!open || !contactId) return;
    resetGuard();

    (async () => {
      try {
        const { data: contact } = await api.get(`/contacts/${contactId}`);
        setPhotoMedia(contact.photo || null);
        setSelectedBusinesses(contact.businesses?.map((b) => b._id || b) || []);
        reset({
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          email: contact.email || '',
          phone: contact.phone || '',
          jobTitle: contact.jobTitle || '',
          notes: contact.notes || '',
        });

        const { data: media } = await api.get('/media', {
          params: { entityType: 'contact', entityId: contactId },
        });
        const map = {};
        media.forEach((m) => { map[m._id] = m; });
        setMediaMap(map);
        setOtherDocs(media.map((m) => ({ name: m.original_filename || m.filename, media_id: m._id })));
        armGuard();
      } catch {
        setPhotoMedia(null);
        setOtherDocs([]);
        setMediaMap({});
        armGuard();
      }
    })();
  }, [open, contactId, reset, resetGuard, armGuard]);

  const { mutate, isPending } = useOfflineMutation('contacts');

  const onSubmit = (formData) => {
    mutate({
      action: 'update',
      id: contactId,
      data: {
        ...formData,
        photo: photoMedia?._id || null,
        businesses: selectedBusinesses,
      },
    }, {
      onSuccess: () => {
        toast({ title: t('contacts.contactUpdated') });
        onSaved?.();
        closeSheet();
      },
    });
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

  const handleQuickBusinessCreated = (newBusiness) => {
    setSelectedBusinesses((prev) => [...prev, newBusiness._id]);
    markDirty();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent className="z-[60]">
          <SheetHeader>
            <SheetTitle>{t('contacts.editContact')}</SheetTitle>
            <SheetDescription>{t('contacts.editContactDesc')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="contact-edit-stacked-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <AvatarUpload
                value={photoMedia}
                onUpload={(media) => { setPhotoMedia(media); markDirty(); }}
                onRemove={() => { setPhotoMedia(null); markDirty(); }}
                entityType="contact"
                entityId={contactId}
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
                  <Label htmlFor="ces-firstName">{t('contacts.firstName')}</Label>
                  <Input id="ces-firstName" {...register('firstName')} />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ces-lastName">{t('contacts.lastName')}</Label>
                  <Input id="ces-lastName" {...register('lastName')} />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ces-email">{t('contacts.email')}</Label>
                <Input id="ces-email" type="email" {...register('email')} />
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
                <Label htmlFor="ces-jobTitle">{t('contacts.jobTitle')}</Label>
                <Input id="ces-jobTitle" {...register('jobTitle')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ces-notes">{t('contacts.notes')}</Label>
                <textarea
                  id="ces-notes"
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
                  onChange={(v) => { setSelectedBusinesses(v); markDirty(); }}
                  placeholder={t('contacts.selectBusinesses')}
                  searchPlaceholder={t('contacts.searchBusinesses')}
                  emptyMessage={t('common.noResults')}
                  createLabel={t('contacts.addNewBusiness')}
                  onCreate={() => setQuickAddBusinessOpen(true)}
                />
              </div>

              <Separator />

              <DocumentsManager
                entityType="contact"
                entityId={contactId}
                category="contacts"
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
            <Button type="submit" form="contact-edit-stacked-form" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={closeSheet}
      />

      <QuickAddBusinessSheet
        open={quickAddBusinessOpen}
        onOpenChange={setQuickAddBusinessOpen}
        onCreated={handleQuickBusinessCreated}
      />
    </>
  );
}
