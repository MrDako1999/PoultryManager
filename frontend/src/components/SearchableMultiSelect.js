import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Plus, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/**
 * @param {Object} props
 * @param {Array<{value: string, label: string, description?: string}>} props.options
 * @param {Array<string>} props.value - selected values
 * @param {(value: Array<string>) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {string} [props.searchPlaceholder]
 * @param {string} [props.emptyMessage]
 * @param {string} [props.createLabel]
 * @param {() => void} [props.onCreate]
 * @param {string} [props.className]
 * @param {"default"|"dropdown"} [props.variant] - "default" for form fields (badges in trigger), "dropdown" for filter bars (compact button trigger)
 */
export default function SearchableMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search options…',
  emptyMessage = 'No results found',
  createLabel,
  onCreate,
  className,
  variant = 'default',
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
    if (!open) setSearch('');
  }, [open]);

  const filtered = options.filter((opt) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.description?.toLowerCase().includes(q)
    );
  });

  const toggle = (val) => {
    const next = value.includes(val)
      ? value.filter((v) => v !== val)
      : [...value, val];
    onChange?.(next);
  };

  const allSelected = options.length > 0 && value.length === options.length;

  const toggleAll = () => {
    if (allSelected) {
      onChange?.([]);
    } else {
      onChange?.(options.map((o) => o.value));
    }
  };

  const remove = (val) => {
    onChange?.(value.filter((v) => v !== val));
  };

  const selectedOptions = options.filter((o) => value.includes(o.value));

  const isDropdown = variant === 'dropdown';

  const triggerLabel = isDropdown
    ? value.length === 0
      ? placeholder
      : value.length === 1
        ? selectedOptions[0]?.label || placeholder
        : `${value.length} selected`
    : null;

  const dropdownList = (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-md">
      {/* Search bar inside dropdown */}
      {(isDropdown || options.length > 5) && (
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={isDropdown ? searchRef : undefined}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div
        className="max-h-52 overflow-y-auto p-1"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* "All" toggle for dropdown variant */}
        {isDropdown && !search && (
          <button
            type="button"
            onClick={toggleAll}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
              allSelected && 'bg-accent/50',
            )}
          >
            <div className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
              allSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/40',
            )}>
              {allSelected && <Check className="h-3 w-3" />}
            </div>
            <span className="flex-1 text-left font-medium">All {placeholder}</span>
          </button>
        )}

        {filtered.map((opt) => {
          const isSelected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                isSelected && 'bg-accent/50',
              )}
            >
              <div className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/40',
              )}>
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <span className={cn('flex-1 text-left truncate', isSelected && 'font-medium')}>{opt.label}</span>
              {opt.description && (
                <span className="text-muted-foreground text-xs truncate">{opt.description}</span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && !onCreate && (
          <p className="text-sm text-muted-foreground text-center py-3">{emptyMessage}</p>
        )}
      </div>

      {/* Footer: Clear all / Done (dropdown) or Create (default) */}
      {isDropdown ? (
        <>
          <Separator />
          <div className="flex items-center justify-between px-2 py-1.5">
            <button
              type="button"
              onClick={() => { onChange?.([]); }}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={close}
              className="px-2 py-1 text-xs font-medium text-foreground hover:text-foreground/80 transition-colors"
            >
              Done
            </button>
          </div>
        </>
      ) : (
        onCreate && (
          <>
            <Separator />
            <button
              type="button"
              onClick={() => { onCreate(); close(); }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              {createLabel}
            </button>
          </>
        )
      )}
    </div>
  );

  // Dropdown variant: compact button trigger
  if (isDropdown) {
    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-white dark:bg-card px-3 text-sm ring-offset-background transition-colors',
            'hover:bg-accent/50',
            open && 'ring-2 ring-ring ring-offset-2',
            value.length === 0 && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open && dropdownList}
      </div>
    );
  }

  // Default variant: badge-based trigger for forms
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-[2.5rem] w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background cursor-text',
          open && 'ring-2 ring-ring ring-offset-2',
        )}
        onClick={() => setOpen(true)}
      >
        {selectedOptions.map((opt) => (
          <Badge key={opt.value} variant="secondary" className="gap-1 pr-1">
            <span className="truncate max-w-[120px]">{opt.label}</span>
            <button
              type="button"
              className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                remove(opt.value);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {selectedOptions.length === 0 && !open && (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {open && (
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={selectedOptions.length > 0 ? searchPlaceholder : placeholder}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        )}
      </div>
      {open && dropdownList}
    </div>
  );
}
