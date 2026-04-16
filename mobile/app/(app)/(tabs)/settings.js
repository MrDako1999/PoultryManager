import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  User, Shield, Puzzle, Calculator, ShoppingCart,
  ChevronRight, LogOut, Moon, Sun, Monitor,
} from 'lucide-react-native';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useSettings from '@/hooks/useSettings';
import useCapabilities from '@/hooks/useCapabilities';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import Separator from '@/components/ui/Separator';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const logoLight = require('@/assets/images/logo.png');
const logoDark = require('@/assets/images/logo-white.png');

function SettingsRow({ icon: Icon, label, value, onPress, destructive }) {
  const { resolvedTheme } = useThemeStore();
  const iconColor = destructive
    ? 'hsl(0, 72%, 51%)'
    : (resolvedTheme === 'dark' ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)');
  const chevronColor = resolvedTheme === 'dark' ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:bg-accent/50"
    >
      {Icon && <Icon size={18} color={iconColor} style={{ marginRight: 12 }} />}
      <Text className={`text-sm flex-1 ${destructive ? 'text-destructive font-medium' : 'text-foreground'}`}>
        {label}
      </Text>
      {value && <Text className="text-sm text-muted-foreground mr-2">{value}</Text>}
      {onPress && !destructive && <ChevronRight size={16} color={chevronColor} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { toast } = useToast();
  const accountingSettings = useSettings('accounting');
  const { workspace, can } = useCapabilities();
  const isOwner = !!workspace?.isOwner;

  const [section, setSection] = useState('main');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

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

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: t('auth.passwordMismatch', 'Passwords do not match') });
      return;
    }
    if (newPassword.length < 8) {
      toast({ variant: 'destructive', title: t('auth.passwordMin', 'Password must be at least 8 characters') });
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/settings/password', { currentPassword: oldPassword, newPassword });
      toast({ title: t('settings.passwordChanged', 'Password changed successfully') });
      setSection('main');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast({ variant: 'destructive', title: err.response?.data?.message || t('common.error', 'Error') });
    } finally {
      setSavingPassword(false);
    }
  };

  if (section === 'security') {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 pt-2 pb-3 border-b border-border flex-row items-center gap-3">
          <Pressable onPress={() => setSection('main')} hitSlop={8}>
            <Text className="text-sm text-primary font-medium">{t('common.back', 'Back')}</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">{t('settings.security', 'Security')}</Text>
        </View>
        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          <View className="gap-4">
            <View className="gap-2">
              <Label>{t('settings.currentPassword', 'Current Password')}</Label>
              <Input secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
            </View>
            <View className="gap-2">
              <Label>{t('settings.newPassword', 'New Password')}</Label>
              <Input secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            </View>
            <View className="gap-2">
              <Label>{t('auth.confirmPassword', 'Confirm Password')}</Label>
              <Input secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
            </View>
            <Button onPress={handleChangePassword} loading={savingPassword} disabled={savingPassword}>
              {t('settings.changePassword', 'Change Password')}
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  const themeIcons = { light: Sun, dark: Moon, system: Monitor };
  const themeLabels = { light: 'Light', dark: 'Dark', system: 'System' };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3">
        <Text className="text-xl font-bold text-foreground">{t('nav.settings')}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Profile Section */}
        <Pressable onPress={() => router.push('/(app)/settings-profile')} className="px-4 py-3 active:bg-accent/50">
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 rounded-full bg-primary/10 items-center justify-center">
              <Text className="text-xl font-bold text-primary">
                {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">
                {user?.firstName} {user?.lastName}
              </Text>
              <Text className="text-sm text-muted-foreground">{user?.email}</Text>
            </View>
            <ChevronRight size={16} color={resolvedTheme === 'dark' ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)'} />
          </View>
        </Pressable>

        <Separator className="my-1" />

        {/* Theme */}
        <View className="px-4 py-3">
          <Text className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            {t('settings.appearance', 'Appearance')}
          </Text>
          <View className="flex-row gap-2">
            {['light', 'dark', 'system'].map((mode) => {
              const ThemeIcon = themeIcons[mode];
              const isActive = theme === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setTheme(mode)}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg border ${
                    isActive ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <ThemeIcon size={14} color={isActive ? primaryColor : (resolvedTheme === 'dark' ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)')} />
                  <Text className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {themeLabels[mode]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Separator className="my-1" />

        {/* Account */}
        <View>
          <Text className="text-xs font-semibold text-muted-foreground uppercase px-4 py-2">
            {t('settings.account', 'Account')}
          </Text>
          <SettingsRow icon={Shield} label={t('settings.security', 'Security')} onPress={() => setSection('security')} />
          {isOwner && (
            <SettingsRow icon={Puzzle} label={t('settings.modules', 'Modules')} onPress={() => router.push('/(app)/settings-modules')} />
          )}
        </View>

        {(can('settings:accounting:read') || can('settings:saleDefaults:read') || isOwner) && (
          <>
            <Separator className="my-1" />

            {/* Preferences */}
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase px-4 py-2">
                {t('settings.preferences', 'Preferences')}
              </Text>
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
                />
              )}
            </View>
          </>
        )}

        <Separator className="my-1" />

        <View className="mt-2">
          <SettingsRow icon={LogOut} label={t('auth.logout', 'Log Out')} onPress={handleLogout} destructive />
        </View>

        {/* Branding Footer */}
        <View className="px-4 pt-8 pb-4 items-center gap-2">
          <Image
            source={resolvedTheme === 'dark' ? logoDark : logoLight}
            style={{ width: 36, height: 36, borderRadius: 8 }}
            resizeMode="contain"
          />
          <Text className="text-xs text-muted-foreground">PoultryManager.io v1.0.0</Text>
          <Text className="text-[10px] text-muted-foreground">&copy; {new Date().getFullYear()} Estera Tech LLC</Text>
        </View>
      </ScrollView>
    </View>
  );
}
