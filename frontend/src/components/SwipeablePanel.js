import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const EDGE_ZONE = 24;
const DISMISS_RATIO = 0.3;
const VELOCITY_THRESHOLD = 0.4;

export default function SwipeablePanel({ open, onSwipeRight, children, className }) {
  const panelRef = useRef(null);
  const tracking = useRef(false);
  const startX = useRef(0);
  const startTime = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    if (touch.clientX > EDGE_ZONE) return;
    tracking.current = true;
    startX.current = touch.clientX;
    startTime.current = Date.now();
    currentX.current = touch.clientX;
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!tracking.current) return;
    currentX.current = e.touches[0].clientX;
    const dx = Math.max(0, currentX.current - startX.current);
    if (panelRef.current) {
      panelRef.current.style.transform = `translateX(${dx}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!tracking.current) return;
    tracking.current = false;

    const dx = currentX.current - startX.current;
    const dt = (Date.now() - startTime.current) / 1000;
    const velocity = dt > 0 ? dx / dt / window.innerWidth : 0;
    const dismissed = dx > window.innerWidth * DISMISS_RATIO || velocity > VELOCITY_THRESHOLD;

    if (panelRef.current) {
      panelRef.current.style.transition = '';
      panelRef.current.style.transform = '';
    }

    if (dismissed) {
      onSwipeRight?.();
    }
  }, [onSwipeRight]);

  return (
    <div
      ref={panelRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'absolute inset-0 bg-background transition-transform duration-300 ease-out will-change-transform',
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
