import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'collapsible-section-state';

function readPersistedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistState(key, isOpen) {
  const state = readPersistedState();
  state[key] = isOpen;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const SECTION_VARIANTS = {
  sources: { accent: '', iconColor: '' },
  expenses: { accent: '', iconColor: '' },
  feedOrders: { accent: '', iconColor: '' },
  sales: { accent: '', iconColor: '' },
};

export default function CollapsibleSection({
  title,
  icon: Icon,
  count,
  subtitle,
  headerExtra,
  expandTo,
  onAdd,
  defaultOpen = true,
  persistKey,
  maxHeight = 320,
  children,
  items,
  renderItem,
  variant,
  className,
}) {
  const [open, setOpen] = useState(() => {
    if (persistKey) {
      const saved = readPersistedState();
      if (saved[persistKey] !== undefined) return saved[persistKey];
    }
    return defaultOpen;
  });
  const navigate = useNavigate();

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (persistKey) persistState(persistKey, next);
      return next;
    });
  }, [persistKey]);

  const displayItems = items || [];
  const hasContent = displayItems.length > 0 || children;
  const v = variant ? SECTION_VARIANTS[variant] : null;

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', v?.accent, className)}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={cn('h-4 w-4 shrink-0', v?.iconColor || 'text-muted-foreground')} />}
          <span className="font-semibold text-sm truncate">{title}</span>
          {headerExtra ? (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              {headerExtra}
            </div>
          ) : (
            <>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {count ?? displayItems.length}
              </Badge>
              {subtitle && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-mono">
                  {subtitle}
                </Badge>
              )}
            </>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0', !open && '-rotate-90')} />
      </button>

      <div className={cn(
        'grid transition-all duration-200',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}>
        <div className="overflow-hidden">
          {renderItem && displayItems.length > 0 ? (
            <div className="border-t divide-y overflow-y-auto" style={{ maxHeight }}>
              {displayItems.map((item, i) => renderItem(item, i))}
            </div>
          ) : !renderItem && children ? (
            <div className="border-t divide-y overflow-y-auto" style={{ maxHeight }}>
              {children}
            </div>
          ) : !hasContent ? (
            <div className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
              No items yet
            </div>
          ) : null}
        </div>
      </div>

      {(expandTo || onAdd) && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t bg-muted/20">
          {expandTo && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(expandTo)}>
              <Maximize2 className="h-3 w-3" />
              Expand
            </Button>
          )}
          {onAdd && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onAdd}>
              <Plus className="h-3 w-3" />
              Add
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
