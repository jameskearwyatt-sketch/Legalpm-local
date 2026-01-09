import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface StickyTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Provides sticky header behavior for tables that also need horizontal scrolling.
 * Uses JavaScript to clone and fix the header when it scrolls out of view.
 */
export function StickyTableHeader({ children, className }: StickyTableHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [headerInfo, setHeaderInfo] = useState<{
    html: string;
    width: number;
    left: number;
    columnWidths: number[];
    scrollLeft: number;
  } | null>(null);

  const updateHeader = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const thead = container.querySelector('thead');
    const table = container.querySelector('table');
    const scrollableDiv = container.querySelector('div[style*="overflow"]') || 
                          container.querySelector('.overflow-x-auto') ||
                          container.querySelector('div');
    
    if (!thead || !table) return;

    const theadRect = thead.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Check if thead is above viewport (scrolled past)
    const shouldStick = theadRect.top < 0 && containerRect.bottom > thead.offsetHeight;
    
    setIsSticky(shouldStick);

    if (shouldStick) {
      // Get column widths from th elements
      const ths = thead.querySelectorAll('th');
      const columnWidths: number[] = [];
      ths.forEach(th => {
        columnWidths.push(th.getBoundingClientRect().width);
      });

      // Get scroll position of the scrollable container
      const scrollLeft = scrollableDiv instanceof HTMLElement ? scrollableDiv.scrollLeft : 0;

      setHeaderInfo({
        html: thead.innerHTML,
        width: table.offsetWidth,
        left: containerRect.left,
        columnWidths,
        scrollLeft,
      });
    }
  }, []);

  useEffect(() => {
    updateHeader();
    
    window.addEventListener('scroll', updateHeader, true);
    window.addEventListener('resize', updateHeader);
    
    // Also listen for horizontal scroll on scrollable containers
    const container = containerRef.current;
    if (container) {
      const scrollable = container.querySelector('div[style*="overflow"]') || 
                        container.querySelector('.overflow-x-auto') ||
                        container.querySelector('div');
      if (scrollable) {
        scrollable.addEventListener('scroll', updateHeader);
      }
    }

    return () => {
      window.removeEventListener('scroll', updateHeader, true);
      window.removeEventListener('resize', updateHeader);
    };
  }, [updateHeader]);

  // Sync scroll position when clicking on fixed header
  const handleFixedHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    
    const scrollable = container.querySelector('div[style*="overflow"]') || 
                      container.querySelector('.overflow-x-auto') ||
                      container.querySelector('div');
    if (scrollable instanceof HTMLElement) {
      scrollable.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {children}
      
      {isSticky && headerInfo && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: headerInfo.left,
            width: `calc(100vw - ${headerInfo.left}px - 16px)`,
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: headerInfo.width,
              transform: `translateX(-${headerInfo.scrollLeft}px)`,
            }}
          >
            <table 
              className="w-full caption-bottom text-sm"
              style={{ 
                tableLayout: 'fixed',
                width: headerInfo.width,
              }}
            >
              <colgroup>
                {headerInfo.columnWidths.map((width, i) => (
                  <col key={i} style={{ width }} />
                ))}
              </colgroup>
              <thead 
                className="bg-background [&_tr]:border-b border-b shadow-sm"
                dangerouslySetInnerHTML={{ __html: headerInfo.html }}
              />
            </table>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
