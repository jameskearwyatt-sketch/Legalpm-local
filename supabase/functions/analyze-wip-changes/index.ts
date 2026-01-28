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
    const { matters, welcomeParagraph } = await req.json() as { 
      matters: MatterData[];
      welcomeParagraph: string;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const results: AnalysisResult[] = [];

    for (const matter of matters) {
      const { startSnapshot, endSnapshot, feeCurrency, userNotes, reviewPeriodDays } = matter;
      
      let narrative = "";
      let changes = {
        wipChange: 0,
        arChange: 0,
        paidChange: 0,
        newBilling: 0,
        newWipIncurred: 0,
      };

      // If no historical data, just report current figures
      if (!startSnapshot || !endSnapshot) {
        // No comparison available - just report current state
        const currentTotal = matter.currentWip + matter.currentAr + matter.currentPaid;
        if (currentTotal > 0) {
          narrative = `Our current work in progress stands at ${formatCurrency(matter.currentWip, feeCurrency)}.`;
          if (matter.currentAr > 0) {
            narrative += ` We have outstanding invoices totalling ${formatCurrency(matter.currentAr, feeCurrency)}.`;
          }
          if (matter.currentPaid > 0) {
            narrative += ` Thank you for your payment of ${formatCurrency(matter.currentPaid, feeCurrency)} received to date.`;
          }
        } else {
          narrative = "No fees have been incurred on this matter to date.";
        }
      } else {
        // Calculate changes
        changes.wipChange = endSnapshot.wip_amount - startSnapshot.wip_amount;
        changes.arChange = endSnapshot.accounts_receivable - startSnapshot.accounts_receivable;
        changes.paidChange = endSnapshot.paid_amount - startSnapshot.paid_amount;
        
        // Derive billing and new WIP
        // If AR went up, we billed that amount
        // If WIP went down but AR went up, we billed from WIP
        // Net new WIP = WIP change + amount billed from WIP
        const wipDecrease = Math.max(0, -changes.wipChange);
        const arIncrease = Math.max(0, changes.arChange);
        
        // New billing is the increase in AR
        changes.newBilling = arIncrease;
        
        // If WIP decreased and AR increased, part of WIP was billed
        // True new WIP incurred = WIP end - (WIP start - billed from WIP)
        // Actually: if WIP went from 100 to 20, and AR went from 0 to 100:
        //   - We billed 100 (from WIP)
        //   - New WIP incurred = 20 (current WIP)
        //   This means we incurred 20 new WIP after billing
        // 
        // More generally:
        // New WIP incurred = endWip - startWip + amountBilledFromWip
        // amountBilledFromWip = min(wipDecrease, arIncrease)
        const billedFromWip = Math.min(wipDecrease, arIncrease);
        changes.newWipIncurred = changes.wipChange + billedFromWip;
        
        // Use AI to generate narrative
        const prompt = buildAnalysisPrompt(matter, changes, reviewPeriodDays, userNotes);
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: `You are a senior lawyer writing a professional but warm email update to a client about the financial status of their legal matter. Write in UK English. Be concise, clear, and informative. Use formal business English but avoid being overly stiff. Never mention specific amounts unless they are significant changes. Always frame things positively where possible. The currency is ${feeCurrency}.`,
              },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!response.ok) {
          console.error("AI API error:", response.status, await response.text());
          // Fallback to template-based narrative
          narrative = buildFallbackNarrative(matter, changes, reviewPeriodDays);
        } else {
          const data = await response.json();
          narrative = data.choices?.[0]?.message?.content || buildFallbackNarrative(matter, changes, reviewPeriodDays);
        }
      }

      // Polish user notes if provided
      if (userNotes && userNotes.trim()) {
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
                content: "You are a senior lawyer. Polish the following notes into professional prose suitable for a client email. Keep it concise. Write in UK English. Output ONLY the polished text, nothing else.",
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

function buildAnalysisPrompt(
  matter: MatterData,
  changes: AnalysisResult["changes"],
  reviewPeriodDays: number,
  userNotes?: string
): string {
  const periodDescription = reviewPeriodDays <= 7 
    ? "the past week" 
    : reviewPeriodDays <= 14 
      ? "the past two weeks" 
      : reviewPeriodDays <= 31 
        ? "the past month" 
        : `the past ${Math.round(reviewPeriodDays / 7)} weeks`;

  let prompt = `Write a brief paragraph (2-4 sentences) for a client email update about the financial status of their legal matter "${matter.matterName}".

Review period: ${periodDescription}
Currency: ${matter.feeCurrency}

Financial changes during this period:
- Work in Progress (WIP) change: ${changes.wipChange >= 0 ? '+' : ''}${formatCurrency(changes.wipChange, matter.feeCurrency)}
- Current WIP: ${formatCurrency(matter.currentWip, matter.feeCurrency)}
- Accounts Receivable (outstanding invoices) change: ${changes.arChange >= 0 ? '+' : ''}${formatCurrency(changes.arChange, matter.feeCurrency)}
- Current AR: ${formatCurrency(matter.currentAr, matter.feeCurrency)}
- Payments received change: ${changes.paidChange >= 0 ? '+' : ''}${formatCurrency(changes.paidChange, matter.feeCurrency)}
- Total paid to date: ${formatCurrency(matter.currentPaid, matter.feeCurrency)}

Key interpretations:
- New fees incurred: ${formatCurrency(Math.max(0, changes.newWipIncurred), matter.feeCurrency)}
- New invoices issued: ${formatCurrency(changes.newBilling, matter.feeCurrency)}

Write a professional, warm paragraph explaining the current financial position. Focus on what's most relevant to the client. If we've billed them, mention it. If we've incurred new fees, explain briefly. If they've made payments, thank them.`;

  return prompt;
}

function buildFallbackNarrative(
  matter: MatterData,
  changes: AnalysisResult["changes"],
  reviewPeriodDays: number
): string {
  const periodDescription = reviewPeriodDays <= 7 
    ? "the past week" 
    : reviewPeriodDays <= 14 
      ? "the past two weeks" 
      : "the review period";
  
  const parts: string[] = [];
  
  if (changes.newWipIncurred > 0) {
    parts.push(`During ${periodDescription}, we have incurred ${formatCurrency(changes.newWipIncurred, matter.feeCurrency)} in additional fees.`);
  }
  
  if (changes.newBilling > 0) {
    parts.push(`We have issued invoices totalling ${formatCurrency(changes.newBilling, matter.feeCurrency)}.`);
  }
  
  if (changes.paidChange > 0) {
    parts.push(`Thank you for your payment of ${formatCurrency(changes.paidChange, matter.feeCurrency)}.`);
  }
  
  if (parts.length === 0) {
    parts.push(`Our work in progress currently stands at ${formatCurrency(matter.currentWip, matter.feeCurrency)}.`);
  }
  
  return parts.join(" ");
}
