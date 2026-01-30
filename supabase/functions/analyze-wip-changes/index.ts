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
  reviewPeriodDays: number;
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
    newWipIncurred: number;
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
      const { startSnapshot, feeCurrency, userNotes, reviewPeriodDays } = matter;
      
      let narrative = "";
      let changes = {
        wipChange: 0,
        arChange: 0,
        paidChange: 0,
        newBilling: 0,
        newWipIncurred: 0,
      };

      // Build period description
      const periodDescription = reviewPeriodDays <= 7 
        ? "the past week" 
        : reviewPeriodDays <= 14 
          ? "the past two weeks" 
          : reviewPeriodDays <= 31 
            ? "the past month" 
            : reviewPeriodDays <= 45
              ? "the past six weeks"
              : `the past ${Math.round(reviewPeriodDays / 30)} months`;

      // If no historical data, just report current figures
      if (!startSnapshot) {
        // No comparison available - just report current state
        narrative = buildCurrentStateNarrative(matter, feeCurrency);
      } else {
        // Calculate changes: compare start snapshot to CURRENT values (not end snapshot)
        // This ensures we capture all changes up to now
        changes.wipChange = matter.currentWip - startSnapshot.wip_amount;
        changes.arChange = matter.currentAr - startSnapshot.accounts_receivable;
        changes.paidChange = matter.currentPaid - startSnapshot.paid_amount;
        
        // Total budget utilised in period = new WIP incurred
        // If WIP went from 0 to 100k, we incurred 100k
        // If WIP went from 50k to 30k but AR went from 0 to 80k, we incurred 60k (30k current + 80k billed - 50k start)
        // Formula: current WIP + (current billed - start billed) - start WIP
        // Or simpler: currentWip + currentAr + currentPaid - (startWip + startAr + startPaid)
        const startTotal = startSnapshot.wip_amount + startSnapshot.accounts_receivable + startSnapshot.paid_amount;
        const currentTotal = matter.currentWip + matter.currentAr + matter.currentPaid;
        changes.newWipIncurred = currentTotal - startTotal;
        
        // New billing is the increase in billed amount (AR + Paid)
        const startBilled = startSnapshot.accounts_receivable + startSnapshot.paid_amount;
        const currentBilled = matter.currentAr + matter.currentPaid;
        changes.newBilling = Math.max(0, currentBilled - startBilled);
        
        // Build factual narrative
        narrative = buildFactualNarrative(matter, changes, periodDescription, feeCurrency);
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

function buildCurrentStateNarrative(matter: MatterData, currency: string): string {
  const parts: string[] = [];
  
  parts.push(`Our current work in progress stands at ${formatCurrency(matter.currentWip, currency)}.`);
  
  if (matter.currentAr > 0) {
    parts.push(`Outstanding invoices total ${formatCurrency(matter.currentAr, currency)}.`);
  }
  
  if (matter.currentPaid > 0) {
    parts.push(`Payments received to date: ${formatCurrency(matter.currentPaid, currency)}.`);
  }
  
  return parts.join(" ");
}

function buildFactualNarrative(
  matter: MatterData,
  changes: AnalysisResult["changes"],
  periodDescription: string,
  currency: string
): string {
  const parts: string[] = [];
  
  // Opening with budget utilisation
  if (changes.newWipIncurred > 0) {
    parts.push(`In ${periodDescription}, we have utilised ${formatCurrency(changes.newWipIncurred, currency)} of the budget.`);
  } else if (changes.newWipIncurred === 0) {
    parts.push(`In ${periodDescription}, there has been no additional budget utilisation.`);
  } else {
    // Negative means write-offs or adjustments
    parts.push(`In ${periodDescription}, there has been a credit adjustment of ${formatCurrency(Math.abs(changes.newWipIncurred), currency)}.`);
  }
  
  // Current position summary
  parts.push("");
  parts.push("Current position:");
  parts.push(`• Work in progress: ${formatCurrency(matter.currentWip, currency)}`);
  
  if (matter.currentAr > 0) {
    parts.push(`• Outstanding invoices: ${formatCurrency(matter.currentAr, currency)}`);
  }
  
  if (matter.currentPaid > 0) {
    parts.push(`• Paid to date: ${formatCurrency(matter.currentPaid, currency)}`);
  }
  
  // Additional context if there was billing activity
  if (changes.newBilling > 0) {
    parts.push("");
    parts.push(`Invoices totalling ${formatCurrency(changes.newBilling, currency)} were issued during this period.`);
  }
  
  if (changes.paidChange > 0) {
    parts.push("");
    parts.push(`Thank you for your payment of ${formatCurrency(changes.paidChange, currency)}.`);
  }
  
  return parts.join("\n");
}
