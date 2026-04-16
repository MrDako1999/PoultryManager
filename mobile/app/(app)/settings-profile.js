import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Separator from '@/components/ui/Separator';
import PhoneInput from '@/components/PhoneInput';
import LogoUpload from '@/components/LogoUpload';
import FileUpload from '@/components/FileUpload';
import { useToast } from '@/components/ui/Toast';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useSettings from '@/hooks/useSettings';
import useCapabilities from '@/hooks/useCapabilities';
import api from '@/lib/api';
import { upsertSettings } from '@/lib/db';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

const businessSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  tradeLicenseNumber: z.string().optional(),
  trnNumber: z.string().optional(),
});

const EMPTY_ADDRESS = { street: '', city: '', state: '', postalCode: '', country: '' };

export default function SettingsProfileScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { user, checkAuth } = useAuthStore();
  const { toast } = useToast();
  const { workspace } = useCapabilities();
  const isOwner = workspace?.isOwner ?? (user?.accountRole === 'owner' || !user?.createdBy);
  const accountBusiness = useSettings('business');

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);

  const [logoMedia, setLogoMedia] = useState(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [trnCertMedia, setTrnCertMedia] = useState(null);
  const [tradeLicenseMedia, setTradeLicenseMedia] = useState(null);
  const [bizExtraDirty, setBizExtraDirty] = useState(false);

  const {
    control: profileControl,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  });

  const {
    control: bizControl,
    handleSubmit: handleBizSubmit,
    reset: resetBiz,
    formState: { errors: bizErrors, isDirty: bizDirty },
  } = useForm({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      companyName: '',
      tradeLicenseNumber: '',
      trnNumber: '',
    },
  });

  useEffect(() => {
    if (accountBusiness) {
      resetBiz({
        companyName: accountBusiness.companyName || '',
        tradeLicenseNumber: accountBusiness.tradeLicenseNumber || '',
        trnNumber: accountBusiness.trnNumber || '',
      });
      setLogoMedia(accountBusiness.logo || null);
      setAddress(accountBusiness.address || EMPTY_ADDRESS);
      setTrnCertMedia(accountBusiness.trnCertificate || null);
      setTradeLicenseMedia(accountBusiness.tradeLicense || null);
      setBizExtraDirty(false);
    }
  }, [accountBusiness, resetBiz]);

  const onProfileSubmit = async (data) => {
    setSavingProfile(true);
    try {
      await api.put('/settings/profile', data);
      checkAuth();
      toast({ title: t('settings.profileUpdated', 'Profile updated') });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('common.error', 'Error'),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const onBizSubmit = async (data) => {
    setSavingBiz(true);
    try {
      const payload = {
        ...data,
        logo: logoMedia?._id || null,
        address: address || {},
        trnCertificate: trnCertMedia?._id || null,
        tradeLicense: tradeLicenseMedia?._id || null,
      };
      const { data: responseData } = await api.put('/settings/business', payload);
      await upsertSettings([{ key: 'business', value: responseData }]);
      checkAuth();
      setBizExtraDirty(false);
      toast({ title: t('settings.businessUpdated', 'Business info updated') });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('common.error', 'Error'),
      });
    } finally {
      setSavingBiz(false);
    }
  };

  const handleAddressChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setBizExtraDirty(true);
  };

  const roleLabel = t(`settings.roles.${user?.accountRole || 'owner'}`, user?.accountRole || 'owner');

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <Text className="text-lg font-bold text-foreground flex-1">
          {t('settings.profile', 'Profile')}
        </Text>
        <Badge variant="secondary">
          <Text className="text-xs text-secondary-foreground">{roleLabel}</Text>
        </Badge>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Personal Information */}
          <View className="rounded-xl border border-border bg-card p-4 mb-4">
            <Text className="text-base font-semibold text-foreground mb-4">
              {t('settings.profileTitle', 'Personal Information')}
            </Text>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 gap-2">
                <Label>{t('auth.firstName', 'First Name')}</Label>
                <Controller
                  control={profileControl}
                  name="firstName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input value={value} onChangeText={onChange} onBlur={onBlur} />
                  )}
                />
                {profileErrors.firstName && (
                  <Text className="text-xs text-destructive">{profileErrors.firstName.message}</Text>
                )}
              </View>
              <View className="flex-1 gap-2">
                <Label>{t('auth.lastName', 'Last Name')}</Label>
                <Controller
                  control={profileControl}
                  name="lastName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input value={value} onChangeText={onChange} onBlur={onBlur} />
                  )}
                />
                {profileErrors.lastName && (
                  <Text className="text-xs text-destructive">{profileErrors.lastName.message}</Text>
                )}
              </View>
            </View>

            <View className="gap-2 mb-4">
              <Label>{t('auth.email', 'Email')}</Label>
              <Input value={user?.email || ''} editable={false} className="opacity-60" />
              <Text className="text-xs text-muted-foreground">
                {t('settings.emailReadonly', 'Email cannot be changed')}
              </Text>
            </View>

            <View className="gap-2 mb-4">
              <Label>{t('auth.phone', 'Phone')}</Label>
              <Controller
                control={profileControl}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <PhoneInput value={value} onChange={onChange} />
                )}
              />
            </View>

            <Button
              onPress={handleProfileSubmit(onProfileSubmit)}
              loading={savingProfile}
              disabled={!profileDirty || savingProfile}
            >
              {t('common.save', 'Save')}
            </Button>
          </View>

          {/* Business Information */}
          {isOwner && (
            <View className="rounded-xl border border-border bg-card p-4">
              <Text className="text-base font-semibold text-foreground mb-1">
                {t('settings.businessInfoTitle', 'Business Information')}
              </Text>
              <Text className="text-xs text-muted-foreground mb-4">
                {t('settings.businessInfoDesc', 'Your company details for invoices and documents')}
              </Text>

              {/* Company Name */}
              <View className="gap-2 mb-4">
                <Label>{t('businesses.companyName', 'Company Name')}</Label>
                <Controller
                  control={bizControl}
                  name="companyName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input value={value} onChangeText={onChange} onBlur={onBlur} />
                  )}
                />
                {bizErrors.companyName && (
                  <Text className="text-xs text-destructive">{bizErrors.companyName.message}</Text>
                )}
              </View>

              {/* Brand / Logo */}
              <View className="gap-2 mb-4">
                <Label>{t('businesses.logo', 'Brand / Logo')}</Label>
                <LogoUpload
                  value={logoMedia}
                  onUpload={(media) => { setLogoMedia(media); setBizExtraDirty(true); }}
                  onRemove={() => { setLogoMedia(null); setBizExtraDirty(true); }}
                  entityType="business"
                  entityId={accountBusiness?._id}
                  category="businesses"
                />
              </View>

              {/* Trade License # / TRN # */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1 gap-2">
                  <Label>{t('businesses.tradeLicenseNumber', 'Trade License #')}</Label>
                  <Controller
                    control={bizControl}
                    name="tradeLicenseNumber"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input value={value} onChangeText={onChange} onBlur={onBlur} />
                    )}
                  />
                </View>
                <View className="flex-1 gap-2">
                  <Label>{t('businesses.trnNumber', 'TRN #')}</Label>
                  <Controller
                    control={bizControl}
                    name="trnNumber"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input value={value} onChangeText={onChange} onBlur={onBlur} />
                    )}
                  />
                </View>
              </View>

              <Separator className="my-2" />

              {/* Business Address */}
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2 mb-3">
                {t('businesses.addressSection', 'Business Address')}
              </Text>

              <View className="gap-2 mb-4">
                <Label>{t('businesses.street', 'Street Address')}</Label>
                <Input
                  value={address.street || ''}
                  onChangeText={(val) => handleAddressChange('street', val)}
                  placeholder={t('businesses.streetPlaceholder', 'e.g. 123 Main St')}
                />
              </View>

              <View className="flex-row gap-3 mb-4">
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

              <View className="flex-row gap-3 mb-4">
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

              <Separator className="my-2" />

              {/* TRN Certificate Upload */}
              <View className="mt-2 mb-4">
                <FileUpload
                  label={t('businesses.trnCertificate', 'TRN Certificate')}
                  value={trnCertMedia}
                  onUpload={(media) => { setTrnCertMedia(media); setBizExtraDirty(true); }}
                  onRemove={() => { setTrnCertMedia(null); setBizExtraDirty(true); }}
                  entityType="business"
                  entityId={accountBusiness?._id}
                  category="businesses"
                  mediaType="document"
                />
              </View>

              {/* Trade License Upload */}
              <View className="mb-4">
                <FileUpload
                  label={t('businesses.tradeLicense', 'Trade License')}
                  value={tradeLicenseMedia}
                  onUpload={(media) => { setTradeLicenseMedia(media); setBizExtraDirty(true); }}
                  onRemove={() => { setTradeLicenseMedia(null); setBizExtraDirty(true); }}
                  entityType="business"
                  entityId={accountBusiness?._id}
                  category="businesses"
                  mediaType="document"
                />
              </View>

              <Button
                onPress={handleBizSubmit(onBizSubmit)}
                loading={savingBiz}
                disabled={(!bizDirty && !bizExtraDirty) || savingBiz}
              >
                {t('common.save', 'Save')}
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
