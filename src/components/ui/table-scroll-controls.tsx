import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableScrollControlsProps {
  children: React.ReactNode;
  className?: string;
}

export function TableScrollControls({ children, className }: TableScrollControlsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll);
    
    // Also check on resize
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = el.clientWidth * 0.6;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const showControls = canScrollLeft || canScrollRight;

  return (
    <div className={cn("relative", className)}>
      <div 
        ref={scrollRef} 
        className="overflow-x-auto"
      >
        {children}
      </div>
      
      {/* Floating scroll controls */}
      {showControls && (
        <div className="sticky bottom-0 left-0 right-0 flex justify-center py-2 bg-gradient-to-t from-background/80 to-transparent pointer-events-none z-10">
          <div className="flex items-center gap-2 pointer-events-auto bg-background/95 backdrop-blur-sm border rounded-full shadow-lg px-1 py-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                "p-2 rounded-full transition-all",
                canScrollLeft 
                  ? "hover:bg-muted text-foreground" 
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs text-muted-foreground px-2 select-none">Scroll</span>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                "p-2 rounded-full transition-all",
                canScrollRight 
                  ? "hover:bg-muted text-foreground" 
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
