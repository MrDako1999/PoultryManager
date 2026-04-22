import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  ChevronRight, ChevronLeft, FileText, Image as ImageIcon, File as FileIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { detectFileType } from '@/components/FileViewer';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const TYPE_ICON = { image: ImageIcon, pdf: FileText, file: FileIcon };

function formatSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable document preview card for detail screens.
 *
 * Renders an accent-tinted icon tile + uppercase eyebrow (label) + filename
 * + optional filesize + RTL-aware chevron, all inside an elevated card
 * surface (DL §6 stacked-elevated-cards pattern). Use inside a
 * `<SheetSection padded={false}>` and stack with `gap: 10`.
 *
 * Layout lives in StyleSheet (DL §9 trap rule). Functional `style` carries
 * only the pressed-state colour / scale deltas.
 *
 * @param {object} props
 * @param {object} props.doc      - media object (`url`, `mime_type`, `original_filename`, `file_size`, ...)
 * @param {string} props.label    - uppercase eyebrow above the filename (e.g. "Sale Invoice")
 * @param {() => void} props.onPress - called when the card is tapped (open FileViewer, etc.)
 */
export default function DocCard({ doc, label, onPress }) {
  const isRTL = useIsRTL();
  const {
    accentColor, textColor, mutedColor,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg, dark,
  } = useHeroSheetTokens();

  if (!doc) return null;

  const type = detectFileType(doc);
  const Icon = TYPE_ICON[type] || FileIcon;
  const filename = doc.original_filename || doc.filename || doc.name || label;
  const size = formatSize(doc.file_size || doc.size);
  const ForwardArrow = isRTL ? ChevronLeft : ChevronRight;
  const iconTileBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: pressed ? accentColor : elevatedCardBorder,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.96 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={filename}
    >
      <View style={[styles.row, { flexDirection: rowDirection(isRTL) }]}>
        <View style={[styles.iconTile, { backgroundColor: iconTileBg }]}>
          <Icon size={20} color={accentColor} strokeWidth={2.2} />
        </View>
        <View style={styles.textCol}>
          {label ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: mutedColor,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
          {filename ? (
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: textColor,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {filename}
            </Text>
          ) : null}
          {size ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                fontVariant: ['tabular-nums'],
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {size}
            </Text>
          ) : null}
        </View>
        <ForwardArrow size={18} color={mutedColor} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  row: {
    alignItems: 'center',
    gap: 14,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
});
