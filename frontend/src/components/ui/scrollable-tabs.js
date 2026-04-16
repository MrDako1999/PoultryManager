import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ScrollableTabs({ children, className }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();

    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener('scroll', updateScrollState, { passive: true });

    const handleClick = (e) => {
      const trigger = e.target.closest('[role="tab"]');
      if (trigger) {
        requestAnimationFrame(() => {
          const cRect = el.getBoundingClientRect();
          const tRect = trigger.getBoundingClientRect();
          const offset = tRect.left - cRect.left + tRect.width / 2 - cRect.width / 2;
          el.scrollBy({ left: offset, behavior: 'smooth' });
        });
      }
    };
    el.addEventListener('click', handleClick);

    // Center active tab on mount
    const active = el.querySelector('[data-state="active"]');
    if (active) {
      const cRect = el.getBoundingClientRect();
      const tRect = active.getBoundingClientRect();
      const offset = tRect.left - cRect.left + tRect.width / 2 - cRect.width / 2;
      el.scrollLeft += offset;
    }

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateScrollState);
      el.removeEventListener('click', handleClick);
    };
  }, [updateScrollState]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 120, behavior: 'smooth' });
  };

  return (
    <div className={cn('relative', className)}>
      <div ref={scrollRef} className="overflow-x-auto scrollbar-hide">
        {children}
      </div>

      <button
        type="button"
        onClick={() => scroll(-1)}
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-md border bg-background/90 shadow-sm transition-opacity z-10',
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-label="Scroll tabs left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => scroll(1)}
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-md border bg-background/90 shadow-sm transition-opacity z-10',
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-label="Scroll tabs right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
