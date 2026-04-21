import { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Users, KeyRound, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '@/lib/api';
import useLocalQuery from '@/hooks/useLocalQuery';
import useAuthStore from '@/stores/authStore';
import SheetInput from '@/components/SheetInput';
import PhoneInput from '@/components/PhoneInput';
import FormSheet from '@/components/FormSheet';
import { FormSection, FormField } from '@/components/FormSheetParts';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import InviteAccessSheet from '@/shared/sheets/InviteAccessSheet';

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

/**
 * View / edit an existing team member on mobile. Mirrors the web
 * TeamMemberSheet — same fields, same actions in the same order:
 *   - Person fields
 *   - Role / scope (farm picker) / advanced permissions via InviteAccessSheet
 *   - Reset Password + Remove (soft-delete) buttons at the bottom
 *
 * Wires to the backend directly (no offline queue) because team
 * management is owner-only and an owner is normally online when doing
 * this work. If they're offline the request errors clearly.
 */
export default function TeamMemberSheet({
  open,
  onClose,
  member,
  onTempPassword,
  onRemoved,
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isRTL = useIsRTL();
  const user = useAuthStore((s) => s.user);
  const userModules = Array.isArray(user?.modules) ? user.modules : [];

  const [workers] = useLocalQuery('workers');
  const linkedWorker = useMemo(() => {
    if (!member?._id) return null;
    return workers.find((w) => {
      const linkedId = typeof w.linkedUser === 'object' ? w.linkedUser?._id : w.linkedUser;
      return String(linkedId) === String(member._id);
    });
  }, [workers, member?._id]);

  const [accountRole, setAccountRole] = useState(member?.accountRole || 'viewer');
  const [farmAssignments, setFarmAssignments] = useState([]);
  const [permissions, setPermissions] = useState({ allow: [], deny: [] });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: member?.firstName || '',
      lastName: member?.lastName || '',
      phone: member?.phone || '',
    },
  });

  useEffect(() => {
    if (!open || !member) return;
    reset({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      phone: member.phone || '',
    });
    setAccountRole(member.accountRole || 'viewer');
    setPermissions({
      allow: Array.isArray(member.permissions?.allow) ? member.permissions.allow : [],
      deny: Array.isArray(member.permissions?.deny) ? member.permissions.deny : [],
    });
    const farms = Array.isArray(linkedWorker?.farmAssignments)
      ? linkedWorker.farmAssignments.map((f) => String(typeof f === 'object' ? f._id : f))
      : [];
    setFarmAssignments(farms);
  }, [open, member, linkedWorker, reset]);

  const handleResetPassword = async () => {
    if (!member?._id) return;
    setResetting(true);
    try {
      const { data } = await api.post(`/users/${member._id}/reset-password`);
      onTempPassword?.({
        name: `${member.firstName} ${member.lastName || ''}`.trim(),
        email: member.email,
        password: data.tempPassword,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('settings.resetPasswordError', 'Failed to reset password'),
      });
    } finally {
      setResetting(false);
    }
  };

  const handleRemove = () => {
    if (!member?._id) return;
    Alert.alert(
      t('settings.removeUserTitle', 'Remove team member?'),
      t(
        'settings.removeUserDesc',
        'This person will lose access immediately. Their authored records (daily logs, sales, expenses, photos) stay intact and continue to show their name. This cannot be undone from the UI.'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('settings.removeUser', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${member._id}`);
              await deltaSync().catch(() => {});
              toast({ title: t('settings.userRemoved', 'Team member removed') });
              onRemoved?.();
              onClose();
            } catch (err) {
              toast({
                variant: 'destructive',
                title: err.response?.data?.message || t('common.error', 'Error'),
              });
            }
          },
        },
      ]
    );
  };

  const onSubmit = async (data) => {
    if (!member?._id) return;
    setSaving(true);
    try {
      await api.put(`/users/${member._id}`, {
        firstName: data.firstName,
        lastName: data.lastName || '',
        phone: data.phone || '',
        accountRole,
        permissions,
        farmAssignments,
      });
      await deltaSync().catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast({ title: t('settings.userUpdated', 'Team member updated') });
      onClose();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('common.error', 'Error'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={t('settings.editUser', 'Edit Team Member')}
      subtitle={member.email}
      icon={Users}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={t('common.save', 'Save')}
      loading={saving}
      disabled={saving}
    >
      <FormSection title={t('settings.personalSection', 'Personal Information')}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('auth.firstName', 'First Name')} required error={errors.firstName?.message}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    dense
                  />
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
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
        </View>

        <FormField label={t('auth.phone', 'Phone')}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => (
              <PhoneInput value={value} onChange={onChange} />
            )}
          />
        </FormField>
      </FormSection>

      <InviteAccessSheet
        accountRole={accountRole}
        onAccountRole={setAccountRole}
        farmAssignments={farmAssignments}
        onFarmAssignments={setFarmAssignments}
        permissions={permissions}
        onPermissions={setPermissions}
        userModules={userModules}
      />

      <FormSection title={t('settings.actions', 'Actions')}>
        <Button
          onPress={handleResetPassword}
          loading={resetting}
          disabled={resetting}
          variant="outline"
        >
          <KeyRound size={16} />
          <Text style={{ fontFamily: 'Poppins-SemiBold', marginLeft: 6 }}>
            {t('settings.resetPassword', 'Reset Password')}
          </Text>
        </Button>
        <Button
          onPress={handleRemove}
          variant="destructive"
        >
          <Trash2 size={16} color="#ffffff" />
          <Text style={{ fontFamily: 'Poppins-SemiBold', color: '#ffffff', marginLeft: 6 }}>
            {t('settings.removeUser', 'Remove')}
          </Text>
        </Button>
      </FormSection>
    </FormSheet>
  );
}
