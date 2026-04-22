import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import CtaButton from '@/components/ui/CtaButton';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * FormSheet — reusable design-language chrome for create / edit sheets.
 *
 * Renders a full-screen Modal (`presentationStyle="pageSheet"` on iOS) with:
 *   - Drag-pill (visual only — system gesture handles the swipe-to-dismiss
 *     when presentationStyle="pageSheet")
 *   - Icon-tile header with title, optional subtitle, and a close X button
 *   - KeyboardAvoidingView body that scrolls
 *   - Optional sticky summary slot above the footer (used by money-totalling
 *     forms like ExpenseSheet / SaleOrderSheet / SourceSheet)
 *   - Sticky footer with primary Save / Create button + optional secondary
 *     destructive label (Delete)
 *
 * Layout in StyleSheet (§9 NativeWind trap rule). Tokens-only colors;
 * RTL-safe.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {Component} [props.icon] - Lucide icon for the header tile
 * @param {ReactNode} [props.headerExtra] - Optional element under the header (e.g. step progress bar)
 * @param {ReactNode} props.children - Form body content
 * @param {ReactNode} [props.footerExtra] - Sticky footer slot above the primary button (sticky summary card, etc.)
 * @param {ReactNode} [props.footer] - Custom footer overrides the default Button entirely (e.g. multi-step Back/Next)
 * @param {string} [props.submitLabel='Save']
 * @param {() => void} [props.onSubmit]
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.deleteLabel] - Optional destructive text button under the primary
 * @param {() => void} [props.onDelete]
 * @param {object} [props.scrollViewProps] - Spread onto the inner ScrollView (ref, onLayout, etc.)
 * @param {object} [props.scrollContentStyle] - Extra style for the ScrollView contentContainer
 */
export default function FormSheet({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  headerExtra,
  children,
  footerExtra,
  footer,
  submitLabel,
  onSubmit,
  loading = false,
  disabled = false,
  deleteLabel,
  onDelete,
  scrollViewProps,
  scrollContentStyle,
}) {
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    dark, screenBg, sheetBg, accentColor, textColor, mutedColor, borderColor,
  } = tokens;

  if (!open) return null;

  const handleClose = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose?.();
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: screenBg }}
      >
        {/* Drag pill (visual cue — pageSheet swipe-to-dismiss is OS-managed) */}
        <View style={styles.dragZone}>
          <View
            style={[
              styles.dragPill,
              { backgroundColor: dark ? 'hsl(150, 14%, 28%)' : 'hsl(148, 14%, 86%)' },
            ]}
          />
        </View>

        {/* Header — icon tile + title/subtitle + close X */}
        <View
          style={[
            styles.header,
            { flexDirection: rowDirection(isRTL), backgroundColor: sheetBg },
          ]}
        >
          {Icon ? (
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
                },
              ]}
            >
              <Icon size={20} color={accentColor} strokeWidth={2.2} />
            </View>
          ) : null}
          <View style={styles.headerTextCol}>
            <Text
              style={{
                fontSize: 17,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.2,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  marginTop: 1,
                  textAlign: textAlignStart(isRTL),
                }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            style={[
              styles.closeBtn,
              { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
            ]}
            accessibilityRole="button"
          >
            <X size={16} color={mutedColor} strokeWidth={2.4} />
          </Pressable>
        </View>

        {headerExtra ? (
          <View style={{ backgroundColor: sheetBg, paddingHorizontal: 20, paddingBottom: 12 }}>
            {headerExtra}
          </View>
        ) : null}

        {/* Hairline divider between chrome and body */}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />

        {/* Body */}
        <ScrollView
          style={{ flex: 1, backgroundColor: screenBg }}
          contentContainerStyle={[
            { paddingTop: 16, paddingBottom: 24 },
            scrollContentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>

        {/* Optional sticky summary above the footer */}
        {footerExtra}

        {/* Footer — polished CtaButton stack. Save / Create is the
            primary action; Delete (when present) sits below as a soft
            destructive chip rather than a bare text link. */}
        {footer ?? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: sheetBg,
                borderTopColor: borderColor,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <CtaButton
              variant="primary"
              label={submitLabel || 'Save'}
              onPress={onSubmit}
              loading={loading}
              disabled={disabled}
            />
            {deleteLabel && onDelete ? (
              <View style={{ marginTop: 10 }}>
                <CtaButton
                  variant="destructive"
                  icon={Trash2}
                  label={deleteLabel}
                  onPress={onDelete}
                  disabled={loading}
                />
              </View>
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dragZone: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
