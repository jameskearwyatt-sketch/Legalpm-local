import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FinancialSnapshot {
  wip_amount: number;
  billed_amount: number;
  paid_amount: number;
  accounts_receivable: number;
  wip_write_off_amount: number;
  as_of_date: string;
}

interface MatterData {
  matterId: string;
  matterName: string;
  clientName: string;
  feeCurrency: string;
  startSnapshot: FinancialSnapshot | null;
  endSnapshot: FinancialSnapshot | null;
  currentWip: number;
  currentAr: number;
  currentPaid: number;
  totalBudgetUtilised: number;
  agreedBudget: number;
  reviewPeriodDays: number | null; // null means "from beginning" / all time
  userNotes?: string;
}

interface AnalysisResult {
  matterId: string;
  narrative: string;
  changes: {
    wipChange: number;
    arChange: number;
    paidChange: number;
    newBilling: number;
    periodUtilisation: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matters } = await req.json() as { 
      matters: MatterData[];
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const results: AnalysisResult[] = [];

    for (const matter of matters) {
      const { startSnapshot, feeCurrency, userNotes, reviewPeriodDays, totalBudgetUtilised } = matter;
      
      let narrative = "";
      let changes = {
        wipChange: 0,
        arChange: 0,
        paidChange: 0,
        newBilling: 0,
        periodUtilisation: 0,
      };

      // Always build the aggregate financial position first
      const aggregateSection = buildAggregateSection(matter, feeCurrency);
      
      // If we have a period to compare (reviewPeriodDays is not null), calculate period changes
      let periodSection = "";
      if (reviewPeriodDays !== null && startSnapshot) {
        // Calculate changes: compare start snapshot to CURRENT values
        changes.wipChange = matter.currentWip - startSnapshot.wip_amount;
        changes.arChange = matter.currentAr - startSnapshot.accounts_receivable;
        changes.paidChange = matter.currentPaid - startSnapshot.paid_amount;
        
        // Period utilisation = total change in (WIP + AR + Paid)
        const startTotal = startSnapshot.wip_amount + startSnapshot.accounts_receivable + startSnapshot.paid_amount;
        const currentTotal = matter.currentWip + matter.currentAr + matter.currentPaid;
        changes.periodUtilisation = currentTotal - startTotal;
        
        // New billing is the increase in billed amount (AR + Paid)
        const startBilled = startSnapshot.accounts_receivable + startSnapshot.paid_amount;
        const currentBilled = matter.currentAr + matter.currentPaid;
        changes.newBilling = Math.max(0, currentBilled - startBilled);
        
        // Build period-specific section
        periodSection = buildPeriodSection(changes, reviewPeriodDays, feeCurrency);
      }

      // Combine sections
      narrative = aggregateSection;
      if (periodSection) {
        narrative += "\n\n" + periodSection;
      }

      // Polish user notes if provided
      if (userNotes && userNotes.trim() && LOVABLE_API_KEY) {
        try {
          const polishResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: "You are a senior lawyer. Polish the following notes into professional prose suitable for a client email. Keep it concise. Write in UK English. Output ONLY the polished text, nothing else. Do not add any greetings, sign-offs, or introductory phrases.",
                },
                { role: "user", content: userNotes },
              ],
            }),
          });

          if (polishResponse.ok) {
            const polishData = await polishResponse.json();
            const polishedNotes = polishData.choices?.[0]?.message?.content;
            if (polishedNotes) {
              narrative = narrative + "\n\n" + polishedNotes;
            }
          }
        } catch (e) {
          console.error("Failed to polish notes:", e);
          // If AI fails, just append raw notes
          narrative = narrative + "\n\n" + userNotes;
        }
      }

      results.push({
        matterId: matter.matterId,
        narrative,
        changes,
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-wip-changes error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
    JPY: "¥",
  };
  const symbol = symbols[currency] || currency + " ";
  return `${symbol}${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildAggregateSection(matter: MatterData, currency: string): string {
  const totalUtilised = matter.totalBudgetUtilised || (matter.currentWip + matter.currentAr + matter.currentPaid);
  const agreedBudget = matter.agreedBudget || 0;
  
  const lines: string[] = [];
  
  // Show agreed budget first if available
  if (agreedBudget > 0) {
    lines.push(`Agreed budget: ${formatCurrency(agreedBudget, currency)}`);
  }
  
  lines.push(`Total budget utilised to date: ${formatCurrency(totalUtilised, currency)}`);
  lines.push("");
  lines.push("Current financial position:");
  lines.push(`• Work in progress: ${formatCurrency(matter.currentWip, currency)}`);
  lines.push(`• Outstanding invoices: ${formatCurrency(matter.currentAr, currency)}`);
  lines.push(`• Paid to date: ${formatCurrency(matter.currentPaid, currency)}`);
  
  return lines.join("\n");
}

function buildPeriodSection(
  changes: AnalysisResult["changes"],
  reviewPeriodDays: number,
  currency: string
): string {
  const periodDescription = reviewPeriodDays <= 7 
    ? "the past week" 
    : reviewPeriodDays <= 14 
      ? "the past two weeks" 
      : reviewPeriodDays <= 31 
        ? "the past month" 
        : reviewPeriodDays <= 45
          ? "the past six weeks"
          : `the past ${Math.round(reviewPeriodDays / 30)} months`;

  const lines: string[] = [];
  
  // Period utilisation
  if (changes.periodUtilisation > 0) {
    lines.push(`In ${periodDescription}, we have utilised ${formatCurrency(changes.periodUtilisation, currency)} of the budget.`);
  } else if (changes.periodUtilisation === 0) {
    lines.push(`In ${periodDescription}, there has been no additional budget utilisation.`);
  } else {
    lines.push(`In ${periodDescription}, there has been a credit adjustment of ${formatCurrency(Math.abs(changes.periodUtilisation), currency)}.`);
  }
  
  // Additional context if there was billing activity
  if (changes.newBilling > 0) {
    lines.push(`Invoices totalling ${formatCurrency(changes.newBilling, currency)} were issued during this period.`);
  }
  
  if (changes.paidChange > 0) {
    lines.push(`Thank you for your payment of ${formatCurrency(changes.paidChange, currency)}.`);
  }
  
  return lines.join(" ");
}
