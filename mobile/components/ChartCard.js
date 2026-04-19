import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import SheetSection from '@/components/SheetSection';

/**
 * ChartCard — design-language wrapper around chart bodies.
 *
 * SheetSection (uppercase eyebrow above) wrapping an elevated card body
 * that holds an optional title row, optional second-row segmented control,
 * and the chart children. Tokens-only, RTL-safe.
 *
 * Layout in StyleSheet (§9). Press visuals only on the segmented pills.
 */
export default function ChartCard({
  title,
  subtitle,
  segments,
  segmentValue,
  onSegmentChange,
  segmentsRow2,
  segmentValue2,
  onSegmentChange2,
  sectionTitle,
  sectionIcon,
  children,
}) {
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    elevatedCardBg, elevatedCardBorder, textColor, mutedColor, dark,
  } = tokens;

  const Body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevatedCardBg,
          borderColor: elevatedCardBorder,
        },
      ]}
    >
      <View
        style={[
          styles.headerRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View style={styles.headerTextCol}>
          {title ? (
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 2,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {segments ? (
          <MiniSegmented
            options={segments}
            value={segmentValue}
            onChange={onSegmentChange}
            tokens={tokens}
            isRTL={isRTL}
          />
        ) : null}
      </View>

      {segmentsRow2 ? (
        <View
          style={[
            styles.row2,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <MiniSegmented
            options={segmentsRow2}
            value={segmentValue2}
            onChange={onSegmentChange2}
            tokens={tokens}
            isRTL={isRTL}
          />
        </View>
      ) : null}

      {children}
    </View>
  );

  if (sectionTitle) {
    return (
      <SheetSection title={sectionTitle} icon={sectionIcon} padded={false}>
        {Body}
      </SheetSection>
    );
  }
  return Body;
}

function MiniSegmented({ options, value, onChange, tokens, isRTL }) {
  const {
    accentColor, mutedColor, textColor, dark, sectionBg,
  } = tokens;
  return (
    <View
      style={[
        miniStyles.shell,
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)',
        },
      ]}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange?.(opt.value);
            }}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderless: false,
            }}
            style={[
              miniStyles.pill,
              {
                flexDirection: isRTL ? 'row-reverse' : 'row',
                backgroundColor: active ? sectionBg : 'transparent',
                ...(active && !dark
                  ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.06,
                      shadowRadius: 3,
                      elevation: 1,
                    }
                  : {}),
              },
            ]}
            hitSlop={4}
          >
            {Icon ? (
              <Icon
                size={12}
                color={active ? accentColor : mutedColor}
                strokeWidth={2.4}
              />
            ) : null}
            {opt.label ? (
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: active ? accentColor : mutedColor,
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  row2: {
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
});

const miniStyles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  pill: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 28,
  },
});
