import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Fetch relevant data from the database
    console.log("Fetching data for user:", userId);

    // Get all matters with their clients
    const { data: matters, error: mattersError } = await supabase
      .from("matters")
      .select(`
        id,
        matter_name,
        matter_number,
        practice_area,
        budget_type,
        agreed_budget_amount,
        bm_fee_component,
        local_counsel_fee,
        fee_amount_upper_end,
        currency,
        fee_currency,
        category,
        status,
        start_date,
        target_close_date,
        deal_value,
        deal_currency,
        clients!inner(name, group_sector)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (mattersError) {
      console.error("Error fetching matters:", mattersError);
    }

    // Get budget versions with line items
    const { data: budgetVersions, error: budgetError } = await supabase
      .from("budget_versions")
      .select(`
        id,
        matter_id,
        version_number,
        total_amount,
        bm_total,
        local_counsel_total,
        notes,
        finalized_at
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (budgetError) {
      console.error("Error fetching budget versions:", budgetError);
    }

    // Get budget line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("budget_line_items")
      .select(`
        id,
        budget_version_id,
        matter_id,
        work_item,
        provider,
        category,
        fee_amount,
        is_optional,
        is_included
      `)
      .eq("user_id", userId)
      .limit(500);

    if (lineItemsError) {
      console.error("Error fetching line items:", lineItemsError);
    }

    // Get invoices for financial context
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id,
        matter_id,
        invoice_number,
        billed_amount,
        paid_amount,
        status,
        invoice_date
      `)
      .eq("user_id", userId)
      .limit(200);

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
    }

    // Get clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, group_sector")
      .eq("user_id", userId);

    if (clientsError) {
      console.error("Error fetching clients:", clientsError);
    }

    // Approximate exchange rates for currency conversion (to GBP as base)
    // These are rough rates for AI estimation - not for actual billing
    const exchangeRatesToGBP: Record<string, number> = {
      'GBP': 1.0,
      'USD': 0.79,
      'EUR': 0.86,
      'CHF': 0.89,
      'JPY': 0.0053,
      'AUD': 0.52,
      'CAD': 0.59,
      'SGD': 0.59,
      'HKD': 0.10,
      'CNY': 0.11,
    };

    const exchangeRatesToUSD: Record<string, number> = {
      'GBP': 1.27,
      'USD': 1.0,
      'EUR': 1.09,
      'CHF': 1.13,
      'JPY': 0.0067,
      'AUD': 0.66,
      'CAD': 0.75,
      'SGD': 0.75,
      'HKD': 0.13,
      'CNY': 0.14,
    };

    // Helper function to convert amounts
    const convertToGBP = (amount: number, fromCurrency: string): number => {
      const rate = exchangeRatesToGBP[fromCurrency] || 1.0;
      return Math.round(amount * rate);
    };

    const convertToUSD = (amount: number, fromCurrency: string): number => {
      const rate = exchangeRatesToUSD[fromCurrency] || 1.0;
      return Math.round(amount * rate);
    };

    // Build context for the AI with explicit currency information
    const mattersContext = (matters || []).map((m: any) => {
      // fee_currency is the currency used for quoting/budgeting (e.g., USD)
      // currency is the billing currency (e.g., GBP)
      const feeCurrency = m.fee_currency || m.currency || 'GBP';
      const billingCurrency = m.currency || 'GBP';
      return {
        name: m.matter_name,
        client: m.clients?.name,
        sector: m.clients?.group_sector,
        practiceArea: m.practice_area,
        budgetType: m.budget_type,
        // Budget/fee amounts are in fee_currency (quote currency)
        agreedBudget: {
          original: m.agreed_budget_amount,
          originalCurrency: billingCurrency,
          inGBP: convertToGBP(m.agreed_budget_amount, billingCurrency),
          inUSD: convertToUSD(m.agreed_budget_amount, billingCurrency),
        },
        // BM fee and local counsel fees are in the fee_currency (quote currency)
        bmFee: {
          original: m.bm_fee_component,
          originalCurrency: feeCurrency,
          inGBP: convertToGBP(m.bm_fee_component, feeCurrency),
          inUSD: convertToUSD(m.bm_fee_component, feeCurrency),
        },
        localCounselFee: {
          original: m.local_counsel_fee,
          originalCurrency: feeCurrency,
          inGBP: convertToGBP(m.local_counsel_fee, feeCurrency),
          inUSD: convertToUSD(m.local_counsel_fee, feeCurrency),
        },
        feeUpperEnd: {
          original: m.fee_amount_upper_end,
          originalCurrency: feeCurrency,
          inGBP: convertToGBP(m.fee_amount_upper_end, feeCurrency),
          inUSD: convertToUSD(m.fee_amount_upper_end, feeCurrency),
        },
        category: m.category,
        status: m.status,
        dealValue: m.deal_value ? {
          original: m.deal_value,
          originalCurrency: m.deal_currency || billingCurrency,
          inGBP: convertToGBP(m.deal_value, m.deal_currency || billingCurrency),
          inUSD: convertToUSD(m.deal_value, m.deal_currency || billingCurrency),
        } : null,
      };
    });

    const budgetContext = (budgetVersions || []).map((bv: any) => {
      const matter = (matters || []).find((m: any) => m.id === bv.matter_id);
      const items = (lineItems || []).filter((li: any) => li.budget_version_id === bv.id);
      // Use fee_currency for budget line items as they represent quote amounts
      const feeCurrency = matter?.fee_currency || matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        practiceArea: matter?.practice_area,
        version: bv.version_number,
        budgetCurrency: feeCurrency,
        total: {
          original: bv.total_amount,
          originalCurrency: feeCurrency,
          inGBP: convertToGBP(bv.total_amount, feeCurrency),
          inUSD: convertToUSD(bv.total_amount, feeCurrency),
        },
        bmTotal: {
          original: bv.bm_total,
          originalCurrency: feeCurrency,
          inGBP: convertToGBP(bv.bm_total, feeCurrency),
          inUSD: convertToUSD(bv.bm_total, feeCurrency),
        },
        lcTotal: {
          original: bv.local_counsel_total,
          originalCurrency: feeCurrency,
          inGBP: convertToGBP(bv.local_counsel_total, feeCurrency),
          inUSD: convertToUSD(bv.local_counsel_total, feeCurrency),
        },
        lineItems: items.map((li: any) => ({
          workItem: li.work_item,
          provider: li.provider,
          category: li.category,
          amount: {
            original: li.fee_amount,
            originalCurrency: feeCurrency,
            inGBP: convertToGBP(li.fee_amount, feeCurrency),
            inUSD: convertToUSD(li.fee_amount, feeCurrency),
          },
          included: li.is_included,
        })),
      };
    });

    const invoiceContext = (invoices || []).map((inv: any) => {
      const matter = (matters || []).find((m: any) => m.id === inv.matter_id);
      const currency = matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        currency: currency,
        billed: {
          original: inv.billed_amount,
          originalCurrency: currency,
          inGBP: convertToGBP(inv.billed_amount, currency),
          inUSD: convertToUSD(inv.billed_amount, currency),
        },
        paid: {
          original: inv.paid_amount,
          originalCurrency: currency,
          inGBP: convertToGBP(inv.paid_amount, currency),
          inUSD: convertToUSD(inv.paid_amount, currency),
        },
        status: inv.status,
        date: inv.invoice_date,
      };
    });

    const systemPrompt = `You are an intelligent legal matter and budget assistant. You have access to the user's matters, budgets, and financial data. Your role is to provide helpful, accurate answers based on this data.

CRITICAL CURRENCY RULES:
1. Each matter and budget has its OWN CURRENCY - pay close attention to the "originalCurrency" field
2. NEVER mix currencies - a budget of 219,000 EUR is NOT the same as 219,000 GBP
3. When comparing matters or calculating averages, ALWAYS use the converted values (inGBP or inUSD)
4. When reporting final recommendations, ALWAYS report in GBP (pounds sterling) or USD (US dollars)
5. Default to reporting in GBP unless the user specifically asks for USD
6. When you reference a specific matter's budget, mention its original currency (e.g., "Matter X had a budget of €219,000, which is approximately £188,000")

FORMAT FOR ANSWERS:
- Give your main recommendation in GBP (e.g., "I recommend quoting approximately £150,000")
- If helpful, also provide the USD equivalent in parentheses
- When referencing source data, always clarify the original currency

When answering questions about pricing or quotes:
1. Look for similar matters by practice area, deal type, or client sector
2. Analyze the budget amounts using the CONVERTED values for fair comparison
3. Consider the range of fees quoted (budget amounts, BM fees, local counsel fees)
4. Provide a clear recommendation with specific justification
5. Reference specific matters by their NAME only (never use internal system IDs or codes)

When giving price recommendations:
- Provide a specific figure or range IN GBP (or USD if requested)
- Explain what similar matters you based this on (by name, not by ID)
- Clarify the original currencies of your source data
- Note any relevant factors that might affect the price

IMPORTANT: Never reference internal system matter numbers or IDs. Always refer to matters by their descriptive name only.

Keep your answers concise but informative. Always justify your recommendations with specific data points.

Here is the user's data:

MATTERS (${mattersContext.length} total):
${JSON.stringify(mattersContext, null, 2)}

BUDGETS (${budgetContext.length} versions):
${JSON.stringify(budgetContext, null, 2)}

INVOICES (${invoiceContext.length} total):
${JSON.stringify(invoiceContext, null, 2)}

CLIENTS (${(clients || []).length} total):
${JSON.stringify(clients, null, 2)}`;

    console.log("Calling Lovable AI...");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || "I couldn't generate an answer.";

    console.log("AI response received successfully");

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ask-ai function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
