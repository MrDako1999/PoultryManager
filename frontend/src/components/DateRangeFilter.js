import { useState, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

export default function DateRangeFilter({ value, onChange, className }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(undefined);
  const clickCount = useRef(0);

  const committed = value;
  const displayed = pending ?? committed;

  const hasRange = committed?.from;

  const label = hasRange
    ? committed.to && committed.from.getTime() !== committed.to.getTime()
      ? `${format(committed.from, 'MMM d, yyyy')} – ${format(committed.to, 'MMM d, yyyy')}`
      : format(committed.from, 'MMM d, yyyy')
    : 'Date';

  const handleOpen = (next) => {
    if (next) {
      setPending(committed);
      clickCount.current = 0;
    } else {
      setPending(undefined);
    }
    setOpen(next);
  };

  const apply = (range) => {
    onChange(range);
    setPending(undefined);
    clickCount.current = 0;
    setOpen(false);
  };

  const handleCalendarSelect = (range) => {
    clickCount.current += 1;
    setPending(range);

    if (clickCount.current >= 2 && range?.from && range?.to) {
      apply(range);
    }
  };

  const handleClear = () => {
    onChange(undefined);
    setPending(undefined);
    clickCount.current = 0;
    setOpen(false);
  };

  const handleClearTrigger = (e) => {
    e.stopPropagation();
    onChange(undefined);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleToday = () => {
    apply({ from: today, to: today });
  };

  const handleLast30 = () => {
    apply({ from: subDays(today, 29), to: today });
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal h-9 gap-2 bg-white dark:bg-card w-full',
            !hasRange && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{label}</span>
          {hasRange && (
            <X
              className="h-3.5 w-3.5 shrink-0 ml-auto text-muted-foreground hover:text-foreground"
              onClick={handleClearTrigger}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={displayed?.from || today}
          selected={displayed}
          onSelect={handleCalendarSelect}
          numberOfMonths={1}
          fixedWeeks
        />
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-normal"
            onClick={handleToday}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-normal"
            onClick={handleLast30}
          >
            Last 30 Days
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-normal text-muted-foreground"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => apply(pending)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
