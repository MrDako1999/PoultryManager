import { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { X, XCircle } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useThemeStore from '@/stores/themeStore';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import Separator from '@/components/ui/Separator';
import LogoUpload from '@/components/LogoUpload';
import FileUpload from '@/components/FileUpload';
import MultiFileUpload from '@/components/MultiFileUpload';

const EMPTY_ADDRESS = { street: '', city: '', state: '', postalCode: '', country: '' };

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

export default function QuickAddBusinessSheet({ open, onClose, onCreated, initialName = '' }) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const mutedColor = resolvedTheme === 'dark' ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)';
  const [saving, setSaving] = useState(false);
  const { create } = useOfflineMutation('businesses');

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

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { companyName: '', tradeLicenseNumber: '', trnNumber: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ companyName: initialName || '', tradeLicenseNumber: '', trnNumber: '' });
      setLogoMedia(null);
      setAddress(EMPTY_ADDRESS);
      setTrnCertMedia(null);
      setTradeLicenseMedia(null);
      setSelectedContacts([]);
      setOtherDocs([]);
    }
  }, [open, initialName, reset]);

  const handleAddressChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const toggleContact = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const removeContact = (contactId) => {
    setSelectedContacts((prev) => prev.filter((id) => id !== contactId));
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        companyName: data.companyName,
        tradeLicenseNumber: data.tradeLicenseNumber || '',
        trnNumber: data.trnNumber || '',
        logo: logoMedia?._id || null,
        address: address || {},
        contacts: selectedContacts,
        trnCertificate: trnCertMedia?._id || null,
        tradeLicense: tradeLicenseMedia?._id || null,
        otherDocs,
      };
      await create(tempId, payload, ['logo', 'trnCertificate', 'tradeLicense']);
      const createdBiz = { _id: tempId, ...payload };
      onCreated?.(createdBiz);
      resetFormState();
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create business');
    } finally {
      setSaving(false);
    }
  };

  const resetFormState = () => {
    reset({ companyName: '', tradeLicenseNumber: '', trnNumber: '' });
    setLogoMedia(null);
    setAddress(EMPTY_ADDRESS);
    setTrnCertMedia(null);
    setTradeLicenseMedia(null);
    setSelectedContacts([]);
    setOtherDocs([]);
  };

  const handleClose = () => {
    resetFormState();
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-lg font-bold text-foreground">{t('businesses.addBusiness', 'Add Business')}</Text>
          <Pressable onPress={handleClose} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
            <X size={20} color={iconColor} />
          </Pressable>
        </View>
        <Separator />

        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4" keyboardShouldPersistTaps="handled">
          {/* Company Name */}
          <View className="gap-1.5">
            <Label>{t('businesses.companyName', 'Company Name')} <Text className="text-destructive">*</Text></Label>
            <Controller
              control={control}
              name="companyName"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder={t('businesses.companyName', 'Company Name')} autoFocus />
              )}
            />
            {errors.companyName && <Text className="text-xs text-destructive">{errors.companyName.message}</Text>}
          </View>

          {/* Logo */}
          <View className="gap-1.5">
            <Label>{t('businesses.logo', 'Brand / Logo')}</Label>
            <LogoUpload
              value={logoMedia}
              onUpload={setLogoMedia}
              onRemove={() => setLogoMedia(null)}
              entityType="business"
              category="businesses"
            />
          </View>

          {/* Trade License Number + TRN Number */}
          <View className="gap-1.5">
            <Label>{t('businesses.tradeLicenseNumber', 'Trade License Number')}</Label>
            <Controller
              control={control}
              name="tradeLicenseNumber"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder={t('businesses.tradeLicenseNumber', 'Trade License Number')} />
              )}
            />
          </View>

          <View className="gap-1.5">
            <Label>{t('businesses.trnNumber', 'TRN Number')}</Label>
            <Controller
              control={control}
              name="trnNumber"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder={t('businesses.trnNumber', 'TRN Number')} />
              )}
            />
          </View>

          <Separator />

          {/* Address Section */}
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('businesses.addressSection', 'Business Address')}
          </Text>

          <View className="gap-2">
            <Label>{t('businesses.street', 'Street Address')}</Label>
            <Input
              value={address.street || ''}
              onChangeText={(val) => handleAddressChange('street', val)}
              placeholder={t('businesses.streetPlaceholder', 'e.g. 123 Main St')}
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <Label>{t('businesses.city', 'City')}</Label>
              <Input
                value={address.city || ''}
                onChangeText={(val) => handleAddressChange('city', val)}
                placeholder={t('businesses.cityPlaceholder', 'City')}
              />
            </View>
            <View className="flex-1 gap-2">
              <Label>{t('businesses.state', 'State / Emirate')}</Label>
              <Input
                value={address.state || ''}
                onChangeText={(val) => handleAddressChange('state', val)}
                placeholder={t('businesses.statePlaceholder', 'State')}
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <Label>{t('businesses.postalCode', 'Postal / PO Box')}</Label>
              <Input
                value={address.postalCode || ''}
                onChangeText={(val) => handleAddressChange('postalCode', val)}
                placeholder={t('businesses.postalCodePlaceholder', 'Postal Code')}
              />
            </View>
            <View className="flex-1 gap-2">
              <Label>{t('businesses.country', 'Country')}</Label>
              <Input
                value={address.country || ''}
                onChangeText={(val) => handleAddressChange('country', val)}
                placeholder={t('businesses.countryPlaceholder', 'Country')}
              />
            </View>
          </View>

          <Separator />

          {/* TRN Certificate */}
          <FileUpload
            label={t('businesses.trnCertificate', 'TRN Certificate')}
            value={trnCertMedia}
            onUpload={setTrnCertMedia}
            onRemove={() => setTrnCertMedia(null)}
            entityType="business"
            category="businesses"
            mediaType="document"
          />

          {/* Trade License Document */}
          <FileUpload
            label={t('businesses.tradeLicense', 'Trade License')}
            value={tradeLicenseMedia}
            onUpload={setTradeLicenseMedia}
            onRemove={() => setTradeLicenseMedia(null)}
            entityType="business"
            category="businesses"
            mediaType="document"
          />

          <Separator />

          {/* Associated Contacts */}
          <View className="gap-2">
            <Label>{t('businesses.associatedContacts', 'Associated Contacts')}</Label>

            {selectedContacts.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-1">
                {selectedContacts.map((id) => {
                  const contact = contactOptions.find((c) => c.value === id);
                  return (
                    <View key={id} className="flex-row items-center gap-1 bg-primary/10 rounded-full px-3 py-1.5">
                      <Text className="text-xs font-medium text-primary" numberOfLines={1}>
                        {contact?.label || 'Contact'}
                      </Text>
                      <Pressable onPress={() => removeContact(id)} hitSlop={6}>
                        <XCircle size={14} color={mutedColor} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            <Select
              value=""
              onValueChange={(contactId) => { if (contactId) toggleContact(contactId); }}
              options={contactOptions.filter((c) => !selectedContacts.includes(c.value))}
              placeholder={t('businesses.selectContacts', 'Select contacts...')}
              label={t('businesses.associatedContacts', 'Associated Contacts')}
            />
          </View>

          <Separator />

          {/* Other Documents */}
          <MultiFileUpload
            label={t('businesses.otherDocs', 'Other Documents')}
            files={otherDocs}
            onAdd={(media) => setOtherDocs((prev) => [...prev, media])}
            onRemove={(index) => setOtherDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="business"
            category="businesses"
          />
        </ScrollView>

        <View className="px-4 pt-4 border-t border-border" style={{ paddingBottom: Math.max(safeBottom, 16) }}>
          <Button onPress={handleSubmit(onSubmit)} disabled={saving}>
            <Text className="text-sm font-medium text-primary-foreground">
              {saving ? t('common.saving', 'Saving...') : t('common.create', 'Create')}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
