import { Fragment, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpenseCategoryGroup({
  label, total, count, pills,
  defaultOpen = true,
  open: controlledOpen, onToggle,
  children,
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : internalOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen((v) => !v);
    }
  };

  const segments = pills || [
    { value: typeof total === 'number' ? fmt(total) : total },
    ...(count != null ? [{ value: count }] : []),
  ];

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between w-full px-4 py-2 bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown className={cn(
            'h-3 w-3 text-muted-foreground transition-transform duration-200',
            !open && '-rotate-90',
          )} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {segments.map((seg, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="w-px self-stretch bg-border" />}
              <span className="px-1.5 py-0">{seg.value}</span>
            </Fragment>
          ))}
        </span>
      </button>

      <div className={cn(
        'grid transition-all duration-200',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}>
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
