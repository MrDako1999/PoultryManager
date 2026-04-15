import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { priorityCountries, otherCountries } from '@/lib/countries';

export default function PhoneInput({ value, onChange, className, disabled }) {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState(priorityCountries[0]);
  const [search, setSearch] = useState('');
  const [localNumber, setLocalNumber] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (value) {
      const match = [...priorityCountries, ...otherCountries].find((c) =>
        value.startsWith(c.dial)
      );
      if (match) {
        setCountry(match);
        setLocalNumber(value.slice(match.dial.length).trim());
      }
    }
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  const handleCountrySelect = (c) => {
    setCountry(c);
    setOpen(false);
    setSearch('');
    const full = localNumber ? `${c.dial} ${localNumber}` : '';
    onChange?.(full);
  };

  const handleNumberChange = (e) => {
    const num = e.target.value.replace(/[^\d\s]/g, '');
    const digitsOnly = num.replace(/\s/g, '');
    if (digitsOnly.length > 15) return;
    setLocalNumber(num);
    onChange?.(num ? `${country.dial} ${num}` : '');
  };

  const filteredPriority = priorityCountries.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search)
  );
  const filteredOther = otherCountries.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search)
  );

  return (
    <div className={cn('flex', disabled && 'opacity-60', className)}>
      <Popover open={disabled ? false : open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:bg-background"
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-muted-foreground">{country.dial}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ScrollArea className="h-64">
            <div className="p-1">
              {filteredPriority.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                    country.code === c.code && 'bg-accent'
                  )}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.dial}</span>
                </button>
              ))}
              {filteredPriority.length > 0 && filteredOther.length > 0 && (
                <Separator className="my-1" />
              )}
              {filteredOther.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                    country.code === c.code && 'bg-accent'
                  )}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.dial}</span>
                </button>
              ))}
              {filteredPriority.length === 0 && filteredOther.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No countries found</p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <input
        type="tel"
        value={localNumber}
        onChange={handleNumberChange}
        maxLength={18}
        disabled={disabled}
        placeholder="50 123 4567"
        className="flex h-10 w-full rounded-r-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
