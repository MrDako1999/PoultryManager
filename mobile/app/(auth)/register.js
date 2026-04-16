import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, ArrowRight, Check, Building2 } from 'lucide-react-native';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import PasswordInput from '@/components/ui/PasswordInput';
import PasswordStrength from '@/components/PasswordStrength';
import PhoneInput from '@/components/PhoneInput';
import { useToast } from '@/components/ui/Toast';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';

const AVAILABLE_MODULES = [
  { slug: 'broiler', labelKey: 'modules.broiler', descKey: 'modules.broilerDesc', available: true },
  { slug: 'hatchery', labelKey: 'modules.hatchery', descKey: 'modules.hatcheryDesc', available: false },
  { slug: 'free-range', labelKey: 'modules.freeRange', descKey: 'modules.freeRangeDesc', available: false },
  { slug: 'egg-production', labelKey: 'modules.eggProduction', descKey: 'modules.eggProductionDesc', available: false },
  { slug: 'slaughterhouse', labelKey: 'modules.slaughterhouse', descKey: 'modules.slaughterhouseDesc', available: false },
];

const registerSchema = z
  .object({
    firstName: z.string().min(1, 'auth.firstNameRequired'),
    lastName: z.string().min(1, 'auth.lastNameRequired'),
    companyName: z.string().optional(),
    email: z.string().min(1, 'auth.emailRequired').email('auth.emailInvalid'),
    password: z.string().min(8, 'auth.passwordMin'),
    confirmPassword: z.string().min(1, 'auth.passwordRequired'),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  });

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModules, setSelectedModules] = useState(['broiler']);
  const { register: registerUser } = useAuthStore();
  const { resolvedTheme } = useThemeStore();
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
    },
  });

  const watchPassword = watch('password');

  const toggleModule = (slug) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedModules((prev) =>
      prev.includes(slug) ? prev.filter((m) => m !== slug) : [...prev, slug]
    );
  };

  const goToStep2 = () => {
    if (selectedModules.length === 0) {
      toast({ variant: 'destructive', title: t('modules.selectAtLeastOne') });
      return;
    }
    setStep(2);
  };

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...userData } = values;
      await registerUser({ ...userData, modules: selectedModules });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)/(tabs)/dashboard');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast({
        variant: 'destructive',
        title: t('auth.registerError'),
        description: err.response?.data?.message || t('auth.registerError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedModuleNames = AVAILABLE_MODULES
    .filter((m) => selectedModules.includes(m.slug))
    .map((m) => t(m.labelKey));

  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const mutedIconColor = 'hsl(150, 10%, 45%)';

  if (step === 1) {
    return (
      <View>
        <Card>
          <CardHeader>
            <CardTitle>{t('modules.title')}</CardTitle>
            <CardDescription>{t('modules.subtitle')}</CardDescription>
          </CardHeader>

          <CardContent className="gap-3">
            {AVAILABLE_MODULES.map((mod) => (
              <Pressable
                key={mod.slug}
                onPress={() => mod.available && toggleModule(mod.slug)}
                disabled={!mod.available}
              >
                <View
                  className={`flex-row items-start gap-3 rounded-lg border p-3 ${
                    !mod.available
                      ? 'opacity-50 border-border'
                      : selectedModules.includes(mod.slug)
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                  }`}
                >
                  <Checkbox
                    checked={selectedModules.includes(mod.slug)}
                    onCheckedChange={() => mod.available && toggleModule(mod.slug)}
                    disabled={!mod.available}
                    className="mt-0.5"
                  />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-medium text-foreground">{t(mod.labelKey)}</Text>
                      {!mod.available && (
                        <Badge variant="muted">
                          <Text className="text-xs text-muted-foreground">{t('modules.comingSoon')}</Text>
                        </Badge>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground mt-0.5">{t(mod.descKey)}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </CardContent>

          <CardFooter className="gap-4">
            <Button className="w-full" onPress={goToStep2}>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-medium text-primary-foreground">{t('common.next')}</Text>
                <ArrowRight size={16} color="#f5f8f5" />
              </View>
            </Button>

            <View className="flex-row items-center justify-center gap-1">
              <Text className="text-sm text-muted-foreground">{t('auth.hasAccount')}</Text>
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text className="text-sm text-primary font-medium">{t('auth.login')}</Text>
              </Pressable>
            </View>
          </CardFooter>
        </Card>
      </View>
    );
  }

  return (
      <View>
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setStep(1)}
                className="h-8 w-8 items-center justify-center rounded-md active:bg-accent"
              >
                <ArrowLeft size={16} color={iconColor} />
              </Pressable>
              <View className="flex-1">
                <CardTitle>{t('auth.registerTitle')}</CardTitle>
                <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-1.5 pt-1">
              {selectedModuleNames.map((name) => (
                <Badge key={name} variant="outline" className="bg-primary/10 border-primary/20">
                  <View className="flex-row items-center gap-1">
                    <Check size={12} color={resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)'} />
                    <Text className="text-xs font-medium text-primary">{name}</Text>
                  </View>
                </Badge>
              ))}
            </View>
          </CardHeader>

          <CardContent className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1 gap-2">
                <Label>{t('auth.firstName')}</Label>
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input value={value} onChangeText={onChange} onBlur={onBlur} autoComplete="given-name" />
                  )}
                />
                {errors.firstName && (
                  <Text className="text-xs text-destructive">{t(errors.firstName.message)}</Text>
                )}
              </View>
              <View className="flex-1 gap-2">
                <Label>{t('auth.lastName')}</Label>
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input value={value} onChangeText={onChange} onBlur={onBlur} autoComplete="family-name" />
                  )}
                />
                {errors.lastName && (
                  <Text className="text-xs text-destructive">{t(errors.lastName.message)}</Text>
                )}
              </View>
            </View>

            <View className="gap-2">
              <Label>{t('auth.companyName')}</Label>
              <View className="relative">
                <View className="absolute left-3 top-0 h-12 justify-center z-10">
                  <Building2 size={16} color={mutedIconColor} />
                </View>
                <Controller
                  control={control}
                  name="companyName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoComplete="organization"
                      className="pl-9"
                    />
                  )}
                />
              </View>
            </View>

            <View className="gap-2">
              <Label>{t('auth.phone')}</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <PhoneInput value={value} onChange={onChange} />
                )}
              />
            </View>

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
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                )}
              />
              <PasswordStrength password={watchPassword} />
              {errors.password && (
                <Text className="text-sm text-destructive">{t(errors.password.message)}</Text>
              )}
            </View>

            <View className="gap-2">
              <Label>{t('auth.confirmPassword')}</Label>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                )}
              />
              {errors.confirmPassword && (
                <Text className="text-sm text-destructive">{t(errors.confirmPassword.message)}</Text>
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
              {t('auth.register')}
            </Button>

            <View className="flex-row items-center justify-center gap-1">
              <Text className="text-sm text-muted-foreground">{t('auth.hasAccount')}</Text>
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text className="text-sm text-primary font-medium">{t('auth.login')}</Text>
              </Pressable>
            </View>
          </CardFooter>
        </Card>
      </View>
  );
}
