// Generates a 1536-dim embedding for a text snippet using OpenAI
// text-embedding-3-small. Used by the analyst tools for semantic retrieval
// of relevant learnings / precedents.
//
// Requires OPENAI_API_KEY env var. If not configured, returns 501 — callers
// treat this as "no embedding available" and fall back to all-active behaviour.
//
// Request: { text: string }  OR  { texts: string[] }
// Response: { embedding: number[], model: string, dimensions: number }
//           or { embeddings: number[][], ... } for the batch form.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY not configured. Semantic retrieval disabled; callers will fall back to all-active learnings.",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const input: string | string[] = body.texts ?? body.text;
    if (!input || (Array.isArray(input) && input.length === 0)) {
      return new Response(JSON.stringify({ error: "Missing text or texts" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard against OpenAI's 8192-token input limit by truncating per item.
    // ~4 chars per token -> cap at 30k chars.
    const truncate = (s: string) => (s.length > 30_000 ? s.slice(0, 30_000) : s);
    const payloadInput = Array.isArray(input) ? input.map(truncate) : truncate(input);

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, input: payloadInput }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI embeddings error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: `OpenAI error ${res.status}: ${errText.slice(0, 300)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    // json.data is [{ embedding: number[], index, object }]
    if (Array.isArray(input)) {
      const ordered: number[][] = Array(input.length);
      for (const item of json.data) ordered[item.index] = item.embedding;
      return new Response(
        JSON.stringify({ embeddings: ordered, model: MODEL, dimensions: DIMENSIONS }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ embedding: json.data[0].embedding, model: MODEL, dimensions: DIMENSIONS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("embed-text failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
