// Version: v1.0.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const {
      mode, // "initial" or "refine"
      proposal,
      items,
      structuredAnswers,
      freeDescription,
      newName,
      newClientName,
      // Refine-mode only:
      phaseChanges: userPhaseDecisions,
      itemChanges: userItemDecisions,
      scopeChanges: userScopeDecisions,
      generalComment,
    } = body;

    const itemsSummary = (items || [])
      .map((i: any, idx: number) => `${idx + 1}. ID: ${i.id} | [${i.provider}] ${i.work_item}${i.detail ? ` — ${i.detail}` : ""} | Category: ${i.category || "none"} | Phase: ${i.phase_id || "none"} | Fee: ${i.fee_lower}-${i.fee_upper} | fee_amount: ${i.fee_amount}`)
      .join("\n");

    const phasesSummary = (proposal.work_phases || [])
      .map((p: any) => `${p.id}: ${p.name}`)
      .join("\n");

    const answersText = (structuredAnswers || [])
      .map((a: any) => `Q: ${a.questionId} → ${JSON.stringify(a.answer)}`)
      .join("\n");

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "initial") {
      systemPrompt = `You are an expert legal pricing analyst. You are adapting a base pricing proposal for a new deal.

Your job is to:
1. Analyse the base proposal's work items, phases, and scope
2. Consider the user's answers about how the new deal differs
3. Consider the user's free-form description of differences
4. Produce a comprehensive list of changes needed

For each work item, decide:
- "unchanged": keep as-is (no modifications needed)
- "modified": text or detail needs changing (e.g., jurisdiction references, technology references, regulatory body names)
- "removed": not relevant for the new deal
- "added": new items needed for the new deal

Also consider phase-level changes (renaming, adding, removing) and scope assumption changes.

Be intelligent about:
- Replacing jurisdiction-specific references (e.g., Egyptian regulations → Saudi regulations)
- Replacing technology references (e.g., solar → wind)
- Adding jurisdiction-specific regulatory items
- Removing workstreams the user indicated are not needed
- Adding workstreams for the new deal structure

CRITICAL RULES:
1. baseItemId: For "unchanged", "modified", and "removed" items, you MUST set baseItemId to the exact ID from the base item list. This is essential for matching.
2. originalWorkItem: ALWAYS populate this with the exact work_item text from the base proposal for unchanged/modified/removed items.
3. newWorkItem: For "modified" items, ALWAYS provide a clear, descriptive work item label (never leave blank or use generic text like "Work Item").
4. Fees: For "unchanged" and "modified" items, ALWAYS copy fee_amount, fee_lower, and fee_upper from the base item. Only estimate fees for newly "added" items.
5. phase_id: For "unchanged" items, preserve the original phase_id. For "modified" items, preserve unless explicitly changing phases.
6. category: Always preserve the base item's category unless explicitly changing it.`;

      userPrompt = `BASE PROPOSAL: "${proposal.name}" for ${proposal.client?.name || "Unknown"}
Currency: ${proposal.currency}

NEW DEAL: "${newName}" for ${newClientName}

PHASES:
${phasesSummary || "No phases"}

WORK ITEMS:
${itemsSummary || "No items"}

USER ANSWERS TO TARGETED QUESTIONS:
${answersText || "No answers provided"}

USER FREE-FORM DESCRIPTION:
${freeDescription || "No additional description provided"}

Please produce the complete adaptation.`;
    } else {
      // Refine mode
      const allItemChangesText = (userItemDecisions || [])
        .map((d: any) => {
          const status = d.accepted ? "ACCEPTED" : "REJECTED";
          const comment = d.comment ? ` — User comment: ${d.comment}` : "";
          if (d.action === "unchanged") return `[UNCHANGED] "${d.originalWorkItem}"${comment}`;
          if (d.action === "removed") return `[REMOVED - ${status}] "${d.originalWorkItem}" — Rationale: ${d.rationale}${comment}`;
          if (d.action === "added") return `[ADDED - ${status}] "${d.newWorkItem}" — Detail: ${d.newDetail || "none"} — Rationale: ${d.rationale}${comment}`;
          return `[MODIFIED - ${status}] "${d.originalWorkItem}" → "${d.newWorkItem}" — New detail: ${d.newDetail || "none"} — Rationale: ${d.rationale}${comment}`;
        })
        .join("\n");

      const phaseDecisionsText = (userPhaseDecisions || [])
        .map((d: any) => {
          const status = d.accepted ? "ACCEPTED" : "REJECTED";
          const comment = d.comment ? ` — User comment: ${d.comment}` : "";
          if (d.action === "unchanged") return `[UNCHANGED] "${d.originalName}"`;
          return `[${d.action.toUpperCase()} - ${status}] "${d.originalName || ""}" → "${d.newName || ""}"${comment}`;
        })
        .join("\n");

      // Include the current built items so AI can see the baseline
      const currentItemsSummary = (body.currentFinalItems || [])
        .map((item: any, idx: number) => `${idx + 1}. [${item.provider}] ${item.work_item}${item.detail ? ` — ${item.detail}` : ""} | Fee: ${item.fee_amount}`)
        .join("\n");

      systemPrompt = `You are refining a pricing proposal adaptation based on user feedback.

The user has reviewed the initial AI-proposed changes and made accept/reject decisions with comments.
The client-side logic has already applied the basic accept/reject decisions to produce a draft item list.

Your job is to IMPROVE the draft by:
- Addressing any user comments on rejected items (they may want an alternative approach rather than keeping the original)
- Incorporating general feedback to adjust items
- Ensuring coherence across all items after the accept/reject decisions

Return the complete final item list with all fields populated. The items you return will REPLACE the current draft entirely.
Do NOT simply copy the base items — use the current draft as your starting point and refine it.`;

      userPrompt = `ORIGINAL BASE: "${proposal.name}"
NEW DEAL: "${newName}" for ${newClientName}

ALL ITEM CHANGES AND USER DECISIONS:
${allItemChangesText || "No item changes"}

PHASE CHANGES AND USER DECISIONS:
${phaseDecisionsText || "No phase changes"}

GENERAL FEEDBACK:
${generalComment || "No general feedback"}

CURRENT DRAFT ITEMS (after applying accept/reject):
${currentItemsSummary || "No items"}

BASE PHASES:
${phasesSummary}

Please produce the refined final proposal items and phases.`;
    }

    // Different tool schemas for initial vs refine
    const tools = mode === "initial"
      ? [
          {
            type: "function" as const,
            function: {
              name: "return_adaptation",
              description: "Return the proposed adaptation changes",
              parameters: {
                type: "object",
                properties: {
                  phaseChanges: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        basePhaseId: { type: "string" },
                        action: { type: "string", enum: ["renamed", "removed", "added", "unchanged"] },
                        originalName: { type: "string" },
                        newName: { type: "string" },
                        rationale: { type: "string" },
                      },
                      required: ["action", "rationale"],
                      additionalProperties: false,
                    },
                  },
                  itemChanges: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        baseItemId: { type: "string" },
                        action: { type: "string", enum: ["modified", "removed", "added", "unchanged"] },
                        originalWorkItem: { type: "string" },
                        originalDetail: { type: "string" },
                        newWorkItem: { type: "string" },
                        newDetail: { type: "string" },
                        newCategory: { type: "string" },
                        newPhaseId: { type: "string" },
                        rationale: { type: "string" },
                        fee_amount: { type: "number" },
                        fee_lower: { type: "number" },
                        fee_upper: { type: "number" },
                        provider: { type: "string" },
                      },
                      required: ["action", "rationale"],
                      additionalProperties: false,
                    },
                  },
                  scopeAssumptionChanges: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["modified", "removed", "added"] },
                        description: { type: "string" },
                        rationale: { type: "string" },
                      },
                      required: ["type", "description", "rationale"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["phaseChanges", "itemChanges", "scopeAssumptionChanges"],
                additionalProperties: false,
              },
            },
          },
        ]
      : [
          {
            type: "function" as const,
            function: {
              name: "return_final_proposal",
              description: "Return the final complete proposal items and phases",
              parameters: {
                type: "object",
                properties: {
                  finalPhases: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                      },
                      required: ["id", "name"],
                      additionalProperties: false,
                    },
                  },
                  finalItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        work_item: { type: "string" },
                        detail: { type: "string" },
                        provider: { type: "string", enum: ["Baker McKenzie", "Local Counsel"] },
                        fee_amount: { type: "number" },
                        fee_lower: { type: "number" },
                        fee_upper: { type: "number" },
                        category: { type: "string" },
                        phase_id: { type: "string" },
                        rationale: { type: "string" },
                      },
                      required: ["work_item", "provider", "fee_amount"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["finalPhases", "finalItems"],
                additionalProperties: false,
              },
            },
          },
        ];

    const toolChoice = mode === "initial"
      ? { type: "function", function: { name: "return_adaptation" } }
      : { type: "function", function: { name: "return_final_proposal" } };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("adapt-pricing-proposal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
