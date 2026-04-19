import { Image } from 'react-native';

/**
 * Waze brand icon — renders the official PNG asset directly.
 *
 * Source of truth at `assets/icons/waze.png` (the Waze app icon: cyan
 * rounded square with the white smiley speech-bubble inside). Wrapped in
 * the lucide-style `(size, style)` API so it slots into the same action
 * tiles as our other brand icons. Square aspect ratio is preserved.
 *
 * @param {object} props
 * @param {number} [props.size=20] - Square size in pt
 * @param {object} [props.style]
 */
export default function WazeIcon({ size = 20, style }) {
  return (
    <Image
      source={require('@/assets/icons/waze.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
