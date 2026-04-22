import { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Check, ShieldCheck,
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import useAuthStore from '@/stores/authStore';
import { useIsRTL } from '@/stores/localeStore';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import AuthHeroToolbar from '@/components/AuthHeroToolbar';
import { rowDirection } from '@/lib/rtl';

const loginSchema = z.object({
  email: z.string().email('auth.emailInvalid').min(1, 'auth.emailRequired'),
  password: z.string().min(1, 'auth.passwordRequired'),
});

const banner = require('@/assets/images/banner-white.png');

export default function LoginScreen() {
  const tokens = useHeroSheetTokens();
  const {
    dark, inputBorderIdle, inputBorderFocus, textColor,
    mutedColor, iconColor, accentColor, errorColor,
  } = tokens;

  const isRTL = useIsRTL();
  // Direction-aware row helpers. We don't trust I18nManager.isRTL because it
  // only flips on a true cold-start; the store-driven `isRTL` reflects the
  // user's choice immediately.
  const row = rowDirection(isRTL);
  const textAlign = isRTL ? 'right' : 'left';
  const ForwardArrow = isRTL ? ArrowLeft : ArrowRight;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordRef = useRef(null);

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

  const onForgotPassword = () => {
    Haptics.selectionAsync();
    toast({
      title: t('auth.forgotPassword'),
      description: t(
        'auth.forgotPasswordHint',
        'Please contact your administrator to reset your password.'
      ),
    });
  };

  const onToggleRemember = () => {
    Haptics.selectionAsync();
    setRememberMe((v) => !v);
  };

  const headerRight = <AuthHeroToolbar />;

  const heroExtra = (
    <Image
      source={banner}
      style={{ width: 220, height: 56 }}
      resizeMode="contain"
    />
  );

  return (
    <HeroSheetScreen
      title={t('auth.loginGreeting', 'Welcome back')}
      subtitle={t('auth.loginPrompt', 'Sign in to continue managing your operations.')}
      showBack={false}
      headerRight={headerRight}
      heroExtra={heroExtra}
      heroComfort="relaxed"
      keyboardAvoiding
      contentStyle={{ paddingHorizontal: 20, gap: 18 }}
    >
      {/* Email */}
      <FieldShell label={t('auth.email')} error={errors.email && t(errors.email.message)} isRTL={isRTL}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <InputBox
              focused={emailFocused}
              error={!!errors.email}
              icon={Mail}
              isRTL={isRTL}
            >
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={() => {
                  setEmailFocused(false);
                  onBlur();
                }}
                onFocus={() => setEmailFocused(true)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={mutedColor}
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                style={{
                  flex: 1,
                  marginLeft: isRTL ? 0 : 12,
                  marginRight: isRTL ? 12 : 0,
                  fontFamily: 'Poppins-Regular',
                  fontSize: 15,
                  color: textColor,
                  height: '100%',
                  textAlign,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              />
            </InputBox>
          )}
        />
      </FieldShell>

      {/* Password */}
      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: row,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Medium',
              color: textColor,
              textAlign,
            }}
          >
            {t('auth.password')}
          </Text>
          <Pressable onPress={onForgotPassword} hitSlop={10}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Medium',
                color: accentColor,
              }}
            >
              {t('auth.forgotPassword')}
            </Text>
          </Pressable>
        </View>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <InputBox
              focused={passwordFocused}
              error={!!errors.password}
              icon={Lock}
              isRTL={isRTL}
            >
              <TextInput
                ref={passwordRef}
                value={value}
                onChangeText={onChange}
                onBlur={() => {
                  setPasswordFocused(false);
                  onBlur();
                }}
                onFocus={() => setPasswordFocused(true)}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={mutedColor}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit)}
                style={{
                  flex: 1,
                  marginLeft: isRTL ? 4 : 12,
                  marginRight: isRTL ? 12 : 4,
                  fontFamily: 'Poppins-Regular',
                  fontSize: 15,
                  color: textColor,
                  height: '100%',
                  textAlign,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setPasswordVisible((v) => !v);
                }}
                hitSlop={10}
                style={{ padding: 4 }}
              >
                {passwordVisible ? (
                  <EyeOff size={18} color={iconColor} />
                ) : (
                  <Eye size={18} color={iconColor} />
                )}
              </Pressable>
            </InputBox>
          )}
        />
        {errors.password && (
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: errorColor,
              marginHorizontal: 4,
              textAlign,
            }}
          >
            {t(errors.password.message)}
          </Text>
        )}
      </View>

      {/* Remember Me */}
      <Pressable
        onPress={onToggleRemember}
        hitSlop={6}
        style={{
          flexDirection: row,
          alignItems: 'center',
          gap: 10,
          paddingVertical: 4,
          marginHorizontal: 4,
          alignSelf: 'flex-start',
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: rememberMe
              ? inputBorderFocus
              : (dark ? 'hsl(150, 14%, 28%)' : 'hsl(148, 14%, 78%)'),
            backgroundColor: rememberMe ? inputBorderFocus : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {rememberMe && <Check size={14} color="#ffffff" strokeWidth={3} />}
        </View>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-Regular',
            color: textColor,
          }}
        >
          {t('auth.rememberMe')}
        </Text>
      </Pressable>

      {/* Submit */}
      <Button
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        disabled={isSubmitting}
        size="lg"
        className="w-full mt-2 rounded-2xl"
      >
        <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontFamily: 'Poppins-SemiBold',
              fontSize: 15,
              color: '#f5f8f5',
            }}
          >
            {t('auth.login')}
          </Text>
          {!isSubmitting && (
            <ForwardArrow size={18} color="#f5f8f5" strokeWidth={2.5} />
          )}
        </View>
      </Button>

      {/* Divider */}
      <View style={{ flexDirection: row, alignItems: 'center', gap: 12, marginTop: 4 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: inputBorderIdle }} />
        <Text style={{ fontSize: 11, fontFamily: 'Poppins-Medium', color: mutedColor, letterSpacing: 1 }}>
          {t('common.or', 'OR')}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: inputBorderIdle }} />
      </View>

      {/* Sign up CTA */}
      <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 14, fontFamily: 'Poppins-Regular', color: mutedColor }}>
          {t('auth.noAccount')}
        </Text>
        <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={10}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: accentColor,
            }}
          >
            {t('auth.register')}
          </Text>
        </Pressable>
      </View>

      {/* Trust badge */}
      <View
        style={{
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 12,
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
          {t('auth.secureLogin')}
        </Text>
      </View>
    </HeroSheetScreen>
  );
}

function FieldShell({ label, error, isRTL, children }) {
  const { textColor, errorColor } = useHeroSheetTokens();
  const textAlign = isRTL ? 'right' : 'left';
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-Medium',
          color: textColor,
          marginHorizontal: 4,
          textAlign,
        }}
      >
        {label}
      </Text>
      {children}
      {error && (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: errorColor,
            marginHorizontal: 4,
            textAlign,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

function InputBox({ focused, error, icon: Icon, isRTL, children }) {
  const { inputBg, inputBorderIdle, inputBorderFocus, errorColor, iconColor } = useHeroSheetTokens();
  return (
    <View
      style={{
        flexDirection: rowDirection(isRTL),
        alignItems: 'center',
        backgroundColor: inputBg,
        borderWidth: 1.5,
        borderColor: error
          ? errorColor
          : focused
            ? inputBorderFocus
            : inputBorderIdle,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 54,
      }}
    >
      {Icon && <Icon size={18} color={focused ? inputBorderFocus : iconColor} />}
      {children}
    </View>
  );
}

