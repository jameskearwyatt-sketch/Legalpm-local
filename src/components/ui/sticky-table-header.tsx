import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface StickyTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface HeaderInfo {
  html: string;
  tableWidth: number;
  viewportLeft: number;
  viewportWidth: number;
  columnWidths: number[];
  scrollLeft: number;
}

/**
 * Provides sticky header behavior for tables that also need horizontal scrolling.
 * Uses JavaScript to clone and fix the header when it scrolls out of view.
 *
 * IMPORTANT: This component clones the thead element for sticky display.
 * Event handlers on the original thead buttons continue to work because
 * we forward click events from the cloned header to the original.
 */
export function StickyTableHeader({ children, className }: StickyTableHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clonedTheadRef = useRef<HTMLTableSectionElement>(null);
  const scrollableRef = useRef<HTMLElement | null>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [headerInfo, setHeaderInfo] = useState<HeaderInfo | null>(null);

  const getScrollableElement = useCallback((container: HTMLElement, table: HTMLTableElement) => {
    let node: HTMLElement | null = table.parentElement;

    while (node && node !== container) {
      const style = window.getComputedStyle(node);
      const canScrollX =
        style.overflowX === 'auto' ||
        style.overflowX === 'scroll' ||
        style.overflow === 'auto' ||
        style.overflow === 'scroll';

      if (canScrollX) {
        return node;
      }

      node = node.parentElement;
    }

    return table.parentElement instanceof HTMLElement ? table.parentElement : container;
  }, []);

  const updateHeader = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const table = container.querySelector('table');
    const thead = container.querySelector('thead');
    if (!(table instanceof HTMLTableElement) || !(thead instanceof HTMLTableSectionElement)) {
      setIsSticky(false);
      setHeaderInfo(null);
      return;
    }

    const scrollable = getScrollableElement(container, table);
    scrollableRef.current = scrollable;

    const tableRect = table.getBoundingClientRect();
    const theadRect = thead.getBoundingClientRect();
    const viewportRect = scrollable.getBoundingClientRect();

    // Stick only while table body still has vertical room below the viewport top.
    const shouldStick = tableRect.top < 0 && tableRect.bottom > theadRect.height;
    setIsSticky(shouldStick);

    if (!shouldStick) {
      setHeaderInfo(null);
      return;
    }

    const ths = Array.from(thead.querySelectorAll('th'));
    const columnWidths = ths.map((th) => th.getBoundingClientRect().width);

    const tableWidth = table.getBoundingClientRect().width;
    if (tableWidth <= 0 || columnWidths.length === 0) {
      setHeaderInfo(null);
      return;
    }

    setHeaderInfo({
      html: thead.innerHTML,
      tableWidth,
      viewportLeft: viewportRect.left,
      viewportWidth: viewportRect.width,
      columnWidths,
      scrollLeft: scrollable.scrollLeft,
    });
  }, [getScrollableElement]);

  useEffect(() => {
    updateHeader();

    window.addEventListener('scroll', updateHeader, true);
    window.addEventListener('resize', updateHeader);

    const container = containerRef.current;
    const table = container?.querySelector('table');
    const scrollable = container && table instanceof HTMLTableElement
      ? getScrollableElement(container, table)
      : null;

    if (scrollable) {
      scrollableRef.current = scrollable;
      scrollable.addEventListener('scroll', updateHeader);
    }

    const resizeObserver = new ResizeObserver(updateHeader);
    if (table instanceof HTMLTableElement) resizeObserver.observe(table);
    if (scrollable) resizeObserver.observe(scrollable);

    return () => {
      window.removeEventListener('scroll', updateHeader, true);
      window.removeEventListener('resize', updateHeader);
      if (scrollableRef.current) {
        scrollableRef.current.removeEventListener('scroll', updateHeader);
      }
      resizeObserver.disconnect();
    };
  }, [getScrollableElement, updateHeader]);

  // Handle clicks on the cloned header - forward them to the original header buttons
  const handleClonedHeaderClick = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    const target = e.target as HTMLElement;
    const container = containerRef.current;
    if (!container) return;

    const clickedButton = target.closest('button');
    if (!clickedButton) return;

    const clickedTh = clickedButton.closest('th');
    if (!clickedTh) return;

    const clonedThead = clonedTheadRef.current;
    if (!clonedThead) return;

    const allClonedThs = Array.from(clonedThead.querySelectorAll('th'));
    const thIndex = allClonedThs.indexOf(clickedTh);
    if (thIndex === -1) return;

    const originalThead = container.querySelector('thead');
    if (!originalThead) return;

    const originalThs = originalThead.querySelectorAll('th');
    const originalTh = originalThs[thIndex];
    if (!originalTh) return;

    const originalButton = originalTh.querySelector('button');
    if (originalButton) {
      originalButton.click();
    }
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {children}

      {isSticky && headerInfo && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: headerInfo.viewportLeft,
            width: headerInfo.viewportWidth,
            zIndex: 20, // Below sticky action bars/dialog triggers
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: headerInfo.tableWidth,
              transform: `translateX(-${headerInfo.scrollLeft}px)`,
            }}
          >
            <table
              className="w-full caption-bottom text-sm"
              style={{
                tableLayout: 'fixed',
                width: headerInfo.tableWidth,
                minWidth: headerInfo.tableWidth,
              }}
            >
              <colgroup>
                {headerInfo.columnWidths.map((width, i) => (
                  <col key={i} style={{ width }} />
                ))}
              </colgroup>
              <thead
                ref={clonedTheadRef}
                className="bg-background [&_tr]:border-b border-b shadow-sm cursor-pointer"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(headerInfo.html) }}
                onClick={handleClonedHeaderClick}
              />
            </table>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
