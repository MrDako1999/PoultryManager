import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Web port of mobile/components/SlidingSegmentedControl.js. The visual recipe:
//   - bordered card panel (rounded-2xl, bg-card, border-border)
//   - 6pt inner padding
//   - active pill: bg-accentStrong/15 with 1px border-accentStrong, rounded-xl,
//     translateX-driven slide between option positions (CSS transform, no
//     animation library)
//   - active label cross-fades from text-muted-foreground to text-accentStrong
//
// Width is measured at layout time so the pill knows where to slide. Re-runs
// on resize (covered by ResizeObserver). RTL flips the slide direction by
// branching translateX sign on dir=rtl.
export default function SegmentedControl({
  value,
  onChange,
  options,
  className,
  bordered = true,
}) {
  const id = useId();
  const trackRef = useRef(null);
  const itemRefs = useRef([]);
  const [layout, setLayout] = useState({ width: 0, items: [] });
  const [isRTL, setIsRTL] = useState(false);

  // Detect document direction once mounted, then keep in sync if it changes
  // (e.g. user toggles language). This is the canonical way to read direction
  // in the dashboard since the i18n layer sets `dir` on `<html>`.
  useEffect(() => {
    const update = () => setIsRTL(document.documentElement.getAttribute('dir') === 'rtl');
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  const measure = () => {
    if (!trackRef.current) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const items = itemRefs.current
      .filter(Boolean)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left - trackRect.left, width: r.width };
      });
    setLayout({ width: trackRect.width, items });
  };

  useLayoutEffect(() => {
    measure();
    if (!trackRef.current) return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(trackRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const activeIndex = useMemo(() => {
    const i = options.findIndex((o) => o.value === value);
    return i < 0 ? 0 : i;
  }, [options, value]);

  const activeRect = layout.items[activeIndex];

  return (
    <div
      className={cn(
        bordered &&
          'rounded-2xl border border-border bg-card shadow-[0_1px_6px_rgba(15,31,16,0.04)] dark:shadow-none',
        className,
      )}
    >
      <div ref={trackRef} className="relative p-1.5" role="tablist" aria-label={id}>
        {/* Sliding pill — absolutely positioned, transform-translated to the
            active option. The width transition handles options of different
            label widths gracefully. */}
        {activeRect ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-xl border border-accentStrong bg-accentStrong/15 transition-[transform,width] duration-200 ease-out"
            style={{
              // `left: 0` anchors at the start of the track's padding box;
              // each item's `getBoundingClientRect().left - trackRect.left`
              // is the offset INCLUDING the 6px padding, so translating by
              // `activeRect.left` lands the pill exactly on top of the item.
              // RTL is irrelevant here because both the track and the items
              // share the same coordinate space — the browser already handles
              // the visual mirroring of the children when `dir=rtl`.
              left: 0,
              width: activeRect.width,
              transform: `translateX(${activeRect.left}px)`,
            }}
          />
        ) : null}

        <div className="relative flex gap-1.5">
          {options.map((opt, i) => {
            const Icon = opt.icon;
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                onClick={() => {
                  if (opt.value === value) return;
                  onChange?.(opt.value);
                }}
                className={cn(
                  'relative z-[1] flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  isActive ? 'text-accentStrong' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {Icon ? <Icon className="h-[15px] w-[15px]" strokeWidth={2.2} /> : null}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
