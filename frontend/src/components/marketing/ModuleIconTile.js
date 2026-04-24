import { cn } from '@/lib/utils';
import { MODULE_ICON, moduleColour } from './moduleVisuals';

/**
 * Translates the mobile module-row icon-tile (mobile/app/(app)/settings-modules.js
 * lines 111-124) to web. Used by both the radial hub diagram and the module
 * showcase cards so the visual vocabulary is identical across the page.
 *
 * Sizes:
 *   sm = 36 (radial-diagram mobile fallback)
 *   md = 44 (mobile-row default)
 *   lg = 56 (showcase card)
 *   xl = 72 (radial hero "glow" chrome — wants more presence)
 *
 * Variants:
 *   tinted = colored tile + colored icon (default)
 *   muted  = neutral tile + muted icon (used for inactive/coming-soon when
 *            we want to dim the whole row, not the tile colour)
 *
 * Chrome:
 *   rounded = rounded-square tile, no outer effects (default — matches the
 *             mobile module rows + the showcase cards)
 *   glow    = perfectly circular tile with a soft colored outer halo and a
 *             thin colored ring on the tile edge. Designed to sit on a
 *             dark/photographic background (e.g. the radial hub on top of
 *             the hero photo) where the rounded chrome reads as just a
 *             white square. Also drops the rounded-square's solid white
 *             fill in favour of an off-white that picks up a hint of the
 *             module colour, which is how the reference renders.
 */
const SIZES = {
  sm: { box: 36, radius: 10, icon: 16 },
  md: { box: 44, radius: 13, icon: 20 },
  lg: { box: 56, radius: 14, icon: 24 },
  xl: { box: 72, radius: 18, icon: 32 },
};

export default function ModuleIconTile({
  moduleId,
  meta,
  size = 'md',
  variant = 'tinted',
  chrome = 'rounded',
  onTinted = false,
  className,
  style,
}) {
  if (!meta) return null;
  const dims = SIZES[size] || SIZES.md;
  const Icon = MODULE_ICON[meta.icon] || MODULE_ICON.Bird;
  const c = moduleColour(meta, false);
  const isGlow = chrome === 'glow';

  // `onTinted` lifts the tile a step so it stays visible on top of a tinted
  // surface (e.g. the brand-green hero). Without it the 12% tile against a
  // green background just disappears.
  let bg;
  if (variant === 'muted') {
    bg = 'rgba(255,255,255,0.10)';
  } else if (isGlow) {
    // Off-white wash with a hint of module colour — same warm feel as the
    // reference where each tile "belongs" to its module without being a
    // solid colour brick.
    bg = `color-mix(in srgb, ${c.solid} 14%, white)`;
  } else {
    bg = onTinted ? c.tintBgStrong : c.tintBg;
  }

  const iconColour = variant === 'muted' ? 'currentColor' : c.solid;

  // Glow chrome stack:
  //   - thin colored ring on the tile edge (1.5px @ 70% alpha)
  //   - soft colored halo radiating outward (24px blur @ ~45% alpha)
  //   - faint extra-wide diffuse halo (44px @ ~22%) for the "lit" feeling
  //   - subtle inner shadow so the icon feels seated in the disc, not pasted
  // Every shadow is keyed to the module's solid colour, so each tile carries
  // its own tinted aura instead of a generic white bloom.
  const glowShadow = isGlow
    ? [
        `0 0 0 1.5px ${c.solid}B3`,
        `0 0 24px 2px ${c.solid}73`,
        `0 0 44px 6px ${c.solid}38`,
        `inset 0 0 12px ${c.solid}24`,
      ].join(', ')
    : undefined;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        variant === 'muted' && 'text-muted-foreground',
        className,
      )}
      style={{
        width: dims.box,
        height: dims.box,
        borderRadius: isGlow ? 9999 : dims.radius,
        backgroundColor: bg,
        color: iconColour,
        boxShadow: glowShadow,
        ...style,
      }}
      aria-hidden="true"
    >
      <Icon
        size={dims.icon}
        strokeWidth={isGlow ? 2 : 2.2}
        // Lucide reads `color` from currentColor by default. We force it via
        // `style` so the tinted variant keeps the brand colour even when the
        // parent text colour overrides it (e.g. on hover).
        style={{ color: iconColour }}
      />
    </span>
  );
}
