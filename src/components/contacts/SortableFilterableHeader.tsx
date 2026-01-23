import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowUp,
  ArrowDown,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

type HeaderMode = "sort-and-search" | "search-only" | "sort-only" | "dropdown-filter";

interface SortableFilterableHeaderProps {
  label: string;
  columnKey: string;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  filterValue?: string;
  onFilterChange?: (key: string, value: string) => void;
  filterOptions?: string[];
  className?: string;
  /** 
   * Mode determines what controls are shown:
   * - "sort-and-search": Both sort arrows and search input (default)
   * - "search-only": Only search input, no sorting
   * - "sort-only": Only sort arrows, no filter
   * - "dropdown-filter": Sort arrows + dropdown selection for filter
   */
  mode?: HeaderMode;
}

export function SortableFilterableHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  filterValue = "",
  onFilterChange,
  filterOptions,
  className,
  mode = "sort-and-search",
}: SortableFilterableHeaderProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const isActive = sortKey === columnKey;
  const hasFilter = !!filterValue;
  
  const showSort = mode === "sort-and-search" || mode === "sort-only" || mode === "dropdown-filter";
  const showSearch = mode === "sort-and-search" || mode === "search-only";
  const showDropdown = mode === "dropdown-filter" && filterOptions && filterOptions.length > 0;

  const handleSort = () => {
    if (onSort && showSort) {
      onSort(columnKey);
    }
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* Label - clickable for sort if sorting enabled */}
      {showSort ? (
        <button
          onClick={handleSort}
          className={cn(
            "flex items-center gap-1 text-xs font-medium hover:text-primary transition-colors",
            isActive && "text-primary"
          )}
        >
          <span className="truncate">{label}</span>
          {isActive && sortDirection === "asc" && <ArrowUp className="h-3 w-3 flex-shrink-0" />}
          {isActive && sortDirection === "desc" && <ArrowDown className="h-3 w-3 flex-shrink-0" />}
        </button>
      ) : (
        <span className="text-xs font-medium truncate">{label}</span>
      )}

      {/* Search filter button/popover */}
      {(showSearch || showDropdown) && onFilterChange && (
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "p-1 rounded hover:bg-accent transition-colors flex-shrink-0",
                hasFilter && "text-primary bg-primary/10"
              )}
            >
              <Search className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-56 p-2 bg-popover border shadow-lg z-[100]" 
            align="start"
            sideOffset={4}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Filter {label}
                </span>
                {hasFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => {
                      onFilterChange(columnKey, "");
                      setFilterOpen(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {showDropdown ? (
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filterOptions!.map((option) => (
                    <button
                      key={option}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors",
                        filterValue === option && "bg-accent font-medium"
                      )}
                      onClick={() => {
                        onFilterChange(columnKey, option);
                        setFilterOpen(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <Input
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={filterValue}
                  onChange={(e) => onFilterChange(columnKey, e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/**
 * Simple header with just a label - no sorting or filtering
 */
export function SimpleHeader({ 
  label, 
  className 
}: { 
  label: string; 
  className?: string 
}) {
  return (
    <span className={cn("text-xs font-medium", className)}>
      {label}
    </span>
  );
}
