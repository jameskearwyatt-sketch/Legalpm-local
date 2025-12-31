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
  const [isVisible, setIsVisible] = useState(false);
  const [controlsStyle, setControlsStyle] = useState<React.CSSProperties>({});

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(hasHorizontalScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  const updateControlsPosition = useCallback(() => {
    const container = containerRef.current;
    const scrollEl = scrollRef.current;
    if (!container || !scrollEl) return;

    const hasHorizontalScroll = scrollEl.scrollWidth > scrollEl.clientWidth;
    if (!hasHorizontalScroll) {
      setIsVisible(false);
      return;
    }

    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Check if container is in viewport
    const isInView = rect.top < viewportHeight && rect.bottom > 0;
    
    if (!isInView) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    
    // Position the controls at the bottom of the visible area of the table
    // or at the bottom of the table if the table bottom is visible
    const tableBottomInView = rect.bottom <= viewportHeight;
    
    if (tableBottomInView) {
      // Table bottom is visible, position controls just above it
      setControlsStyle({
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
      });
    } else {
      // Table extends below viewport, use fixed positioning
      setControlsStyle({
        position: 'fixed',
        bottom: '16px',
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translateX(-50%)',
      });
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial checks
    const timeoutId = setTimeout(() => {
      checkScroll();
      updateControlsPosition();
    }, 100);
    
    el.addEventListener('scroll', checkScroll);
    
    // Check on resize and scroll
    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
      updateControlsPosition();
    });
    resizeObserver.observe(el);
    
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    // Update position on window scroll and resize
    const handleScrollOrResize = () => {
      updateControlsPosition();
    };
    
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      clearTimeout(timeoutId);
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      resizeObserver.disconnect();
    };
  }, [checkScroll, updateControlsPosition]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = Math.min(el.clientWidth * 0.6, 400);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const showControls = isVisible && (canScrollLeft || canScrollRight);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div 
        ref={scrollRef} 
        className="overflow-x-auto"
      >
        {children}
      </div>
      
      {/* Floating scroll controls */}
      {showControls && (
        <div 
          style={controlsStyle}
          className="z-50 pointer-events-auto"
        >
          <div className="flex items-center gap-1 bg-background border-2 border-border rounded-full shadow-xl px-2 py-1.5">
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
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs text-muted-foreground px-2 select-none font-medium">Scroll</span>
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
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
