import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function InfoTip({ children, className, side = 'top' }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className={`max-w-xs text-xs text-muted-foreground leading-relaxed ${className || ''}`}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
