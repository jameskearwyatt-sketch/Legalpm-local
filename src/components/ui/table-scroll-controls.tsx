import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TableScrollControlsProps {
  children: React.ReactNode;
  className?: string;
}

export function TableScrollControls({ children, className }: TableScrollControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: 0, width: 0, visible: false });
  const [scrollableEl, setScrollableEl] = useState<HTMLElement | null>(null);
  const [scrollInfo, setScrollInfo] = useState({ thumbWidth: 0, thumbLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find the actual scrollable element
  useEffect(() => {
    if (!containerRef.current || !mounted) return;
    
    const findScrollable = () => {
      const container = containerRef.current;
      if (!container) return null;
      
      const candidates = container.querySelectorAll('div');
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.overflowX === 'auto' || style.overflow === 'auto') {
          // Accept elements that have overflow-x:auto even if not yet overflowing
          // The scroll state check will handle visibility
          return el as HTMLElement;
        }
      }
      return null;
    };

    const tryFind = () => {
      const el = findScrollable();
      if (el && el !== scrollableEl) setScrollableEl(el);
    };

    // Try immediately and at intervals to catch late-loading content
    tryFind();
    const t1 = setTimeout(tryFind, 100);
    const t2 = setTimeout(tryFind, 500);
    const t3 = setTimeout(tryFind, 1500);

    // Also watch for DOM changes (new table rows loading)
    const observer = new MutationObserver(() => {
      tryFind();
    });
    observer.observe(containerRef.current, { childList: true, subtree: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      observer.disconnect();
    };
  }, [mounted, scrollableEl]);

  const updateScrollState = useCallback(() => {
    const el = scrollableEl;
    const container = containerRef.current;
    if (!el || !container) return;
    
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    
    const overflow = scrollWidth > clientWidth + 2;
    
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const isInView = rect.top < viewportHeight && rect.bottom > 60;
    
    // Check if user has scrolled to the bottom of the table
    // The native horizontal scrollbar becomes visible when the bottom of the container is in view
    // We hide the floating scrollbar when the bottom of the table (with some buffer for the scrollbar) is visible
    const scrollbarHeight = 20; // Approximate height of native scrollbar area
    const bottomBuffer = 30; // Buffer zone - hide floating bar when native scrollbar is visible
    const isAtBottom = rect.bottom <= viewportHeight + bottomBuffer;
    
    // Only show floating scrollbar if table is in view, has overflow, AND user hasn't scrolled to bottom
    const shouldShow = isInView && overflow && !isAtBottom;
    
    // Calculate thumb size and position relative to track
    const trackWidth = Math.min(rect.width * 0.6, 300); // Track width
    const ratio = clientWidth / scrollWidth;
    const thumbWidth = Math.max(trackWidth * ratio, 40); // Min thumb size
    const maxThumbLeft = trackWidth - thumbWidth;
    const scrollRatio = scrollLeft / (scrollWidth - clientWidth);
    const thumbLeft = maxThumbLeft * scrollRatio;
    
    setScrollInfo({ thumbWidth, thumbLeft });
    setPosition({
      left: rect.left,
      width: rect.width,
      visible: shouldShow,
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

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollableEl) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, scrollLeft: scrollableEl.scrollLeft };
  };

  useEffect(() => {
    if (!isDragging || !scrollableEl) return;

    const handleMouseMove = (e: MouseEvent) => {
      const trackWidth = Math.min(position.width * 0.6, 300);
      const scrollWidth = scrollableEl.scrollWidth;
      const clientWidth = scrollableEl.clientWidth;
      const maxScroll = scrollWidth - clientWidth;
      
      const deltaX = e.clientX - dragStartRef.current.x;
      const scrollPerPixel = maxScroll / (trackWidth - scrollInfo.thumbWidth);
      const newScrollLeft = dragStartRef.current.scrollLeft + deltaX * scrollPerPixel;
      
      scrollableEl.scrollLeft = Math.max(0, Math.min(maxScroll, newScrollLeft));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, scrollableEl, position.width, scrollInfo.thumbWidth]);

  // Handle track click
  const handleTrackClick = (e: React.MouseEvent) => {
    if (!scrollableEl || !trackRef.current) return;
    
    const trackRect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const trackWidth = trackRect.width;
    const scrollWidth = scrollableEl.scrollWidth;
    const clientWidth = scrollableEl.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    
    const scrollRatio = clickX / trackWidth;
    scrollableEl.scrollTo({
      left: maxScroll * scrollRatio,
      behavior: 'smooth'
    });
  };

  const showControls = mounted && position.visible;
  const trackWidth = Math.min(position.width * 0.6, 300);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {children}
      
      {showControls && createPortal(
        <div 
          style={{
            position: 'fixed',
            bottom: '80px',
            left: `${position.left + position.width / 2}px`,
            transform: 'translateX(-50%)',
            zIndex: 40, // Below dialogs (z-50) but above normal content
          }}
          className="animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="bg-card border border-border rounded-lg shadow-lg p-2 backdrop-blur-sm">
            {/* Scrollbar track */}
            <div
              ref={trackRef}
              onClick={handleTrackClick}
              className="relative h-3 bg-secondary rounded-full cursor-pointer"
              style={{ width: trackWidth }}
            >
              {/* Scrollbar thumb */}
              <div
                onMouseDown={handleMouseDown}
                className={cn(
                  "absolute top-0.5 h-2 rounded-full transition-colors cursor-grab",
                  isDragging 
                    ? "bg-primary cursor-grabbing" 
                    : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
                )}
                style={{
                  width: scrollInfo.thumbWidth,
                  left: scrollInfo.thumbLeft,
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
