import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import PhoneInput from '@/components/PhoneInput';
import FileUpload from '@/components/FileUpload';
import LogoUpload from '@/components/LogoUpload';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import InfoTip from '@/components/InfoTip';
import useAuthStore from '@/stores/authStore';
import api from '@/lib/api';
import db from '@/lib/db';
import useSettings from '@/hooks/useSettings';

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

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { user, checkAuth } = useAuthStore();
  const { toast } = useToast();
  const isOwner = user?.accountRole === 'owner' || !user?.createdBy;

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    control: profileControl,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  });

  const [savingProfile, setSavingProfile] = useState(false);

  const accountBusiness = useSettings('business');

  const {
    register: registerBiz,
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

  const [logoMedia, setLogoMedia] = useState(null);
  const [address, setAddress] = useState(null);
  const [trnCertMedia, setTrnCertMedia] = useState(null);
  const [tradeLicenseMedia, setTradeLicenseMedia] = useState(null);
  const [bizExtraDirty, setBizExtraDirty] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);

  useEffect(() => {
    if (accountBusiness) {
      resetBiz({
        companyName: accountBusiness.companyName || '',
        tradeLicenseNumber: accountBusiness.tradeLicenseNumber || '',
        trnNumber: accountBusiness.trnNumber || '',
      });
      setLogoMedia(accountBusiness.logo || null);
      setAddress(accountBusiness.address || null);
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
      toast({ title: t('settings.profileUpdated') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.profileUpdateError'),
        variant: 'destructive',
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
      await db.settings.put({ key: 'business', value: responseData });
      checkAuth();
      setBizExtraDirty(false);
      toast({ title: t('settings.businessUpdated') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.businessUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setSavingBiz(false);
    }
  };

  const roleLabel = t(`settings.roles.${user?.accountRole || 'owner'}`);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('settings.profileTitle')}</CardTitle>
              <CardDescription>{t('settings.profileDesc')}</CardDescription>
            </div>
            <Badge variant="secondary">{roleLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4 max-w-lg">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('auth.firstName')}</Label>
                <Input id="firstName" {...registerProfile('firstName')} />
                {profileErrors.firstName && (
                  <p className="text-sm text-destructive">{profileErrors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('auth.lastName')}</Label>
                <Input id="lastName" {...registerProfile('lastName')} />
                {profileErrors.lastName && (
                  <p className="text-sm text-destructive">{profileErrors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" value={user?.email || ''} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">{t('settings.emailReadonly')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('auth.phone')}</Label>
              <Controller
                name="phone"
                control={profileControl}
                render={({ field }) => (
                  <PhoneInput value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <Button type="submit" disabled={!profileDirty || savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.businessInfoTitle')}</CardTitle>
            <CardDescription>{t('settings.businessInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
              <form onSubmit={handleBizSubmit(onBizSubmit)} className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="biz-companyName">{t('businesses.companyName')}</Label>
                  <Input id="biz-companyName" {...registerBiz('companyName')} />
                  {bizErrors.companyName && (
                    <p className="text-sm text-destructive">{bizErrors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('businesses.logo')}</Label>
                  <LogoUpload
                    value={logoMedia}
                    onUpload={(media) => { setLogoMedia(media); setBizExtraDirty(true); }}
                    onRemove={() => { setLogoMedia(null); setBizExtraDirty(true); }}
                    entityType="business"
                    entityId={accountBusiness?._id}
                    category="businesses"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="biz-tradeLicense">{t('businesses.tradeLicenseNumber')}</Label>
                    <Input id="biz-tradeLicense" {...registerBiz('tradeLicenseNumber')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-trn">{t('businesses.trnNumber')}</Label>
                    <Input id="biz-trn" {...registerBiz('trnNumber')} />
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
                  onChange={(addr) => { setAddress(addr); setBizExtraDirty(true); }}
                />

                <Separator />

                <FileUpload
                  label={t('businesses.trnCertificate')}
                  value={trnCertMedia}
                  onUpload={(media) => { setTrnCertMedia(media); setBizExtraDirty(true); }}
                  onRemove={() => { setTrnCertMedia(null); setBizExtraDirty(true); }}
                  entityType="business"
                  entityId={accountBusiness?._id}
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
                  onUpload={(media) => { setTradeLicenseMedia(media); setBizExtraDirty(true); }}
                  onRemove={() => { setTradeLicenseMedia(null); setBizExtraDirty(true); }}
                  entityType="business"
                  entityId={accountBusiness?._id}
                  category="businesses"
                  mediaType="document"
                  accept={{
                    'application/pdf': ['.pdf'],
                    'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
                  }}
                />

                <Button type="submit" disabled={(!bizDirty && !bizExtraDirty) || savingBiz}>
                  {savingBiz && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('common.save')}
                </Button>
              </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
