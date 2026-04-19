import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User as UserIcon, Building2, MapPin } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Label } from '@/components/ui/Label';
import PhoneInput from '@/components/PhoneInput';
import LogoUpload from '@/components/LogoUpload';
import FileUpload from '@/components/FileUpload';
import FarmLocationPicker from '@/components/FarmLocationPicker';
import { useToast } from '@/components/ui/Toast';
import useAuthStore from '@/stores/authStore';
import useSettings from '@/hooks/useSettings';
import useCapabilities from '@/hooks/useCapabilities';
import api from '@/lib/api';
import { upsertSettings } from '@/lib/db';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';

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

const EMPTY_ADDRESS = {
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  formattedAddress: '',
  placeId: '',
  lat: null,
  lng: null,
};

function SectionField({ label, hint, children }) {
  return (
    <View style={{ gap: 8, marginBottom: 14 }}>
      <Label>{label}</Label>
      {children}
      {hint && <FieldHint text={hint} />}
    </View>
  );
}

function FieldHint({ text }) {
  const { mutedColor } = useHeroSheetTokens();
  return (
    <Text
      style={{
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: mutedColor,
        marginLeft: 4,
      }}
    >
      {text}
    </Text>
  );
}

function SaveButton({ onPress, loading, disabled, children }) {
  return (
    <Button
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      size="lg"
      className="w-full mt-2 rounded-2xl"
    >
      <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#f5f8f5' }}>
        {children}
      </Text>
    </Button>
  );
}

export default function SettingsProfileScreen() {
  const { t } = useTranslation();
  const { user, checkAuth } = useAuthStore();
  const { toast } = useToast();
  const { workspace } = useCapabilities();
  const isOwner = workspace?.isOwner ?? (user?.accountRole === 'owner' || !user?.createdBy);
  const accountBusiness = useSettings('business');

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
      setAddress({ ...EMPTY_ADDRESS, ...(accountBusiness.address || {}) });
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

  const headerRight = (
    <Badge variant="secondary" className="bg-white/20 border-0">
      <Text style={{ fontSize: 11, fontFamily: 'Poppins-SemiBold', color: '#ffffff', letterSpacing: 0.4 }}>
        {roleLabel}
      </Text>
    </Badge>
  );

  const heroExtra = (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <UserIcon size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  return (
    <HeroSheetScreen
      title={t('settings.profile', 'Profile')}
      subtitle={t('settings.profileDesc', 'Update your personal details and business information')}
      heroExtra={heroExtra}
      headerRight={headerRight}
      keyboardAvoiding
    >
      {/* Personal Information */}
      <SheetSection title={t('settings.profileTitle', 'Personal Information')}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Controller
              control={profileControl}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <SheetInput
                  label={t('auth.firstName', 'First Name')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={profileErrors.firstName?.message}
                />
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={profileControl}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <SheetInput
                  label={t('auth.lastName', 'Last Name')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={profileErrors.lastName?.message}
                />
              )}
            />
          </View>
        </View>

        <SheetInput
          label={t('auth.email', 'Email')}
          value={user?.email || ''}
          editable={false}
          hint={t('settings.emailReadonly', 'Email cannot be changed')}
          containerStyle={{ marginBottom: 14 }}
        />

        <SectionField label={t('auth.phone', 'Phone')}>
          <Controller
            control={profileControl}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <PhoneInput value={value} onChange={onChange} />
            )}
          />
        </SectionField>

        <SaveButton
          onPress={handleProfileSubmit(onProfileSubmit)}
          loading={savingProfile}
          disabled={!profileDirty || savingProfile}
        >
          {t('common.save', 'Save')}
        </SaveButton>
      </SheetSection>

      {/* Business Information */}
      {isOwner && (
        <SheetSection
          title={t('settings.businessInfoTitle', 'Business Information')}
          icon={Building2}
          description={t('settings.businessInfoDesc', 'Your company details for invoices and documents')}
        >
          <Controller
            control={bizControl}
            name="companyName"
            render={({ field: { onChange, onBlur, value } }) => (
              <SheetInput
                label={t('businesses.companyName', 'Company Name')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={bizErrors.companyName?.message}
                containerStyle={{ marginBottom: 14 }}
              />
            )}
          />

          <SectionField label={t('businesses.logo', 'Brand / Logo')}>
            <LogoUpload
              value={logoMedia}
              onUpload={(media) => { setLogoMedia(media); setBizExtraDirty(true); }}
              onRemove={() => { setLogoMedia(null); setBizExtraDirty(true); }}
              entityType="business"
              entityId={accountBusiness?._id}
              category="businesses"
            />
          </SectionField>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={bizControl}
                name="tradeLicenseNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <SheetInput
                    label={t('businesses.tradeLicenseNumber', 'Trade License #')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={bizControl}
                name="trnNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <SheetInput
                    label={t('businesses.trnNumber', 'TRN #')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </View>
          </View>

          <SubsectionHeader icon={MapPin} label={t('businesses.addressSection', 'Business Address')} />

          <View style={{ marginBottom: 14 }}>
            <FarmLocationPicker
              value={{
                lat: address.lat,
                lng: address.lng,
                placeName: address.formattedAddress || '',
              }}
              onChange={(loc) => {
                setAddress((prev) => ({
                  ...prev,
                  lat: loc.lat,
                  lng: loc.lng,
                  formattedAddress: loc.placeName || prev.formattedAddress,
                }));
                setBizExtraDirty(true);
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
                setBizExtraDirty(true);
              }}
              markerLabel={accountBusiness?.companyName || ''}
            />
          </View>

          <SheetInput
            label={t('businesses.street', 'Street Address')}
            value={address.street || ''}
            onChangeText={(val) => handleAddressChange('street', val)}
            placeholder={t('businesses.streetPlaceholder', 'e.g. 123 Main St')}
            containerStyle={{ marginBottom: 14 }}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <SheetInput
                label={t('businesses.city', 'City')}
                value={address.city || ''}
                onChangeText={(val) => handleAddressChange('city', val)}
                placeholder={t('businesses.cityPlaceholder', 'City')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SheetInput
                label={t('businesses.state', 'State / Emirate')}
                value={address.state || ''}
                onChangeText={(val) => handleAddressChange('state', val)}
                placeholder={t('businesses.statePlaceholder', 'State')}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <SheetInput
                label={t('businesses.postalCode', 'Postal / PO Box')}
                value={address.postalCode || ''}
                onChangeText={(val) => handleAddressChange('postalCode', val)}
                placeholder={t('businesses.postalCodePlaceholder', 'Postal Code')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SheetInput
                label={t('businesses.country', 'Country')}
                value={address.country || ''}
                onChangeText={(val) => handleAddressChange('country', val)}
                placeholder={t('businesses.countryPlaceholder', 'Country')}
              />
            </View>
          </View>

          <View style={{ marginBottom: 14 }}>
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

          <View style={{ marginBottom: 14 }}>
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

          <SaveButton
            onPress={handleBizSubmit(onBizSubmit)}
            loading={savingBiz}
            disabled={(!bizDirty && !bizExtraDirty) || savingBiz}
          >
            {t('common.save', 'Save')}
          </SaveButton>
        </SheetSection>
      )}
    </HeroSheetScreen>
  );
}

function SubsectionHeader({ icon: Icon, label }) {
  const { mutedColor, borderColor } = useHeroSheetTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 6,
        paddingBottom: 14,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
      }}
    >
      {Icon && <Icon size={13} color={mutedColor} />}
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-SemiBold',
          color: mutedColor,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
