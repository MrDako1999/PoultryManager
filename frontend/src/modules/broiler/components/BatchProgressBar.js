import { cn } from '@/lib/utils';

// 5pt-tall track with brand-green fill. Shape and tones ported from
// mobile/modules/broiler/dashboard/BroilerActiveBatches.js (`progressBarTrack`
// + `progressBarFill`). Track tones lean translucent so the bar reads as
// "etched into the surface" rather than a separate element.
//
// Width is clamped to 0-100 to defend against >35-day cycles producing a
// runaway fill that overflows the card.
export default function BatchProgressBar({ value = 0, className }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn(
        'h-[5px] w-full overflow-hidden rounded-[3px] bg-black/[0.05] dark:bg-white/[0.06]',
        className,
      )}
    >
      <div
        className="h-full rounded-[3px] bg-accentStrong transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
