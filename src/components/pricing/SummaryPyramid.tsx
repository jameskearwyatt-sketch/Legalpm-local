import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Triangle, Minus, Star, Zap, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface TeamMember {
  key: string;
  label: string;
  hours: number;
  rate: number;
  revenue: number;
  memberCost: number;
  level?: string;
  maxHours?: number;
}

export type DistributionPreset = "pyramid" | "flat" | "reverse";

interface SummaryPyramidProps {
  teamMembers: TeamMember[];
  formatCurrency: (value: number) => string;
  formatHours: (value: number) => string;
  onDistribute?: (preset: DistributionPreset) => void;
  onMemberHoursCommit?: (key: string, hours: number) => void;
  keyPlayers?: Record<string, number>;
  onToggleKeyPlayer?: (key: string) => void;
}

type TierKey = "partners" | "senior" | "associates" | "juniors";

interface Tier {
  key: TierKey;
  label: string;
  emptyLabel: string;
  members: TeamMember[];
}

const TIER_COLORS: Record<TierKey, { bg: string; border: string; text: string }> = {
  partners: {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    border: "border-indigo-200 dark:border-indigo-800/50",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  senior: {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    border: "border-violet-200 dark:border-violet-800/50",
    text: "text-violet-700 dark:text-violet-300",
  },
  associates: {
    bg: "bg-sky-100 dark:bg-sky-900/30",
    border: "border-sky-200 dark:border-sky-800/50",
    text: "text-sky-700 dark:text-sky-300",
  },
  juniors: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

export function classifyTier(member: { key: string; level?: string }): TierKey {
  if (member.level) {
    const lvl = member.level.toLowerCase();
    if (lvl === "partner") return "partners";
    if (lvl === "counsel" || lvl === "seniorassociate") return "senior";
    if (lvl === "associate") return "associates";
    if (lvl === "trainee") return "juniors";
  }
  const k = member.key.toLowerCase();
  if (k.includes("partner")) return "partners";
  if (k.includes("counsel") || k.includes("seniorassociate") || k.includes("senior_associate") || k.includes("senior associate"))
    return "senior";
  if (k.includes("associate")) return "associates";
  return "juniors";
}

function buildTiers(members: TeamMember[]): Tier[] {
  const groups: Record<TierKey, TeamMember[]> = {
    partners: [],
    senior: [],
    associates: [],
    juniors: [],
  };
  members.forEach((m) => groups[classifyTier(m)].push(m));

  return [
    { key: "partners", label: "Partners", emptyLabel: "No Partners", members: groups.partners },
    { key: "senior", label: "Counsel / Sr. Associates", emptyLabel: "No Counsel / Sr. Associates", members: groups.senior },
    { key: "associates", label: "Associates", emptyLabel: "No Associates", members: groups.associates },
    { key: "juniors", label: "Trainees / Juniors", emptyLabel: "No Trainees / Juniors", members: groups.juniors },
  ];
}

/* ─── Draggable Member Block ─── */
interface DraggableMemberBlockProps {
  member: TeamMember;
  tierKey: TierKey;
  widthPct: number;
  formatValue: (v: number) => string;
  value: number;
  interactive: boolean;
  isSelected: boolean;
  onSelect: (key: string) => void;
  onHoursCommit?: (key: string, hours: number) => void;
  dragHoursOverride: number | null;
  dragWidthPx: number | null;
  onDragStart: (key: string, barEl: HTMLDivElement) => void;
  editingKey: string | null;
  onEditClick: (key: string) => void;
  onEditDone: (key: string, val: number) => void;
}

function DraggableMemberBlock({
  member, tierKey, widthPct, formatValue, value,
  interactive, isSelected, onSelect, onHoursCommit,
  dragHoursOverride, dragWidthPx, onDragStart,
  editingKey, onEditClick, onEditDone,
}: DraggableMemberBlockProps) {
  const colors = TIER_COLORS[tierKey];
  const displayHours = dragHoursOverride !== null ? dragHoursOverride : member.hours;
  const displayValue = dragHoursOverride !== null ? dragHoursOverride : value;
  const isDragging = dragHoursOverride !== null;
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const isEditing = editingKey === member.key;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (barRef.current) onDragStart(member.key, barRef.current);
  };

  const handleHandleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (barRef.current) onDragStart(member.key, barRef.current);
  };

  const handleValueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interactive || !onHoursCommit) return;
    setEditVal(member.hours.toFixed(1));
    onEditClick(member.key);
  };

  const commitEdit = () => {
    const parsed = parseFloat(editVal);
    if (!isNaN(parsed) && parsed >= 0) {
      onEditDone(member.key, parsed);
    } else {
      onEditDone(member.key, member.hours);
    }
  };

  // During drag, use absolute pixel width; otherwise percentage
  const wrapperStyle: React.CSSProperties = isDragging && dragWidthPx !== null
    ? { width: dragWidthPx, minWidth: 20, flex: 'none' }
    : { width: `${widthPct}%`, minWidth: 40 };

  return (
    <div className="flex flex-col min-w-0" style={wrapperStyle}>
      <div
        className={cn(
          "rounded-xl border flex items-center justify-between py-1.5 px-1.5 min-w-0 overflow-hidden relative group",
          isDragging ? "transition-none" : "transition-all duration-300",
          colors.bg, colors.border,
          interactive && "cursor-pointer hover:ring-2 hover:ring-primary/30",
          isSelected && !isDragging && "ring-2 ring-primary/50",
          isDragging && "ring-2 ring-primary shadow-lg",
        )}
        style={{ minHeight: 36 }}
        title={`${member.label}: ${formatValue(value)}`}
        onClick={() => interactive && onSelect(member.key)}
      >
        {/* Content */}
        <div className="flex flex-col items-center justify-center flex-1 min-w-0 overflow-hidden">
          <span className={cn("text-[10px] font-medium leading-tight truncate w-full text-center", colors.text)}>
            {member.label}
          </span>
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              step="0.5"
              min="0"
              max={member.maxHours}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") onEditDone(member.key, member.hours);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-14 h-4 text-center text-[10px] tabular-nums bg-background/80 border rounded px-0.5 outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <span
              className={cn(
                "text-[10px] tabular-nums leading-tight opacity-75 cursor-text hover:opacity-100 hover:underline",
                colors.text
              )}
              onClick={handleValueClick}
            >
              {interactive ? `${displayHours.toFixed(1)}h` : formatValue(displayValue)}
            </span>
          )}
        </div>

        {/* Drag handle — visible on hover/selected for interactive blocks */}
        {interactive && isSelected && !isEditing && (
          <div
            className="flex items-center justify-center w-4 h-full cursor-col-resize shrink-0 opacity-60 hover:opacity-100 transition-opacity touch-none"
            onMouseDown={handleHandleMouseDown}
            onTouchStart={handleHandleTouchStart}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className={cn("h-3.5 w-3.5 rotate-90", colors.text)} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Pyramid Column ─── */
interface PyramidColumnProps {
  title: string;
  tiers: Tier[];
  getValue: (m: TeamMember) => number;
  formatValue: (v: number) => string;
  total: number;
  interactive?: boolean;
  selectedMember: string | null;
  onMemberClick?: (key: string) => void;
  onHoursCommit?: (key: string, hours: number) => void;
  formatHours?: (v: number) => string;
  dragState: { key: string; hours: number } | null;
  onDragStart: (key: string, startX: number, startHours: number) => void;
  editingKey: string | null;
  onEditClick: (key: string) => void;
  onEditDone: (key: string, val: number) => void;
}

function PyramidColumn({
  title, tiers, getValue, formatValue, total,
  interactive, selectedMember, onMemberClick,
  onHoursCommit, formatHours,
  dragState, onDragStart,
  editingKey, onEditClick, onEditDone,
}: PyramidColumnProps) {
  const isDragging = !!dragState;

  const tierTotals = tiers.map((t) =>
    t.members.reduce((s, m) => s + getValue(m), 0)
  );
  const maxTierTotal = Math.max(...tierTotals, 1);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
        {title}
      </p>
      <div className="flex flex-col items-center gap-1.5">
        {tiers.map((tier, i) => {
          const tierTotal = tierTotals[i];
          const colors = TIER_COLORS[tier.key];
          const widthPct = total > 0 ? Math.max(20, (tierTotal / maxTierTotal) * 100) : 20;

          if (tier.members.length === 0) {
            return (
              <div
                key={tier.key}
                className="flex items-center justify-center transition-all duration-500"
                style={{ width: `${20}%`, minHeight: 36 }}
              >
                <div className="w-full rounded-xl border-2 border-dashed flex items-center justify-center py-1.5 px-2 border-muted-foreground/20">
                  <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">
                    {tier.emptyLabel}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={tier.key}
              className="flex flex-col items-center gap-1 transition-all duration-300"
              style={{ width: `${widthPct}%` }}
            >
              <div className="flex items-stretch gap-1 justify-center w-full">
                {tier.members.map((member) => {
                  const val = getValue(member);
                  const memberPct = tierTotal > 0 ? (val / tierTotal) * 100 : 100 / tier.members.length;

                  return (
                    <DraggableMemberBlock
                      key={member.key}
                      member={member}
                      tierKey={tier.key}
                      widthPct={memberPct}
                      formatValue={formatValue}
                      value={val}
                      interactive={!!interactive}
                      isSelected={selectedMember === member.key}
                      onSelect={(k) => onMemberClick?.(k)}
                      onHoursCommit={onHoursCommit}
                      dragHoursOverride={dragState?.key === member.key ? dragState.hours : null}
                      onDragStart={onDragStart}
                      editingKey={editingKey}
                      onEditClick={onEditClick}
                      onEditDone={onEditDone}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Key Players Selection ─── */
interface KeyPlayersSelectionProps {
  tiers: Tier[];
  keyPlayers: Record<string, number>;
  onToggle: (key: string) => void;
}

function KeyPlayersSelection({ tiers, keyPlayers, onToggle }: KeyPlayersSelectionProps) {
  const hasAny = tiers.some(t => t.members.length > 0);
  if (!hasAny) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Star className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-muted-foreground">
          Tap to assign: Key (2×) → Anchor (4×) → Clear
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {tiers.filter(t => t.members.length > 0).map(tier => {
          const colors = TIER_COLORS[tier.key];
          return (
            <div key={tier.key} className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("text-[10px] font-medium w-20 shrink-0 truncate", colors.text)}>
                {tier.label}
              </span>
              {tier.members.map(m => {
                const level = keyPlayers[m.key] || 0;
                return (
                  <Badge
                    key={m.key}
                    variant="outline"
                    className={cn(
                      "cursor-pointer text-[10px] px-2 py-0.5 transition-all select-none",
                      level === 2
                        ? "bg-orange-100 dark:bg-orange-900/40 border-orange-500 text-orange-800 dark:text-orange-200 ring-1 ring-orange-500/60"
                        : level === 1
                        ? "bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-800 dark:text-amber-200 ring-1 ring-amber-400/50"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => onToggle(m.key)}
                  >
                    {level === 2 && <Zap className="h-2.5 w-2.5 mr-0.5 fill-orange-500 text-orange-500" />}
                    {level === 1 && <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-500 text-amber-500" />}
                    {m.label}
                    {level === 1 && <span className="ml-1 text-[8px] opacity-70">Key</span>}
                    {level === 2 && <span className="ml-1 text-[8px] opacity-70">Anchor</span>}
                  </Badge>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Preset Buttons ─── */
const PRESETS: { key: DistributionPreset; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "pyramid", label: "Pyramid", icon: <Triangle className="h-3.5 w-3.5 rotate-180" />, desc: "Most hours to seniors & juniors" },
  { key: "flat", label: "Flat", icon: <Minus className="h-3.5 w-3.5" />, desc: "Equal revenue share" },
  { key: "reverse", label: "Reverse", icon: <Triangle className="h-3.5 w-3.5" />, desc: "Partners-heavy distribution" },
];

/* ─── Main Component ─── */
const SummaryPyramid = React.memo(function SummaryPyramid({
  teamMembers,
  formatCurrency,
  formatHours,
  onDistribute,
  onMemberHoursCommit,
  keyPlayers = {},
  onToggleKeyPlayer,
}: SummaryPyramidProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<DistributionPreset | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Drag state
  const [dragState, setDragState] = useState<{ key: string; hours: number } | null>(null);
  const dragRef = useRef<{
    key: string;
    startX: number;
    startHours: number;
    maxHours: number;
    containerWidth: number;
  } | null>(null);
  const pyramidContainerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((key: string, startX: number, startHours: number) => {
    const member = teamMembers.find(m => m.key === key);
    if (!member) return;
    const containerWidth = pyramidContainerRef.current?.offsetWidth || 400;
    dragRef.current = {
      key,
      startX,
      startHours,
      maxHours: member.maxHours || 500,
      containerWidth,
    };
    setDragState({ key, hours: startHours });
  }, [teamMembers]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { startX, startHours, maxHours, containerWidth } = dragRef.current;
      const deltaX = e.clientX - startX;
      const sensitivity = 3;
      const hourDelta = (deltaX / containerWidth) * maxHours * sensitivity;
      const newHours = Math.min(Math.max(0, startHours + hourDelta), maxHours);
      setDragState({ key: dragRef.current.key, hours: newHours });
    };

    const handleMouseUp = () => {
      if (!dragRef.current) return;
      const { key } = dragRef.current;
      setDragState(prev => {
        if (prev && onMemberHoursCommit) {
          const rounded = Math.round(prev.hours * 2) / 2;
          onMemberHoursCommit(key, rounded);
        }
        return null;
      });
      dragRef.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      const touch = e.touches[0];
      const { startX, startHours, maxHours, containerWidth } = dragRef.current;
      const deltaX = touch.clientX - startX;
      const sensitivity = 3;
      const hourDelta = (deltaX / containerWidth) * maxHours * sensitivity;
      const newHours = Math.min(Math.max(0, startHours + hourDelta), maxHours);
      setDragState({ key: dragRef.current.key, hours: newHours });
    };

    const handleTouchEnd = () => {
      if (!dragRef.current) return;
      const { key } = dragRef.current;
      setDragState(prev => {
        if (prev && onMemberHoursCommit) {
          const rounded = Math.round(prev.hours * 2) / 2;
          onMemberHoursCommit(key, rounded);
        }
        return null;
      });
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onMemberHoursCommit]);

  if (teamMembers.length === 0) return null;

  const tiers = buildTiers(teamMembers);
  const totalHours = teamMembers.reduce((s, m) => s + m.hours, 0);
  const totalRevenue = teamMembers.reduce((s, m) => s + m.revenue, 0);
  const interactive = !!onMemberHoursCommit;

  const hasKeyPlayers = Object.values(keyPlayers).some(v => v > 0);

  const handleMemberClick = (key: string) => {
    setSelectedMember(prev => prev === key ? null : key);
    setEditingKey(null);
  };

  const handlePresetClick = (preset: DistributionPreset) => {
    if (!hasKeyPlayers) return;
    setActivePreset(preset);
    onDistribute?.(preset);
  };

  const handleEditClick = (key: string) => {
    setEditingKey(key);
  };

  const handleEditDone = (key: string, val: number) => {
    setEditingKey(null);
    if (onMemberHoursCommit) {
      const rounded = Math.round(val * 2) / 2;
      onMemberHoursCommit(key, rounded);
    }
  };

  return (
    <TooltipProvider>
      <div className="rounded-lg border bg-card p-4 space-y-4" ref={pyramidContainerRef}>
        {/* Key Players Selection */}
        {onDistribute && onToggleKeyPlayer && (
          <KeyPlayersSelection
            tiers={tiers}
            keyPlayers={keyPlayers}
            onToggle={onToggleKeyPlayer}
          />
        )}

        {/* Preset buttons */}
        {onDistribute && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Auto-Distribute Hours:</span>
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map((p) => (
                <Tooltip key={p.key}>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant={activePreset === p.key ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs gap-1.5 px-2.5"
                        onClick={() => handlePresetClick(p.key)}
                        disabled={!hasKeyPlayers}
                      >
                        {p.icon}
                        {p.label}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasKeyPlayers ? p.desc : "Select key players first"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* Hint for drag interaction */}
        {interactive && (
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Click a member, then drag the ⋮⋮ handle to resize — or click the hours value to type
          </p>
        )}

        {/* Pyramids */}
        <div className="flex flex-col sm:flex-row gap-6">
          <PyramidColumn
            title="Hours Distribution"
            tiers={tiers}
            getValue={(m) => m.hours}
            formatValue={(v) => `${formatHours(v)}h`}
            total={totalHours}
            interactive={interactive}
            selectedMember={selectedMember}
            onMemberClick={handleMemberClick}
            onHoursCommit={onMemberHoursCommit}
            formatHours={formatHours}
            dragState={dragState}
            onDragStart={handleDragStart}
            editingKey={editingKey}
            onEditClick={handleEditClick}
            onEditDone={handleEditDone}
          />
          <div className="hidden sm:block w-px bg-border" />
          <PyramidColumn
            title="Cost Distribution"
            tiers={tiers}
            getValue={(m) => m.revenue}
            formatValue={(v) => formatCurrency(v)}
            total={totalRevenue}
            interactive={false}
            selectedMember={null}
            dragState={null}
            onDragStart={() => {}}
            editingKey={null}
            onEditClick={() => {}}
            onEditDone={() => {}}
          />
        </div>
      </div>
    </TooltipProvider>
  );
});

export default SummaryPyramid;
