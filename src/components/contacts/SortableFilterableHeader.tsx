import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

interface SortableFilterableHeaderProps {
  label: string;
  columnKey: string;
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  filterValue: string;
  onFilterChange: (key: string, value: string) => void;
  filterOptions?: string[];
  className?: string;
}

export function SortableFilterableHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  filterValue,
  onFilterChange,
  filterOptions,
  className,
}: SortableFilterableHeaderProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const isActive = sortKey === columnKey;
  const hasFilter = !!filterValue;

  const SortIcon = isActive
    ? sortDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "-ml-3 h-8 px-2 hover:bg-transparent",
          isActive && "text-primary"
        )}
        onClick={() => onSort(columnKey)}
      >
        {label}
        <SortIcon className="ml-1 h-3 w-3" />
      </Button>

      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6",
              hasFilter && "text-primary bg-primary/10"
            )}
          >
            <Filter className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-56 p-2 bg-popover border shadow-md z-50" 
          align="start"
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
            
            {filterOptions && filterOptions.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filterOptions.map((option) => (
                  <button
                    key={option}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent",
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
                placeholder={`Filter by ${label.toLowerCase()}...`}
                value={filterValue}
                onChange={(e) => onFilterChange(columnKey, e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
