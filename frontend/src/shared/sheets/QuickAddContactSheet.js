import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useTranslation } from 'react-i18next';
import { Loader2, Users } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import AvatarUpload from '@/components/AvatarUpload';
import PhoneInput from '@/components/PhoneInput';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  notes: z.string().optional(),
});

const defaults = {
  firstName: '', lastName: '', email: '', phone: '', jobTitle: '', notes: '',
};

export default function QuickAddContactSheet({ open, onOpenChange, onCreated, initialName = '' }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const guard = useFormGuard(form.formState.isDirty);

  const [photoMedia, setPhotoMedia] = useState(null);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);

  const businesses = useLocalQuery('businesses');

  const businessOptions = useMemo(
    () => businesses.map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    })),
    [businesses]
  );

  const watchedFirstName = form.watch('firstName');
  const watchedLastName = form.watch('lastName');

  useEffect(() => {
    if (open) {
      guard.resetGuard();
      const parts = initialName.trim().split(/\s+/);
      form.reset({
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        email: '', phone: '', jobTitle: '', notes: '',
      });
      setPhotoMedia(null);
      setSelectedBusinesses([]);
      guard.armGuard();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate, isPending } = useOfflineMutation('contacts');

  const closeSheet = () => {
    onOpenChange(false);
    guard.resetGuard();
    form.reset(defaults);
    setPhotoMedia(null);
    setSelectedBusinesses([]);
  };

  const tryClose = () => {
    if (guard.isDirty) {
      guard.setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  const onSubmit = (formData) => {
    mutate({
      action: 'create',
      data: {
        ...formData,
        photo: photoMedia?._id || null,
        businesses: selectedBusinesses,
      },
    }, {
      onSuccess: (newContact) => {
        toast({ title: t('contacts.contactCreated') });
        onCreated?.(newContact);
        closeSheet();
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && tryClose()}>
        <SheetContent className="z-[60]">
          <SheetHeader>
            <SheetTitle>{t('contacts.addContact')}</SheetTitle>
            <SheetDescription>{t('contacts.addContactDesc')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="qac-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <AvatarUpload
                value={photoMedia}
                onUpload={(media) => { setPhotoMedia(media); guard.markDirty(); }}
                onRemove={() => { setPhotoMedia(null); guard.markDirty(); }}
                entityType="contact"
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
                  <Label htmlFor="qac-firstName">{t('contacts.firstName')}</Label>
                  <Input id="qac-firstName" {...form.register('firstName')} />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qac-lastName">{t('contacts.lastName')}</Label>
                  <Input id="qac-lastName" {...form.register('lastName')} />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qac-email">{t('contacts.email')}</Label>
                <Input id="qac-email" type="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('contacts.phone')}</Label>
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field }) => (
                    <PhoneInput value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qac-jobTitle">{t('contacts.jobTitle')}</Label>
                <Input id="qac-jobTitle" {...form.register('jobTitle')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qac-notes">{t('contacts.notes')}</Label>
                <textarea
                  id="qac-notes"
                  {...form.register('notes')}
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
                  onChange={(val) => { setSelectedBusinesses(val); guard.markDirty(); }}
                  placeholder={t('contacts.selectBusinesses')}
                  searchPlaceholder={t('contacts.searchBusinesses')}
                  emptyMessage={t('common.noResults')}
                />
              </div>
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="qac-form" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={guard.confirmOpen}
        onOpenChange={guard.setConfirmOpen}
        onDiscard={closeSheet}
      />
    </>
  );
}
