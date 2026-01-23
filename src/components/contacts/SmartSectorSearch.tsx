import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, X, Loader2, Sparkles, Zap, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartSectorSearchProps {
  onSearch: (query: string) => void;
  onDeepSearch: (query: string) => void;
  onClear: () => void;
  isSearching: boolean;
  isDeepSearching: boolean;
  isActive: boolean;
  matchCount: number;
  queryUnderstanding?: string;
}

export function SmartSectorSearch({
  onSearch,
  onDeepSearch,
  onClear,
  isSearching,
  isDeepSearching,
  isActive,
  matchCount,
  queryUnderstanding,
}: SmartSectorSearchProps) {
  const [inputValue, setInputValue] = useState("");
  const [showUnderstanding, setShowUnderstanding] = useState(false);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      onSearch(inputValue.trim());
    }
    if (e.key === "Escape") {
      setInputValue("");
      onClear();
    }
  }, [inputValue, onSearch, onClear]);

  const handleClear = useCallback(() => {
    setInputValue("");
    onClear();
  }, [onClear]);

  const handleDeepSearch = useCallback(() => {
    if (inputValue.trim()) {
      onDeepSearch(inputValue.trim());
    }
  }, [inputValue, onDeepSearch]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <Input
          type="text"
          placeholder="Smart Sector Search..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "pl-9 pr-8 w-[200px] h-9 text-sm",
            isActive && "border-primary ring-1 ring-primary/20"
          )}
          disabled={isSearching || isDeepSearching}
        />
        {(inputValue || isActive) && !isSearching && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {inputValue.trim() && !isActive && !isSearching && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSearch(inputValue.trim())}
          className="h-9 gap-1.5"
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </Button>
      )}

      {isActive && (
        <div className="flex items-center gap-2">
          <Badge 
            variant="secondary" 
            className="bg-primary/10 text-primary border-primary/20"
          >
            {matchCount} match{matchCount !== 1 ? 'es' : ''}
          </Badge>

          {queryUnderstanding && (
            <Popover open={showUnderstanding} onOpenChange={setShowUnderstanding}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm" align="start">
                <div className="space-y-2">
                  <p className="font-medium">AI Understanding</p>
                  <p className="text-muted-foreground whitespace-pre-wrap text-xs">
                    {queryUnderstanding}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeepSearch}
                  disabled={isDeepSearching}
                  className="h-8 gap-1.5 text-xs"
                >
                  {isDeepSearching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Deep Search
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>More thorough analysis (takes longer)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
