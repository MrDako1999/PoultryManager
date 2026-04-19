import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Building2, XCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import LogoUpload from '@/components/LogoUpload';
import FileUpload from '@/components/FileUpload';
import MultiFileUpload from '@/components/MultiFileUpload';
import FarmLocationPicker from '@/components/FarmLocationPicker';
import FormSheet from '@/components/FormSheet';
import { FormSection, FormField } from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { useToast } from '@/components/ui/Toast';

const BUSINESS_TYPES = ['TRADER', 'SUPPLIER'];

const EMPTY_ADDRESS = {
  street: '', city: '', state: '', postalCode: '', country: '',
  formattedAddress: '', placeId: '', lat: null, lng: null,
};

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  businessType: z.enum(BUSINESS_TYPES).default('TRADER'),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

const defaultValues = {
  companyName: '',
  businessType: 'TRADER',
  tradeLicenseNumber: '',
  trnNumber: '',
};

export default function QuickAddBusinessSheet({
  open,
  onClose,
  onCreated,
  initialName = '',
  editData = null,
  onDelete,
  canDelete = false,
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { accentColor, mutedColor, dark } = tokens;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { create, update } = useOfflineMutation('businesses');
  const isEditing = !!editData?._id;

  const [logoMedia, setLogoMedia] = useState(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [trnCertMedia, setTrnCertMedia] = useState(null);
  const [tradeLicenseMedia, setTradeLicenseMedia] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [otherDocs, setOtherDocs] = useState([]);

  const [contacts] = useLocalQuery('contacts');

  const contactOptions = useMemo(() =>
    (contacts || []).map((c) => ({
      value: c._id,
      label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Contact',
      description: c.email || '',
    })),
    [contacts]
  );

  const businessTypeOptions = useMemo(
    () => BUSINESS_TYPES.map((value) => ({
      value,
      label: t(`businesses.${value.toLowerCase()}`, value),
    })),
    [t]
  );

  const {
    control, handleSubmit, reset, watch, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const watchedName = watch('companyName');

  useEffect(() => {
    if (!open) return;
    if (editData) {
      reset({
        companyName: editData.companyName || '',
        businessType: BUSINESS_TYPES.includes(editData.businessType) ? editData.businessType : 'TRADER',
        tradeLicenseNumber: editData.tradeLicenseNumber || '',
        trnNumber: editData.trnNumber || '',
      });
      setLogoMedia(editData.logo && typeof editData.logo === 'object' ? editData.logo : null);
      setAddress(editData.address || EMPTY_ADDRESS);
      setTrnCertMedia(editData.trnCertificate && typeof editData.trnCertificate === 'object' ? editData.trnCertificate : null);
      setTradeLicenseMedia(editData.tradeLicense && typeof editData.tradeLicense === 'object' ? editData.tradeLicense : null);
      setSelectedContacts(
        Array.isArray(editData.contacts)
          ? editData.contacts.map((c) => (typeof c === 'object' ? c._id : c)).filter(Boolean)
          : []
      );
      setOtherDocs(Array.isArray(editData.otherDocs) ? editData.otherDocs : []);
    } else {
      reset({ ...defaultValues, companyName: initialName || '' });
      setLogoMedia(null);
      setAddress(EMPTY_ADDRESS);
      setTrnCertMedia(null);
      setTradeLicenseMedia(null);
      setSelectedContacts([]);
      setOtherDocs([]);
    }
  }, [open, initialName, editData, reset]);

  const handleAddressChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const toggleContact = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const removeContact = (contactId) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedContacts((prev) => prev.filter((id) => id !== contactId));
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        companyName: data.companyName,
        businessType: data.businessType,
        tradeLicenseNumber: data.tradeLicenseNumber || '',
        trnNumber: data.trnNumber || '',
        logo: logoMedia?._id || null,
        address: address || {},
        contacts: selectedContacts,
        trnCertificate: trnCertMedia?._id || null,
        tradeLicense: tradeLicenseMedia?._id || null,
        otherDocs,
      };
      if (isEditing) {
        await update(editData._id, payload);
        onCreated?.({ _id: editData._id, ...payload });
        toast({ title: t('businesses.businessUpdated', 'Business updated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload, ['logo', 'trnCertificate', 'tradeLicense']);
        onCreated?.({ _id: tempId, ...payload });
        toast({ title: t('businesses.businessCreated', 'Business created') });
      }
      onClose();
    } catch (err) {
      console.error('[QuickAddBusinessSheet] save failed', err);
      toast({
        variant: 'destructive',
        title: isEditing
          ? t('businesses.updateError', 'Failed to update business')
          : t('businesses.createError', 'Failed to create business'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEditing
        ? t('businesses.editBusiness', 'Edit Business')
        : t('businesses.addBusiness', 'Add Business')
      }
      subtitle={isEditing
        ? t('businesses.editBusinessDesc', 'Update this business\'s details')
        : t('businesses.addBusinessDesc', 'Register a supplier or trader')
      }
      icon={Building2}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEditing ? t('common.save', 'Save') : t('common.create', 'Create')}
      loading={saving}
      disabled={saving}
      deleteLabel={isEditing && canDelete && onDelete ? t('businesses.deleteBusiness', 'Delete Business') : undefined}
      onDelete={isEditing && canDelete && onDelete
        ? () => { onClose(); onDelete(); }
        : undefined
      }
    >
      <FormSection title={t('businesses.identitySection', 'Identity')}>
        <FormField label={t('businesses.logo', 'Brand / Logo')}>
          <LogoUpload
            value={logoMedia}
            onUpload={setLogoMedia}
            onRemove={() => setLogoMedia(null)}
            entityType="business"
            category="businesses"
          />
        </FormField>

        <FormField label={t('businesses.companyName', 'Company Name')} required error={errors.companyName?.message}>
          <Controller
            control={control}
            name="companyName"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('businesses.companyName', 'Company Name')}
                autoCapitalize="words"
              />
            )}
          />
        </FormField>

        <FormField label={t('businesses.businessType', 'Business Type')} required error={errors.businessType?.message}>
          <Controller
            control={control}
            name="businessType"
            render={({ field: { value, onChange } }) => (
              <EnumButtonSelect
                value={value}
                onChange={onChange}
                options={businessTypeOptions}
                columns={2}
                compact
              />
            )}
          />
        </FormField>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('businesses.tradeLicenseNumber', 'Trade License Number')}>
              <Controller
                control={control}
                name="tradeLicenseNumber"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="—"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('businesses.trnNumber', 'TRN Number')}>
              <Controller
                control={control}
                name="trnNumber"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="—"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
        </View>
      </FormSection>

      <FormSection
        title={t('businesses.addressSection', 'Business Address')}
        description={t('businesses.addressLookupHint', 'Search for an address or drag the marker to auto-fill the fields below.')}
      >
        <View style={{ borderRadius: 12, overflow: 'hidden' }}>
          <FarmLocationPicker
            value={{ lat: address.lat, lng: address.lng, placeName: address.formattedAddress || '' }}
            onChange={(loc) => {
              setAddress((prev) => ({
                ...prev,
                lat: loc.lat,
                lng: loc.lng,
                formattedAddress: loc.placeName || prev.formattedAddress,
              }));
            }}
            onAddressResolved={(resolved) => {
              setAddress((prev) => ({
                ...prev,
                street: resolved.street || prev.street,
                city: resolved.city || prev.city,
                state: resolved.state || prev.state,
                postalCode: resolved.postalCode || prev.postalCode,
                country: resolved.country || prev.country,
                formattedAddress: resolved.formattedAddress || prev.formattedAddress,
                placeId: resolved.placeId || prev.placeId,
                lat: resolved.lat ?? prev.lat,
                lng: resolved.lng ?? prev.lng,
              }));
            }}
            markerLabel={watchedName || ''}
          />
        </View>

        <FormField label={t('businesses.street', 'Street Address')}>
          <SheetInput
            value={address.street || ''}
            onChangeText={(val) => handleAddressChange('street', val)}
            placeholder={t('businesses.streetPlaceholder', 'e.g. 123 Main St')}
          />
        </FormField>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('businesses.city', 'City')}>
              <SheetInput
                value={address.city || ''}
                onChangeText={(val) => handleAddressChange('city', val)}
                placeholder={t('businesses.cityPlaceholder', 'City')}
                dense
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('businesses.state', 'State / Emirate')}>
              <SheetInput
                value={address.state || ''}
                onChangeText={(val) => handleAddressChange('state', val)}
                placeholder={t('businesses.statePlaceholder', 'State')}
                dense
              />
            </FormField>
          </View>
        </View>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('businesses.postalCode', 'Postal / PO Box')}>
              <SheetInput
                value={address.postalCode || ''}
                onChangeText={(val) => handleAddressChange('postalCode', val)}
                placeholder={t('businesses.postalCodePlaceholder', 'Postal Code')}
                dense
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('businesses.country', 'Country')}>
              <SheetInput
                value={address.country || ''}
                onChangeText={(val) => handleAddressChange('country', val)}
                placeholder={t('businesses.countryPlaceholder', 'Country')}
                dense
              />
            </FormField>
          </View>
        </View>
      </FormSection>

      <FormSection title={t('businesses.documentsSection', 'Documents')}>
        <FormField label={t('businesses.tradeLicense', 'Trade License')}>
          <FileUpload
            value={tradeLicenseMedia}
            onUpload={setTradeLicenseMedia}
            onRemove={() => setTradeLicenseMedia(null)}
            entityType="business"
            category="businesses"
            mediaType="document"
          />
        </FormField>

        <FormField label={t('businesses.trnCertificate', 'TRN Certificate')}>
          <FileUpload
            value={trnCertMedia}
            onUpload={setTrnCertMedia}
            onRemove={() => setTrnCertMedia(null)}
            entityType="business"
            category="businesses"
            mediaType="document"
          />
        </FormField>

        <FormField label={t('businesses.otherDocs', 'Other Documents')}>
          <MultiFileUpload
            files={otherDocs}
            onAdd={(media) => setOtherDocs((prev) => [...prev, media])}
            onRemove={(index) => setOtherDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="business"
            category="businesses"
          />
        </FormField>
      </FormSection>

      <FormSection title={t('businesses.associatedContacts', 'Associated Contacts')}>
        {selectedContacts.length > 0 ? (
          <View
            style={[
              styles.chipRow,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            {selectedContacts.map((id) => {
              const contact = contactOptions.find((c) => c.value === id);
              return (
                <View
                  key={id}
                  style={[
                    styles.chip,
                    {
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
                      borderColor: dark ? 'rgba(148,210,165,0.30)' : 'hsl(148, 35%, 80%)',
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Medium',
                      color: accentColor,
                      maxWidth: 140,
                    }}
                    numberOfLines={1}
                  >
                    {contact?.label || 'Contact'}
                  </Text>
                  <Pressable onPress={() => removeContact(id)} hitSlop={6}>
                    <XCircle size={14} color={mutedColor} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        <Select
          value=""
          onValueChange={(contactId) => { if (contactId) toggleContact(contactId); }}
          options={contactOptions.filter((c) => !selectedContacts.includes(c.value))}
          placeholder={t('businesses.selectContacts', 'Select contacts...')}
          label={t('businesses.associatedContacts', 'Associated Contacts')}
        />
      </FormSection>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
