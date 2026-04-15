/**
 * ask-analyst-position
 *
 * Answers a targeted question about a single extracted position inside an
 * analyst contract analysis (PPA, Tolling, Carbon, IT Supply, Cloud Compute).
 * Unlike the generic `ask-ai` function which loads the user's whole practice
 * context, this one receives *only* the clause-level context from the caller:
 * the category, source text, position summary, optional variance notes and
 * market-position label, and any relevant precedents / prior learnings the
 * client already retrieved via pgvector. That keeps tokens low and the answer
 * narrowly grounded — the attorney typically wants things like "explain why
 * this is way-off-market" or "draft an amendment clause that pulls this back
 * to on-market" rather than a survey of their whole book.
 *
 * Privacy: the position source_text is already PII-redacted on the client
 * (see `redactPII` + the toggle in every upload component) before being
 * stored, so we don't redact again here.
 *
 * Failure mode: if the Lovable gateway returns 402/429, we propagate the
 * status so the client surfaces the standard "rate limit" / "credits
 * exhausted" copy. Any other error returns 500 with a generic message —
 * no prompt or response content is ever leaked to the client on error.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrecedentContext {
  project_name?: string | null;
  jurisdiction?: string | null;
  position_summary: string;
  market_position?: string | null;
  party_favorability?: string | null;
  is_gold_standard?: boolean | null;
}

interface LearningContext {
  original_position?: string | null;
  corrected_position: string;
  correction_reason?: string | null;
}

interface AskPositionBody {
  analyst: string;
  analystLabel: string;
  category: string;
  positionSummary: string;
  sourceText?: string | null;
  marketPosition?: string | null;
  partyFavorability?: string | null;
  confidence?: string | null;
  varianceNotes?: string | null;
  projectName?: string | null;
  jurisdiction?: string | null;
  contractType?: string | null;
  question: string;
  relevantPrecedents?: PrecedentContext[];
  relevantLearnings?: LearningContext[];
}

function buildSystemPrompt(body: AskPositionBody): string {
  const {
    analystLabel, category, positionSummary, sourceText, marketPosition,
    partyFavorability, confidence, varianceNotes, projectName, jurisdiction,
    contractType, relevantPrecedents, relevantLearnings,
  } = body;

  const precedentBlock = (relevantPrecedents && relevantPrecedents.length > 0)
    ? relevantPrecedents.map((p, i) =>
        `Precedent ${i + 1} [${p.is_gold_standard ? 'GOLD STANDARD' : 'precedent'}]${p.project_name ? ` — ${p.project_name}` : ''}${p.jurisdiction ? ` (${p.jurisdiction})` : ''}:\n  ${p.position_summary}${p.market_position ? `\n  Market: ${p.market_position}` : ''}${p.party_favorability ? `\n  Favors: ${p.party_favorability}` : ''}`
      ).join('\n\n')
    : '(no similar precedents retrieved)';

  const learningBlock = (relevantLearnings && relevantLearnings.length > 0)
    ? relevantLearnings.map((l, i) =>
        `Correction ${i + 1}: ${l.correction_reason || ''}${l.original_position ? `\n  Original: ${l.original_position}` : ''}\n  Corrected: ${l.corrected_position}`
      ).join('\n\n')
    : '(no prior corrections in this category)';

  return `You are an expert ${analystLabel} contract lawyer assisting with a targeted question about one clause.

CONTEXT OF THE CLAUSE UNDER DISCUSSION:
- Category: ${category}
${projectName ? `- Project: ${projectName}\n` : ''}${jurisdiction ? `- Jurisdiction: ${jurisdiction}\n` : ''}${contractType ? `- Contract type: ${contractType}\n` : ''}- Current summary: ${positionSummary}
${sourceText ? `- Source clause text: ${sourceText}\n` : ''}${marketPosition ? `- Market position label: ${marketPosition}\n` : ''}${partyFavorability ? `- Party favorability: ${partyFavorability}\n` : ''}${confidence ? `- Confidence: ${confidence}\n` : ''}${varianceNotes ? `- Variance notes: ${varianceNotes}\n` : ''}
RELEVANT PRECEDENTS (from this user's precedent bank — highest similarity first):
${precedentBlock}

RELEVANT PRIOR CORRECTIONS (what this user has taught the AI in this category):
${learningBlock}

INSTRUCTIONS:
1. Answer the user's question directly, grounded in the clause context and the precedents/corrections above.
2. If the question asks you to draft or redraft language, produce clean clause text, not a commentary.
3. If the question is interpretive ("is this market?", "why is this off-market?"), cite specific precedents by project name where helpful.
4. If the context is insufficient to answer, say so explicitly rather than guessing.
5. Be concise — attorneys are busy. 3-8 sentences unless drafting is requested.
6. Never invent facts about the deal that aren't in the context. Treat absent fields as unknown, not as "not applicable".`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as AskPositionBody;
    if (!body.question || typeof body.question !== 'string' || !body.question.trim()) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!body.positionSummary || !body.category || !body.analystLabel) {
      return new Response(
        JSON.stringify({ error: "Missing required position context" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI gateway not configured" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(body);
    const startedAt = Date.now();

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
          { role: "user", content: body.question },
        ],
        temperature: 0.3,
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
      console.error("ask-analyst-position gateway error:", aiResponse.status);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const answer: string = aiData.choices?.[0]?.message?.content || "I couldn't generate an answer.";
    const usage = aiData.usage ?? {};

    return new Response(
      JSON.stringify({
        answer,
        model_used: aiData.model ?? "google/gemini-2.5-flash",
        input_tokens: usage.prompt_tokens ?? null,
        output_tokens: usage.completion_tokens ?? null,
        duration_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ask-analyst-position:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
