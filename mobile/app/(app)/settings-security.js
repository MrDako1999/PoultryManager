import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Lock, KeyRound } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import api from '@/lib/api';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';

function PasswordField({ value, onChangeText, placeholder }) {
  const { inputBg, inputBorderIdle, inputBorderFocus, textColor, mutedColor, iconColor } = useHeroSheetTokens();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: inputBg,
        borderWidth: 1.5,
        borderColor: focused ? inputBorderFocus : inputBorderIdle,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 52,
      }}
    >
      <Lock size={18} color={focused ? inputBorderFocus : iconColor} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor={mutedColor}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          flex: 1,
          marginLeft: 12,
          marginRight: 4,
          fontFamily: 'Poppins-Regular',
          fontSize: 15,
          color: textColor,
          height: '100%',
        }}
      />
      <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} style={{ padding: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Poppins-Medium', color: iconColor }}>
          {visible ? 'HIDE' : 'SHOW'}
        </Text>
      </Pressable>
    </View>
  );
}

function SettingsField({ label, children }) {
  const { textColor } = useHeroSheetTokens();
  return (
    <View style={{ gap: 8, marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-Medium',
          color: textColor,
          marginLeft: 4,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function SettingsSecurityScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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
      router.back();
    } catch (err) {
      toast({ variant: 'destructive', title: err.response?.data?.message || t('common.error', 'Error') });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <HeroSheetScreen
      title={t('settings.security', 'Security')}
      subtitle={t('settings.securityDesc', 'Update your password to keep your account secure')}
      keyboardAvoiding
      heroExtra={
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
          <KeyRound size={26} color="#ffffff" strokeWidth={2} />
        </View>
      }
    >
      <SheetSection title={t('settings.changePasswordSection', 'Change Password')}>
        <SettingsField label={t('settings.currentPassword', 'Current Password')}>
          <PasswordField value={oldPassword} onChangeText={setOldPassword} placeholder="••••••••" />
        </SettingsField>
        <SettingsField label={t('settings.newPassword', 'New Password')}>
          <PasswordField value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" />
        </SettingsField>
        <SettingsField label={t('auth.confirmPassword', 'Confirm Password')}>
          <PasswordField value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" />
        </SettingsField>
        <Button
          onPress={handleChangePassword}
          loading={savingPassword}
          disabled={savingPassword}
          size="lg"
          className="w-full mt-2 rounded-2xl"
        >
          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#f5f8f5' }}>
            {t('settings.changePassword', 'Change Password')}
          </Text>
        </Button>
      </SheetSection>
    </HeroSheetScreen>
  );
}
