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
  const [showControls, setShowControls] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 0, width: 0 });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const hasHorizontalScroll = el.scrollWidth > el.clientWidth + 5;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(hasHorizontalScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    
    return hasHorizontalScroll;
  }, []);

  const updatePosition = useCallback(() => {
    const container = containerRef.current;
    const scrollEl = scrollRef.current;
    if (!container || !scrollEl) return;

    const hasHorizontalScroll = scrollEl.scrollWidth > scrollEl.clientWidth + 5;
    
    if (!hasHorizontalScroll) {
      setShowControls(false);
      return;
    }

    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Check if any part of the container is visible in viewport
    const isPartiallyVisible = rect.top < viewportHeight - 60 && rect.bottom > 60;
    
    if (!isPartiallyVisible) {
      setShowControls(false);
      return;
    }

    setShowControls(true);
    setPosition({
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    // Create portal container
    setPortalContainer(document.body);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial checks with delay for content to render
    const timeoutId = setTimeout(() => {
      checkScroll();
      updatePosition();
    }, 200);
    
    el.addEventListener('scroll', checkScroll);
    
    // ResizeObserver for container and content
    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
      updatePosition();
    });
    resizeObserver.observe(el);
    
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    // Update on scroll and resize
    const handleUpdate = () => {
      checkScroll();
      updatePosition();
    };
    
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Also trigger on any layout changes
    const mutationObserver = new MutationObserver(handleUpdate);
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      clearTimeout(timeoutId);
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [checkScroll, updatePosition]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = Math.min(el.clientWidth * 0.5, 300);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const controlsVisible = showControls && (canScrollLeft || canScrollRight);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div 
        ref={scrollRef} 
        className="overflow-x-auto"
      >
        {children}
      </div>
      
      {/* Portal-based floating controls fixed to viewport bottom */}
      {controlsVisible && portalContainer && createPortal(
        <div 
          style={{
            position: 'fixed',
            bottom: '20px',
            left: `${position.left + position.width / 2}px`,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
        >
          <div className="flex items-center gap-1 bg-background border-2 border-primary/20 rounded-full shadow-2xl px-3 py-2 backdrop-blur-sm">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                "p-2 rounded-full transition-all",
                canScrollLeft 
                  ? "hover:bg-primary/10 text-primary" 
                  : "text-muted-foreground/30 cursor-not-allowed"
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm font-medium text-foreground">Scroll Table</span>
            </div>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                "p-2 rounded-full transition-all",
                canScrollRight 
                  ? "hover:bg-primary/10 text-primary" 
                  : "text-muted-foreground/30 cursor-not-allowed"
              )}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>,
        portalContainer
      )}
    </div>
  );
}
