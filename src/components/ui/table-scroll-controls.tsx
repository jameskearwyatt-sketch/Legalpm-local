import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: 0, width: 0, visible: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    
    const overflow = scrollWidth > clientWidth + 2;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 2);
    
    // Get position for fixed controls
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const isVisible = rect.top < viewportHeight && rect.bottom > 100;
    
    setPosition({
      left: rect.left,
      width: rect.width,
      visible: isVisible && overflow,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !mounted) return;

    // Check immediately and after delays for dynamic content
    updateScrollState();
    const t1 = setTimeout(updateScrollState, 100);
    const t2 = setTimeout(updateScrollState, 500);
    const t3 = setTimeout(updateScrollState, 1000);
    
    el.addEventListener('scroll', updateScrollState);
    window.addEventListener('scroll', updateScrollState, true);
    window.addEventListener('resize', updateScrollState);
    
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('scroll', updateScrollState, true);
      window.removeEventListener('resize', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, mounted]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    el.scrollBy({
      left: direction === 'left' ? -250 : 250,
      behavior: 'smooth'
    });
  };

  const showControls = mounted && position.visible;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div 
        ref={scrollRef} 
        className="overflow-x-auto"
      >
        {children}
      </div>
      
      {/* Fixed floating controls via portal */}
      {showControls && createPortal(
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            left: `${position.left + position.width / 2}px`,
            transform: 'translateX(-50%)',
            zIndex: 99999,
            pointerEvents: 'auto',
          }}
        >
          <div 
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-2xl px-4 py-2"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
          >
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                "p-1 rounded-full transition-opacity",
                canScrollLeft ? "opacity-100 hover:bg-white/20" : "opacity-30 cursor-not-allowed"
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium px-1">← Scroll →</span>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                "p-1 rounded-full transition-opacity",
                canScrollRight ? "opacity-100 hover:bg-white/20" : "opacity-30 cursor-not-allowed"
              )}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
