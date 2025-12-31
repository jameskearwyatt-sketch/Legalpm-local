import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableScrollControlsProps {
  children: React.ReactNode;
  className?: string;
}

export function TableScrollControls({ children, className }: TableScrollControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: 0, width: 0, visible: false });
  const [scrollableEl, setScrollableEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find the actual scrollable element (the Table component's internal div)
  useEffect(() => {
    if (!containerRef.current) return;
    
    const findScrollable = () => {
      const container = containerRef.current;
      if (!container) return null;
      
      const candidates = container.querySelectorAll('div');
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.overflowX === 'auto' || style.overflow === 'auto') {
          if (el.scrollWidth > el.clientWidth) {
            return el as HTMLElement;
          }
        }
      }
      return null;
    };

    const t1 = setTimeout(() => {
      const el = findScrollable();
      if (el) setScrollableEl(el);
    }, 100);
    
    const t2 = setTimeout(() => {
      const el = findScrollable();
      if (el) setScrollableEl(el);
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mounted]);

  const updateScrollState = useCallback(() => {
    const el = scrollableEl;
    const container = containerRef.current;
    if (!el || !container) return;
    
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    
    const overflow = scrollWidth > clientWidth + 2;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 2);
    
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const isVisible = rect.top < viewportHeight && rect.bottom > 60;
    
    setPosition({
      left: rect.left,
      width: rect.width,
      visible: isVisible && overflow,
    });
  }, [scrollableEl]);

  useEffect(() => {
    if (!scrollableEl || !mounted) return;

    updateScrollState();
    
    scrollableEl.addEventListener('scroll', updateScrollState);
    window.addEventListener('scroll', updateScrollState, true);
    window.addEventListener('resize', updateScrollState);
    
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollableEl);

    return () => {
      scrollableEl.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('scroll', updateScrollState, true);
      window.removeEventListener('resize', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, scrollableEl, mounted]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollableEl) return;
    
    scrollableEl.scrollBy({
      left: direction === 'left' ? -250 : 250,
      behavior: 'smooth'
    });
  };

  const showControls = mounted && position.visible;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {children}
      
      {/* Fixed floating controls via portal - styled to match app theme */}
      {showControls && createPortal(
        <div 
          style={{
            position: 'fixed',
            bottom: '20px',
            left: `${position.left + position.width / 2}px`,
            transform: 'translateX(-50%)',
            zIndex: 99999,
          }}
          className="animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg shadow-lg px-2 py-1.5 backdrop-blur-sm">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                "p-1.5 rounded-md transition-all",
                canScrollLeft 
                  ? "text-foreground hover:bg-secondary active:bg-secondary/80" 
                  : "text-muted-foreground/30 cursor-not-allowed"
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-1.5 px-2 border-x border-border">
              <MoveHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Scroll</span>
            </div>
            
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                "p-1.5 rounded-md transition-all",
                canScrollRight 
                  ? "text-foreground hover:bg-secondary active:bg-secondary/80" 
                  : "text-muted-foreground/30 cursor-not-allowed"
              )}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
