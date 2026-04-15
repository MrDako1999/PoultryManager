import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import FileUpload from '@/components/FileUpload';
import LogoUpload from '@/components/LogoUpload';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import DocumentsManager from '@/components/DocumentsManager';
import InfoTip from '@/components/InfoTip';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import QuickAddContactSheet from '@/components/QuickAddContactSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import db from '@/lib/db';
import { DOC_ACCEPT } from '@/lib/constants';

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

const defaults = { companyName: '', tradeLicenseNumber: '', trnNumber: '' };

export default function QuickAddBusinessSheet({ open, onOpenChange, onCreated, initialName = '' }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const guard = useFormGuard(form.formState.isDirty);

  const [logoMedia, setLogoMedia] = useState(null);
  const [address, setAddress] = useState(null);
  const [trnCertMedia, setTrnCertMedia] = useState(null);
  const [tradeLicenseMedia, setTradeLicenseMedia] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});
  const [quickContactOpen, setQuickContactOpen] = useState(false);

  const contacts = useLocalQuery('contacts');

  const contactOptions = useMemo(
    () => contacts.map((c) => ({
      value: c._id,
      label: `${c.firstName} ${c.lastName}`,
      description: c.email || '',
    })),
    [contacts]
  );

  useEffect(() => {
    if (open) {
      guard.resetGuard();
      form.reset({ companyName: initialName, tradeLicenseNumber: '', trnNumber: '' });
      setLogoMedia(null);
      setAddress(null);
      setTrnCertMedia(null);
      setTradeLicenseMedia(null);
      setSelectedContacts([]);
      setOtherDocs([]);
      setMediaMap({});
      guard.armGuard();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedContacts.length === 0) return;
    const contactIds = new Set(contacts.map(c => c._id));
    const stale = selectedContacts.filter(id => !contactIds.has(id));
    if (stale.length === 0) return;
    Promise.all(stale.map(id => db.idMap.get({ tempId: id, entityType: 'contacts' }))).then(mappings => {
      const updates = {};
      mappings.forEach((m, i) => { if (m) updates[stale[i]] = m.realId; });
      if (Object.keys(updates).length > 0) {
        setSelectedContacts(prev => prev.map(id => updates[id] || id));
      }
    });
  }, [contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate, isPending } = useOfflineMutation('businesses');

  const closeSheet = () => {
    onOpenChange(false);
    guard.resetGuard();
    form.reset(defaults);
    setLogoMedia(null);
    setAddress(null);
    setTrnCertMedia(null);
    setTradeLicenseMedia(null);
    setSelectedContacts([]);
    setOtherDocs([]);
    setMediaMap({});
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
        logo: logoMedia?._id || null,
        address: address || {},
        contacts: selectedContacts,
        trnCertificate: trnCertMedia?._id || null,
        tradeLicense: tradeLicenseMedia?._id || null,
        otherDocs,
      },
    }, {
      onSuccess: (newBiz) => {
        toast({ title: t('businesses.businessCreated') });
        onCreated?.(newBiz);
        closeSheet();
      },
    });
  };

  const handleQuickContact = (newContact) => {
    setSelectedContacts((prev) => [...prev, newContact._id]);
    guard.markDirty();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('businesses.addBusiness')}</SheetTitle>
            <SheetDescription>{t('businesses.addBusinessDesc')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="qb-biz-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="qb-companyName">{t('businesses.companyName')}</Label>
                <Input id="qb-companyName" {...form.register('companyName')} />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('businesses.logo')}</Label>
                <LogoUpload
                  value={logoMedia}
                  onUpload={(media) => { setLogoMedia(media); guard.markDirty(); }}
                  onRemove={() => { setLogoMedia(null); guard.markDirty(); }}
                  entityType="business"
                  category="businesses"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qb-tradeLicense">{t('businesses.tradeLicenseNumber')}</Label>
                  <Input id="qb-tradeLicense" {...form.register('tradeLicenseNumber')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qb-trn">{t('businesses.trnNumber')}</Label>
                  <Input id="qb-trn" {...form.register('trnNumber')} />
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
                onChange={(addr) => { setAddress(addr); guard.markDirty(); }}
              />

              <Separator />

              <FileUpload
                label={t('businesses.trnCertificate')}
                value={trnCertMedia}
                onUpload={(media) => { setTrnCertMedia(media); guard.markDirty(); }}
                onRemove={() => { setTrnCertMedia(null); guard.markDirty(); }}
                entityType="business"
                category="businesses"
                mediaType="document"
                accept={DOC_ACCEPT}
              />

              <FileUpload
                label={t('businesses.tradeLicense')}
                value={tradeLicenseMedia}
                onUpload={(media) => { setTradeLicenseMedia(media); guard.markDirty(); }}
                onRemove={() => { setTradeLicenseMedia(null); guard.markDirty(); }}
                entityType="business"
                category="businesses"
                mediaType="document"
                accept={DOC_ACCEPT}
              />

              <Separator />

              <div className="space-y-2">
                <Label>{t('businesses.associatedContacts')}</Label>
                <SearchableMultiSelect
                  options={contactOptions}
                  value={selectedContacts}
                  onChange={(val) => { setSelectedContacts(val); guard.markDirty(); }}
                  placeholder={t('businesses.selectContacts')}
                  searchPlaceholder={t('businesses.searchContacts')}
                  emptyMessage={t('common.noResults')}
                  createLabel={t('businesses.addNewContact')}
                  onCreate={() => setQuickContactOpen(true)}
                />
              </div>

              <Separator />

              <DocumentsManager
                entityType="business"
                category="businesses"
                documents={otherDocs}
                mediaMap={mediaMap}
                onDocumentsChange={(docs, map) => {
                  setOtherDocs(docs);
                  setMediaMap(map);
                  guard.markDirty();
                }}
              />
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="qb-biz-form" disabled={isPending}>
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

      <QuickAddContactSheet
        open={quickContactOpen}
        onOpenChange={setQuickContactOpen}
        onCreated={handleQuickContact}
      />
    </>
  );
}
