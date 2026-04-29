import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Warehouse } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Multi-select list of farms used wherever role-scoped users (ground staff,
 * workers, etc.) are assigned access. Used by InviteUserSheet,
 * TeamMemberSheet and WorkerSheet so the experience is identical wherever
 * you assign farm access.
 *
 * Layout per row, leading→trailing in the locale's reading direction:
 *   [warehouse icon tile] [farm name + nickname (flex)] [check indicator]
 *
 * Selected rows get a tinted background so the picker reads as a list of
 * "on / off" cards rather than a dense checklist. The header above the
 * list shows the selected count and a Select-all / Clear toggle so an
 * owner with many farms can opt in/out in one tap.
 *
 * NOTE: the layout View inside Pressable must use a hard-coded
 * `flexDirection: rowDirection(isRTL)` from a regular object style. An
 * earlier version put the row layout on the Pressable itself via a
 * function-style `style={({pressed}) => [...]}` prop; in that form the
 * inline flexDirection was getting dropped on iOS and every row rendered
 * as a vertical stack of icons + text. Keeping layout on a child View
 * sidesteps that quirk.
 *
 * Props:
 *   farms    - Farm[] (must have _id, farmName, optional nickname)
 *   value    - string[] of farm ids currently assigned
 *   onChange - (next: string[]) => void
 */
export default function FarmAssignmentList({ farms, value, onChange }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { mutedColor, textColor, accentColor, borderColor, dark } = tokens;

  const selected = useMemo(
    () => new Set((value || []).map(String)),
    [value]
  );
  const allSelected = farms.length > 0 && selected.size === farms.length;

  const toggle = (id) => {
    Haptics.selectionAsync().catch(() => {});
    const key = String(id);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  const toggleAll = () => {
    Haptics.selectionAsync().catch(() => {});
    onChange(allSelected ? [] : farms.map((f) => String(f._id)));
  };

  if (farms.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            borderColor,
            backgroundColor: dark
              ? 'rgba(255,255,255,0.03)'
              : 'hsl(148, 22%, 96%)',
          },
        ]}
      >
        <Warehouse size={20} color={mutedColor} />
        <Text style={[styles.emptyTitle, { color: textColor }]}>
          {t('settings.scopeNoFarmsTitle', 'No farms yet')}
        </Text>
        <Text style={[styles.emptyDesc, { color: mutedColor }]}>
          {t(
            'settings.scopeNoFarmsDesc',
            'Create farms first; you can assign them once they exist.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: rowDirection(isRTL),
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Medium',
            color: mutedColor,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {selected.size === 0
            ? t('settings.farmsNoneSelected', 'None selected')
            : t(
                'settings.farmsSelectedCount',
                '{{count}} of {{total}} selected',
                { count: selected.size, total: farms.length }
              )}
        </Text>
        <Pressable onPress={toggleAll} hitSlop={10}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-SemiBold',
              color: accentColor,
            }}
          >
            {allSelected
              ? t('common.clearAll', 'Clear all')
              : t('common.selectAll', 'Select all')}
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.list,
          {
            borderColor,
            backgroundColor: dark
              ? 'rgba(255,255,255,0.03)'
              : 'hsl(148, 22%, 97%)',
          },
        ]}
      >
        {farms.map((farm, idx) => (
          <FarmRow
            key={farm._id}
            farm={farm}
            checked={selected.has(String(farm._id))}
            isLast={idx === farms.length - 1}
            onToggle={() => toggle(farm._id)}
            tokens={tokens}
            isRTL={isRTL}
          />
        ))}
      </View>
    </View>
  );
}

function FarmRow({ farm, checked, isLast, onToggle, tokens, isRTL }) {
  const { textColor, accentColor, mutedColor, dark, borderColor } = tokens;
  const tintedBg = checked
    ? dark
      ? 'rgba(148,210,165,0.10)'
      : 'hsl(148, 38%, 96%)'
    : 'transparent';
  return (
    <Pressable
      onPress={onToggle}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: rowDirection(isRTL),
            alignItems: 'center',
            gap: 12,
            width: '100%',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: borderColor,
            backgroundColor: pressed
              ? dark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)'
              : tintedBg,
          }}
        >
          <View
            style={[
              styles.iconTile,
              {
                backgroundColor: checked
                  ? dark
                    ? 'rgba(148,210,165,0.18)'
                    : 'hsl(148, 35%, 92%)'
                  : dark
                    ? 'rgba(255,255,255,0.05)'
                    : 'hsl(148, 18%, 95%)',
              },
            ]}
          >
            <Warehouse
              size={16}
              color={checked ? accentColor : mutedColor}
              strokeWidth={2.2}
            />
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
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: checked ? accentColor : 'transparent',
                borderColor: checked
                  ? accentColor
                  : dark
                    ? 'hsl(150, 14%, 32%)'
                    : 'hsl(148, 14%, 78%)',
              },
            ]}
          >
            {checked ? <Check size={13} color="#ffffff" strokeWidth={3} /> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
});
