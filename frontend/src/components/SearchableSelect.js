import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

/**
 * @param {Object} props
 * @param {Array<{value: string, label: string, icon?: string, description?: string}>} props.options
 * @param {Array<{value: string, label: string, icon?: string, description?: string}>} [props.priorityOptions] – shown above a separator
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {string} [props.searchPlaceholder]
 * @param {string} [props.emptyMessage]
 * @param {string} [props.createLabel] – label for the "create new" button shown at the bottom
 * @param {(searchText: string) => void} [props.onCreate] – callback when "create new" is clicked, receives current search text
 * @param {string} [props.className]
 * @param {boolean} [props.disabled]
 */
export default function SearchableSelect({
  options = [],
  priorityOptions,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results found',
  createLabel,
  onCreate,
  className,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hlIndex, setHlIndex] = useState(0);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
    if (!open) {
      setSearch('');
      setHlIndex(0);
    }
  }, [open]);

  const filterFn = (opt) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      opt.description?.toLowerCase().includes(q)
    );
  };

  const hasPriority = priorityOptions && priorityOptions.length > 0;
  const filteredPriority = hasPriority ? priorityOptions.filter(filterFn) : [];
  const filteredOptions = options.filter(filterFn);
  const totalResults = filteredPriority.length + filteredOptions.length;
  const hasCreate = !!onCreate;
  const itemCount = totalResults + (hasCreate ? 1 : 0);

  const allOptions = hasPriority ? [...priorityOptions, ...options] : options;
  const selected = allOptions.find((o) => o.value === value);

  const flatFiltered = [...filteredPriority, ...filteredOptions];

  useEffect(() => {
    setHlIndex(0);
  }, [search]);

  const scrollToIndex = useCallback((idx) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-item]');
    items[idx]?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleSelect = (val) => {
    onChange?.(val);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHlIndex((prev) => {
        const next = prev < itemCount - 1 ? prev + 1 : 0;
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHlIndex((prev) => {
        const next = prev > 0 ? prev - 1 : itemCount - 1;
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hlIndex < totalResults) {
        handleSelect(flatFiltered[hlIndex].value);
      } else if (hasCreate) {
        onCreate(search.trim());
        setOpen(false);
      }
    }
  };

  const renderItem = (opt, idx) => (
    <button
      key={opt.value}
      type="button"
      data-item
      onClick={() => handleSelect(opt.value)}
      onMouseEnter={() => setHlIndex(idx)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm transition-colors',
        idx === hlIndex ? 'bg-accent' : 'hover:bg-accent',
        value === opt.value && idx !== hlIndex && 'bg-accent/50'
      )}
    >
      {opt.icon && <span className="text-base leading-none">{opt.icon}</span>}
      <span className="flex-1 text-left truncate">{opt.label}</span>
      {opt.description && (
        <span className="text-muted-foreground text-xs">{opt.description}</span>
      )}
      {value === opt.value && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );

  let runningIdx = 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.icon && <span className="text-base leading-none">{selected.icon}</span>}
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredPriority.map((opt) => {
            const idx = runningIdx++;
            return renderItem(opt, idx);
          })}
          {filteredPriority.length > 0 && filteredOptions.length > 0 && (
            <Separator className="my-1" />
          )}
          {filteredOptions.map((opt) => {
            const idx = runningIdx++;
            return renderItem(opt, idx);
          })}
          {totalResults === 0 && !onCreate && (
            <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
          )}
          {totalResults === 0 && onCreate && (
            <p className="text-sm text-muted-foreground text-center pt-3 pb-1">{emptyMessage}</p>
          )}
        </div>
        {onCreate && (
          <>
            <Separator />
            <button
              type="button"
              data-item
              onClick={() => {
                onCreate(search.trim());
                setOpen(false);
              }}
              onMouseEnter={() => setHlIndex(totalResults)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary transition-colors',
                hlIndex === totalResults ? 'bg-accent' : 'hover:bg-accent'
              )}
            >
              <Plus className="h-4 w-4" />
              {createLabel}{search.trim() ? `: ${search.trim()}` : ''}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
