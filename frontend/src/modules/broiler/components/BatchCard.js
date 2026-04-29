import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bird, Calendar, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import BatchAvatar from './BatchAvatar';
import BatchProgressBar from './BatchProgressBar';
import { mortalityToneClass } from './KpiHeroCard';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';

// Mobile parity: BroilerActiveBatches assumes a 35-day cycle for the progress
// bar's denominator. Centralising the constant here so the BatchesPage list
// uses the same figure and any future "cycle target per farm" override hooks
// in cleanly.
const CYCLE_TARGET_DAYS = 35;

const fmtInt = (val) => Number(val || 0).toLocaleString('en-US');

// Resolves the avatar letter + sequence number the same way the mobile
// dashboard does — first character of farm nickname / farmName / batchName.
function resolveAvatar(batch) {
  const farm = batch.farm && typeof batch.farm === 'object' ? batch.farm : null;
  const source = farm?.nickname || farm?.farmName || batch.batchName || '?';
  return {
    letter: source[0].toUpperCase(),
    sequence: batch.sequenceNumber ?? '',
  };
}

/**
 * Reusable batch summary card. Two visual variants:
 *
 *   variant="default"  — dashboard active batches: avatar + name + meta + day
 *                        progress bar (full mobile parity).
 *   variant="compact"  — list rows (BatchesPage): same anatomy, denser, no
 *                        progress bar, trailing chevron.
 *
 * `deaths` is required and pre-computed by the caller because aggregating
 * `dailyLogs` per card would be O(N*M); see the dashboard widget for the
 * recommended single-pass aggregator.
 */
export default function BatchCard({
  batch,
  deaths = 0,
  variant = 'default',
  cycleTargetDays = CYCLE_TARGET_DAYS,
  onClick,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const initial = useMemo(
    () => (batch.houses || []).reduce((sum, h) => sum + (h.quantity || 0), 0),
    [batch.houses],
  );

  const remaining = Math.max(0, initial - deaths);
  const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
  const dayCount = batch.startDate
    ? Math.max(0, Math.floor((Date.now() - new Date(batch.startDate)) / 86400000))
    : 0;
  const cycleProgressPct = Math.min(100, (dayCount / cycleTargetDays) * 100);

  const { letter, sequence } = resolveAvatar(batch);
  const status = getStatusConfig(batch.status || 'IN_PROGRESS');
  const mortalityClass = mortalityToneClass(mortalityPct);

  const handleClick = onClick || (() => navigate(`/dashboard/batches/${batch._id}`));

  const isCompact = variant === 'compact';
  const avatarSize = isCompact ? 36 : 40;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group block w-full rounded-2xl border text-start transition-colors',
        'border-elevatedCard-border bg-elevatedCard',
        'hover:border-accentStrong/40 hover:bg-elevatedCard-pressed/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'shadow-[0_2px_10px_rgba(15,31,16,0.05)] dark:shadow-none',
        isCompact ? 'p-3' : 'p-3.5',
      )}
    >
      {/* Header row: avatar + (name + meta) + optional chevron */}
      <div className="flex items-start gap-3">
        <BatchAvatar
          letter={letter}
          sequence={sequence}
          status={status}
          size={avatarSize}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight text-foreground truncate">
            {batch.batchName}
          </div>
          {/* Health summary — bird icon + remaining + (-deaths) tinted by
              mortality severity, separator dot, mortality %. Matches the
              mobile BatchCard meta row. */}
          {initial > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px]">
              <div className="flex items-center gap-1">
                <Bird className="h-3 w-3 text-muted-foreground" strokeWidth={2.2} aria-hidden="true" />
                <span className="text-muted-foreground tabular-nums">{fmtInt(remaining)}</span>
                {deaths > 0 ? (
                  <span className={cn('font-semibold tabular-nums', mortalityClass)}>
                    ({`-${fmtInt(deaths)}`})
                  </span>
                ) : null}
              </div>
              <span className="text-muted-foreground" aria-hidden="true">·</span>
              <span className={cn('font-semibold tabular-nums', mortalityClass)}>
                {`${mortalityPct.toFixed(2)}%`}
              </span>
            </div>
          ) : null}
        </div>
        {isCompact ? (
          <ChevronRight
            className="ms-1 mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        ) : null}
      </div>

      {/* Day-of-target progress — hidden for completed cycles. */}
      {batch.status !== 'COMPLETE' && (
        <div className={isCompact ? 'mt-2' : 'mt-3'}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" strokeWidth={2.4} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('dashboard.dayN', { n: dayCount })}
              </span>
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {Math.round(cycleProgressPct)}%
            </span>
          </div>
          <BatchProgressBar value={cycleProgressPct} className="mt-1.5" />
        </div>
      )}
    </button>
  );
}

export { CYCLE_TARGET_DAYS };
