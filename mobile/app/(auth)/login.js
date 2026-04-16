import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import PasswordInput from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/Toast';
import useAuthStore from '@/stores/authStore';

const loginSchema = z.object({
  email: z.string().email('auth.emailInvalid').min(1, 'auth.emailRequired'),
  password: z.string().min(1, 'auth.passwordRequired'),
});

export default function LoginScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuthStore();
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      await login(values);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)/(tabs)/dashboard');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast({
        variant: 'destructive',
        title: t('auth.loginError'),
        description: err.response?.data?.message || t('auth.loginError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.loginTitle')}</CardTitle>
        <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="gap-4">
        <View className="gap-2">
          <Label>{t('auth.email')}</Label>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="name@example.com"
                textContentType="emailAddress"
              />
            )}
          />
          {errors.email && (
            <Text className="text-sm text-destructive">{t(errors.email.message)}</Text>
          )}
        </View>

        <View className="gap-2">
          <Label>{t('auth.password')}</Label>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoComplete="password"
                textContentType="password"
              />
            )}
          />
          {errors.password && (
            <Text className="text-sm text-destructive">{t(errors.password.message)}</Text>
          )}
        </View>
      </CardContent>

      <CardFooter className="gap-4">
        <Button
          className="w-full"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {t('auth.login')}
        </Button>

        <View className="flex-row items-center justify-center gap-1">
          <Text className="text-sm text-muted-foreground">{t('auth.noAccount')}</Text>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text className="text-sm text-primary font-medium">{t('auth.register')}</Text>
          </Pressable>
        </View>
      </CardFooter>
    </Card>
  );
}
