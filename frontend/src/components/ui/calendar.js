import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('bg-background p-3', className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: defaultClassNames.root,
        months: cn(
          'relative flex flex-col gap-4 md:flex-row',
          defaultClassNames.months,
        ),
        month: cn('flex flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 z-10',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-7 w-7 p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-7 w-7 p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-7 items-center justify-center',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-7 items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'relative rounded-md border border-input shadow-sm',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          'absolute inset-0 opacity-0 cursor-pointer',
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          'font-medium select-none text-sm',
          defaultClassNames.caption_label,
        ),
        table: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'w-9 text-center text-[0.8rem] font-normal text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-1 flex w-full', defaultClassNames.week),
        week_number_header: cn(
          'w-9 select-none',
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          'text-[0.8rem] text-muted-foreground select-none',
          defaultClassNames.week_number,
        ),
        day: cn(
          'relative w-9 p-0 text-center text-sm select-none',
          defaultClassNames.day,
        ),
        range_start: cn(
          'bg-primary/15 rounded-l-full',
          defaultClassNames.range_start,
        ),
        range_middle: cn(
          'bg-primary/15',
          defaultClassNames.range_middle,
        ),
        range_end: cn(
          'bg-primary/15 rounded-r-full',
          defaultClassNames.range_end,
        ),
        today: cn(
          'rounded-md bg-accent text-accent-foreground',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.outside,
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled,
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: cls, rootRef, ...rest }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(cls)} {...rest} />
        ),
        Chevron: ({ className: cls, orientation, ...rest }) => {
          if (orientation === 'left')
            return <ChevronLeftIcon className={cn('h-4 w-4', cls)} {...rest} />;
          return <ChevronRightIcon className={cn('h-4 w-4', cls)} {...rest} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...rest }) => (
          <td {...rest}>
            <div className="flex h-9 w-9 items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

function CalendarDayButton({ className, day, modifiers, ...props }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isSelectedSingle =
    modifiers.selected &&
    !modifiers.range_start &&
    !modifiers.range_end &&
    !modifiers.range_middle;

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-normal transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        modifiers.range_start &&
          'bg-primary text-primary-foreground hover:bg-primary/90',
        modifiers.range_end &&
          'bg-primary text-primary-foreground hover:bg-primary/90',
        modifiers.range_middle &&
          'rounded-none bg-transparent text-foreground hover:bg-primary/10',
        isSelectedSingle &&
          'bg-primary text-primary-foreground hover:bg-primary/90',
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
