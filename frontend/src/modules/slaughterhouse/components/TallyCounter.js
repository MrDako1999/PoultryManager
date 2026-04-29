import { Minus, Plus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// +1 / +5 / − tally counter for sortation entries. Composed entirely
// from existing ui/Button + Badge primitives — no new visual atom
// invented (per plan §0.3). Workers tap to increment instead of
// typing; the value still passes through the standard onChange so
// react-hook-form stays in control.
//
// When `requirePhotosWhen > 0` is reached, a "📷 N required" affordance
// renders and clicking it triggers `onAddPhoto`. The parent owns the
// photo state and decides what to do with the click (open file picker,
// camera, etc.).
export default function TallyCounter({
  label,
  value,
  onChange,
  photoCount = 0,
  onAddPhoto,
  className,
  disabled,
}) {
  const numeric = Number(value) || 0;
  const photosNeeded = Math.max(0, numeric - photoCount);
  const hasPhotosOk = numeric === 0 || photosNeeded === 0;

  const change = (delta) => {
    if (disabled) return;
    const next = Math.max(0, numeric + delta);
    onChange?.(next);
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        numeric > 0 && !hasPhotosOk && 'border-destructive/50',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider">{label}</Label>
        {numeric > 0 ? (
          hasPhotosOk
            ? <Badge variant="outline" className="text-[10px] px-1.5 py-0">{photoCount} 📷</Badge>
            : (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {photosNeeded} req
              </Badge>
            )
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => change(-1)}
          disabled={disabled || numeric === 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-2xl font-semibold tabular-nums flex-1 text-center">
          {numeric.toLocaleString('en-US')}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => change(1)}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => change(5)}
          disabled={disabled}
        >
          +5
        </Button>
        {onAddPhoto ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={onAddPhoto}
            disabled={disabled}
          >
            <Camera className="h-3.5 w-3.5" />
            {numeric > 0
              ? `${photoCount}/${numeric}`
              : photoCount > 0 ? `${photoCount}` : ''}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
