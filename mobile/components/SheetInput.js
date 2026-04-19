import { forwardRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from './HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

/**
 * Soft-fill input matching the HeroSheetScreen aesthetic.
 *
 * @param {object} props
 * @param {string} [props.label] - Field label rendered above the input
 * @param {Component} [props.icon] - Lucide icon component rendered inside the input
 * @param {string} [props.error] - Error message; turns the border red
 * @param {string} [props.hint] - Helper text below the input
 * @param {ReactNode} [props.suffix] - Element rendered to the right inside the input
 * @param {boolean} [props.editable=true]
 * @param {boolean} [props.dense=false] - Tighter height (44 instead of 52)
 * @param {object} [props.style] - Style override for the input wrapper
 * @param {object} [props.containerStyle] - Style override for the field container (label + input)
 */
const SheetInput = forwardRef(({
  label,
  icon: Icon,
  error,
  hint,
  suffix,
  editable = true,
  dense = false,
  style,
  containerStyle,
  onFocus,
  onBlur,
  ...textInputProps
}, ref) => {
  const { inputBg, inputBorderIdle, inputBorderFocus, textColor, mutedColor, iconColor, errorColor } = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const [focused, setFocused] = useState(false);

  // Manual margins on TextInput because we don't trust I18nManager.isRTL to
  // auto-flip marginStart/marginEnd — the platform flag only flips on a true
  // cold start. See stores/localeStore.js for context.
  const inputMarginLeft = isRTL ? (suffix ? 8 : 0) : (Icon ? 12 : 0);
  const inputMarginRight = isRTL ? (Icon ? 12 : 0) : (suffix ? 8 : 0);

  return (
    <View style={[{ gap: 8 }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Medium',
            color: textColor,
            marginHorizontal: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            backgroundColor: inputBg,
            borderWidth: 1.5,
            borderColor: error ? errorColor : focused ? inputBorderFocus : inputBorderIdle,
            borderRadius: 14,
            paddingHorizontal: 14,
            height: dense ? 44 : 52,
            opacity: editable ? 1 : 0.6,
          },
          style,
        ]}
      >
        {Icon && <Icon size={18} color={focused ? inputBorderFocus : iconColor} />}
        <TextInput
          ref={ref}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={mutedColor}
          style={{
            flex: 1,
            marginLeft: inputMarginLeft,
            marginRight: inputMarginRight,
            fontFamily: 'Poppins-Regular',
            fontSize: dense ? 14 : 15,
            color: textColor,
            height: '100%',
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
          {...textInputProps}
        />
        {suffix}
      </View>
      {error ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: errorColor,
            marginHorizontal: 4,
            textAlign: isRTL ? 'right' : 'left',
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
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

SheetInput.displayName = 'SheetInput';

export default SheetInput;

/**
 * Currency-prefixed numeric input.
 */
export function SheetCurrencyInput({ currency, ...props }) {
  return (
    <SheetInput
      {...props}
      keyboardType="decimal-pad"
      suffix={
        currency ? (
          <CurrencyTag currency={currency} />
        ) : null
      }
    />
  );
}

/**
 * Soft-fill password input with an inline show/hide toggle. Matches the
 * SheetInput aesthetic (icon-prefixed soft-fill, animated focus border) and
 * is RTL-safe.
 */
export const SheetPasswordInput = forwardRef(({
  label,
  error,
  hint,
  showIcon = true,
  ...textInputProps
}, ref) => {
  const { iconColor } = useHeroSheetTokens();
  const [visible, setVisible] = useState(false);

  return (
    <SheetInput
      ref={ref}
      label={label}
      icon={showIcon ? Lock : undefined}
      error={error}
      hint={hint}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      suffix={
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setVisible((v) => !v);
          }}
          hitSlop={10}
          style={{ padding: 4 }}
        >
          {visible ? (
            <EyeOff size={18} color={iconColor} />
          ) : (
            <Eye size={18} color={iconColor} />
          )}
        </Pressable>
      }
      {...textInputProps}
    />
  );
});

SheetPasswordInput.displayName = 'SheetPasswordInput';

function CurrencyTag({ currency }) {
  const { mutedColor, dark } = useHeroSheetTokens();
  return (
    <View
      style={{
        backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-SemiBold',
          color: mutedColor,
          letterSpacing: 0.4,
        }}
      >
        {currency}
      </Text>
    </View>
  );
}
