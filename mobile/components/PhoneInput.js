import { View, TextInput, Text } from 'react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const COUNTRY_CODE = '+971';

/**
 * Phone input with the +971 country code on the leading edge. Soft-fill, RTL-safe.
 *
 * The leading-edge prefix tile reads as a separate visual element from the
 * input itself, like a chip. The input area shows the user-entered digits.
 */
export default function PhoneInput({ value, onChange }) {
  const { inputBg, inputBorderIdle, textColor, mutedColor, dark } = useHeroSheetTokens();
  const isRTL = useIsRTL();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        backgroundColor: inputBg,
        borderWidth: 1.5,
        borderColor: inputBorderIdle,
        borderRadius: 14,
        height: 52,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: 14,
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'Poppins-SemiBold',
            fontSize: 13,
            color: mutedColor,
            letterSpacing: 0.4,
          }}
        >
          {COUNTRY_CODE}
        </Text>
      </View>
      <TextInput
        value={value?.replace(/^\+971/, '') || ''}
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, '');
          onChange?.(digits ? `${COUNTRY_CODE}${digits}` : '');
        }}
        keyboardType="phone-pad"
        placeholder="50 123 4567"
        placeholderTextColor={mutedColor}
        style={{
          flex: 1,
          paddingHorizontal: 14,
          fontFamily: 'Poppins-Regular',
          fontSize: 15,
          color: textColor,
          height: '100%',
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: 'ltr',
        }}
      />
    </View>
  );
}
