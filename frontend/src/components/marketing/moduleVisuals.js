import { Bird, Egg, Feather, Factory, ShoppingBag, Wrench } from 'lucide-react';

// Shared mapping of MODULE_CATALOG.icon strings to lucide components. Kept in
// one place so the radial diagram and the module-showcase cards always pick
// the same glyph for the same module.
export const MODULE_ICON = {
  Bird,
  Egg,
  Feather,
  Factory,
  ShoppingBag,
  Wrench,
};

// MODULE_CATALOG colours come as { light, dark }. We pick the right one based
// on theme (web stores `dark` on a Zustand store + `.dark` class on <html>;
// since the radial diagram lives over the brand-green hero, we use the
// `light` variant there regardless of theme — contrast is against green, not
// against the page background).
//
// Returns:
//   { solid, tintBg, tintBgStrong, ring }
// where:
//   solid        = full-strength colour, used for icon glyphs
//   tintBg       = ~12% alpha tint for icon-tile bg in light mode
//   tintBgStrong = ~15% alpha tint for icon-tile bg in dark mode
//   ring         = ~30% alpha for selected/active borders
export function moduleColour(meta, dark = false) {
  const base = dark
    ? meta?.color?.dark || meta?.color?.light || '#059669'
    : meta?.color?.light || '#059669';
  return {
    solid: base,
    // Hex-with-alpha. 1F = 12% / 26 = 15% / 4D = 30%.
    tintBg:       `${base}1F`,
    tintBgStrong: `${base}26`,
    ring:         `${base}4D`,
  };
}
