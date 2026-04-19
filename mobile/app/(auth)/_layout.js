import { Slot } from 'expo-router';

/**
 * Every auth screen owns its full layout via `HeroSheetScreen`. The
 * (auth) group layout is just a transparent passthrough so child screens
 * can paint their own immersive hero edge-to-edge.
 */
export default function AuthLayout() {
  return <Slot />;
}
