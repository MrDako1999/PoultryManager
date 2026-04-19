import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Languages, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useLocaleStore, { SUPPORTED_LANGUAGES } from '@/stores/localeStore';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import BottomPickerSheet from '@/components/BottomPickerSheet';
import FlagTile, { getFlagComponent } from '@/components/flags';

/**
 * Shared language picker sheet. Owns the option mapping, the live language
 * value, and the call to `useLocaleStore.setLanguage`. Exposes an imperative
 * `open()` / `close()` API so it can sit behind any trigger — the auth pill,
 * a settings row, a menu item, etc. — while keeping a single source of truth
 * for the picker's UX (flags, search, RTL-safe rows).
 */
export const LanguagePickerSheet = forwardRef(function LanguagePickerSheet(_props, ref) {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const { dark, accentColor, textColor, mutedColor } = tokens;
  const language = useLocaleStore((s) => s.language);
  const setLanguage = useLocaleStore((s) => s.setLanguage);
  const sheetRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.open(),
      close: () => sheetRef.current?.close(),
    }),
    []
  );

  const options = useMemo(
    () =>
      SUPPORTED_LANGUAGES.map((lang) => ({
        value: lang.code,
        label: lang.native,
        native: lang.native,
        code: lang.code,
        latinLabel: lang.label,
        rtl: lang.rtl,
        description: lang.label,
      })),
    []
  );

  const onValueChange = async (code) => {
    if (!code || code === language) return;
    await setLanguage(code);
  };

  return (
    <BottomPickerSheet
      ref={sheetRef}
      icon={Languages}
      title={t('settings.languageTitle', 'Language')}
      subtitle={t('settings.languageSubtitle', 'Choose the app language')}
      forceSearchable
      searchPlaceholder={t('settings.languageSearchPlaceholder', 'Search language…')}
      searchFields={['label', 'native', 'code', 'latinLabel', 'description']}
      sheetHeightFraction={0.85}
      options={options}
      value={language}
      onValueChange={onValueChange}
      renderItem={({ item, isSelected, onPress }) => (
        <LanguageRow
          item={item}
          isSelected={isSelected}
          onPress={onPress}
          dark={dark}
          accentColor={accentColor}
          textColor={textColor}
          mutedColor={mutedColor}
        />
      )}
    />
  );
});

/**
 * Language selector. Two visual variants for the trigger pill:
 *
 * - `variant="hero"` (default): translucent white pill suitable for sitting on
 *   the gradient hero toolbar.
 * - `variant="sheet"`: token-driven pill suitable for a settings sheet.
 *
 * Tapping the trigger opens a `LanguagePickerSheet` (the same primitive the
 * settings row uses) — searchable, swipeable, RTL-safe, with the icon-tile +
 * title + subtitle header from the design language.
 */
export default function LanguageSelector({ variant = 'hero', compact = true }) {
  const tokens = useHeroSheetTokens();
  const { dark, textColor, mutedColor, sectionBg, borderColor } = tokens;
  const language = useLocaleStore((s) => s.language);
  const sheetRef = useRef(null);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const isHero = variant === 'hero';

  const triggerStyle = isHero
    ? {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }
    : {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: sectionBg,
        borderWidth: dark ? 1 : 0,
        borderColor,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
      };

  const triggerLabelColor = isHero ? '#ffffff' : textColor;
  const triggerIconColor = isHero ? '#ffffff' : mutedColor;
  const hasFlag = !!getFlagComponent(current.code);

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          sheetRef.current?.open();
        }}
        hitSlop={6}
        style={triggerStyle}
      >
        {hasFlag ? (
          <FlagTile code={current.code} size={16} />
        ) : (
          <Languages size={14} color={triggerIconColor} strokeWidth={2.2} />
        )}
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-SemiBold',
            color: triggerLabelColor,
            letterSpacing: 0.2,
          }}
        >
          {compact ? current.code.toUpperCase() : current.native}
        </Text>
      </Pressable>

      <LanguagePickerSheet ref={sheetRef} />
    </>
  );
}

/**
 * Single language row. Layout uses StyleSheet + an inner row View because
 * NativeWind's css-interop has been observed to drop `flexDirection` from
 * functional Pressable styles, causing rows to stack vertically. By keeping
 * the row layout on a plain View, we sidestep the bug entirely.
 */
function LanguageRow({ item, isSelected, onPress, dark, accentColor, textColor, mutedColor }) {
  const flagAvailable = !!getFlagComponent(item.code);
  const bg = isSelected
    ? (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)')
    : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      style={[rowStyles.outer, { backgroundColor: bg }]}
    >
      <View style={rowStyles.row}>
        {/* Leading: flag tile (preferred) or letter-code fallback. All tiles
            share a uniform 42×28 footprint so the column is perfectly aligned
            regardless of each flag's native aspect ratio. */}
        <View style={rowStyles.leading}>
          {flagAvailable ? (
            <FlagTile code={item.code} size={28} width={42} radius={6} />
          ) : (
            <View
              style={{
                width: 42,
                height: 28,
                borderRadius: 6,
                backgroundColor: isSelected
                  ? (dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)')
                  : (dark ? 'rgba(255,255,255,0.06)' : 'hsl(148, 14%, 95%)'),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins-Bold',
                  fontSize: 11,
                  color: isSelected ? accentColor : mutedColor,
                  letterSpacing: 0.4,
                }}
              >
                {item.code.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Title + description */}
        <View style={rowStyles.textCol}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
            }}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {item.description ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {item.description}
            </Text>
          ) : null}
        </View>

        {/* Trailing check disc */}
        {isSelected ? (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: accentColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={15} color="#ffffff" strokeWidth={3} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 14,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
});
