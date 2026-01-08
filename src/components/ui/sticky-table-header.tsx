import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface StickyTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function StickyTableHeader({ children, className }: StickyTableHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [stickyInfo, setStickyInfo] = useState({
    show: false,
    left: 0,
    width: 0,
    scrollLeft: 0,
  });
  const [theadClone, setTheadClone] = useState<HTMLElement | null>(null);
  const [scrollableEl, setScrollableEl] = useState<HTMLElement | null>(null);
  const [colStyles, setColStyles] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find the scrollable element and thead
  useEffect(() => {
    if (!containerRef.current) return;

    const findElements = () => {
      const container = containerRef.current;
      if (!container) return { scrollable: null, thead: null };

      // Find scrollable div
      const candidates = container.querySelectorAll('div');
      let scrollable: HTMLElement | null = null;
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.overflowX === 'auto' || style.overflow === 'auto') {
          if (el.scrollWidth > el.clientWidth) {
            scrollable = el as HTMLElement;
            break;
          }
        }
      }

      // Find thead
      const thead = container.querySelector('thead');

      return { scrollable, thead };
    };

    const t1 = setTimeout(() => {
      const { scrollable, thead } = findElements();
      if (scrollable) setScrollableEl(scrollable);
      if (thead) setTheadClone(thead);
    }, 100);

    const t2 = setTimeout(() => {
      const { scrollable, thead } = findElements();
      if (scrollable) setScrollableEl(scrollable);
      if (thead) setTheadClone(thead);
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mounted]);

  // Generate colgroup styles from actual column widths
  const captureColumnWidths = useCallback(() => {
    if (!theadClone) return;
    
    const headerCells = theadClone.querySelectorAll('th');
    const widths: number[] = [];
    headerCells.forEach((cell) => {
      widths.push(cell.getBoundingClientRect().width);
    });
    
    if (widths.length > 0) {
      const colgroup = `<colgroup>${widths.map(w => `<col style="width:${w}px;min-width:${w}px;"/>`).join('')}</colgroup>`;
      setColStyles(colgroup);
    }
  }, [theadClone]);

  const updateStickyState = useCallback(() => {
    const container = containerRef.current;
    const thead = theadClone;
    if (!container || !thead) return;

    const containerRect = container.getBoundingClientRect();
    const theadRect = thead.getBoundingClientRect();

    // Show sticky header when original thead is scrolled above viewport
    // Account for mobile header (64px / 4rem)
    const topOffset = window.innerWidth < 1024 ? 64 : 0;
    const shouldShow = theadRect.top < topOffset && containerRect.bottom > topOffset + 60;

    // Capture column widths when about to show
    if (shouldShow) {
      captureColumnWidths();
    }

    setStickyInfo({
      show: shouldShow,
      left: containerRect.left,
      width: containerRect.width,
      scrollLeft: scrollableEl?.scrollLeft || 0,
    });
  }, [theadClone, scrollableEl, captureColumnWidths]);

  useEffect(() => {
    if (!mounted || !theadClone) return;

    captureColumnWidths();
    updateStickyState();

    window.addEventListener('scroll', updateStickyState, true);
    window.addEventListener('resize', updateStickyState);
    scrollableEl?.addEventListener('scroll', updateStickyState);

    const resizeObserver = new ResizeObserver(() => {
      captureColumnWidths();
      updateStickyState();
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('scroll', updateStickyState, true);
      window.removeEventListener('resize', updateStickyState);
      scrollableEl?.removeEventListener('scroll', updateStickyState);
      resizeObserver.disconnect();
    };
  }, [updateStickyState, captureColumnWidths, mounted, theadClone, scrollableEl]);

  // Sync horizontal scroll when sticky header is shown
  const handleStickyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (scrollableEl) {
      scrollableEl.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const topOffset = typeof window !== 'undefined' && window.innerWidth < 1024 ? 64 : 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {children}

      {/* Fixed sticky header clone via portal */}
      {mounted && stickyInfo.show && theadClone && createPortal(
        <div
          style={{
            position: 'fixed',
            top: topOffset,
            left: stickyInfo.left,
            width: stickyInfo.width,
            zIndex: 40,
            overflow: 'hidden',
          }}
          className="bg-background border-b border-border shadow-sm"
        >
          <div
            className="overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={handleStickyScroll}
            ref={(el) => {
              if (el) el.scrollLeft = stickyInfo.scrollLeft;
            }}
          >
            <table 
              className="w-full caption-bottom text-sm border-collapse" 
              style={{ minWidth: scrollableEl?.scrollWidth }}
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(
                  colStyles + `<thead class="bg-background [&_tr]:border-b">${theadClone.innerHTML}</thead>`,
                  { ADD_TAGS: ['colgroup', 'col', 'thead', 'tr', 'th'], ADD_ATTR: ['style', 'class', 'colspan', 'rowspan'] }
                )
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}