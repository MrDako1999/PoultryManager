import { Slot } from 'expo-router';

/**
 * Every auth screen owns its full layout via `HeroSheetScreen` with
 * `heroComfort="relaxed"` so the green hero has more padding than tab
 * dashboards. The layout is a transparent passthrough so children paint
 * edge-to-edge.
 */
export default function AuthLayout() {
  return <Slot />;
}
