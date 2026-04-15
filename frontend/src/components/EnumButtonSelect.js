import { cn } from '@/lib/utils';

/**
 * @param {Object} props
 * @param {Array<{value: string, label: string, icon?: import('react').ElementType}>} props.options
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {number} [props.columns] – grid columns on sm+, defaults to option count
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.compact] – renders a slimmer, inline variant
 * @param {string} [props.className]
 */
export default function EnumButtonSelect({
  options = [],
  value,
  onChange,
  columns,
  disabled,
  compact,
  className,
}) {
  const cols = columns || options.length;

  return (
    <div
      className={cn(
        'grid gap-2',
        compact ? 'grid-cols-3' : 'grid-cols-2',
        className,
      )}
      style={{ '--cols': cols }}
    >
      <style>{`@media (min-width: 640px) { [style*="--cols: ${cols}"] { grid-template-columns: repeat(${cols}, minmax(0, 1fr)); } }`}</style>
      {options.map(({ value: optVal, label, icon: Icon }) => {
        const selected = value === optVal;
        return (
          <button
            key={optVal}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(optVal)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg border text-center transition-colors',
              compact
                ? 'flex-row px-2 py-2 h-10'
                : 'min-h-[72px] flex-col px-2 py-2.5',
              selected
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-input bg-background hover:bg-accent/50',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'shrink-0',
                  compact ? 'h-3.5 w-3.5' : 'h-5 w-5',
                  selected ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            )}
            <span
              className={cn(
                'font-medium leading-tight truncate',
                compact ? 'text-xs' : 'text-xs',
                selected ? 'text-primary' : 'text-foreground'
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
