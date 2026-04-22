import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronRight, Warehouse } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  ACCOUNT_ROLES as ALL_ROLES,
  MODULE_CAPABILITIES,
  actionsForRole,
  actionMatches,
} from '@poultrymanager/shared';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { FormSection, FormField } from '@/components/FormSheetParts';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const ASSIGNABLE_ROLES = ALL_ROLES.filter((r) => r !== 'owner');

const ROLE_HELP = {
  manager: 'Full access to operations across the workspace.',
  veterinarian: 'Read batches, log weights and environment.',
  accountant: 'Read batches, full access to sales/expenses/feed orders.',
  ground_staff: 'Records daily logs for assigned farms.',
  viewer: 'Read-only access across all data.',
};

/**
 * Page 2 of the team invite/edit flow on mobile. Mirrors the web
 * InviteUserDialog "Access" step: role picker -> conditional farm
 * scope picker -> collapsed advanced permissions.
 *
 * Pure UI, no I/O. Parent owns state and submission.
 *
 * Props:
 *   accountRole       - selected role
 *   onAccountRole     - (role) => void
 *   farmAssignments   - string[] of farm ids
 *   onFarmAssignments - (next) => void
 *   permissions       - { allow: string[], deny: string[] }
 *   onPermissions     - (next) => void
 *   userModules       - module ids active for the owner
 */
export default function InviteAccessSheet({
  accountRole,
  onAccountRole,
  farmAssignments,
  onFarmAssignments,
  permissions,
  onPermissions,
  userModules = [],
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { mutedColor, textColor, accentColor, borderColor, dark } = tokens;

  const [farms] = useLocalQuery('farms');

  const roleOptions = useMemo(
    () =>
      ASSIGNABLE_ROLES.map((r) => ({
        value: r,
        label: t(`settings.roles.${r}`, r),
      })),
    [t]
  );

  // Auto-show scope picker only when the picked role's capability list
  // includes a :assigned-suffixed action (i.e. the role actually scopes
  // by assignment). Otherwise the role sees everything by default.
  const roleNeedsScope = useMemo(() => {
    for (const moduleId of userModules) {
      const caps = MODULE_CAPABILITIES[moduleId];
      const list = caps?.[accountRole] || [];
      if (list.some((a) => a.endsWith(':assigned'))) return true;
    }
    return false;
  }, [accountRole, userModules]);

  const selectedFarms = new Set((farmAssignments || []).map(String));

  const toggleFarm = (farmId) => {
    Haptics.selectionAsync().catch(() => {});
    const id = String(farmId);
    const next = new Set(selectedFarms);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onFarmAssignments(Array.from(next));
  };

  return (
    <View style={{ gap: 16 }}>
      <FormSection title={t('settings.accountRole', 'Role')}>
        <EnumButtonSelect
          options={roleOptions}
          value={accountRole}
          onChange={onAccountRole}
          columns={2}
        />
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            marginTop: 8,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {t(`settings.roleHelp.${accountRole}`, ROLE_HELP[accountRole] || '')}
        </Text>
      </FormSection>

      {roleNeedsScope ? (
        <FormSection
          title={t('settings.assignedFarms', 'Assigned farms')}
          description={t(
            'settings.assignedFarmsDesc',
            'This role only sees data for farms you assign here.'
          )}
          padded={false}
          style={{ padding: 12, gap: 12 }}
        >
          {farms.length === 0 ? (
            <View
              style={{
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor,
                alignItems: 'center',
              }}
            >
              <Warehouse size={20} color={mutedColor} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  marginTop: 8,
                }}
              >
                {t('settings.scopeNoFarmsTitle', 'No farms yet')}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {t(
                  'settings.scopeNoFarmsDesc',
                  'Create farms first; you can assign them once they exist.'
                )}
              </Text>
            </View>
          ) : (
            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor,
                overflow: 'hidden',
                backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'hsl(148, 22%, 96%)',
              }}
            >
              {farms.map((farm, idx) => {
                const isLast = idx === farms.length - 1;
                const checked = selectedFarms.has(String(farm._id));
                return (
                  <FarmRow
                    key={farm._id}
                    farm={farm}
                    checked={checked}
                    isLast={isLast}
                    onToggle={() => toggleFarm(farm._id)}
                    tokens={tokens}
                    isRTL={isRTL}
                  />
                );
              })}
            </View>
          )}
        </FormSection>
      ) : (
        <FormSection
          title={t('settings.scopeUnscoped', 'Scope')}
          padded={false}
          style={{ padding: 12 }}
        >
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              textAlign: textAlignStart(isRTL),
            }}
          >
            {t(
              'settings.unscopedRoleNote',
              'This role sees all farms and houses by default. No farm assignment needed.'
            )}
          </Text>
        </FormSection>
      )}

      <AdvancedPermissions
        role={accountRole}
        userModules={userModules}
        permissions={permissions}
        onChange={onPermissions}
        tokens={tokens}
      />
    </View>
  );
}

function FarmRow({ farm, checked, isLast, onToggle, tokens, isRTL }) {
  const { textColor, accentColor, mutedColor, dark, borderColor } = tokens;
  return (
    <Pressable
      onPress={onToggle}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        farmRowStyles.row,
        {
          flexDirection: rowDirection(isRTL),
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: borderColor,
          backgroundColor: pressed
            ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
            : 'transparent',
        },
      ]}
    >
      <View
        style={[
          farmRowStyles.checkbox,
          {
            backgroundColor: checked ? accentColor : 'transparent',
            borderColor: checked ? accentColor : (dark ? 'hsl(150, 14%, 32%)' : 'hsl(148, 14%, 78%)'),
          },
        ]}
      >
        {checked ? <Check size={12} color="#ffffff" strokeWidth={3} /> : null}
      </View>
      <View
        style={[
          farmRowStyles.iconTile,
          {
            backgroundColor: checked
              ? (dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)')
              : (dark ? 'rgba(255,255,255,0.05)' : 'hsl(148, 18%, 95%)'),
          },
        ]}
      >
        <Warehouse size={14} color={checked ? accentColor : mutedColor} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: checked ? 'Poppins-SemiBold' : 'Poppins-Medium',
            color: textColor,
            textAlign: textAlignStart(isRTL),
          }}
          numberOfLines={1}
        >
          {farm.farmName}
        </Text>
        {farm.nickname ? (
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              textAlign: textAlignStart(isRTL),
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {farm.nickname}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function AdvancedPermissions({ role, userModules, permissions, onChange, tokens }) {
  const { t } = useTranslation();
  const { mutedColor, textColor, borderColor, dark } = tokens;
  const [open, setOpen] = useState(false);

  const allow = new Set(permissions?.allow || []);
  const deny = new Set(permissions?.deny || []);

  const sections = useMemo(() => {
    const out = [];
    for (const moduleId of userModules) {
      const caps = MODULE_CAPABILITIES[moduleId];
      const list = caps?.[role] || [];
      if (list.length === 0) continue;
      out.push({ moduleId, actions: list });
    }
    return out;
  }, [userModules, role]);

  const coreActions = useMemo(() => actionsForRole(role), [role]);

  const isGrantedByRole = (action) => {
    for (const granted of coreActions) if (actionMatches(granted, action)) return true;
    for (const section of sections) {
      for (const granted of section.actions) if (actionMatches(granted, action)) return true;
    }
    return false;
  };

  const setAllow = (action, on) => {
    const next = new Set(allow);
    if (on) next.add(action);
    else next.delete(action);
    onChange({ allow: Array.from(next), deny: Array.from(deny) });
  };
  const setDeny = (action, on) => {
    const next = new Set(deny);
    if (on) next.add(action);
    else next.delete(action);
    onChange({ allow: Array.from(allow), deny: Array.from(next) });
  };

  if (sections.length === 0) return null;

  return (
    <FormSection
      padded={false}
      style={{ padding: 0 }}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
            }}
          >
            {t('settings.advancedPermissions', 'Advanced permissions')}
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
              'settings.advancedPermissionsDesc',
              'Override the role defaults with per-action allow/deny.'
            )}
          </Text>
        </View>
        {open ? (
          <ChevronDown size={16} color={mutedColor} />
        ) : (
          <ChevronRight size={16} color={mutedColor} />
        )}
      </Pressable>

      {open ? (
        <ScrollView
          style={{ maxHeight: 280 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {sections.map((section, sIdx) => (
            <View
              key={section.moduleId}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: borderColor,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: 'Poppins-SemiBold',
                  color: mutedColor,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                {section.moduleId}
              </Text>
              {section.actions.map((action) => (
                <View
                  key={action}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 6,
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontFamily: 'Menlo',
                      color: textColor,
                    }}
                    numberOfLines={1}
                  >
                    {action}
                  </Text>
                  <PermPill
                    label="allow"
                    on={allow.has(action) || isGrantedByRole(action)}
                    locked={isGrantedByRole(action)}
                    onPress={() => setAllow(action, !allow.has(action))}
                    tokens={tokens}
                  />
                  <PermPill
                    label="deny"
                    on={deny.has(action)}
                    onPress={() => setDeny(action, !deny.has(action))}
                    tokens={tokens}
                    destructive
                  />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </FormSection>
  );
}

function PermPill({ label, on, locked = false, destructive = false, onPress, tokens }) {
  const { dark, accentColor, mutedColor, errorColor, textColor } = tokens;
  const activeBg = destructive
    ? (dark ? 'rgba(252,165,165,0.18)' : 'rgba(220,38,38,0.10)')
    : (dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)');
  const activeColor = destructive ? errorColor : accentColor;
  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? activeColor : (dark ? 'rgba(255,255,255,0.10)' : 'hsl(148, 14%, 88%)'),
        backgroundColor: on ? activeBg : 'transparent',
        opacity: locked ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'Poppins-SemiBold',
          color: on ? activeColor : mutedColor,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const farmRowStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
