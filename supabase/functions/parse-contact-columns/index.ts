import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, sampleRows, availableSectors } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert data parser for contact lists. Your task is to analyse Excel/CSV column headers and map them to contact fields.

Available contact fields:
- full_name (required) - can be combined from first_name + last_name columns
- email (required)
- company
- job_title
- country
- city
- gender (male/female/unknown)
- linkedin_url
- relationship_owner
- sectors (array from allowed list only)

IMPORTANT RULES:
1. If you see separate "First Name"/"Firstname"/"Given Name" and "Last Name"/"Surname"/"Family Name" columns, map them BOTH to full_name with a note to combine them.
2. Be flexible with column name variations (e.g., "Organisation" = company, "Position" = job_title)
3. For sectors, ONLY use values from the allowed sector list. Map related terms:
   - LNG, upstream, downstream, petroleum → Oil & Gas
   - SMRs, atomic, fission → Nuclear  
   - CCS, carbon capture → CCUS
   - Solar, wind, hydro, green energy → Renewables
4. If a column clearly doesn't map to any field, mark it as "ignore"
5. Look at sample data to confirm your mapping is correct

Available sectors for this user: ${availableSectors?.length > 0 ? availableSectors.join(", ") : "None defined yet"}`;

    const userPrompt = `Analyse these Excel headers and sample data to create the best column mapping:

HEADERS: ${JSON.stringify(headers)}

SAMPLE DATA (first 3 rows): ${JSON.stringify(sampleRows?.slice(0, 3) || [])}

Return a JSON object with this structure:
{
  "mapping": {
    "<original_header>": {
      "field": "<contact_field_name>",
      "combineWith": "<other_header_to_combine>" // only for first_name/last_name cases
    }
  },
  "confidence": "high" | "medium" | "low",
  "notes": "any important observations"
}`;

    console.log("Calling AI for column mapping...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "map_columns",
              description: "Map Excel columns to contact fields",
              parameters: {
                type: "object",
                properties: {
                  mapping: {
                    type: "object",
                    additionalProperties: {
                      type: "object",
                      properties: {
                        field: { 
                          type: "string",
                          enum: ["full_name", "first_name", "last_name", "email", "company", "job_title", "country", "city", "gender", "linkedin_url", "relationship_owner", "sectors", "ignore"]
                        },
                        combineWith: { type: "string" }
                      },
                      required: ["field"]
                    }
                  },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  notes: { type: "string" }
                },
                required: ["mapping", "confidence"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "map_columns" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in parse-contact-columns:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
