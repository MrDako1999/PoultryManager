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
 *
 * Variants:
 *   tinted = colored tile + colored icon (default)
 *   muted  = neutral tile + muted icon (used for inactive/coming-soon when
 *            we want to dim the whole row, not the tile colour)
 */
const SIZES = {
  sm: { box: 36, radius: 10, icon: 16 },
  md: { box: 44, radius: 13, icon: 20 },
  lg: { box: 56, radius: 14, icon: 24 },
};

export default function ModuleIconTile({
  moduleId,
  meta,
  size = 'md',
  variant = 'tinted',
  onTinted = false,
  className,
  style,
}) {
  if (!meta) return null;
  const dims = SIZES[size] || SIZES.md;
  const Icon = MODULE_ICON[meta.icon] || MODULE_ICON.Bird;
  const c = moduleColour(meta, false);

  // `onTinted` lifts the tile a step so it stays visible on top of a tinted
  // surface (e.g. the brand-green hero). Without it the 12% tile against a
  // green background just disappears.
  const bg = variant === 'muted'
    ? 'rgba(255,255,255,0.10)'
    : (onTinted ? c.tintBgStrong : c.tintBg);

  const iconColour = variant === 'muted' ? 'currentColor' : c.solid;

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
        borderRadius: dims.radius,
        backgroundColor: bg,
        color: iconColour,
        ...style,
      }}
      aria-hidden="true"
    >
      <Icon
        size={dims.icon}
        strokeWidth={2.2}
        // Lucide reads `color` from currentColor by default. We force it via
        // `style` so the tinted variant keeps the brand colour even when the
        // parent text colour overrides it (e.g. on hover).
        style={{ color: iconColour }}
      />
    </span>
  );
}
