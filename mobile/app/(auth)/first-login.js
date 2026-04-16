import { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import PasswordInput from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/Toast';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';

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
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.firstLoginTitle', 'Set your password')}</CardTitle>
        <CardDescription>
          {t(
            'auth.firstLoginSubtitle',
            'For security, please change the temporary password you received before continuing.'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="gap-4">
        <View className="gap-2">
          <Label>{t('auth.currentPassword', 'Current password')}</Label>
          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput value={value} onChangeText={onChange} onBlur={onBlur} />
            )}
          />
          {errors.currentPassword && (
            <Text className="text-sm text-destructive">{t(errors.currentPassword.message)}</Text>
          )}
        </View>

        <View className="gap-2">
          <Label>{t('auth.newPassword', 'New password')}</Label>
          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput value={value} onChangeText={onChange} onBlur={onBlur} />
            )}
          />
          {errors.newPassword && (
            <Text className="text-sm text-destructive">{t(errors.newPassword.message)}</Text>
          )}
        </View>

        <View className="gap-2">
          <Label>{t('auth.confirmPassword', 'Confirm password')}</Label>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput value={value} onChangeText={onChange} onBlur={onBlur} />
            )}
          />
          {errors.confirmPassword && (
            <Text className="text-sm text-destructive">{t(errors.confirmPassword.message)}</Text>
          )}
        </View>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
          disabled={submitting}
        >
          {t('auth.changePasswordCta', 'Change password and continue')}
        </Button>
      </CardFooter>
    </Card>
  );
}
