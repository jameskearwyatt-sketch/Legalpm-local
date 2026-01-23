import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmartSearchMatch } from "@/lib/hooks/useSmartSectorSearch";

interface SmartMatchBadgeProps {
  match: SmartSearchMatch;
  compact?: boolean;
}

const confidenceStyles = {
  high: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  medium: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  low: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
};

const confidenceLabels = {
  high: "High",
  medium: "Med",
  low: "Low",
};

export function SmartMatchBadge({ match, compact = false }: SmartMatchBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 cursor-help font-normal",
              confidenceStyles[match.confidence],
              compact && "px-1.5 py-0 text-[10px]"
            )}
          >
            <Sparkles className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
            {confidenceLabels[match.confidence]}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{match.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
