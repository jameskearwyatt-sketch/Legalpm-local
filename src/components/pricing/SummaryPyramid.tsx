import React from "react";
import { cn } from "@/lib/utils";

interface TeamMember {
  key: string;
  label: string;
  hours: number;
  rate: number;
  revenue: number;
  memberCost: number;
  level?: string;
}

interface SummaryPyramidProps {
  teamMembers: TeamMember[];
  formatCurrency: (value: number) => string;
  formatHours: (value: number) => string;
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

function classifyTier(member: TeamMember): TierKey {
  // Use stored level if available
  if (member.level) {
    const lvl = member.level.toLowerCase();
    if (lvl === "partner") return "partners";
    if (lvl === "counsel" || lvl === "seniorassociate") return "senior";
    if (lvl === "associate") return "associates";
    if (lvl === "trainee") return "juniors";
  }
  // Fallback: auto-detect from key
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

interface PyramidColumnProps {
  title: string;
  tiers: Tier[];
  getValue: (m: TeamMember) => number;
  formatValue: (v: number) => string;
  total: number;
}

function PyramidColumn({ title, tiers, getValue, formatValue, total }: PyramidColumnProps) {
  // Max tier width proportional to tier's share of total
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
          // Width: proportion of this tier vs the largest tier, with min 20% for visibility
          const widthPct = total > 0 ? Math.max(20, (tierTotal / maxTierTotal) * 100) : 20;

          if (tier.members.length === 0) {
            // Empty tier — gap placeholder
            return (
              <div
                key={tier.key}
                className="flex items-center justify-center transition-all duration-500"
                style={{ width: `${20}%`, minHeight: 36 }}
              >
                <div
                  className={cn(
                    "w-full rounded-xl border-2 border-dashed flex items-center justify-center py-1.5 px-2",
                    "border-muted-foreground/20"
                  )}
                >
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
              className="flex items-stretch gap-1 justify-center transition-all duration-500"
              style={{ width: `${widthPct}%` }}
            >
              {tier.members.map((member) => {
                const val = getValue(member);
                const memberPct = tierTotal > 0 ? (val / tierTotal) * 100 : 100 / tier.members.length;

                return (
                  <div
                    key={member.key}
                    className={cn(
                      "rounded-xl border flex flex-col items-center justify-center py-1.5 px-1 transition-all duration-500 min-w-0 overflow-hidden",
                      colors.bg,
                      colors.border
                    )}
                    style={{ width: `${memberPct}%`, minWidth: 40, minHeight: 36 }}
                    title={`${member.label}: ${formatValue(val)}`}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-medium leading-tight truncate w-full text-center",
                        colors.text
                      )}
                    >
                      {member.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] tabular-nums leading-tight opacity-75",
                        colors.text
                      )}
                    >
                      {formatValue(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SummaryPyramid = React.memo(function SummaryPyramid({
  teamMembers,
  formatCurrency,
  formatHours,
}: SummaryPyramidProps) {
  if (teamMembers.length === 0) return null;

  const tiers = buildTiers(teamMembers);
  const totalHours = teamMembers.reduce((s, m) => s + m.hours, 0);
  const totalRevenue = teamMembers.reduce((s, m) => s + m.revenue, 0);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col sm:flex-row gap-6">
        <PyramidColumn
          title="Hours Distribution"
          tiers={tiers}
          getValue={(m) => m.hours}
          formatValue={(v) => `${formatHours(v)}h`}
          total={totalHours}
        />
        <div className="hidden sm:block w-px bg-border" />
        <PyramidColumn
          title="Cost Distribution"
          tiers={tiers}
          getValue={(m) => m.revenue}
          formatValue={(v) => formatCurrency(v)}
          total={totalRevenue}
        />
      </div>
    </div>
  );
});

export default SummaryPyramid;
