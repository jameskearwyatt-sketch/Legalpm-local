import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiSelectFilterProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  icon?: React.ReactNode;
  className?: string;
  maxDisplayItems?: number;
  popoverWidth?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder,
  icon,
  className,
  maxDisplayItems = 2,
  popoverWidth = "280px",
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayText = React.useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length <= maxDisplayItems) {
      return selected.join(", ");
    }
    return `${selected.slice(0, maxDisplayItems).join(", ")} +${selected.length - maxDisplayItems}`;
  }, [selected, placeholder, maxDisplayItems]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal",
            selected.length > 0 && "border-primary/50",
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {icon}
            <span className="truncate">{displayText}</span>
          </span>
          <span className="flex items-center gap-1 ml-1">
            {selected.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-xs"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 z-50 bg-popover" style={{ width: popoverWidth }} align="start">
        <div className="p-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{placeholder}</span>
            {selected.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No options available
              </p>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent text-sm",
                    selected.includes(option) && "bg-accent"
                  )}
                >
                  <Checkbox
                    checked={selected.includes(option)}
                    onCheckedChange={() => handleToggle(option)}
                  />
                  <span className="truncate flex-1">{option}</span>
                  {selected.includes(option) && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </label>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
