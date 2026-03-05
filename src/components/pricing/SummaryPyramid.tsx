import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Triangle, Minus, Star, Zap } from "lucide-react";
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

/* ─── Expanded inline editor for a member block ─── */
interface MemberEditorProps {
  member: TeamMember;
  onHoursCommit: (key: string, hours: number) => void;
  formatHours: (v: number) => string;
}

function MemberEditor({ member, onHoursCommit, formatHours }: MemberEditorProps) {
  const [localHours, setLocalHours] = useState<number | null>(null);
  const isDragging = useRef(false);
  const displayHours = localHours !== null ? localHours : member.hours;
  const sliderMax = Math.max(Math.ceil(member.maxHours || 500), 1);

  const commitValue = useCallback((val: number) => {
    isDragging.current = false;
    setLocalHours(null);
    onHoursCommit(member.key, val);
  }, [member.key, onHoursCommit]);

  return (
    <div className="flex items-center gap-2 w-full px-1 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <Input
        type="number"
        step="0.5"
        min="0"
        max={member.maxHours}
        value={displayHours.toFixed(1)}
        onChange={(e) => {
          const val = Math.max(0, parseFloat(e.target.value) || 0);
          onHoursCommit(member.key, val);
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-16 h-6 text-right text-[10px] tabular-nums px-1"
      />
      <span className="text-[10px] text-muted-foreground shrink-0">h</span>
      <input
        type="range"
        min="0"
        max={sliderMax}
        step="0.5"
        value={Math.min(displayHours, sliderMax)}
        onMouseDown={() => { isDragging.current = true; }}
        onTouchStart={() => { isDragging.current = true; }}
        onChange={(e) => setLocalHours(parseFloat(e.target.value) || 0)}
        onMouseUp={(e) => commitValue(parseFloat((e.target as HTMLInputElement).value) || 0)}
        onTouchEnd={(e) => commitValue(parseFloat((e.target as HTMLInputElement).value) || 0)}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 h-1.5 accent-primary cursor-pointer min-w-[40px]"
      />
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
  expandedMember: string | null;
  onMemberClick?: (key: string) => void;
  onHoursCommit?: (key: string, hours: number) => void;
  formatHours?: (v: number) => string;
}

function PyramidColumn({
  title, tiers, getValue, formatValue, total,
  interactive, expandedMember, onMemberClick,
  onHoursCommit, formatHours,
}: PyramidColumnProps) {
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
              className="flex flex-col items-center gap-1 transition-all duration-500"
              style={{ width: `${widthPct}%` }}
            >
              <div className="flex items-stretch gap-1 justify-center w-full">
                {tier.members.map((member) => {
                  const val = getValue(member);
                  const memberPct = tierTotal > 0 ? (val / tierTotal) * 100 : 100 / tier.members.length;
                  const isExpanded = expandedMember === member.key && interactive;

                  return (
                    <div key={member.key} className="flex flex-col min-w-0" style={{ width: `${memberPct}%`, minWidth: 40 }}>
                      <div
                        className={cn(
                          "rounded-xl border flex flex-col items-center justify-center py-1.5 px-1 transition-all duration-500 min-w-0 overflow-hidden relative",
                          colors.bg, colors.border,
                          interactive && "cursor-pointer hover:ring-2 hover:ring-primary/30",
                          isExpanded && "ring-2 ring-primary/50",
                        )}
                        style={{ minHeight: 36 }}
                        title={`${member.label}: ${formatValue(val)}`}
                        onClick={() => interactive && onMemberClick?.(member.key)}
                      >
                        <span className={cn("text-[10px] font-medium leading-tight truncate w-full text-center", colors.text)}>
                          {member.label}
                        </span>
                        <span className={cn("text-[10px] tabular-nums leading-tight opacity-75", colors.text)}>
                          {formatValue(val)}
                        </span>
                      </div>
                      {isExpanded && onHoursCommit && formatHours && (
                        <MemberEditor
                          member={member}
                          onHoursCommit={onHoursCommit}
                          formatHours={formatHours}
                        />
                      )}
                    </div>
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
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<DistributionPreset | null>(null);

  if (teamMembers.length === 0) return null;

  const tiers = buildTiers(teamMembers);
  const totalHours = teamMembers.reduce((s, m) => s + m.hours, 0);
  const totalRevenue = teamMembers.reduce((s, m) => s + m.revenue, 0);
  const interactive = !!onMemberHoursCommit;

  const hasKeyPlayers = Object.values(keyPlayers).some(v => v > 0);

  const handleMemberClick = (key: string) => {
    setExpandedMember(prev => prev === key ? null : key);
  };

  const handlePresetClick = (preset: DistributionPreset) => {
    if (!hasKeyPlayers) return;
    setActivePreset(preset);
    onDistribute?.(preset);
  };

  return (
    <TooltipProvider>
      <div className="rounded-lg border bg-card p-4 space-y-4">
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

        {/* Pyramids */}
        <div className="flex flex-col sm:flex-row gap-6">
          <PyramidColumn
            title="Hours Distribution"
            tiers={tiers}
            getValue={(m) => m.hours}
            formatValue={(v) => `${formatHours(v)}h`}
            total={totalHours}
            interactive={interactive}
            expandedMember={expandedMember}
            onMemberClick={handleMemberClick}
            onHoursCommit={onMemberHoursCommit}
            formatHours={formatHours}
          />
          <div className="hidden sm:block w-px bg-border" />
          <PyramidColumn
            title="Cost Distribution"
            tiers={tiers}
            getValue={(m) => m.revenue}
            formatValue={(v) => formatCurrency(v)}
            total={totalRevenue}
            interactive={false}
            expandedMember={null}
          />
        </div>
      </div>
    </TooltipProvider>
  );
});

export default SummaryPyramid;
