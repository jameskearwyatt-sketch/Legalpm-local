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

    // Build context for the AI
    const mattersContext = (matters || []).map((m: any) => ({
      name: m.matter_name,
      number: m.matter_number,
      client: m.clients?.name,
      sector: m.clients?.group_sector,
      practiceArea: m.practice_area,
      budgetType: m.budget_type,
      agreedBudget: m.agreed_budget_amount,
      bmFee: m.bm_fee_component,
      localCounselFee: m.local_counsel_fee,
      feeUpperEnd: m.fee_amount_upper_end,
      currency: m.currency,
      category: m.category,
      status: m.status,
      dealValue: m.deal_value,
      dealCurrency: m.deal_currency,
    }));

    const budgetContext = (budgetVersions || []).map((bv: any) => {
      const matter = (matters || []).find((m: any) => m.id === bv.matter_id);
      const items = (lineItems || []).filter((li: any) => li.budget_version_id === bv.id);
      return {
        matterName: matter?.matter_name,
        matterNumber: matter?.matter_number,
        practiceArea: matter?.practice_area,
        version: bv.version_number,
        total: bv.total_amount,
        bmTotal: bv.bm_total,
        lcTotal: bv.local_counsel_total,
        currency: matter?.currency,
        lineItems: items.map((li: any) => ({
          workItem: li.work_item,
          provider: li.provider,
          category: li.category,
          amount: li.fee_amount,
          included: li.is_included,
        })),
      };
    });

    const invoiceContext = (invoices || []).map((inv: any) => {
      const matter = (matters || []).find((m: any) => m.id === inv.matter_id);
      return {
        matterName: matter?.matter_name,
        invoiceNumber: inv.invoice_number,
        billed: inv.billed_amount,
        paid: inv.paid_amount,
        status: inv.status,
        date: inv.invoice_date,
      };
    });

    const systemPrompt = `You are an intelligent legal matter and budget assistant. You have access to the user's matters, budgets, and financial data. Your role is to provide helpful, accurate answers based on this data.

When answering questions about pricing or quotes:
1. Look for similar matters by practice area, deal type, or client sector
2. Analyze the budget amounts and fee structures from comparable matters
3. Consider the range of fees quoted (budget amounts, BM fees, local counsel fees)
4. Provide a clear recommendation with specific justification
5. Reference specific matters by name/number to support your answer

When giving price recommendations:
- Provide a specific figure or range
- Explain what similar matters you based this on
- Note any relevant factors that might affect the price

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
