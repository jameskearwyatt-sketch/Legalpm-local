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

Available contact fields to map TO:
- full_name (required) - person's full name
- first_name - if separate from surname, will be combined with last_name
- last_name - if separate from first name, will be combined with first_name  
- email (required) - email address
- company - organisation/company name
- job_title - role/position/title
- country - country name
- city - city name
- gender - male/female/unknown
- linkedin_url - LinkedIn profile URL
- relationship_owner - who owns this contact relationship
- sectors - industry sectors (array)
- ignore - for columns that don't match any field

CRITICAL RULES:
1. You MUST create a mapping entry for EVERY header column provided. Do not return an empty mapping.
2. Common header variations:
   - "Name", "Full Name", "Contact Name" → full_name
   - "First Name", "Firstname", "Given Name", "Forename" → first_name
   - "Last Name", "Surname", "Family Name" → last_name
   - "Email", "E-mail", "Email Address" → email
   - "Company", "Organisation", "Organization", "Org", "Employer" → company
   - "Title", "Job Title", "Position", "Role" → job_title
   - "Country", "Location" → country
   - "City", "Town" → city
   - "LinkedIn", "LinkedIn URL" → linkedin_url
   - "Owner", "Relationship Owner", "Account Owner" → relationship_owner
3. If you see BOTH first name AND last name columns, map first to "first_name" and surname to "last_name" - they will be combined automatically.
4. If a column clearly doesn't match any field, set field to "ignore"
5. Look at the sample data values to confirm your mapping is sensible.

Available sectors: ${availableSectors?.length > 0 ? availableSectors.join(", ") : "None defined"}`;

    const userPrompt = `Map these Excel column headers to contact fields. You MUST provide a mapping for EACH header.

HEADERS TO MAP: ${JSON.stringify(headers)}

SAMPLE DATA (to help confirm mappings):
${JSON.stringify(sampleRows?.slice(0, 3) || [], null, 2)}

REMEMBER: Create a mapping entry for EVERY header in the list above. Do not skip any.`;

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
