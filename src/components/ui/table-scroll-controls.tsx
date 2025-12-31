import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableScrollControlsProps {
  children: React.ReactNode;
  className?: string;
}

export function TableScrollControls({ children, className }: TableScrollControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(hasHorizontalScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial check after a brief delay to allow content to render
    const timeoutId = setTimeout(checkScroll, 100);
    
    el.addEventListener('scroll', checkScroll);
    
    // Check on resize
    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(el);
    
    // Also observe children for size changes
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    // Check when window resizes
    window.addEventListener('resize', checkScroll);

    return () => {
      clearTimeout(timeoutId);
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = Math.min(el.clientWidth * 0.6, 400);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const showControls = canScrollLeft || canScrollRight;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div 
        ref={scrollRef} 
        className="overflow-x-auto"
      >
        {children}
      </div>
      
      {/* Floating scroll controls - positioned at the bottom of the container */}
      {showControls && (
        <div className="sticky bottom-2 left-0 right-0 flex justify-center pointer-events-none z-20 -mt-12 pb-2">
          <div className="flex items-center gap-1 pointer-events-auto bg-background border rounded-full shadow-lg px-1.5 py-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                "p-1.5 rounded-full transition-all",
                canScrollLeft 
                  ? "hover:bg-muted text-foreground" 
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground px-1 select-none">←→</span>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                "p-1.5 rounded-full transition-all",
                canScrollRight 
                  ? "hover:bg-muted text-foreground" 
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
