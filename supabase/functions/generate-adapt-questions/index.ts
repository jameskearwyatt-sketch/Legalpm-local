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

    const { proposal, items } = await req.json();

    const itemsSummary = (items || [])
      .map((i: any) => `- ${i.work_item}${i.detail ? ` (${i.detail})` : ""} [${i.provider}, ${i.category || "uncategorised"}]`)
      .join("\n");

    const phasesSummary = (proposal.work_phases || [])
      .map((p: any) => p.name)
      .join(", ");

    const scopeSummary = proposal.scope_assumptions
      ? JSON.stringify(proposal.scope_assumptions).slice(0, 2000)
      : "No scope assumptions set";

    const systemPrompt = `You are an expert legal pricing analyst. Analyse the base pricing proposal below and generate 4-8 targeted questions that will help adapt it for a new deal.

Focus on:
- Jurisdiction/country differences
- Technology/sector differences
- Financing structure presence or absence
- Regulatory requirements
- Number of parties/counterparties
- Local counsel needs
- Scope additions or removals
- Any other structural differences you can infer from the work items

Each question should reference specific content from the base proposal so the user understands the context.`;

    const userPrompt = `Base proposal: "${proposal.name}"
Client: ${proposal.client?.name || "Unknown"}
Currency: ${proposal.currency}
Phases: ${phasesSummary || "None defined"}

Work items:
${itemsSummary || "No items"}

Scope assumptions:
${scopeSummary}

Generate targeted questions about how a new deal might differ from this base proposal.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "return_questions",
              description: "Return the list of targeted questions for the adapt wizard",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique id like q1, q2, etc." },
                        question: { type: "string", description: "The question text" },
                        input_type: {
                          type: "string",
                          enum: ["text", "select", "boolean", "checklist"],
                        },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Options for select or checklist types",
                        },
                        context: {
                          type: "string",
                          description: "Brief context about why this question is relevant",
                        },
                      },
                      required: ["id", "question", "input_type"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_questions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("generate-adapt-questions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", questions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
