import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClearableDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
}

const ClearableDateInput = React.forwardRef<HTMLInputElement, ClearableDateInputProps>(
  ({ className, value, onChange, clearable = true, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <Input
          type="date"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("pr-8", className)}
          {...props}
        />
        {clearable && value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 h-6 w-6 p-0 hover:bg-muted"
            onClick={() => onChange('')}
            tabIndex={-1}
          >
            <X className="h-3 w-3 text-muted-foreground" />
            <span className="sr-only">Clear date</span>
          </Button>
        )}
      </div>
    );
  }
);

ClearableDateInput.displayName = "ClearableDateInput";

export { ClearableDateInput };