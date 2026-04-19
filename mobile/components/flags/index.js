import { View } from 'react-native';
import UnitedStatesFlag from './UnitedStatesFlag';
import ArabicFlag from './ArabicFlag';

const FLAG_BY_CODE = {
  en: UnitedStatesFlag,
  ar: ArabicFlag,
};

/**
 * Returns the flag component for a given language code, or null if we
 * don't have an asset for it. Consumers can fall back to the language
 * code badge when this returns null.
 */
export function getFlagComponent(code) {
  return FLAG_BY_CODE[code] || null;
}

/**
 * Rounded-rectangle flag tile. Wraps the flag SVG in a clipped View so
 * every flag gets a consistent corner radius and subtle 1px border, which
 * makes flags from different aspect ratios sit comfortably together in
 * a list.
 *
 * Pass `width` to render a UNIFORM-WIDTH chip — the flag is rendered at
 * its natural aspect ratio (height = `size`) and center-cropped to fit
 * `width`. This is what you want in a list of multiple languages so the
 * 1.9:1 US flag and the 1.5:1 Arabic flag occupy identical real estate.
 * Without `width`, the tile sizes itself to the flag's native aspect.
 *
 * @param {object} props
 * @param {string} props.code - Language code (e.g. 'en', 'ar')
 * @param {number} [props.size=20] - Height of the flag in pt
 * @param {number} [props.width] - Optional fixed width; flag is center-cropped to fit
 * @param {number} [props.radius] - Corner radius (default size * 0.18)
 * @param {object} [props.style]
 */
export default function FlagTile({ code, size = 20, width, radius, style }) {
  const Flag = getFlagComponent(code);
  if (!Flag) return null;

  const r = radius == null ? Math.max(2, Math.round(size * 0.18)) : radius;

  return (
    <View
      style={[
        {
          height: size,
          width,
          borderRadius: r,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Flag size={size} />
    </View>
  );
}
