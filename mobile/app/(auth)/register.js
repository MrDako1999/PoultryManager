import { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import {
  ArrowRight, ArrowLeft, Check, Building2, Mail, Bird, Egg, Feather,
  Factory, Lock, ShoppingBag, Wrench, Layers,
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import useAuthStore from '@/stores/authStore';
import { useIsRTL } from '@/stores/localeStore';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput, { SheetPasswordInput } from '@/components/SheetInput';
import PhoneInput from '@/components/PhoneInput';
import PasswordStrength from '@/components/PasswordStrength';
import AuthHeroToolbar from '@/components/AuthHeroToolbar';
import { rowDirection, leadingAlignment, textAlignStart } from '@/lib/rtl';

const banner = require('@/assets/images/banner-white.png');

const MODULE_META = {
  broiler:        { icon: Bird,       color: '#059669', darkColor: '#34d399' },
  hatchery:       { icon: Egg,        color: '#d97706', darkColor: '#fbbf24' },
  'free-range':   { icon: Feather,    color: '#0284c7', darkColor: '#38bdf8' },
  'egg-production': { icon: Egg,      color: '#ea580c', darkColor: '#fb923c' },
  slaughterhouse: { icon: Factory,    color: '#dc2626', darkColor: '#f87171' },
  marketing:      { icon: ShoppingBag, color: '#9333ea', darkColor: '#a78bfa' },
  equipment:      { icon: Wrench,     color: '#475569', darkColor: '#94a3b8' },
};

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const isRTL = useIsRTL();
  const ForwardArrow = isRTL ? ArrowLeft : ArrowRight;
  const row = rowDirection(isRTL);

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
    Haptics.selectionAsync().catch(() => {});
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

  if (step === 1) {
    return (
      <ModulePickerStep
        t={t}
        isRTL={isRTL}
        row={row}
        ForwardArrow={ForwardArrow}
        selectedModules={selectedModules}
        onToggle={toggleModule}
        onNext={goToStep2}
      />
    );
  }

  return (
    <FormStep
      t={t}
      isRTL={isRTL}
      row={row}
      control={control}
      errors={errors}
      watchPassword={watchPassword}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(onSubmit)}
      onBack={() => {
        Haptics.selectionAsync().catch(() => {});
        setStep(1);
      }}
      selectedModules={selectedModules}
    />
  );
}

function ModulePickerStep({ t, isRTL, row, ForwardArrow, selectedModules, onToggle, onNext }) {
  const activeCount = selectedModules.length;

  const headerRight = <AuthHeroToolbar />;

  return (
    <HeroSheetScreen
      title={t('auth.registerTitle', 'Get Started')}
      subtitle={t('modules.subtitle', 'Choose which modules you need access to')}
      showBack={false}
      headerRight={headerRight}
      heroComfort="relaxed"
      heroExtra={
        <Image
          source={banner}
          style={{ width: 220, height: 56 }}
          resizeMode="contain"
        />
      }
    >
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          alignItems: leadingAlignment(isRTL),
        }}
      >
        <CountChip count={activeCount} t={t} />
      </View>
      <View style={{ marginHorizontal: 16, gap: 12 }}>
        {AVAILABLE_MODULES.map((mod) => (
          <ModuleCard
            key={mod.slug}
            mod={mod}
            isRTL={isRTL}
            isSelected={selectedModules.includes(mod.slug)}
            onToggle={onToggle}
            t={t}
          />
        ))}
      </View>

      <View style={{ marginHorizontal: 16, gap: 14, marginTop: 20 }}>
        <Button
          onPress={onNext}
          size="lg"
          className="w-full rounded-2xl"
          disabled={activeCount === 0}
        >
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Poppins-SemiBold',
                fontSize: 15,
                color: '#f5f8f5',
              }}
            >
              {t('common.next')}
            </Text>
            <ForwardArrow size={18} color="#f5f8f5" strokeWidth={2.5} />
          </View>
        </Button>

        <SignInLink t={t} row={row} />
      </View>
    </HeroSheetScreen>
  );
}

function CountChip({ count, t }) {
  const tokens = useHeroSheetTokens();
  if (count === 0) return null;

  const { accentColor, textColor, dark } = tokens;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: dark ? 'rgba(148,210,165,0.12)' : 'hsl(148, 35%, 94%)',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: accentColor,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Check size={14} color={accentColor} strokeWidth={2.6} />
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-SemiBold',
          color: textColor,
          letterSpacing: 0.2,
        }}
      >
        {count === 1
          ? t('auth.registerOneSelected', '1 selected')
          : t('auth.registerManySelected', '{{count}} selected', { count })}
      </Text>
    </View>
  );
}

/**
 * Module selection card. Brutally simple, three states.
 *
 * Layout: a single absolute-positioned <Pressable> per card.
 *   - Hard-coded `flexDirection: 'row'` (not template-string-interpolated, no
 *     destructured prop) so there is zero possibility of falling back to
 *     'column' if a prop is undefined.
 *   - alignItems: 'flex-start' so the icon and trailing chip hug the top
 *     instead of vertically-centering against a tall description.
 *   - The trailing chip is a sibling flex child — it physically cannot
 *     overlap the text that lives in the middle column.
 */
function ModuleCard({ mod, isRTL, isSelected, onToggle, t }) {
  const { dark, accentColor, mutedColor, textColor } = useHeroSheetTokens();
  const Icon = (MODULE_META[mod.slug] || {}).icon || Layers;
  const isLocked = !mod.available;
  const textAlign = isRTL ? 'right' : 'left';

  // Three explicit visual recipes:
  let cardBg;
  let borderColor = 'transparent';
  let borderWidth = 0;
  let iconBg;
  let iconStroke;
  let titleColor;

  if (isLocked) {
    cardBg = dark ? 'hsl(150, 14%, 18%)' : 'hsl(148, 10%, 96%)';
    iconBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    iconStroke = mutedColor;
    titleColor = mutedColor;
  } else if (isSelected) {
    cardBg = dark ? 'hsl(148, 35%, 22%)' : 'hsl(148, 35%, 92%)';
    borderColor = accentColor;
    borderWidth = 2;
    iconBg = accentColor;
    iconStroke = '#ffffff';
    titleColor = dark ? '#ffffff' : 'hsl(148, 60%, 18%)';
  } else {
    cardBg = dark ? 'hsl(150, 16%, 16%)' : '#ffffff';
    borderColor = dark ? 'hsl(150, 14%, 24%)' : 'hsl(148, 14%, 88%)';
    borderWidth = 1;
    iconBg = dark ? 'hsl(148, 30%, 18%)' : 'hsl(148, 30%, 95%)';
    iconStroke = accentColor;
    titleColor = textColor;
  }

  // NOTE: NativeWind's react-native-css-interop has historically dropped
  // `flexDirection` / `borderWidth` from functional Pressable styles
  // (`style={({ pressed }) => ({...})}`). To sidestep that, we put ALL layout
  // styling on a regular inner View, and use Pressable purely as a touch
  // wrapper with a static (object, not function) style.
  return (
    <Pressable
      onPress={() => {
        if (!isLocked) onToggle(mod.slug);
      }}
      disabled={isLocked}
      style={[
        styles.cardOuter,
        {
          backgroundColor: cardBg,
          borderColor,
          borderWidth,
          ...(isSelected && !dark
            ? {
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.18,
                shadowRadius: 10,
                elevation: 3,
              }
            : {}),
        },
      ]}
    >
      <View
        style={[
          styles.cardRow,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        {/* Icon tile — fixed width, never shrinks */}
        <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
          <Icon size={22} color={iconStroke} strokeWidth={2.2} />
        </View>

        {/* Title + description column */}
        <View style={styles.textColumn}>
          <Text
            style={[styles.title, { color: titleColor, textAlign }]}
            numberOfLines={1}
          >
            {t(mod.labelKey)}
          </Text>
          <Text
            style={[styles.description, { color: mutedColor, textAlign }]}
            numberOfLines={2}
          >
            {t(mod.descKey)}
          </Text>
        </View>

        {/* Trailing affordance — fixed-width column */}
        <View style={styles.trailingSlot}>
          {isLocked ? (
            <Lock size={16} color={mutedColor} strokeWidth={2.2} />
          ) : isSelected ? (
            <View style={[styles.selectedDisc, { backgroundColor: accentColor }]}>
              <Check size={16} color="#ffffff" strokeWidth={3.2} />
            </View>
          ) : (
            <View
              style={[
                styles.idleRing,
                {
                  borderColor: dark
                    ? 'rgba(255,255,255,0.22)'
                    : 'rgba(0,0,0,0.18)',
                },
              ]}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardRow: {
    alignItems: 'center',
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: -0.1,
  },
  description: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    lineHeight: 16,
    marginTop: 2,
  },
  trailingSlot: {
    width: 32,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDisc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});

function FormStep({
  t,
  isRTL,
  row,
  control,
  errors,
  watchPassword,
  isSubmitting,
  onSubmit,
  onBack,
  selectedModules,
}) {
  const { mutedColor, textColor } = useHeroSheetTokens();

  const heroExtra = (
    <View style={{ flexDirection: row, alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      {selectedModules.map((slug) => {
        const meta = MODULE_META[slug] || {};
        const Icon = meta.icon || Layers;
        const labelKey = AVAILABLE_MODULES.find((m) => m.slug === slug)?.labelKey || slug;
        return (
          <View
            key={slug}
            style={{
              flexDirection: row,
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Icon size={12} color="#ffffff" strokeWidth={2.4} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: '#ffffff',
                letterSpacing: 0.2,
              }}
            >
              {t(labelKey)}
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <HeroSheetScreen
      title={t('auth.registerTitle', 'Get Started')}
      subtitle={t('auth.registerSubtitle', 'Create your PoultryManager account')}
      showBack
      onBack={onBack}
      headerRight={<AuthHeroToolbar />}
      heroExtra={heroExtra}
      heroComfort="relaxed"
      keyboardAvoiding
    >
      <SheetSection title={t('auth.personalInfoSection', 'Personal Information')}>
        <View style={{ flexDirection: row, gap: 10, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <SheetInput
                  label={t('auth.firstName')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoComplete="given-name"
                  textContentType="givenName"
                  error={errors.firstName ? t(errors.firstName.message) : undefined}
                />
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <SheetInput
                  label={t('auth.lastName')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoComplete="family-name"
                  textContentType="familyName"
                  error={errors.lastName ? t(errors.lastName.message) : undefined}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="companyName"
          render={({ field: { onChange, onBlur, value } }) => (
            <SheetInput
              label={t('auth.companyName')}
              icon={Building2}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoComplete="organization"
              textContentType="organizationName"
              containerStyle={{ marginBottom: 14 }}
            />
          )}
        />

        <View style={{ gap: 8, marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Medium',
              color: textColor,
              marginHorizontal: 4,
              textAlign: textAlignStart(isRTL),
            }}
          >
            {t('auth.phone')}
          </Text>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <PhoneInput value={value} onChange={onChange} />
            )}
          />
        </View>
      </SheetSection>

      <SheetSection title={t('auth.accountSection', 'Account')}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <SheetInput
              label={t('auth.email')}
              icon={Mail}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              placeholder={t('auth.emailPlaceholder')}
              error={errors.email ? t(errors.email.message) : undefined}
              containerStyle={{ marginBottom: 14 }}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <SheetPasswordInput
              label={t('auth.password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoComplete="new-password"
              textContentType="newPassword"
              error={errors.password ? t(errors.password.message) : undefined}
              containerStyle={{ marginBottom: 6 }}
            />
          )}
        />
        <PasswordStrength password={watchPassword} />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <SheetPasswordInput
              label={t('auth.confirmPassword')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoComplete="new-password"
              textContentType="newPassword"
              error={errors.confirmPassword ? t(errors.confirmPassword.message) : undefined}
              containerStyle={{ marginTop: 14 }}
            />
          )}
        />
      </SheetSection>

      <View style={{ marginHorizontal: 16, gap: 14, marginTop: 4 }}>
        <Button
          onPress={onSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          size="lg"
          className="w-full rounded-2xl"
        >
          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#f5f8f5' }}>
            {t('auth.register')}
          </Text>
        </Button>

        <SignInLink t={t} row={row} />

        <View
          style={{
            flexDirection: row,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Poppins-Regular', color: mutedColor }}>
            {t('auth.terms', 'By creating an account you accept our Terms.')}
          </Text>
        </View>
      </View>
    </HeroSheetScreen>
  );
}

function SignInLink({ t, row }) {
  const { mutedColor, accentColor } = useHeroSheetTokens();
  return (
    <View
      style={{
        flexDirection: row,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flexWrap: 'wrap',
      }}
    >
      <Text style={{ fontSize: 14, fontFamily: 'Poppins-Regular', color: mutedColor }}>
        {t('auth.hasAccount')}
      </Text>
      <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={10}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-SemiBold',
            color: accentColor,
          }}
        >
          {t('auth.login')}
        </Text>
      </Pressable>
    </View>
  );
}
