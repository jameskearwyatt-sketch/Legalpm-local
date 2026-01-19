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

    // Get budget versions with line items - fetch all, then dedupe to most recent per matter
    const { data: allBudgetVersions, error: budgetError } = await supabase
      .from("budget_versions")
      .select(`
        id,
        matter_id,
        version_number,
        total_amount,
        bm_total,
        local_counsel_total,
        notes,
        finalized_at,
        created_at
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (budgetError) {
      console.error("Error fetching budget versions:", budgetError);
    }

    // Keep only the most recent budget version per matter
    const latestBudgetVersionMap = new Map<string, any>();
    for (const bv of allBudgetVersions || []) {
      if (!latestBudgetVersionMap.has(bv.matter_id)) {
        latestBudgetVersionMap.set(bv.matter_id, bv);
      }
    }
    const budgetVersions = Array.from(latestBudgetVersionMap.values());
    const latestBudgetVersionIds = new Set(budgetVersions.map((bv: any) => bv.id));

    // Get budget line items - only for the most recent budget versions
    const { data: allLineItems, error: lineItemsError } = await supabase
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
      .limit(1000);

    if (lineItemsError) {
      console.error("Error fetching line items:", lineItemsError);
    }

    // Filter line items to only include those from the most recent budget versions
    const lineItems = (allLineItems || []).filter((li: any) => latestBudgetVersionIds.has(li.budget_version_id));

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
      .select("id, name, group_sector, display_name, billing_contact")
      .eq("user_id", userId);

    if (clientsError) {
      console.error("Error fetching clients:", clientsError);
    }

    // Get growth projects
    const { data: growthProjects, error: growthError } = await supabase
      .from("growth_projects")
      .select("id, name, description, project_type, status, ai_summary, mentee_name")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (growthError) {
      console.error("Error fetching growth projects:", growthError);
    }

    // Get growth project entries (scrapbook notes)
    const { data: growthEntries, error: entriesError } = await supabase
      .from("growth_project_entries")
      .select("id, project_id, title, content, entry_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (entriesError) {
      console.error("Error fetching growth entries:", entriesError);
    }

    // Get growth tasks
    const { data: growthTasks, error: tasksError } = await supabase
      .from("growth_tasks")
      .select("id, project_id, title, description, assignee, deadline_type, is_completed, completed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (tasksError) {
      console.error("Error fetching growth tasks:", tasksError);
    }

    // Get growth documents with summaries
    const { data: growthDocuments, error: docsError } = await supabase
      .from("growth_project_documents")
      .select("id, project_id, title, file_name, ai_summary")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (docsError) {
      console.error("Error fetching growth documents:", docsError);
    }

    // Get financial snapshots
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("financial_snapshots")
      .select("id, matter_id, as_of_date, wip_amount, billed_amount, paid_amount, notes")
      .eq("user_id", userId)
      .order("as_of_date", { ascending: false })
      .limit(200);

    if (snapshotsError) {
      console.error("Error fetching snapshots:", snapshotsError);
    }

    // Get budget amendments
    const { data: amendments, error: amendmentsError } = await supabase
      .from("budget_amendments")
      .select("id, matter_id, amendment_date, previous_budget, new_budget, previous_bm_fee, new_bm_fee, previous_local_counsel, new_local_counsel, notes")
      .eq("user_id", userId)
      .order("amendment_date", { ascending: false })
      .limit(100);

    if (amendmentsError) {
      console.error("Error fetching amendments:", amendmentsError);
    }

    // Get matter local counsels
    const { data: localCounsels, error: lcError } = await supabase
      .from("matter_local_counsels")
      .select("id, matter_id, firm_name, allocated_budget, wip_amount, billed_amount, billing_mode, last_updated")
      .eq("user_id", userId);

    if (lcError) {
      console.error("Error fetching local counsels:", lcError);
    }

    // Get matter assumptions
    const { data: assumptions, error: assumptionsError } = await supabase
      .from("matter_assumptions")
      .select("id, matter_id, label, assumption_text, is_standard, source_document")
      .eq("user_id", userId);

    if (assumptionsError) {
      console.error("Error fetching assumptions:", assumptionsError);
    }

    // Get payments
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, matter_id, payment_date, amount, reference")
      .eq("user_id", userId)
      .order("payment_date", { ascending: false })
      .limit(200);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Get pricing proposals
    const { data: proposals, error: proposalsError } = await supabase
      .from("pricing_proposals")
      .select("id, client_id, name, description, currency, status, current_version, assumptions, rate_card, work_phases")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (proposalsError) {
      console.error("Error fetching proposals:", proposalsError);
    }

    // Get pricing proposal versions
    const { data: proposalVersions, error: versionsError } = await supabase
      .from("pricing_proposal_versions")
      .select("id, proposal_id, version_number, total_amount, bm_total, local_counsel_total, notes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (versionsError) {
      console.error("Error fetching proposal versions:", versionsError);
    }

    // Get pricing proposal items
    const { data: proposalItems, error: itemsError } = await supabase
      .from("pricing_proposal_items")
      .select("id, proposal_id, version_id, work_item, provider, category, fee_amount, fee_lower, fee_upper, is_included, is_optional, partner_hours, associate_hours, pricing_method, ai_rationale")
      .eq("user_id", userId)
      .limit(500);

    if (itemsError) {
      console.error("Error fetching proposal items:", itemsError);
    }

    // Get time recording drafts
    const { data: timeDrafts, error: timeDraftsError } = await supabase
      .from("time_recording_drafts")
      .select("id, name, mode, single_date, date_range_from, date_range_to, grid_entries, is_polished, processed_output")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (timeDraftsError) {
      console.error("Error fetching time drafts:", timeDraftsError);
    }

    // Get matter clients (for multi-client matters)
    const { data: matterClients, error: matterClientsError } = await supabase
      .from("matter_clients")
      .select("id, matter_id, client_id, fee_percentage, is_master, cm_number")
      .eq("user_id", userId);

    if (matterClientsError) {
      console.error("Error fetching matter clients:", matterClientsError);
    }

    // Get detailed WIP updates
    const { data: wipUpdates, error: wipUpdatesError } = await supabase
      .from("detailed_wip_updates")
      .select("id, matter_id, total_wip_amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (wipUpdatesError) {
      console.error("Error fetching WIP updates:", wipUpdatesError);
    }

    // Get matter bills
    const { data: matterBills, error: billsError } = await supabase
      .from("matter_bills")
      .select("id, matter_id, amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (billsError) {
      console.error("Error fetching matter bills:", billsError);
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

    // Build growth projects context
    const growthContext = (growthProjects || []).map((gp: any) => {
      const projectEntries = (growthEntries || []).filter((e: any) => e.project_id === gp.id);
      const projectTasks = (growthTasks || []).filter((t: any) => t.project_id === gp.id);
      const projectDocs = (growthDocuments || []).filter((d: any) => d.project_id === gp.id);
      
      return {
        name: gp.name,
        type: gp.project_type?.replace(/_/g, ' '),
        description: gp.description,
        status: gp.status,
        menteeName: gp.mentee_name,
        aiSummary: gp.ai_summary,
        entries: projectEntries.map((e: any) => ({
          title: e.title,
          content: e.content,
          type: e.entry_type,
          date: e.created_at,
        })),
        tasks: projectTasks.map((t: any) => ({
          title: t.title,
          description: t.description,
          assignee: t.assignee,
          deadline: t.deadline_type,
          completed: t.is_completed,
        })),
        documents: projectDocs.map((d: any) => ({
          title: d.title,
          fileName: d.file_name,
          summary: d.ai_summary,
        })),
      };
    });

    // Build snapshots context
    const snapshotsContext = (snapshots || []).map((s: any) => {
      const matter = (matters || []).find((m: any) => m.id === s.matter_id);
      const currency = matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        asOfDate: s.as_of_date,
        wipAmount: { original: s.wip_amount, currency, inGBP: convertToGBP(s.wip_amount, currency) },
        billedAmount: { original: s.billed_amount, currency, inGBP: convertToGBP(s.billed_amount, currency) },
        paidAmount: { original: s.paid_amount, currency, inGBP: convertToGBP(s.paid_amount, currency) },
        notes: s.notes,
      };
    });

    // Build amendments context
    const amendmentsContext = (amendments || []).map((a: any) => {
      const matter = (matters || []).find((m: any) => m.id === a.matter_id);
      const currency = matter?.fee_currency || matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        date: a.amendment_date,
        previousBudget: a.previous_budget,
        newBudget: a.new_budget,
        previousBmFee: a.previous_bm_fee,
        newBmFee: a.new_bm_fee,
        previousLocalCounsel: a.previous_local_counsel,
        newLocalCounsel: a.new_local_counsel,
        currency,
        notes: a.notes,
      };
    });

    // Build local counsels context
    const localCounselsContext = (localCounsels || []).map((lc: any) => {
      const matter = (matters || []).find((m: any) => m.id === lc.matter_id);
      const currency = matter?.fee_currency || matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        firmName: lc.firm_name,
        allocatedBudget: lc.allocated_budget,
        wipAmount: lc.wip_amount,
        billedAmount: lc.billed_amount,
        billingMode: lc.billing_mode,
        lastUpdated: lc.last_updated,
        currency,
      };
    });

    // Build assumptions context
    const assumptionsContext = (assumptions || []).map((a: any) => {
      const matter = (matters || []).find((m: any) => m.id === a.matter_id);
      return {
        matterName: matter?.matter_name,
        label: a.label,
        text: a.assumption_text,
        isStandard: a.is_standard,
        sourceDocument: a.source_document,
      };
    });

    // Build payments context
    const paymentsContext = (payments || []).map((p: any) => {
      const matter = (matters || []).find((m: any) => m.id === p.matter_id);
      const currency = matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        date: p.payment_date,
        amount: { original: p.amount, currency, inGBP: convertToGBP(p.amount, currency) },
        reference: p.reference,
      };
    });

    // Build pricing proposals context
    const proposalsContext = (proposals || []).map((p: any) => {
      const client = (clients || []).find((c: any) => c.id === p.client_id);
      const versions = (proposalVersions || []).filter((v: any) => v.proposal_id === p.id);
      const items = (proposalItems || []).filter((i: any) => i.proposal_id === p.id);
      return {
        name: p.name,
        clientName: client?.name,
        description: p.description,
        currency: p.currency,
        status: p.status,
        currentVersion: p.current_version,
        assumptions: p.assumptions,
        rateCard: p.rate_card,
        workPhases: p.work_phases,
        versions: versions.map((v: any) => ({
          versionNumber: v.version_number,
          totalAmount: v.total_amount,
          bmTotal: v.bm_total,
          localCounselTotal: v.local_counsel_total,
          notes: v.notes,
        })),
        items: items.map((i: any) => ({
          workItem: i.work_item,
          provider: i.provider,
          category: i.category,
          feeAmount: i.fee_amount,
          feeLower: i.fee_lower,
          feeUpper: i.fee_upper,
          included: i.is_included,
          optional: i.is_optional,
          partnerHours: i.partner_hours,
          associateHours: i.associate_hours,
          pricingMethod: i.pricing_method,
          aiRationale: i.ai_rationale,
        })),
      };
    });

    // Build time recording context
    const timeRecordingContext = (timeDrafts || []).map((t: any) => ({
      name: t.name,
      mode: t.mode,
      singleDate: t.single_date,
      dateRangeFrom: t.date_range_from,
      dateRangeTo: t.date_range_to,
      isPolished: t.is_polished,
      gridEntries: t.grid_entries,
      processedOutput: t.processed_output,
    }));

    // Build matter bills context
    const matterBillsContext = (matterBills || []).map((b: any) => {
      const matter = (matters || []).find((m: any) => m.id === b.matter_id);
      const currency = matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        amount: b.amount,
        currency,
        date: b.created_at,
      };
    });

    // Build WIP updates context
    const wipUpdatesContext = (wipUpdates || []).map((w: any) => {
      const matter = (matters || []).find((m: any) => m.id === w.matter_id);
      const currency = matter?.currency || 'GBP';
      return {
        matterName: matter?.matter_name,
        totalWipAmount: w.total_wip_amount,
        currency,
        date: w.created_at,
      };
    });

    // Build multi-client matters context
    const multiClientContext = (matterClients || []).map((mc: any) => {
      const matter = (matters || []).find((m: any) => m.id === mc.matter_id);
      const client = (clients || []).find((c: any) => c.id === mc.client_id);
      return {
        matterName: matter?.matter_name,
        clientName: client?.name,
        feePercentage: mc.fee_percentage,
        isMaster: mc.is_master,
        cmNumber: mc.cm_number,
      };
    });

    const systemPrompt = `You are an intelligent assistant for a legal professional. You have COMPLETE ACCESS to ALL data in the application including:

1. MATTERS - Legal cases, budgets, financials, status
2. CLIENTS - Client information, sectors, billing contacts
3. GROWTH PROJECTS - Business development, professional development, learning initiatives
4. PRICING PROPOSALS - Fee quotes, rate cards, work phase breakdowns
5. TIME RECORDING - Time entry drafts, narratives
6. INVOICES & PAYMENTS - Billing history, payment tracking
7. FINANCIAL SNAPSHOTS - Historical WIP, billed, paid amounts
8. BUDGET AMENDMENTS - Budget change history
9. LOCAL COUNSELS - Third-party counsel tracking
10. MATTER ASSUMPTIONS - Pricing assumptions and exclusions

Your role is to provide helpful, accurate answers based on ALL available data. You can answer questions about ANY aspect of the user's practice.

=== ANSWERING APPROACH ===
1. When the user asks about typical pricing, averages, or patterns - ALWAYS analyze ALL relevant matters/budgets automatically. Do NOT ask "which matters" - just analyze everything and give a synthesized answer.
2. Be proactive and helpful. If asked "what do we charge for X", look across all budgets and give ranges, averages, and examples.
3. Give concise, actionable insights. Don't just list data - synthesize it.
4. For pricing questions: calculate min, max, average, and mention notable outliers or patterns.
5. When showing figures, round to reasonable amounts (nearest £1,000 for larger amounts).

=== CURRENCY RULES ===
1. Each matter and budget has its OWN CURRENCY - check the currency field
2. NEVER mix currencies - convert using provided GBP values for comparisons
3. Default to reporting in GBP unless the user asks for another currency
4. When comparing across currencies, use the GBP equivalents for fair comparison

=== DATA QUALITY ===
1. ONLY the MOST RECENT budget version per matter is included - no duplicates
2. Each matter appears ONCE with its current budget breakdown
3. Line items are from the current/active budget only

=== GROWTH PROJECTS ===
For BD, professional development, or learning questions:
- Review ALL scrapbook entries (notes, meeting summaries, emails)
- Check document summaries for key insights
- Review tasks and their status
- Provide actionable insights

=== PRICING & PROPOSALS ===
For pricing questions:
- Reference similar matters and proposals
- Use rate cards and work phase breakdowns
- Consider assumptions and exclusions
- Look at ALL relevant data and synthesize

=== TIME RECORDING ===
For time-related questions:
- Review time entry drafts and narratives
- Check polished vs unpolished entries

IMPORTANT: Never reference internal system IDs. Always refer to matters, clients, and projects by their descriptive name.

=== USER'S COMPLETE DATA ===

MATTERS (${mattersContext.length} total):
${JSON.stringify(mattersContext, null, 2)}

CLIENTS (${(clients || []).length} total):
${JSON.stringify(clients, null, 2)}

BUDGETS (${budgetContext.length} versions):
${JSON.stringify(budgetContext, null, 2)}

INVOICES (${invoiceContext.length} total):
${JSON.stringify(invoiceContext, null, 2)}

PAYMENTS (${paymentsContext.length} total):
${JSON.stringify(paymentsContext, null, 2)}

FINANCIAL SNAPSHOTS (${snapshotsContext.length} total):
${JSON.stringify(snapshotsContext, null, 2)}

BUDGET AMENDMENTS (${amendmentsContext.length} total):
${JSON.stringify(amendmentsContext, null, 2)}

LOCAL COUNSELS (${localCounselsContext.length} total):
${JSON.stringify(localCounselsContext, null, 2)}

MATTER ASSUMPTIONS (${assumptionsContext.length} total):
${JSON.stringify(assumptionsContext, null, 2)}

MATTER BILLS (${matterBillsContext.length} total):
${JSON.stringify(matterBillsContext, null, 2)}

WIP UPDATES (${wipUpdatesContext.length} total):
${JSON.stringify(wipUpdatesContext, null, 2)}

MULTI-CLIENT MATTERS (${multiClientContext.length} entries):
${JSON.stringify(multiClientContext, null, 2)}

PRICING PROPOSALS (${proposalsContext.length} total):
${JSON.stringify(proposalsContext, null, 2)}

TIME RECORDING DRAFTS (${timeRecordingContext.length} total):
${JSON.stringify(timeRecordingContext, null, 2)}

GROWTH PROJECTS (${growthContext.length} total):
${JSON.stringify(growthContext, null, 2)}`;

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
      JSON.stringify({ error: "An error occurred processing your request. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
