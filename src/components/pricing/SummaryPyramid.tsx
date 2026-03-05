import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Triangle, Minus, Star, Zap, GripVertical, Save, RotateCcw, X, Pencil, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SummaryMemorySlot } from "@/lib/hooks/usePricingProposals";

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
  levelOverrides?: Record<string, string>;
  onMemberLevelOverride?: (key: string, newLevel: string) => void;
  benchedMembers?: string[];
  onBenchMember?: (key: string, benched: boolean) => void;
  memorySlots?: (SummaryMemorySlot | null)[];
  onSaveMemory?: (slotIndex: number, note?: string) => void;
  onLoadMemory?: (slotIndex: number) => void;
  onClearMemory?: (slotIndex: number) => void;
  onUpdateMemoryNote?: (slotIndex: number, note: string) => void;
}

export type TierKey = "partner" | "counsel" | "seniorAssociate" | "associate" | "trainee";

interface TierMember extends TeamMember {
  homeTierKey: TierKey;
}

interface Tier {
  key: TierKey;
  label: string;
  emptyLabel: string;
  members: TierMember[];
}

const TIER_ORDER: TierKey[] = ["partner", "counsel", "seniorAssociate", "associate", "trainee"];

const TIER_COLORS: Record<TierKey, { bg: string; border: string; text: string; labelText: string }> = {
  partner: {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    border: "border-indigo-200 dark:border-indigo-800/50",
    text: "text-indigo-700 dark:text-indigo-300",
    labelText: "text-indigo-600 dark:text-indigo-400",
  },
  counsel: {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    border: "border-violet-200 dark:border-violet-800/50",
    text: "text-violet-700 dark:text-violet-300",
    labelText: "text-violet-600 dark:text-violet-400",
  },
  seniorAssociate: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    border: "border-purple-200 dark:border-purple-800/50",
    text: "text-purple-700 dark:text-purple-300",
    labelText: "text-purple-600 dark:text-purple-400",
  },
  associate: {
    bg: "bg-sky-100 dark:bg-sky-900/30",
    border: "border-sky-200 dark:border-sky-800/50",
    text: "text-sky-700 dark:text-sky-300",
    labelText: "text-sky-600 dark:text-sky-400",
  },
  trainee: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    text: "text-emerald-700 dark:text-emerald-300",
    labelText: "text-emerald-600 dark:text-emerald-400",
  },
};

const TIER_LABELS: Record<TierKey, string> = {
  partner: "Partner",
  counsel: "Counsel",
  seniorAssociate: "Senior Associate",
  associate: "Associate",
  trainee: "Trainee",
};

export function classifyTier(member: { key: string; level?: string }): TierKey {
  if (member.level) {
    const lvl = member.level.toLowerCase();
    if (lvl === "partner") return "partner";
    if (lvl === "counsel") return "counsel";
    if (lvl === "seniorassociate" || lvl === "senior associate") return "seniorAssociate";
    if (lvl === "associate") return "associate";
    if (lvl === "trainee") return "trainee";
  }
  const k = member.key.toLowerCase();
  if (k.includes("partner")) return "partner";
  if (k.includes("counsel")) return "counsel";
  if (k.includes("seniorassociate") || k.includes("senior_associate") || k.includes("senior associate")) return "seniorAssociate";
  if (k.includes("associate")) return "associate";
  return "trainee";
}

function buildTiers(members: TeamMember[], levelOverrides?: Record<string, string>): Tier[] {
  const groups: Record<TierKey, TierMember[]> = {
    partner: [],
    counsel: [],
    seniorAssociate: [],
    associate: [],
    trainee: [],
  };

  members.forEach((m) => {
    const homeTier = classifyTier(m);
    const displayTier = (levelOverrides?.[m.key] as TierKey) || homeTier;
    const validTier = TIER_ORDER.includes(displayTier) ? displayTier : homeTier;
    groups[validTier].push({ ...m, homeTierKey: homeTier });
  });

  return TIER_ORDER.map(key => ({
    key,
    label: TIER_LABELS[key],
    emptyLabel: `No ${TIER_LABELS[key]}s`,
    members: groups[key],
  }));
}

/* ─── Draggable Member Block ─── */
interface DraggableMemberBlockProps {
  member: TierMember;
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
  onVerticalDragStart?: (key: string) => void;
}

function DraggableMemberBlock({
  member, tierKey, widthPct, formatValue, value,
  interactive, isSelected, onSelect, onHoursCommit,
  dragHoursOverride, dragWidthPx, onDragStart,
  editingKey, onEditClick, onEditDone,
  onVerticalDragStart,
}: DraggableMemberBlockProps) {
  // Always use HOME tier colors, not the row they're in
  const colors = TIER_COLORS[member.homeTierKey];
  const isRelocated = member.homeTierKey !== tierKey;
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

  // Native drag for vertical reorder between tiers
  const handleNativeDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", member.key);
    e.dataTransfer.effectAllowed = "move";
    onVerticalDragStart?.(member.key);
  };

  // During drag, use absolute pixel width; otherwise percentage
  const wrapperStyle: React.CSSProperties = isDragging && dragWidthPx !== null
    ? { width: dragWidthPx, minWidth: 20, flex: 'none' }
    : { width: `${widthPct}%`, minWidth: 40 };

  return (
    <div className="flex flex-col min-w-0" style={wrapperStyle} ref={barRef}>
      <div
        draggable={interactive}
        onDragStart={handleNativeDragStart}
        className={cn(
          "rounded-xl border flex items-center justify-between py-1.5 px-1.5 min-w-0 overflow-hidden relative group",
          isDragging ? "transition-none" : "transition-all duration-300",
          colors.bg, colors.border,
          interactive && "cursor-grab hover:ring-2 hover:ring-primary/30",
          isSelected && !isDragging && "ring-2 ring-primary/50",
          isDragging && "ring-2 ring-primary shadow-lg",
          isRelocated && "ring-1 ring-offset-1 ring-muted-foreground/30",
        )}
        style={{ minHeight: 36 }}
        title={`${member.label}: ${formatValue(value)}${isRelocated ? ` (home: ${TIER_LABELS[member.homeTierKey]})` : ''}`}
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

        {/* Drag handle — visible on hover for interactive blocks */}
        {interactive && !isEditing && (
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
  benchedMembers: TierMember[];
  getValue: (m: TierMember) => number;
  formatValue: (v: number) => string;
  total: number;
  interactive?: boolean;
  selectedMember: string | null;
  onMemberClick?: (key: string) => void;
  onHoursCommit?: (key: string, hours: number) => void;
  formatHours?: (v: number) => string;
  dragState: { key: string; hours: number; widthPx: number } | null;
  onDragStart: (key: string, barEl: HTMLDivElement) => void;
  editingKey: string | null;
  onEditClick: (key: string) => void;
  onEditDone: (key: string, val: number) => void;
  onMemberLevelOverride?: (key: string, newLevel: string) => void;
  onBenchMember?: (key: string, benched: boolean) => void;
}

function PyramidColumn({
  title, tiers, benchedMembers, getValue, formatValue, total,
  interactive, selectedMember, onMemberClick,
  onHoursCommit, formatHours,
  dragState, onDragStart,
  editingKey, onEditClick, onEditDone,
  onMemberLevelOverride, onBenchMember,
}: PyramidColumnProps) {
  const [dragOverTier, setDragOverTier] = useState<TierKey | "bench" | null>(null);
  const [verticalDragKey, setVerticalDragKey] = useState<string | null>(null);

  const tierTotals = tiers.map((t) =>
    t.members.reduce((s, m) => s + getValue(m), 0)
  );
  const maxTierTotal = Math.max(...tierTotals, 1);

  const handleDragOver = (e: React.DragEvent, tierKey: TierKey | "bench") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTier(tierKey);
  };

  const handleDragLeave = () => {
    setDragOverTier(null);
  };

  const handleDrop = (e: React.DragEvent, tierKey: TierKey | "bench") => {
    e.preventDefault();
    const memberKey = e.dataTransfer.getData("text/plain");
    if (memberKey) {
      if (tierKey === "bench") {
        onBenchMember?.(memberKey, true);
      } else {
        // If member was benched, unbench them first
        onBenchMember?.(memberKey, false);
        onMemberLevelOverride?.(memberKey, tierKey);
      }
    }
    setDragOverTier(null);
    setVerticalDragKey(null);
  };

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
        {title}
      </p>
      <div className="flex flex-col items-stretch gap-1.5">
        {tiers.map((tier, i) => {
          const tierTotal = tierTotals[i];
          const colors = TIER_COLORS[tier.key];
          const widthPct = total > 0 ? Math.max(20, (tierTotal / maxTierTotal) * 100) : 20;
          const isDropTarget = dragOverTier === tier.key;

          return (
            <div
              key={tier.key}
              className={cn(
                "flex items-center gap-2 transition-all duration-200 rounded-lg px-1 py-0.5",
                isDropTarget && "bg-primary/10 ring-2 ring-primary/40 ring-dashed",
              )}
              onDragOver={(e) => interactive && handleDragOver(e, tier.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => interactive && handleDrop(e, tier.key)}
            >
              {/* Level label */}
              <span className={cn("text-[10px] font-semibold w-16 shrink-0 text-right leading-tight", colors.labelText)}>
                {tier.label}
              </span>

              {/* Member blocks or empty placeholder */}
              <div className="flex-1 min-w-0 flex justify-center">
                {tier.members.length === 0 ? (
                  <div
                    className="w-full transition-all duration-500"
                    style={{ maxWidth: `${20}%` }}
                  >
                    <div className="w-full rounded-xl border-2 border-dashed flex items-center justify-center py-1.5 px-2 border-muted-foreground/20" style={{ minHeight: 36 }}>
                      <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">
                        {tier.emptyLabel}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-stretch gap-1 justify-center transition-all duration-300"
                    style={{ width: `${widthPct}%` }}
                  >
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
                          dragWidthPx={dragState?.key === member.key ? dragState.widthPx : null}
                          onDragStart={onDragStart}
                          editingKey={editingKey}
                          onEditClick={onEditClick}
                          onEditDone={onEditDone}
                          onVerticalDragStart={setVerticalDragKey}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Bench zone */}
        {interactive && (
          <div
            className={cn(
              "flex items-center gap-2 mt-2 rounded-lg px-1 py-1.5 border-2 border-dashed transition-all duration-200",
              dragOverTier === "bench"
                ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
                : "border-muted-foreground/20 bg-muted/30",
            )}
            onDragOver={(e) => handleDragOver(e, "bench")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "bench")}
          >
            <span className="text-[10px] font-semibold w-16 shrink-0 text-right leading-tight text-muted-foreground flex items-center justify-end gap-1">
              <UserMinus className="h-3 w-3" />
              Bench
            </span>
            <div className="flex-1 min-w-0 flex flex-wrap gap-1">
              {benchedMembers.length === 0 ? (
                <span className="text-[10px] text-muted-foreground/50 italic">
                  Drag members here to bench
                </span>
              ) : (
                benchedMembers.map((member) => {
                  const colors = TIER_COLORS[member.homeTierKey];
                  return (
                    <div
                      key={member.key}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", member.key);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={cn(
                        "rounded-lg border flex items-center gap-1 py-1 px-2 cursor-grab opacity-50 hover:opacity-75 transition-opacity",
                        colors.bg, colors.border,
                      )}
                      title={`${member.label} (benched) — drag back to reactivate`}
                    >
                      <span className={cn("text-[10px] font-medium line-through", colors.text)}>
                        {member.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
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
  { key: "pyramid", label: "Pyramid", icon: <Triangle className="h-3.5 w-3.5" />, desc: "Most hours to seniors & juniors" },
  { key: "flat", label: "Flat", icon: <Minus className="h-3.5 w-3.5" />, desc: "Equal revenue share" },
  { key: "reverse", label: "Reverse", icon: <Triangle className="h-3.5 w-3.5 rotate-180" />, desc: "Partners-heavy distribution" },
];

/* ─── Memory Slots ─── */
interface MemorySlotsProps {
  slots: (SummaryMemorySlot | null)[];
  onSave: (index: number, note?: string) => void;
  onLoad: (index: number) => void;
  onClear: (index: number) => void;
  onUpdateNote: (index: number, note: string) => void;
}

function MemorySlots({ slots, onSave, onLoad, onClear, onUpdateNote }: MemorySlotsProps) {
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNote !== null && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [editingNote]);

  const handleStartEditNote = (index: number, currentNote: string) => {
    setEditingNote(index);
    setNoteValue(currentNote);
  };

  const handleCommitNote = (index: number) => {
    onUpdateNote(index, noteValue.trim());
    setEditingNote(null);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Memory:</span>
      <div className="flex gap-1.5 flex-wrap items-center">
        {[0, 1, 2].map((i) => {
          const slot = slots[i] ?? null;
          const isEmpty = !slot;
          return (
            <div key={i} className="flex items-center gap-0.5">
              {isEmpty ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 px-2 border-dashed"
                      onClick={() => onSave(i)}
                    >
                      <Save className="h-3 w-3" />
                      M{i + 1}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save current allocation to Memory {i + 1}</TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => onLoad(i)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        M{i + 1}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <p className="font-medium">Restore Memory {i + 1}</p>
                        {slot.note && <p className="text-muted-foreground mt-0.5">"{slot.note}"</p>}
                        <p className="text-muted-foreground mt-0.5">Saved {new Date(slot.savedAt).toLocaleDateString()}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  {editingNote === i ? (
                    <Input
                      ref={noteInputRef}
                      value={noteValue}
                      onChange={(e) => setNoteValue(e.target.value)}
                      onBlur={() => handleCommitNote(i)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCommitNote(i); if (e.key === "Escape") setEditingNote(null); }}
                      className="h-7 w-28 text-xs px-1.5"
                      placeholder="Add note…"
                    />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleStartEditNote(i, slot.note || "")}
                        >
                          <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{slot.note || "Add note"}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onClear(i)}
                      >
                        <X className="h-2.5 w-2.5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear Memory {i + 1}</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
const SummaryPyramid = React.memo(function SummaryPyramid({
  teamMembers,
  formatCurrency,
  formatHours,
  onDistribute,
  onMemberHoursCommit,
  keyPlayers = {},
  onToggleKeyPlayer,
  levelOverrides = {},
  onMemberLevelOverride,
  benchedMembers: benchedMemberKeys = [],
  onBenchMember,
  memorySlots = [null, null, null],
  onSaveMemory,
  onLoadMemory,
  onClearMemory,
  onUpdateMemoryNote,
}: SummaryPyramidProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<DistributionPreset | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Drag state: tracks hours and pixel width for the bar being dragged
  const [dragState, setDragState] = useState<{ key: string; hours: number; widthPx: number } | null>(null);
  const dragRef = useRef<{
    key: string;
    barLeftEdge: number;
    startWidth: number;
    startHours: number;
    maxHours: number;
    pxPerHour: number;
    maxWidthPx: number;
  } | null>(null);
  const pyramidContainerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((key: string, barEl: HTMLDivElement) => {
    const member = teamMembers.find(m => m.key === key);
    if (!member) return;
    const rect = barEl.getBoundingClientRect();
    const startWidth = rect.width;
    const barLeftEdge = rect.left;
    const startHours = member.hours;
    const maxHours = member.maxHours || 500;
    const pxPerHour = startHours > 0 ? startWidth / startHours : startWidth / 1;
    const maxWidthPx = pxPerHour * maxHours;

    dragRef.current = {
      key,
      barLeftEdge,
      startWidth,
      startHours,
      maxHours,
      pxPerHour,
      maxWidthPx,
    };
    setDragState({ key, hours: startHours, widthPx: startWidth });
  }, [teamMembers]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { barLeftEdge, maxHours, pxPerHour, maxWidthPx } = dragRef.current;
      const desiredWidth = Math.max(20, Math.min(e.clientX - barLeftEdge, maxWidthPx));
      const newHours = Math.min(Math.max(0, desiredWidth / pxPerHour), maxHours);
      setDragState({ key: dragRef.current.key, hours: newHours, widthPx: desiredWidth });
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
      const { barLeftEdge, maxHours, pxPerHour, maxWidthPx } = dragRef.current;
      const desiredWidth = Math.max(20, Math.min(touch.clientX - barLeftEdge, maxWidthPx));
      const newHours = Math.min(Math.max(0, desiredWidth / pxPerHour), maxHours);
      setDragState({ key: dragRef.current.key, hours: newHours, widthPx: desiredWidth });
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

  const activeMembers = teamMembers.filter(m => !benchedMemberKeys.includes(m.key));
  const benchedMembersList: TierMember[] = teamMembers
    .filter(m => benchedMemberKeys.includes(m.key))
    .map(m => ({ ...m, homeTierKey: classifyTier(m) }));

  const tiers = buildTiers(activeMembers, levelOverrides);
  const totalHours = activeMembers.reduce((s, m) => s + m.hours, 0);
  const totalRevenue = activeMembers.reduce((s, m) => s + m.revenue, 0);
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

        {/* Memory Slots */}
        {onSaveMemory && (
          <MemorySlots
            slots={memorySlots}
            onSave={onSaveMemory}
            onLoad={onLoadMemory!}
            onClear={onClearMemory!}
            onUpdateNote={onUpdateMemoryNote!}
          />
        )}

        {/* Hint */}
        {interactive && (
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Drag ⋮⋮ handle to resize hours · Drag a block up/down to move between levels · Click hours to type
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
            onMemberLevelOverride={onMemberLevelOverride}
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
