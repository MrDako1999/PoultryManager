import { View, Text } from 'react-native';
import { useHeroSheetTokens } from './HeroSheetScreen';

/**
 * Grouped section card used inside HeroSheetScreen sheets.
 * Provides a tinted background, rounded corners, and an optional uppercase label.
 */
export default function SheetSection({
  title,
  description,
  icon: Icon,
  children,
  style,
  padded = true,
}) {
  const { sectionBg, sectionBorder, mutedColor, dark } = useHeroSheetTokens();

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      {title && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            marginLeft: 6,
          }}
        >
          {Icon && <Icon size={13} color={mutedColor} />}
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-SemiBold',
              color: mutedColor,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Text>
        </View>
      )}
      <View
        style={[
          {
            backgroundColor: sectionBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: sectionBorder,
            overflow: 'hidden',
            ...(dark
              ? {}
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 1,
                }),
          },
          padded && { padding: 16 },
          style,
        ]}
      >
        {children}
      </View>
      {description && (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            marginTop: 8,
            marginLeft: 6,
            lineHeight: 17,
          }}
        >
          {description}
        </Text>
      )}
    </View>
  );
}
