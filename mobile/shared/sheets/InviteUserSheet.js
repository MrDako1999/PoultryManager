import { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { UserPlus, CheckCircle2 } from 'lucide-react-native';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import SheetInput from '@/components/SheetInput';
import PhoneInput from '@/components/PhoneInput';
import FormSheet from '@/components/FormSheet';
import { FormSection, FormField } from '@/components/FormSheetParts';
import { useToast } from '@/components/ui/Toast';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import InviteAccessSheet from '@/shared/sheets/InviteAccessSheet';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
});

/**
 * Three-step invite wizard on mobile. Mirrors the web InviteUserDialog
 * exactly so an owner switching between platforms sees the same flow.
 *
 *   Page 1 - Person: name, email, phone, "Give app access" toggle.
 *   Page 2 - Access: role, scope (farm picker), advanced permissions.
 *   Page 3 - Done: success message + temp password (when invited).
 *
 * The success state stays inside the same sheet rather than popping a
 * separate centered modal — keeps the creation flow as a single
 * smooth sequence instead of an interruption.
 */
export default function InviteUserSheet({ open, onClose, onCreated }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { mutedColor, textColor, accentColor, borderColor } = tokens;

  const user = useAuthStore((s) => s.user);
  const userModules = Array.isArray(user?.modules) ? user.modules : [];

  const [step, setStep] = useState(1);
  const [grantAccess, setGrantAccess] = useState(true);
  const [accountRole, setAccountRole] = useState('viewer');
  const [farmAssignments, setFarmAssignments] = useState([]);
  const [permissions, setPermissions] = useState({ allow: [], deny: [] });
  const [saving, setSaving] = useState(false);
  const [createdSummary, setCreatedSummary] = useState(null);

  const {
    control,
    handleSubmit,
    reset,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(personSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  });

  const handleClose = () => {
    setStep(1);
    setGrantAccess(true);
    setAccountRole('viewer');
    setFarmAssignments([]);
    setPermissions({ allow: [], deny: [] });
    setCreatedSummary(null);
    reset({ firstName: '', lastName: '', email: '', phone: '' });
    onClose?.();
  };

  const goNext = async () => {
    const fields = grantAccess ? ['firstName', 'email'] : ['firstName'];
    const ok = await trigger(fields);
    if (!ok) return;
    if (!grantAccess) {
      handleSubmit(onSubmit)();
    } else {
      setStep(2);
    }
  };

  const onSubmit = async (data) => {
    if (grantAccess && !data.email) {
      toast({
        variant: 'destructive',
        title: t('settings.emailRequiredForAccess', 'Email is required to give app access'),
      });
      return;
    }
    setSaving(true);
    try {
      if (grantAccess) {
        const { data: res } = await api.post('/users', {
          firstName: data.firstName,
          lastName: data.lastName || '',
          email: data.email,
          phone: data.phone || '',
          accountRole,
          permissions,
          farmAssignments,
        });
        await deltaSync().catch(() => {});
        onCreated?.();
        // Stay in the wizard, advance to the Done step. The temp
        // password renders inline rather than as a separate modal.
        setCreatedSummary({
          name: `${res.user.firstName} ${res.user.lastName || ''}`.trim(),
          email: res.user.email,
          password: res.tempPassword,
        });
        setStep(3);
      } else {
        await api.post('/workers', {
          firstName: data.firstName,
          lastName: data.lastName || '',
          phone: data.phone || '',
          farmAssignments,
        });
        await deltaSync().catch(() => {});
        toast({ title: t('settings.workerCreated', 'Worker added') });
        onCreated?.();
        handleClose();
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('common.error', 'Error'),
      });
    } finally {
      setSaving(false);
    }
  };

  const stepTitle = step === 1
    ? t('settings.addUser', 'Add User')
    : step === 2
      ? t('settings.accessTitle', 'Access')
      : t('settings.userCreatedTitle', 'User created');

  const stepSubtitle = step === 1
    ? t('settings.addUserPersonDesc', 'Who is this person?')
    : step === 2
      ? t('settings.addUserAccessDesc', 'What can they do?')
      : t('settings.userCreatedDesc', 'Share these credentials securely. They\'ll only be shown here once.');

  const submitLabel = step === 1
    ? (grantAccess ? t('common.next', 'Next') : t('common.create', 'Create'))
    : step === 2
      ? t('settings.createUser', 'Create User')
      : t('common.done', 'Done');

  const onSheetSubmit = step === 1
    ? goNext
    : step === 2
      ? handleSubmit(onSubmit)
      : () => handleClose();

  const sheetIcon = step === 3 ? CheckCircle2 : UserPlus;

  return (
    <FormSheet
      open={open}
      onClose={handleClose}
      title={stepTitle}
      subtitle={stepSubtitle}
      icon={sheetIcon}
      onSubmit={onSheetSubmit}
      submitLabel={submitLabel}
      loading={saving}
      disabled={saving}
    >
      {step === 1 ? (
        <FormSection title={t('settings.personalSection', 'Personal Information')}>
          <View style={{ flexDirection: rowDirection(isRTL), gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FormField label={t('auth.firstName', 'First Name')} required error={errors.firstName?.message}>
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <SheetInput value={value} onChangeText={onChange} onBlur={onBlur} dense />
                  )}
                />
              </FormField>
            </View>
            <View style={{ flex: 1 }}>
              <FormField label={t('auth.lastName', 'Last Name')}>
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <SheetInput value={value} onChangeText={onChange} onBlur={onBlur} dense />
                  )}
                />
              </FormField>
            </View>
          </View>

          <FormField
            label={
              grantAccess
                ? t('auth.email', 'Email')
                : `${t('auth.email', 'Email')} (${t('common.optional', 'optional')})`
            }
            required={grantAccess}
            error={errors.email?.message}
          >
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <SheetInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              )}
            />
          </FormField>

          <FormField label={t('auth.phone', 'Phone')}>
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange } }) => (
                <PhoneInput value={value} onChange={onChange} />
              )}
            />
          </FormField>

          <View
            style={{
              marginTop: 4,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.borderColor,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: textColor }}>
                {t('settings.giveAppAccess', 'Give app access')}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  marginTop: 2,
                }}
              >
                {t(
                  'settings.giveAppAccessDesc',
                  'Create a login. Off = HR-only directory entry.'
                )}
              </Text>
            </View>
            <Switch value={grantAccess} onValueChange={setGrantAccess} />
          </View>
        </FormSection>
      ) : step === 2 ? (
        <InviteAccessSheet
          accountRole={accountRole}
          onAccountRole={setAccountRole}
          farmAssignments={farmAssignments}
          onFarmAssignments={setFarmAssignments}
          permissions={permissions}
          onPermissions={setPermissions}
          userModules={userModules}
        />
      ) : createdSummary ? (
        <FormSection>
          <View
            style={{
              flexDirection: rowDirection(isRTL),
              alignItems: 'flex-start',
              gap: 12,
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: accentColor,
              backgroundColor: tokens.dark
                ? 'rgba(148,210,165,0.08)'
                : 'hsl(148, 35%, 96%)',
            }}
          >
            <CheckCircle2 size={20} color={accentColor} strokeWidth={2} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  textAlign: textAlignStart(isRTL),
                }}
              >
                {t('settings.userCreatedHeader', 'Account created')}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  lineHeight: 17,
                  textAlign: textAlignStart(isRTL),
                }}
              >
                {t(
                  'settings.userCreatedHelp',
                  "They can sign in immediately with the temporary password below. They'll be asked to change it on first login."
                )}
              </Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: rowDirection(isRTL),
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: mutedColor,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                {t('common.name', 'Name')}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                }}
              >
                {createdSummary.name}
              </Text>
            </View>
            <View
              style={{
                flexDirection: rowDirection(isRTL),
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: mutedColor,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                {t('auth.email', 'Email')}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Medium',
                  color: textColor,
                }}
                numberOfLines={1}
              >
                {createdSummary.email}
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: mutedColor,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                textAlign: textAlignStart(isRTL),
              }}
            >
              {t('settings.temporaryPassword', 'Temporary password')}
            </Text>
            <View
              style={{
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor,
                backgroundColor: tokens.dark
                  ? 'rgba(255,255,255,0.04)'
                  : 'hsl(148, 18%, 97%)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Menlo',
                  fontSize: 14,
                  color: textColor,
                  textAlign: textAlignStart(isRTL),
                }}
                selectable
              >
                {createdSummary.password}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                lineHeight: 16,
                textAlign: textAlignStart(isRTL),
              }}
            >
              {t(
                'settings.tempPasswordWarning',
                'Long-press to copy. This password will only be shown once. Make sure to save it now.'
              )}
            </Text>
          </View>
        </FormSection>
      ) : null}
    </FormSheet>
  );
}
