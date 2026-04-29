import {
  forwardRef, useCallback, useEffect, useId, useRef, useState,
} from 'react';
import {
  View, Text, TextInput, Pressable, Platform,
} from 'react-native';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from './HeroSheetScreen';
import { useFormSheetContext } from './FormSheetContext';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';
import { textInputFit, textInputFitMultiline } from '@/lib/textInputFit';

/**
 * Soft-fill input matching the HeroSheetScreen aesthetic.
 *
 * When rendered inside a `<FormSheet>`, every `SheetInput`:
 *   1. Registers itself with the sheet's `FormSheetContext` so the
 *      sheet knows the chain of single-line inputs.
 *   2. Has its `returnKeyType` automatically set to `next` (or `done`
 *      on the last single-line input) and pressing the keyboard's
 *      Return / Enter / ✓ button focuses the next field. Multiline
 *      inputs (e.g. notes) are excluded from the chain so Return still
 *      inserts a newline.
 *   3. Scrolls itself above the keyboard on focus so the active field
 *      is always visible.
 *   4. Reports its activation to the sheet so the keyboard accessory
 *      toolbar's Prev / Next buttons reflect the current position.
 *
 * Outside a FormSheet (settings, auth, list filter bars) the context
 * value is null and the component behaves exactly as before — caller-
 * supplied `returnKeyType` / `onSubmitEditing` / `blurOnSubmit` always
 * win over the auto-derived defaults.
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
  onSubmitEditing,
  returnKeyType,
  blurOnSubmit,
  multiline,
  ...textInputProps
}, ref) => {
  const {
    inputBg, inputBorderIdle, inputBorderFocus, textColor, mutedColor, iconColor, errorColor,
  } = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const [focused, setFocused] = useState(false);

  const ctx = useFormSheetContext();
  const id = useId();
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // Compose the forwarded ref with our internal one so both the caller
  // and the form-sheet keyboard manager can drive `.focus()` on this
  // input.
  const setInputRef = useCallback((node) => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  useEffect(() => {
    if (!ctx) return undefined;
    return ctx.register({ id, ref: inputRef, multiline: !!multiline });
  }, [ctx, id, multiline]);

  // Manual margins on TextInput because we don't trust I18nManager.isRTL
  // to auto-flip marginStart/marginEnd — the platform flag only flips
  // on a true cold start. See stores/localeStore.js for context.
  const inputMarginLeft = isRTL ? (suffix ? 8 : 0) : (Icon ? 12 : 0);
  const inputMarginRight = isRTL ? (Icon ? 12 : 0) : (suffix ? 8 : 0);

  // Auto-wire next-field navigation only when:
  //   - we're inside a FormSheet (ctx is non-null),
  //   - the input is single-line (multiline keeps Return as newline),
  //   - and the caller hasn't expressed their own intent for the
  //     keyboard return behaviour. ExpenseSheet, for example, passes
  //     `returnKeyType="done"` on its terminal numeric field and a
  //     custom `onSubmitEditing={Keyboard.dismiss}`; we must not
  //     override either.
  const canAutoNav = !!ctx && !multiline;
  const callerOverridesChain = returnKeyType !== undefined
    || onSubmitEditing !== undefined;
  const autoChain = canAutoNav && !callerOverridesChain;

  const navInfo = canAutoNav ? ctx.positionForId(id) : null;
  const isLastNav = !!navInfo && navInfo.count > 0 && navInfo.index === navInfo.count - 1;

  const effectiveReturnKeyType = returnKeyType
    ?? (autoChain ? (isLastNav ? 'done' : 'next') : undefined);
  // Keep the keyboard alive across focus transitions (otherwise it
  // dismisses + re-shows on every "next", causing a visible flicker).
  // Only the last input blurs on submit so its Done button actually
  // closes the keyboard.
  const effectiveBlurOnSubmit = blurOnSubmit
    ?? (autoChain ? !!isLastNav : undefined);

  const handleSubmitEditing = (e) => {
    onSubmitEditing?.(e);
    if (autoChain) ctx.focusNext(id);
  };

  const handleFocus = (e) => {
    setFocused(true);
    if (ctx) {
      ctx.setActive(id);
      ctx.scrollIntoView(wrapperRef);
    }
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    if (ctx) {
      ctx.setActive((cur) => (cur === id ? null : cur));
    }
    onBlur?.(e);
  };

  return (
    <View ref={wrapperRef} style={[{ gap: 8 }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Medium',
            color: textColor,
            marginHorizontal: 4,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          {
            flexDirection: rowDirection(isRTL),
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
          ref={setInputRef}
          editable={editable}
          multiline={multiline}
          returnKeyType={effectiveReturnKeyType}
          blurOnSubmit={effectiveBlurOnSubmit}
          onSubmitEditing={handleSubmitEditing}
          onFocus={handleFocus}
          onBlur={handleBlur}
          // Pin every SheetInput inside a FormSheet to the sheet's
          // single `InputAccessoryView` on iOS so UIKit shows our
          // toolbar above the keyboard instead of synthesising its
          // own (which is what produced the duplicate "Next" pill).
          inputAccessoryViewID={
            Platform.OS === 'ios' && ctx?.accessoryID ? ctx.accessoryID : undefined
          }
          placeholderTextColor={mutedColor}
          style={{
            flex: 1,
            marginLeft: inputMarginLeft,
            marginRight: inputMarginRight,
            fontFamily: 'Poppins-Regular',
            fontSize: dense ? 14 : 15,
            color: textColor,
            height: '100%',
            textAlign: textAlignStart(isRTL),
            writingDirection: isRTL ? 'rtl' : 'ltr',
            ...(multiline ? textInputFitMultiline : textInputFit),
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
 * SheetInput aesthetic (icon-prefixed soft-fill, animated focus border)
 * and is RTL-safe.
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
