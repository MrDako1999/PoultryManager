import GoogleMapsSvg from '@/assets/icons/google-maps.svg';

/**
 * Google Maps brand glyph — renders the official SVG asset directly.
 *
 * The SVG is the source of truth at `assets/icons/google-maps.svg`; this
 * file just wraps it in the lucide-style `(size, style)` API used across
 * our brand icons so it slots into action-row tiles without special-casing.
 *
 * @param {object} props
 * @param {number} [props.size=20] - Square size in pt
 * @param {object} [props.style]
 */
export default function GoogleMapsIcon({ size = 20, style }) {
  return <GoogleMapsSvg width={size} height={size} style={style} />;
}
