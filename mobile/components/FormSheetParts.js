import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Grouped section inside FormSheet body. Visually identical to SheetSection
 * but always full-width with the FormSheet's standard 20pt horizontal margin.
 *
 * @param {object} props
 * @param {string} [props.title] - Optional uppercase eyebrow above the card
 * @param {Component} [props.icon] - Lucide icon for the eyebrow
 * @param {ReactNode} [props.headerRight] - Element rendered at the end of the eyebrow row (e.g. "Add" link)
 * @param {string} [props.description] - Helper text under the card
 * @param {boolean} [props.padded=true] - Adds inner padding when true
 * @param {object} [props.style] - Style override for the card body
 * @param {object} [props.containerStyle] - Style override for the outer wrapper
 */
export function FormSection({
  title,
  icon: Icon,
  headerRight,
  description,
  padded = true,
  style,
  containerStyle,
  children,
}) {
  const { sectionBg, sectionBorder, mutedColor, dark } = useHeroSheetTokens();
  const isRTL = useIsRTL();

  return (
    <View style={[styles.sectionWrap, containerStyle]}>
      {(title || headerRight) ? (
        <View
          style={[
            styles.eyebrowRow,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <View
            style={[
              styles.eyebrowLabelRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            {Icon ? <Icon size={13} color={mutedColor} /> : null}
            {title ? (
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
                {title}
              </Text>
            ) : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: sectionBg,
            borderColor: sectionBorder,
            borderWidth: 1,
          },
          dark ? null : styles.sectionShadow,
          padded ? { padding: 16, gap: 14 } : null,
          style,
        ]}
      >
        {children}
      </View>
      {description ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            marginTop: 8,
            marginLeft: 6,
            lineHeight: 17,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Field wrapper - label above, content below, optional error message.
 * Only used for fields that don't already render their own label/error
 * (e.g. our internal Select / EnumButtonSelect / DatePicker pickers).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} [props.required]
 * @param {string} [props.error]
 * @param {string} [props.hint]
 */
export function FormField({ label, required, error, hint, children }) {
  const { textColor, mutedColor, errorColor } = useHeroSheetTokens();
  const isRTL = useIsRTL();

  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <View
          style={[
            styles.labelRow,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Medium',
              color: textColor,
              textAlign: textAlignStart(isRTL),
            }}
          >
            {label}
            {required ? (
              <Text style={{ color: errorColor }}> *</Text>
            ) : null}
          </Text>
        </View>
      ) : null}
      {children}
      {error ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: errorColor,
            marginHorizontal: 4,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            marginHorizontal: 4,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Subsection title inside a section (e.g. "UAE Residency" / "Live Sale - By Piece")
 */
export function FormSubheader({ children }) {
  const { mutedColor } = useHeroSheetTokens();
  const isRTL = useIsRTL();
  return (
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
      {children}
    </Text>
  );
}

/**
 * SummaryRow - label/value pair used inside SummaryCard. RTL-safe.
 */
export function SummaryRow({ label, value, emphasis = false, negative = false }) {
  const { textColor, mutedColor, errorColor } = useHeroSheetTokens();
  const isRTL = useIsRTL();
  return (
    <View
      style={[
        styles.summaryRow,
        { flexDirection: rowDirection(isRTL) },
      ]}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: emphasis ? 'Poppins-SemiBold' : 'Poppins-Regular',
          color: emphasis ? textColor : mutedColor,
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: emphasis ? 14 : 13,
          fontFamily: emphasis ? 'Poppins-Bold' : 'Poppins-Medium',
          color: negative ? errorColor : textColor,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * SummaryCard - tinted card used inside fields (e.g. expense breakdown,
 * sale grand total). Rounder, lighter than FormSection.
 */
export function SummaryCard({ children, style }) {
  const { dark } = useHeroSheetTokens();
  const tintBg = dark ? 'rgba(148,210,165,0.08)' : 'hsl(148, 22%, 95%)';
  const tintBorder = dark ? 'hsl(150, 12%, 28%)' : 'hsl(148, 16%, 86%)';
  return (
    <View
      style={[
        {
          backgroundColor: tintBg,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tintBorder,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Hairline divider used inside cards / between subsections.
 */
export function CardDivider({ marginVertical = 4 }) {
  const { borderColor } = useHeroSheetTokens();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: borderColor,
        marginVertical,
      }}
    />
  );
}

/**
 * AddRowButton - subtle "+ Add row" pressable used inside dynamic-list
 * sections (FeedOrderSheet line items, SaleOrderSheet weight items, etc.).
 */
export function AddRowButton({ label, onPress, icon: Icon }) {
  const { accentColor, dark } = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  };
  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.addRow,
        {
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          flexDirection: rowDirection(isRTL),
          backgroundColor: dark
            ? 'rgba(148,210,165,0.12)'
            : 'hsl(148, 35%, 92%)',
        },
      ]}
    >
      {Icon ? <Icon size={14} color={accentColor} strokeWidth={2.4} /> : null}
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Poppins-SemiBold',
          color: accentColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  sectionShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  eyebrowRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginHorizontal: 6,
  },
  eyebrowLabelRow: {
    alignItems: 'center',
    gap: 8,
  },
  labelRow: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  summaryRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addRow: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});
