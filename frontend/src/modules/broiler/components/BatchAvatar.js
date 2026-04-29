import useThemeStore from '@/stores/themeStore';

// Web port of mobile/modules/broiler/components/BatchAvatar.js — square brand-
// green tinted tile with a big bold letter+sequence label (e.g. "T2") and an
// optional bottom-trailing status pin.
//
// The mobile component uses raw HSL strings rather than Tailwind classes
// because the tile / label / pin colours need to land on very specific
// lightness stops to keep contrast on every surface (elevated card, sheet,
// hero gradient). We carry that approach over verbatim — the values match the
// mobile file 1:1 so dashboards on both surfaces look identical.
export default function BatchAvatar({ letter, sequence, status, size = 44, radius }) {
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';

  // Pin border has to match the surface the avatar SITS ON, not the avatar
  // itself, so the pin reads as a chip floating on the row. On the dashboard
  // an active-batches card sits on `--elevated-card-bg`; on a list row it
  // sits on `--card`. The mobile compromise (a single elevated tone) works
  // here too because both light and dark elevated bgs are a hair lighter
  // than the surrounding context.
  const cardColor = dark ? 'hsl(150, 14%, 22%)' : 'hsl(0, 0%, 100%)';

  // Stronger tile + bright label so `T2 / K2 / G10` reads at every size.
  // Default `bg-primary/10` collapses against the dark primary in dark mode
  // — both ends settle near `hsl(148 48% 38%)` and contrast drops below
  // 1.5:1, which is unreadable. These tones are tuned for >= 4.5:1 in both
  // themes and identical to the mobile file.
  const tileBg = dark ? 'hsl(148, 38%, 26%)' : 'hsl(148, 50%, 92%)';
  const labelColor = dark ? 'hsl(148, 60%, 80%)' : 'hsl(148, 60%, 22%)';

  const StatusIcon = status?.icon || null;
  const pinSize = Math.round(size * 0.4);
  const iconSize = Math.max(8, Math.round(pinSize * 0.55));
  const labelFontSize = Math.max(11, Math.round(size * 0.34));
  // ~27% radius keeps the avatar harmonised with surrounding rounded surfaces
  // (cards 16pt, elevated cards 12pt). Mobile note: 8pt looked too sharp.
  const tileRadius = radius ?? Math.round(size * 0.27);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex items-center justify-center"
        style={{
          width: size,
          height: size,
          backgroundColor: tileBg,
          borderRadius: tileRadius,
        }}
      >
        <span
          className="font-heading font-bold leading-none truncate"
          style={{
            fontSize: labelFontSize,
            color: labelColor,
            lineHeight: `${labelFontSize + 1}px`,
          }}
        >
          {letter}{sequence}
        </span>
      </div>
      {status ? (
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: pinSize,
            height: pinSize,
            // -3pt overhangs match mobile so the pin nibbles into the card
            // edge instead of floating awkwardly inside the avatar bounds.
            // Logical edges so RTL flips this to bottom-left automatically.
            bottom: -3,
            insetInlineEnd: -3,
            borderRadius: pinSize / 2,
            backgroundColor: dark ? status.pinBgDark : status.pinBgLight,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: cardColor,
          }}
          aria-hidden="true"
        >
          {StatusIcon ? (
            <StatusIcon size={iconSize} color={status.iconColor} strokeWidth={2.5} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
