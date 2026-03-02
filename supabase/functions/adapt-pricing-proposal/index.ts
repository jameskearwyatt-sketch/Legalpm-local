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
      .map((i: any, idx: number) => `${idx + 1}. [${i.provider}] ${i.work_item}${i.detail ? ` — ${i.detail}` : ""} | Category: ${i.category || "none"} | Phase: ${i.phase_id || "none"} | Fee: ${i.fee_lower}-${i.fee_upper}`)
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

IMPORTANT: Preserve original fee amounts for unchanged and modified items. Only set fees for newly added items (estimate based on similar items in the base).`;

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
      const decisionsText = (userItemDecisions || [])
        .filter((d: any) => !d.accepted || d.comment)
        .map((d: any) => `Item "${d.originalWorkItem || d.newWorkItem}": ${d.accepted ? "ACCEPTED" : "REJECTED"}${d.comment ? ` — Comment: ${d.comment}` : ""}`)
        .join("\n");

      const phaseDecisionsText = (userPhaseDecisions || [])
        .filter((d: any) => !d.accepted || d.comment)
        .map((d: any) => `Phase "${d.originalName || d.newName}": ${d.accepted ? "ACCEPTED" : "REJECTED"}${d.comment ? ` — Comment: ${d.comment}` : ""}`)
        .join("\n");

      systemPrompt = `You are refining a pricing proposal adaptation based on user feedback.

The user has reviewed the initial AI-proposed changes and made accept/reject decisions with comments.

Your job is to produce the FINAL list of work items and phases for the new proposal, incorporating:
- All accepted changes as-is
- Adjustments based on rejected changes and user comments
- Any improvements based on the general feedback

Return the complete final item list (not just changes) with all fields populated.`;

      userPrompt = `ORIGINAL BASE: "${proposal.name}"
NEW DEAL: "${newName}" for ${newClientName}

USER DECISIONS ON ITEM CHANGES:
${decisionsText || "All changes accepted without comments"}

USER DECISIONS ON PHASE CHANGES:
${phaseDecisionsText || "All phase changes accepted"}

GENERAL FEEDBACK:
${generalComment || "No general feedback"}

BASE ITEMS FOR REFERENCE:
${itemsSummary}

BASE PHASES:
${phasesSummary}

Please produce the final proposal items and phases.`;
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
