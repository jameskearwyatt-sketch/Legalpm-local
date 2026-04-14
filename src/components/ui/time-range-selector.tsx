import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { subMonths, subDays, startOfDay } from "date-fns";

export type TimeRange = "all" | "12m" | "6m" | "3m" | "1m";

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "all", label: "All" },
  { value: "12m", label: "12M" },
  { value: "6m", label: "6M" },
  { value: "3m", label: "3M" },
  { value: "1m", label: "1M" },
];

export function getTimeRangeCutoff(range: TimeRange): Date | null {
  const now = startOfDay(new Date());
  switch (range) {
    case "12m": return subMonths(now, 12);
    case "6m": return subMonths(now, 6);
    case "3m": return subMonths(now, 3);
    case "1m": return subMonths(now, 1);
    default: return null;
  }
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as TimeRange);
      }}
      className="gap-0.5"
    >
      {TIME_RANGE_OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          size="sm"
          className="px-2.5 py-1 text-xs h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
