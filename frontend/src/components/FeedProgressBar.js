/**
 * FeedProgressBar — universal feed progress primitive with optional
 * 3-zone target visualization. Web port of mobile/components/FeedProgressBar.js.
 *
 * Two display modes, controlled by whether `targetKg` is supplied:
 *
 *   2-state (no targetKg):
 *     - Track  = ordered envelope (translucent accent)
 *     - Solid  = consumed (accent)
 *     The bar's full extent IS the ordered amount.
 *
 *   3-state (targetKg > 0):
 *     - Track  = TARGET envelope (palest accent)
 *     - Mid    = ordered position relative to target (medium accent)
 *     - Solid  = consumed position relative to target (solid accent)
 *     The gap between the medium fill and the right edge IS the kg
 *     the operator should still purchase to hit target.
 *
 * Width transitions ride on a CSS `transition: width 500ms ease-in-out`
 * so values landing from a sync feel measured rather than snapping.
 * Mirrors the 500ms timing on the mobile RN Animated equivalent.
 */
export default function FeedProgressBar({
  consumedKg = 0,
  orderedKg = 0,
  targetKg,
  height = 6,
}) {
  const hasTarget = typeof targetKg === 'number' && targetKg > 0;
  const denominator = hasTarget ? targetKg : orderedKg;

  const consumedPct = denominator > 0
    ? Math.min(100, Math.max(0, (consumedKg / denominator) * 100))
    : 0;
  const orderedPct = denominator > 0
    ? Math.min(100, Math.max(0, (orderedKg / denominator) * 100))
    : 0;

  // Three accent shades on the same hue. Inline styles keep the visual
  // hierarchy stable across every surface that renders the bar without
  // depending on theme tokens for these intermediates. The mobile spec
  // uses the same constants so the two platforms read identically.
  //
  // The track is nearly card-background (very low alpha / near-95% L)
  // so the empty-to-fill transition reads as "filled vs empty" rather
  // than two flavours of green; the medium fill is meaningfully darker
  // so the consumed → ordered boundary is unambiguous.
  return (
    <div
      className="relative w-full overflow-hidden rounded-full"
      style={{
        height,
        background: 'var(--feed-bar-track, hsl(148, 30%, 95%))',
      }}
    >
      {hasTarget ? (
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-in-out"
          style={{
            width: `${orderedPct}%`,
            background: 'var(--feed-bar-ordered, hsl(148, 38%, 68%))',
          }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className="absolute top-0 h-full rounded-full bg-accentStrong transition-[width] duration-500 ease-in-out"
        style={{
          // `start` is the RTL-safe alias for `left`; using inline
          // style ensures the property serialises through inline CSS
          // which auto-flips in RTL containers via `dir="rtl"`.
          insetInlineStart: 0,
          width: `${consumedPct}%`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
