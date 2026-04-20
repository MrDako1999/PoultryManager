import { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import { ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { useIsRTL } from '@/stores/localeStore';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import { SheetPasswordInput } from '@/components/SheetInput';
import AuthHeroToolbar from '@/components/AuthHeroToolbar';

const banner = require('@/assets/images/banner-white.png');

const schema = z.object({
  currentPassword: z.string().min(1, 'auth.currentPasswordRequired'),
  newPassword: z.string().min(8, 'auth.passwordMin'),
  confirmPassword: z.string().min(1, 'auth.passwordConfirmRequired'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'auth.passwordMismatch',
  path: ['confirmPassword'],
});

export default function FirstLoginScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [submitting, setSubmitting] = useState(false);
  const isRTL = useIsRTL();
  const ForwardArrow = isRTL ? ArrowLeft : ArrowRight;
  const row = isRTL ? 'row-reverse' : 'row';
  const { mutedColor } = useHeroSheetTokens();

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await api.put('/settings/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshUser();
      router.replace('/(app)/(tabs)/dashboard');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast({
        variant: 'destructive',
        title: t('auth.passwordChangeError', 'Failed to change password'),
        description: err.response?.data?.message || '',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HeroSheetScreen
      title={t('auth.firstLoginTitle', 'Set your password')}
      subtitle={t('auth.firstLoginSubtitle', 'For security, please change the temporary password you received before continuing.')}
      showBack={false}
      headerRight={<AuthHeroToolbar />}
      heroComfort="relaxed"
      heroExtra={
        <Image
          source={banner}
          style={{ width: 220, height: 56 }}
          resizeMode="contain"
        />
      }
      keyboardAvoiding
    >
      <SheetSection
        title={t('settings.changePasswordSection', 'Change Password')}
        icon={ShieldCheck}
        description={t('auth.firstLoginHint', 'Pick a strong password — at least 8 characters.')}
      >
        <Controller
          control={control}
          name="currentPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <SheetPasswordInput
              label={t('auth.currentPassword', 'Current password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoComplete="current-password"
              textContentType="password"
              error={errors.currentPassword ? t(errors.currentPassword.message) : undefined}
              containerStyle={{ marginBottom: 14 }}
            />
          )}
        />

        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <SheetPasswordInput
              label={t('auth.newPassword', 'New password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoComplete="new-password"
              textContentType="newPassword"
              error={errors.newPassword ? t(errors.newPassword.message) : undefined}
              containerStyle={{ marginBottom: 14 }}
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <SheetPasswordInput
              label={t('auth.confirmPassword', 'Confirm password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoComplete="new-password"
              textContentType="newPassword"
              error={errors.confirmPassword ? t(errors.confirmPassword.message) : undefined}
            />
          )}
        />
      </SheetSection>

      <View style={{ marginHorizontal: 16, gap: 14, marginTop: 4 }}>
        <Button
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
          disabled={submitting}
          size="lg"
          className="w-full rounded-2xl"
        >
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#f5f8f5' }}>
              {t('auth.changePasswordCta', 'Change password and continue')}
            </Text>
            {!submitting && (
              <ForwardArrow size={18} color="#f5f8f5" strokeWidth={2.5} />
            )}
          </View>
        </Button>

        <View
          style={{
            flexDirection: row,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 4,
          }}
        >
          <ShieldCheck size={12} color={mutedColor} />
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
            }}
          >
            {t('auth.secureLogin', 'Secured by end-to-end encryption')}
          </Text>
        </View>
      </View>
    </HeroSheetScreen>
  );
}
