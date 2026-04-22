import {
  View, Text, Pressable, StyleSheet, Linking, Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Share2, ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { useToast } from '@/components/ui/Toast';
import GoogleMapsIcon from '@/components/icons/GoogleMapsIcon';
import WazeIcon from '@/components/icons/WazeIcon';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Build a `https://www.google.com/maps?q=lat,lng` URL — the format every
 * mainstream mapping app accepts as a fallback if the requested native
 * app isn't installed, so it's also the right thing to embed in a Share
 * message body.
 */
const buildMapsUrl = (lat, lng) =>
  `https://www.google.com/maps?q=${lat},${lng}`;

/**
 * LocationActions — stacked list of full-width "row" affordances for
 * navigating to / sharing a saved location.
 *
 * Designed to drop straight inside a `<SheetSection padded={false}>`:
 * each action becomes its own hairline-divided row matching the
 * `LinkedItemRow` chrome on the same screen. This is deliberately the
 * SAME visual idiom as "Linked Farms" / "Associated Contacts" on the
 * business overview, so the address section reads as a peer of those
 * lists rather than a floating cluster of icons in an empty card.
 *
 * Each row is full-width tappable (≥56pt tall) so a tap can't land
 * between targets — solves the same fat-finger problem the contact
 * phone-actions solve, but at a layout scale that also reads cleanly
 * when the parent card has no other content (e.g. farms whose only
 * address data is the lat/lng pin).
 *
 * Brand icons render at their natural fidelity (the Google Maps SVG
 * pin, the Waze app-icon PNG) — no tonal tile wrapping, because the
 * brand colours ARE the affordance. The lucide Share icon gets the
 * tonal-green tile treatment so it visually balances against the
 * coloured brand glyphs.
 *
 * @param {object} props
 * @param {string} [props.name]    Used as the share title and the place
 *                                 label in the share message body.
 * @param {number} [props.lat]     Required to enable Maps / Waze rows;
 *                                 share still appears without coords.
 * @param {number} [props.lng]
 * @param {string} [props.address] Optional human-readable address line
 *                                 appended to the share body.
 */
export default function LocationActions({
  name, lat, lng, address,
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();

  const hasCoords = lat != null && lng != null;
  const hasShareablePayload = hasCoords || !!name || !!address;

  const openGoogleMaps = () => {
    if (!hasCoords) return;
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(buildMapsUrl(lat, lng)).catch(() => {
      toast({
        title: t('location.mapsUnavailable', 'Cannot open Google Maps'),
        variant: 'destructive',
      });
    });
  };

  const openWaze = () => {
    if (!hasCoords) return;
    Haptics.selectionAsync().catch(() => {});
    // Waze universal link: `ll=` is lat/lng pair, `navigate=yes` jumps
    // straight into turn-by-turn instead of just centring the map. The
    // `https://waze.com/ul` host is auto-handled by the native app when
    // installed and falls back to the web bridge otherwise.
    Linking.openURL(`https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`).catch(() => {
      toast({
        title: t('location.wazeUnavailable', 'Cannot open Waze'),
        variant: 'destructive',
      });
    });
  };

  const shareLocation = async () => {
    if (!hasShareablePayload) return;
    Haptics.selectionAsync().catch(() => {});
    // Ordered for readability in any messenger preview: identity first,
    // then human-readable address, then the actionable maps URL last.
    const lines = [];
    if (name) lines.push(name);
    if (address) lines.push(address);
    if (hasCoords) lines.push(buildMapsUrl(lat, lng));
    const message = lines.join('\n');
    try {
      await Share.share({ message, title: name || t('location.shareTitle', 'Location') });
    } catch {
      // user-cancelled / OS-level error — both surface natively, no toast.
    }
  };

  // Build the rows in display order, skipping any whose data isn't ready
  // (e.g. no coords → no Maps / Waze rows). Used to compute `isLast` for
  // the hairline divider so we don't draw a ghost line under the bottom.
  const rows = [];
  if (hasCoords) {
    rows.push({
      key: 'gmaps',
      onPress: openGoogleMaps,
      label: t('location.openInGoogleMaps', 'Open in Google Maps'),
      sublabel: t('location.openInGoogleMapsHint', 'View pin on the map'),
      brandIcon: <GoogleMapsIcon size={28} />,
    });
    rows.push({
      key: 'waze',
      onPress: openWaze,
      label: t('location.openInWaze', 'Open in Waze'),
      sublabel: t('location.openInWazeHint', 'Start turn-by-turn navigation'),
      brandIcon: <WazeIcon size={28} />,
    });
  }
  if (hasShareablePayload) {
    rows.push({
      key: 'share',
      onPress: shareLocation,
      label: t('location.shareLocation', 'Share location'),
      sublabel: t('location.shareLocationHint', 'Send a link via any app'),
      icon: Share2,
    });
  }

  if (rows.length === 0) return null;

  return (
    <View>
      {rows.map((row, i) => (
        <ActionRow
          key={row.key}
          tokens={tokens}
          isRTL={isRTL}
          isLast={i === rows.length - 1}
          onPress={row.onPress}
          label={row.label}
          sublabel={row.sublabel}
          brandIcon={row.brandIcon}
          icon={row.icon}
        />
      ))}
    </View>
  );
}

/**
 * Single tappable row inside the location card. Mirrors the
 * `LinkedItemRow` chrome from BusinessOverviewTab so the address card
 * reads as a peer of the Linked Farms / Associated Contacts cards on
 * the same screen.
 */
function ActionRow({
  tokens, isRTL, isLast, onPress, label, sublabel, brandIcon, icon: Icon,
}) {
  const {
    accentColor, textColor, mutedColor, borderColor, dark,
  } = tokens;
  const ForwardArrow = isRTL ? ChevronLeft : ChevronRight;
  const tonalTileBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
          : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.row,
          {
            flexDirection: rowDirection(isRTL),
            borderBottomColor: borderColor,
            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={styles.iconSlot}>
          {brandIcon || (
            <View style={[styles.tonalTile, { backgroundColor: tonalTileBg }]}>
              <Icon size={18} color={accentColor} strokeWidth={2.4} />
            </View>
          )}
        </View>
        <View style={styles.textCol}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              letterSpacing: -0.1,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 1,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
        <ForwardArrow size={18} color={mutedColor} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 12,
  },
  // Fixed-width slot keeps brand icons (intrinsic frames) and the tonal
  // tile (constructed frame) horizontally aligned across rows.
  iconSlot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tonalTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
});
