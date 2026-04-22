import { useRef, useEffect, useState, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const PADDING = 6;
const GAP = 6;

/**
 * Segmented control with a spring-driven sliding pill + cross-fading accent
 * labels (same motion recipe as Appearance in Settings).
 *
 * @param {string} value — selected `option.value`
 * @param {(next: string) => void} onChange
 * @param {{ value: string, label: string, icon?: import('react').ComponentType<{ size?: number, color?: string, strokeWidth?: number }> }[]} options
 * @param {boolean} [bordered=true] — dashboard-style card; `false` when nested in `SheetSection`
 */
export default function SlidingSegmentedControl(props) {
  if (!props.options?.length) return null;
  return <SlidingSegmentedControlImpl {...props} />;
}

function SlidingSegmentedControlImpl({
  value,
  onChange,
  options,
  bordered = true,
}) {
  const { dark, accentColor, mutedColor, sectionBg, borderColor } = useHeroSheetTokens();
  const isRTL = useIsRTL();

  // The control's pill is absolutely positioned with `left: 0` and a
  // `translateX` driven by an Animated.Value. Both `left` and Yoga's
  // `flexDirection: 'row'` get auto-flipped by iOS when
  // `I18nManager.isRTL === true` — and since our store can flip the
  // locale to LTR (English) without the platform RTL flag catching up
  // until next cold-start, we end up with: `left: 0` flipping to
  // `right: 0` (so the pill starts at the wrong edge), and `'row'`
  // flipping to right-to-left (so the segments render reversed). The
  // user sees the active pill drift off the right edge as they pick a
  // higher-index option, plus the icons end up on the wrong side.
  //
  // Pinning the entire track to a `direction` derived from the locale
  // (not the platform flag) makes Yoga ignore the auto-flip — every
  // child below this wrapper lays out per the locale, period.
  const layoutDirection = isRTL ? 'rtl' : 'ltr';

  // Reverse the source order in RTL so the pill's `translateX(idx *
  // segmentWidth)` (LTR coordinate space inside the locked direction)
  // still lands on the visually-correct option for the current `value`.
  // Without this the pill would think index 0 is the leftmost cell
  // even though the user reads the rightmost one as the "first" option.
  const renderOptions = useMemo(
    () => (isRTL ? [...options].reverse() : options),
    [options, isRTL]
  );

  const [containerWidth, setContainerWidth] = useState(0);
  const innerWidth = Math.max(0, containerWidth - PADDING * 2);
  const segmentWidth = innerWidth > 0
    ? (innerWidth - GAP * (renderOptions.length - 1)) / renderOptions.length
    : 0;

  const indexFor = (v) => {
    const i = renderOptions.findIndex((o) => o.value === v);
    return i < 0 ? 0 : i;
  };

  const slidePos = useRef(new Animated.Value(indexFor(value))).current;
  const measured = useRef(false);

  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = indexFor(value);
    if (!measured.current) {
      slidePos.setValue(target);
      measured.current = true;
      return;
    }
    Animated.spring(slidePos, {
      toValue: target,
      tension: 110,
      friction: 14,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, segmentWidth]);

  const pillTranslateX = slidePos.interpolate({
    inputRange: renderOptions.map((_, i) => i),
    outputRange: renderOptions.map((_, i) => i * (segmentWidth + GAP)),
  });

  const pillBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  const track = (
    <View
      // Lock the layout direction to the locale (see comment on
      // `layoutDirection` above) — without this, native RTL state
      // drift makes the pill auto-flip to the wrong edge and the
      // segments render in reversed order.
      style={{ padding: PADDING, direction: layoutDirection }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ position: 'relative' }}>
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: segmentWidth,
              borderRadius: 12,
              backgroundColor: pillBg,
              borderWidth: 1,
              borderColor: accentColor,
              transform: [{ translateX: pillTranslateX }],
            }}
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: GAP }}>
          {renderOptions.map((opt, i) => {
            const Icon = opt.icon;
            const accentOpacity = slidePos.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  if (opt.value === value) return;
                  Haptics.selectionAsync().catch(() => {});
                  onChange(opt.value);
                }}
                style={{ flex: 1 }}
                hitSlop={4}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Icon ? 6 : 0,
                    paddingVertical: 11,
                  }}
                >
                  {Icon ? (
                    <Icon size={15} color={mutedColor} strokeWidth={2.2} />
                  ) : null}
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Medium',
                      color: mutedColor,
                    }}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: Icon ? 6 : 0,
                      opacity: accentOpacity,
                    }}
                  >
                    {Icon ? (
                      <Icon size={15} color={accentColor} strokeWidth={2.2} />
                    ) : null}
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Poppins-Medium',
                        color: accentColor,
                      }}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                  </Animated.View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  if (!bordered) {
    return track;
  }

  return (
    <View
      style={{
        backgroundColor: sectionBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor,
        overflow: 'hidden',
        ...(dark
          ? {}
          : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 1,
            }),
      }}
    >
      {track}
    </View>
  );
}
