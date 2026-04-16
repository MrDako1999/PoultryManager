import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import LogoUpload from '@/components/LogoUpload';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import DocumentsManager from '@/components/DocumentsManager';
import InfoTip from '@/components/InfoTip';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import QuickAddContactSheet from '@/components/QuickAddContactSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useAuthStore from '@/stores/authStore';
import api from '@/lib/api';

const businessSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

export default function BusinessEditSheet({ open, onOpenChange, editingBusiness, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { checkAuth } = useAuthStore();

  const [selectedContacts, setSelectedContacts] = useState([]);
  const [quickAddContactOpen, setQuickAddContactOpen] = useState(false);
  const [logoMedia, setLogoMedia] = useState(null);
  const [address, setAddress] = useState(null);
  const [trnCertMedia, setTrnCertMedia] = useState(null);
  const [tradeLicenseMedia, setTradeLicenseMedia] = useState(null);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});

  const contacts = useLocalQuery('contacts');

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

  const resetState = useCallback(() => {
    setSelectedContacts([]);
    setLogoMedia(null);
    setAddress(null);
    setTrnCertMedia(null);
    setTradeLicenseMedia(null);
    setOtherDocs([]);
    setMediaMap({});
    resetGuard();
    reset({
      companyName: '',
      tradeLicenseNumber: '',
      trnNumber: '',
    });
  }, [reset, resetGuard]);

  const closeSheet = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const tryClose = () => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  useEffect(() => {
    if (!open) return;

    if (editingBusiness) {
      resetGuard();
      setSelectedContacts(editingBusiness.contacts?.map((c) => c._id || c) || []);
      reset({
        companyName: editingBusiness.companyName,
        tradeLicenseNumber: editingBusiness.tradeLicenseNumber || '',
        trnNumber: editingBusiness.trnNumber || '',
      });

      api.get(`/businesses/${editingBusiness._id}`).then(({ data: fullBiz }) => {
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
          })),
        );
      }).catch(() => {
        setLogoMedia(null);
        setAddress(null);
        setTrnCertMedia(null);
        setTradeLicenseMedia(null);
        setOtherDocs([]);
        setMediaMap({});
      });

      armGuard();
    } else {
      resetState();
      armGuard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingBusiness?._id]);

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
            onSuccess?.();
          },
        },
      );
    } else {
      saveBusiness(
        { action: 'create', data: payload },
        {
          onSuccess: () => {
            closeSheet();
            toast({ title: t('businesses.businessCreated') });
            onSuccess?.();
          },
        },
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
    [contacts],
  );

  const handleQuickContactCreated = (newContact) => {
    setSelectedContacts((prev) => [...prev, newContact._id]);
    markDirty();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
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
            <Button type="submit" form="business-form" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
