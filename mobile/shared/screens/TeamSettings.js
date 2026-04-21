import { useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, RefreshControl, StyleSheet, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  Users, UserPlus, UserX, UserCheck, Trash2, Pencil,
  X,
} from 'lucide-react-native';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import useLocalQuery from '@/hooks/useLocalQuery';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import EmptyState from '@/components/ui/EmptyState';
import QuickAddFAB from '@/components/QuickAddFAB';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import InviteUserSheet from '@/shared/sheets/InviteUserSheet';
import TeamMemberSheet from '@/shared/sheets/TeamMemberSheet';

const SWIPE_ACTION_WIDTH = 76;

const ROLE_BADGE_VARIANT = {
  owner: 'default',
  manager: 'default',
  veterinarian: 'success',
  accountant: 'warning',
  ground_staff: 'secondary',
  viewer: 'outline',
};

/**
 * Mobile Settings -> Team list. Mirrors the web TeamSettings flow:
 *   - Members rendered with role / active-deactivated / app-access pills
 *     and a scope summary ("2 farms" / "All farms").
 *   - Swipe a row to Edit / Activate-Deactivate / Remove (soft-delete).
 *   - FAB opens the two-step InviteUserSheet wizard.
 *   - Owner-only: gated by route entry in settings.js, but we re-check
 *     on mount as a defense-in-depth.
 */
export default function TeamSettingsScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { accentColor, dark, mutedColor } = tokens;

  const user = useAuthStore((s) => s.user);
  const isOwner = !!user && !user.createdBy && user.accountRole === 'owner';

  const [members, membersLoading] = useLocalQuery('users');
  const [workers] = useLocalQuery('workers');
  const [refreshing, setRefreshing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  const workerByLinkedUser = useMemo(() => {
    const map = new Map();
    for (const w of workers) {
      const linkedId = typeof w.linkedUser === 'object' ? w.linkedUser?._id : w.linkedUser;
      if (linkedId) map.set(String(linkedId), w);
    }
    return map;
  }, [workers]);

  const visibleMembers = useMemo(() => {
    return members.filter((m) => !m.deletedAt);
  }, [members]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const toggleActive = async (member) => {
    try {
      await api.put(`/users/${member._id}`, { isActive: !member.isActive });
      await deltaSync().catch(() => {});
      toast({ title: t('settings.userStatusUpdated', 'Status updated') });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('common.error', 'Error'),
      });
    }
  };

  const removeMember = (member) => {
    Alert.alert(
      t('settings.removeUserTitle', 'Remove team member?'),
      t(
        'settings.removeUserDesc',
        'This person will lose access immediately. Their authored records stay intact and continue to show their name. This cannot be undone from the UI.'
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

  const resetPassword = async (member) => {
    try {
      const { data } = await api.post(`/users/${member._id}/reset-password`);
      setTempPasswordInfo({
        name: `${member.firstName} ${member.lastName || ''}`.trim(),
        email: member.email,
        password: data.tempPassword,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('settings.resetPasswordError', 'Failed to reset password'),
      });
    }
  };

  const heroExtra = (
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
      <Users size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  if (!isOwner) {
    return (
      <HeroSheetScreen
        title={t('settings.team', 'Team')}
        subtitle={t('settings.teamDesc', 'Manage who has access to your account')}
        heroExtra={heroExtra}
      >
        <SheetSection>
          <EmptyState
            icon={Users}
            title={t('settings.teamOwnerOnlyTitle', 'Owner only')}
            description={t(
              'settings.teamOwnerOnlyDesc',
              'Only the account owner can manage team members.'
            )}
          />
        </SheetSection>
      </HeroSheetScreen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <HeroSheetScreen
        title={t('settings.team', 'Team')}
        subtitle={t('settings.teamDesc', 'Manage who has access to your account')}
        heroExtra={heroExtra}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
      >
        {membersLoading && visibleMembers.length === 0 ? (
          <SheetSection padded={false}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: mutedColor }}>{t('common.loading', 'Loading...')}</Text>
            </View>
          </SheetSection>
        ) : visibleMembers.length === 0 ? (
          <SheetSection>
            <EmptyState
              icon={Users}
              title={t('settings.noTeamMembers', 'No team members yet')}
              description={t(
                'settings.noTeamMembersDesc',
                'Add team members to give them access to your account with specific roles and permissions.'
              )}
              actionLabel={t('settings.addFirstUser', 'Add Your First Team Member')}
              onAction={() => setInviteOpen(true)}
            />
          </SheetSection>
        ) : (
          <SheetSection padded={false}>
            {visibleMembers.map((member, idx) => (
              <View
                key={member._id}
                style={
                  idx > 0
                    ? { borderTopWidth: 1, borderTopColor: tokens.sectionBorder }
                    : null
                }
              >
                <MemberRow
                  member={member}
                  worker={workerByLinkedUser.get(String(member._id))}
                  tokens={tokens}
                  isRTL={isRTL}
                  t={t}
                  onPress={() => setEditing(member)}
                  onEdit={() => setEditing(member)}
                  onResetPassword={() => resetPassword(member)}
                  onToggleActive={() => toggleActive(member)}
                  onRemove={() => removeMember(member)}
                />
              </View>
            ))}
          </SheetSection>
        )}
      </HeroSheetScreen>

      {!inviteOpen && !editing ? (
        <QuickAddFAB
          items={[]}
          directAction={() => setInviteOpen(true)}
          bottomInset={insets.bottom + 16}
        />
      ) : null}

      <InviteUserSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <TeamMemberSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        member={editing}
        onTempPassword={setTempPasswordInfo}
        onRemoved={() => setEditing(null)}
      />

      <TempPasswordModal
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
        tokens={tokens}
        t={t}
      />
    </View>
  );
}

function MemberRow({
  member, worker, tokens, isRTL, t,
  onPress, onEdit, onResetPassword, onToggleActive, onRemove,
}) {
  const { mutedColor, textColor, accentColor, dark, sectionBg } = tokens;
  const swipeRef = useRef(null);

  const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();
  const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
  const role = member.accountRole || 'viewer';
  const isUnscopedRole = ['owner', 'manager', 'accountant', 'viewer', 'veterinarian'].includes(role);
  const farmsCount = Array.isArray(worker?.farmAssignments) ? worker.farmAssignments.length : 0;
  const scopeText = isUnscopedRole
    ? t('settings.scopeAllFarms', 'All farms')
    : farmsCount === 0
      ? t('settings.scopeNoFarms', 'No farms')
      : t('settings.scopeNFarms', '{{n}} farms', { n: farmsCount });

  const callWith = (cb) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close?.();
    setTimeout(() => cb?.(), 150);
  };

  const renderRightActions = () => (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={() => callWith(onEdit)}
        style={({ pressed }) => [rowStyles.swipeAction, { backgroundColor: '#f59e0b', opacity: pressed ? 0.8 : 1 }]}
      >
        <Pencil size={20} color="#ffffff" strokeWidth={2.2} />
        <Text style={rowStyles.swipeActionLabel}>{t('common.edit', 'Edit')}</Text>
      </Pressable>
      <Pressable
        onPress={() => callWith(onToggleActive)}
        style={({ pressed }) => [rowStyles.swipeAction, { backgroundColor: '#0284c7', opacity: pressed ? 0.8 : 1 }]}
      >
        {member.isActive ? <UserX size={20} color="#ffffff" /> : <UserCheck size={20} color="#ffffff" />}
        <Text style={rowStyles.swipeActionLabel}>
          {member.isActive ? t('settings.deactivate', 'Pause') : t('settings.activate', 'Resume')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => callWith(onRemove)}
        style={({ pressed }) => [rowStyles.swipeAction, { backgroundColor: '#dc2626', opacity: pressed ? 0.8 : 1 }]}
      >
        <Trash2 size={20} color="#ffffff" strokeWidth={2.2} />
        <Text style={rowStyles.swipeActionLabel}>{t('common.delete', 'Remove')}</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      containerStyle={{ backgroundColor: sectionBg }}
    >
      <Pressable
        onPressIn={() => Haptics.selectionAsync().catch(() => {})}
        onPress={onPress}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={({ pressed }) => ({
          backgroundColor: pressed
            ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
            : 'transparent',
        })}
      >
        <View style={rowStyles.rowInner}>
          <View
            style={[
              rowStyles.row,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <View
              style={[
                rowStyles.avatar,
                {
                  backgroundColor: dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)',
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Bold',
                  color: accentColor,
                }}
              >
                {initials || '?'}
              </Text>
            </View>

            <View style={rowStyles.textCol}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  letterSpacing: -0.1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {fullName}
              </Text>

              <View
                style={[
                  rowStyles.metaRow,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                <View
                  style={[
                    rowStyles.rolePill,
                    {
                      backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'hsl(148, 18%, 96%)',
                      borderColor: dark ? 'rgba(255,255,255,0.10)' : 'hsl(148, 14%, 88%)',
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Poppins-SemiBold',
                      color: mutedColor,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t(`settings.roles.${role}`, role)}
                  </Text>
                </View>

                {!member.isActive ? (
                  <View
                    style={[
                      rowStyles.rolePill,
                      {
                        backgroundColor: dark ? 'rgba(252,165,165,0.12)' : 'rgba(220,38,38,0.08)',
                        borderColor: dark ? 'rgba(252,165,165,0.25)' : 'rgba(220,38,38,0.18)',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: 'Poppins-SemiBold',
                        color: dark ? '#fca5a5' : '#dc2626',
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('common.inactive', 'Deactivated')}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  marginTop: 4,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {member.email} · {scopeText}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function TempPasswordModal({ info, onClose, tokens, t }) {
  const { sheetBg, textColor, mutedColor, borderColor } = tokens;
  if (!info) return null;
  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: sheetBg,
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontFamily: 'Poppins-SemiBold', color: textColor, flex: 1 }}>
              {t('settings.tempPasswordTitle', 'Temporary password')}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={mutedColor} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: mutedColor }}>
            {t('settings.tempPasswordDesc', 'Share this securely with the team member.')}
          </Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 11, color: mutedColor, fontFamily: 'Poppins-Regular' }}>
              {info.name}
            </Text>
            <Text style={{ fontSize: 11, color: mutedColor, fontFamily: 'Poppins-Regular' }}>
              {info.email}
            </Text>
          </View>
          <View
            style={{
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor,
            }}
          >
            <Text
              style={{
                fontFamily: 'Menlo',
                fontSize: 14,
                color: textColor,
              }}
              selectable
            >
              {info.password}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: mutedColor, fontFamily: 'Poppins-Regular' }}>
            {t(
              'settings.tempPasswordWarning',
              'Long-press to copy. This password will only be shown once. The user must change it on first login.'
            )}
          </Text>
          <Button onPress={onClose}>
            <Text style={{ fontFamily: 'Poppins-SemiBold', color: '#ffffff' }}>
              {t('common.confirm', 'Done')}
            </Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const rowStyles = StyleSheet.create({
  rowInner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionLabel: {
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    marginTop: 4,
  },
});
