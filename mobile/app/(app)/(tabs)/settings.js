import { useRef } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  User, Shield, Puzzle, Calculator, ShoppingCart,
  ChevronRight, LogOut, Moon, Sun, Monitor, Languages,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useLocaleStore, { SUPPORTED_LANGUAGES } from '@/stores/localeStore';
import useSettings from '@/hooks/useSettings';
import useCapabilities from '@/hooks/useCapabilities';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import { LanguagePickerSheet } from '@/components/LanguageSelector';
import FlagTile, { getFlagComponent } from '@/components/flags';
import SlidingSegmentedControl from '@/components/SlidingSegmentedControl';

function SettingsRow({ icon: Icon, label, value, valueAccessory, onPress, destructive, isLast }) {
  const { iconColor, mutedColor, textColor, errorColor, borderColor, dark } = useHeroSheetTokens();
  const rowIconColor = destructive ? errorColor : iconColor;
  const iconBg = destructive
    ? (dark ? 'rgba(252,165,165,0.12)' : 'rgba(220,38,38,0.08)')
    : (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 30%, 95%)');

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent',
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: borderColor,
        borderRadius: 14,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        {Icon && (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              flexShrink: 0,
            }}
          >
            <Icon size={17} color={rowIconColor} strokeWidth={2.2} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: destructive ? 'Poppins-SemiBold' : 'Poppins-Medium',
              color: destructive ? errorColor : textColor,
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
        {(value || valueAccessory) && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginLeft: 8,
              marginRight: 8,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {valueAccessory}
            {value ? (
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {value}
              </Text>
            ) : null}
          </View>
        )}
        {onPress && !destructive && (
          <ChevronRight size={18} color={mutedColor} style={{ flexShrink: 0 }} />
        )}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const language = useLocaleStore((s) => s.language);
  const currentLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  const currentLanguageFlag = getFlagComponent(currentLanguage.code) ? (
    <FlagTile code={currentLanguage.code} size={16} width={24} radius={3} />
  ) : null;
  const languageSheetRef = useRef(null);
  const accountingSettings = useSettings('accounting');
  const { workspace, can } = useCapabilities();
  const isOwner = !!workspace?.isOwner;

  const { dark, mutedColor } = useHeroSheetTokens();

  const handleLogout = () => {
    Alert.alert(
      t('settings.logoutTitle', 'Log Out'),
      t('settings.logoutConfirm', 'Are you sure you want to log out?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('auth.logout', 'Log Out'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const initials = `${(user?.firstName?.[0] || '').toUpperCase()}${(user?.lastName?.[0] || '').toUpperCase()}`;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email;

  const themeIcons = { light: Sun, dark: Moon, system: Monitor };
  const themeLabels = {
    light: t('common.light', 'Light'),
    dark: t('common.dark', 'Dark'),
    system: t('common.system', 'System'),
  };
  const themeSegmentModes = ['light', 'dark', 'system'];

  const heroAvatar = (
    <Pressable
      onPress={() => router.push('/(app)/settings-profile')}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
    >
      <View
        style={{
          height: 64,
          width: 64,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.95)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text
          style={{
            fontFamily: 'Poppins-Bold',
            fontSize: 24,
            color: dark ? 'hsl(148, 60%, 22%)' : 'hsl(148, 60%, 22%)',
            letterSpacing: -0.5,
          }}
        >
          {initials || '?'}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 18,
            fontFamily: 'Poppins-SemiBold',
            color: '#ffffff',
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {fullName}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Regular',
            color: 'rgba(255,255,255,0.78)',
          }}
          numberOfLines={1}
        >
          {user?.email}
        </Text>
        {user?.accountRole && (
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
              marginTop: 2,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Poppins-SemiBold',
                color: '#ffffff',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {t(`settings.roles.${user.accountRole}`, user.accountRole)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <HeroSheetScreen
      title={t('nav.settings')}
      subtitle={t('settings.subtitle', 'Manage your account, team, and preferences')}
      showBack={false}
      heroExtra={heroAvatar}
    >
      {/* Theme switcher + Language */}
      <SheetSection title={t('settings.appearance', 'Appearance')} padded={false}>
        <SlidingSegmentedControl
          bordered={false}
          value={theme}
          onChange={setTheme}
          options={themeSegmentModes.map((mode) => ({
            value: mode,
            label: themeLabels[mode],
            icon: themeIcons[mode],
          }))}
        />
        <SettingsRow
          icon={Languages}
          label={t('common.language', 'Language')}
          value={currentLanguage.native}
          valueAccessory={currentLanguageFlag}
          onPress={() => languageSheetRef.current?.open()}
          isLast
        />
      </SheetSection>

      {/* Account */}
      <SheetSection title={t('settings.account', 'Account')} padded={false}>
        <SettingsRow
          icon={User}
          label={t('settings.profile', 'Profile')}
          onPress={() => router.push('/(app)/settings-profile')}
        />
        <SettingsRow
          icon={Shield}
          label={t('settings.security', 'Security')}
          onPress={() => router.push('/(app)/settings-security')}
          isLast={!isOwner}
        />
        {isOwner && (
          <SettingsRow
            icon={Puzzle}
            label={t('settings.modules', 'Modules')}
            onPress={() => router.push('/(app)/settings-modules')}
            isLast
          />
        )}
      </SheetSection>

      {/* Preferences */}
      {(can('settings:accounting:read') || can('settings:saleDefaults:read') || isOwner) && (
        <SheetSection title={t('settings.preferences', 'Preferences')} padded={false}>
          {(isOwner || can('settings:accounting:read')) && (
            <SettingsRow
              icon={Calculator}
              label={t('settings.accounting', 'Accounting')}
              value={accountingSettings?.currency || '—'}
              onPress={() => router.push('/(app)/settings-accounting')}
            />
          )}
          {(isOwner || can('settings:saleDefaults:read')) && (
            <SettingsRow
              icon={ShoppingCart}
              label={t('settings.saleDefaults', 'Sale Defaults')}
              onPress={() => router.push('/(app)/settings-sale-defaults')}
              isLast
            />
          )}
        </SheetSection>
      )}

      {/* Logout */}
      <SheetSection padded={false}>
        <SettingsRow
          icon={LogOut}
          label={t('auth.logout', 'Log Out')}
          onPress={handleLogout}
          destructive
          isLast
        />
      </SheetSection>

      {/* Footer */}
      <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 16, gap: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Poppins-Medium', color: mutedColor }}>
          PoultryManager.io · v{Constants.expoConfig?.version ?? '—'}
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'Poppins-Regular', color: mutedColor }}>
          © {new Date().getFullYear()} Estera Tech LLC
        </Text>
      </View>

      <LanguagePickerSheet ref={languageSheetRef} />
    </HeroSheetScreen>
  );
}
