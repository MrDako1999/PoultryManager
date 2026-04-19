import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, X, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import BottomPickerSheet from '@/components/BottomPickerSheet';

/**
 * Form-grade Select. Thin wrapper over `BottomPickerSheet` that adds:
 *   - The default form-style trigger Pressable (border + chevron + label)
 *   - `onCreateNew` "Add New" header pill + empty-state CTA
 *   - `clearable` Clear pill (header) + inline clear X (trigger)
 *   - `renderTrigger` escape hatch for callers that paint their own trigger
 *
 * 100% backward-compatible with the previous Select API.
 */
function Select({
  value,
  onValueChange,
  options = [],
  placeholder = 'Select...',
  label,
  onCreateNew,
  createNewLabel,
  searchable = true,
  onOpen,
  clearable = false,
  renderTrigger,
  sheetHeightFraction = 0.65,
  forceSearchable = false,
  renderItem,
  searchPlaceholder,
}, ref) {
  const sheetRef = useRef(null);
  const [search, setSearch] = useState('');
  const tokens = useHeroSheetTokens();
  const {
    dark, accentColor, textColor, mutedColor, iconColor,
    inputBg, inputBorderIdle,
  } = tokens;
  const isRTL = useIsRTL();
  const selected = options.find((o) => o.value === value);

  const openSheet = useCallback(() => {
    sheetRef.current?.open();
  }, []);

  const closeSheet = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  useImperativeHandle(ref, () => ({ open: openSheet, close: closeSheet }), [openSheet, closeSheet]);

  const handleClear = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onValueChange(null);
  }, [onValueChange]);

  const showInlineClear = clearable && !!selected;

  // Compact form-grade trigger. Layout (flexDirection, border, height) lives
  // in StyleSheet + on a plain inner <View>; the Pressable's style is a
  // STATIC array so NativeWind's css-interop can't strip layout from it.
  // See DESIGN_LANGUAGE.md §9 "NativeWind / Pressable functional-style trap".
  const trigger = renderTrigger === null
    ? null
    : renderTrigger
      ? renderTrigger({ open: openSheet, selected, placeholder })
      : (
        <Pressable
          onPress={openSheet}
          android_ripple={{
            color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderless: false,
          }}
          style={[
            triggerStyles.outer,
            { backgroundColor: inputBg, borderColor: inputBorderIdle },
          ]}
        >
          <View
            style={[
              triggerStyles.row,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: selected ? textColor : mutedColor,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
              numberOfLines={1}
            >
              {selected?.label || placeholder}
            </Text>
            {showInlineClear ? (
              <Pressable
                onPress={handleClear}
                hitSlop={10}
                style={triggerStyles.inlineClear}
              >
                <X size={14} color={mutedColor} strokeWidth={2.4} />
              </Pressable>
            ) : (
              <ChevronDown size={16} color={iconColor} strokeWidth={2.2} />
            )}
          </View>
        </Pressable>
      );

  // Header-right pills carried over from the legacy header (Clear + Add New).
  const headerRight = (clearable && selected) || onCreateNew ? (
    <>
      {clearable && selected ? (
        <Pressable
          onPress={() => { handleClear(); closeSheet(); }}
          hitSlop={8}
          style={({ pressed }) => [
            triggerStyles.headerPill,
            {
              backgroundColor: pressed
                ? (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')
                : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontFamily: 'Poppins-SemiBold',
              color: mutedColor,
              letterSpacing: 0.1,
            }}
          >
            Clear
          </Text>
        </Pressable>
      ) : null}
      {onCreateNew ? (
        <Pressable
          onPress={() => {
            const s = search;
            closeSheet();
            setTimeout(() => onCreateNew(s), 250);
          }}
          hitSlop={8}
          style={({ pressed }) => [
            triggerStyles.headerPillIcon,
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              backgroundColor: pressed
                ? (dark ? 'rgba(148,210,165,0.22)' : 'hsl(148, 35%, 88%)')
                : (dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 94%)'),
            },
          ]}
        >
          <Plus size={14} color={accentColor} strokeWidth={2.4} />
          <Text
            style={{
              fontSize: 12.5,
              fontFamily: 'Poppins-SemiBold',
              color: accentColor,
              letterSpacing: 0.1,
            }}
          >
            {createNewLabel || 'Add New'}
          </Text>
        </Pressable>
      ) : null}
    </>
  ) : null;

  // Custom empty state — preserves the legacy "Create …" CTA.
  const emptyState = onCreateNew && search.trim() ? (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        gap: 12,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontFamily: 'Poppins-Regular',
          color: mutedColor,
          textAlign: 'center',
        }}
      >
        No results for &ldquo;{search}&rdquo;
      </Text>
      <Pressable
        onPress={() => {
          const s = search;
          closeSheet();
          setTimeout(() => onCreateNew(s), 250);
        }}
        style={({ pressed }) => [
          triggerStyles.createCta,
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            borderColor: accentColor,
            backgroundColor: pressed
              ? (dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)')
              : (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)'),
          },
        ]}
      >
        <Plus size={15} color={accentColor} strokeWidth={2.4} />
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-SemiBold',
            color: accentColor,
            letterSpacing: 0.1,
          }}
        >
          Create &ldquo;{search}&rdquo;
        </Text>
      </Pressable>
    </View>
  ) : undefined;

  return (
    <>
      {trigger}

      <BottomPickerSheet
        ref={sheetRef}
        title={label || placeholder}
        searchable={searchable}
        forceSearchable={forceSearchable}
        searchPlaceholder={searchPlaceholder}
        sheetHeightFraction={sheetHeightFraction}
        options={options}
        value={value}
        onValueChange={onValueChange}
        renderItem={renderItem}
        onOpen={() => {
          setSearch('');
          onOpen?.();
        }}
        // Track the live search value so onCreateNew + emptyState can use it.
        // We do this by overriding renderItem-on-empty via the emptyState prop;
        // for the search value itself we read it from the sheet via a small
        // mirror handler exposed through onSearchChange (added below).
        onSearchChange={setSearch}
        headerRight={headerRight}
        emptyState={emptyState}
      />
    </>
  );
}

export default forwardRef(Select);

// Layout / borders / height live in StyleSheet because NativeWind's
// css-interop silently strips them out of Pressable's functional
// `style={({ pressed }) => ({...})}` form. Theme colours go on a static
// style array on top. See DESIGN_LANGUAGE.md §9.
const triggerStyles = StyleSheet.create({
  outer: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    gap: 8,
  },
  inlineClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  headerPillIcon: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  createCta: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
