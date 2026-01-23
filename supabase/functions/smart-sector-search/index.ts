import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Contact {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
  company_keywords: string[] | null;
  naics_codes: string[] | null;
  emi_focus_areas: string[];
  sectors: string[];
}

interface MatchResult {
  contactId: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, contactIds, deepSearch = false } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header and extract user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch contacts - either specific IDs or all for this user
    let contactsQuery = supabase
      .from("distribution_contacts")
      .select("id, full_name, email, company, job_title, company_keywords, naics_codes, emi_focus_areas, sectors")
      .eq("user_id", user.id);

    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      contactsQuery = contactsQuery.in("id", contactIds);
    }

    const { data: contacts, error: contactsError } = await contactsQuery;

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      throw new Error("Failed to fetch contacts");
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ matches: [], queryUnderstanding: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${contacts.length} contacts for smart sector search: "${query}"`);

    // Step 1: Have AI understand the query and identify related terms AND exclusions
    const understandingPrompt = `You are an expert in business sectors and industries. The user is searching for contacts related to: "${query}"

First, explain what this sector/industry means SPECIFICALLY - be precise about what distinguishes this sector from related but different industries.

Then provide:
1. INCLUDE KEYWORDS (max 15): Terms that strongly indicate genuine involvement in "${query}"
2. EXCLUDE KEYWORDS (max 10): Terms that indicate a DIFFERENT industry that should NOT match, even if there's superficial overlap

For example, if searching for "rare earth mining":
- INCLUDE: rare earth elements, REE, lithium extraction, cobalt mining, critical minerals, mineral processing
- EXCLUDE: waste-to-energy, renewable power, solar, wind farms, oil & gas production, pension fund

Be specific and discriminating. Generic terms like "mining" alone are not enough - the company must actually be in the specific sector.`;

    const understandingResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an industry classification expert." },
          { role: "user", content: understandingPrompt }
        ],
      }),
    });

    if (!understandingResponse.ok) {
      const errorText = await understandingResponse.text();
      console.error("AI understanding error:", understandingResponse.status, errorText);
      
      if (understandingResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service is busy. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to analyze sector query");
    }

    const understandingData = await understandingResponse.json();
    const queryUnderstanding = understandingData.choices?.[0]?.message?.content || "";

    console.log("Query understanding:", queryUnderstanding.substring(0, 200));

    // Step 2: Process contacts in batches to find matches
    const BATCH_SIZE = 50;
    const allMatches: MatchResult[] = [];

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      
      // Prepare contact summaries for AI analysis with clear structure
      const contactSummaries = batch.map((c: Contact) => {
        const keywords = c.company_keywords?.join(", ") || "";
        const focusAreas = c.emi_focus_areas?.join(", ") || "";
        const sectors = c.sectors?.join(", ") || "";
        
        return {
          id: c.id,
          summary: `Name: ${c.full_name}
  Company: ${c.company || "Unknown"}
  Job Title: ${c.job_title || "Unknown"}
  COMPANY BUSINESS FOCUS (most important): ${keywords || "Not specified"}
  Person's Interest Areas: ${focusAreas || "None"}
  Sectors: ${sectors || "None"}`
        };
      });

      const matchPrompt = `You are evaluating contacts for relevance to: "${query}"

Context about this sector:
${queryUnderstanding.substring(0, 800)}

CRITICAL MATCHING RULES:
1. The COMPANY'S actual business (shown in "COMPANY BUSINESS FOCUS") is the PRIMARY factor
2. A person's "Interest Areas" are SECONDARY - they indicate what the person is interested in, NOT what their company does
3. If the company's business focus clearly indicates a DIFFERENT industry (e.g., waste-to-energy, renewable power, oil & gas), DO NOT MATCH even if the person has a relevant interest area
4. Only match if there's genuine evidence the COMPANY operates in or directly serves "${query}"

Contacts to analyze:
${contactSummaries.map(c => `[${c.id}]: ${c.summary}`).join("\n\n")}

For each contact that GENUINELY matches, provide the match using the tool.
- "high": Company clearly operates in "${query}" (company name or business focus directly indicates this)
- "medium": Company directly serves or supplies "${query}" (e.g., equipment, services, financing specifically for this sector)
- "low": Only use if company has tangential but real connection (NOT just because person has an interest area)

REJECT contacts where:
- Company business focus indicates a different industry (even if person has relevant interest areas)
- The only connection is a broad/generic term like "mining" without specific relevance to "${query}"
- Company is in renewables/solar/wind but search is for mining (or vice versa)`;

      const matchResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a STRICT contact matching system. You ONLY match contacts whose COMPANY actually operates in or directly serves the target sector. A person having an 'interest area' or 'focus area' in a sector is NOT sufficient - the company's actual business must be relevant. Err on the side of rejecting false positives." },
            { role: "user", content: matchPrompt }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_matches",
                description: "Report contacts that match the sector search",
                parameters: {
                  type: "object",
                  properties: {
                    matches: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          contactId: { type: "string", description: "The contact ID" },
                          confidence: { type: "string", enum: ["high", "medium", "low"] },
                          reason: { type: "string", description: "Brief explanation of why this contact matches (max 100 chars)" }
                        },
                        required: ["contactId", "confidence", "reason"]
                      }
                    }
                  },
                  required: ["matches"]
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "report_matches" } }
        }),
      });

      if (!matchResponse.ok) {
        console.error("AI matching error for batch:", matchResponse.status);
        // On rate limit, wait briefly before continuing to next batch
        if (matchResponse.status === 429) {
          console.log("Rate limited on batch, waiting before retry...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        continue;
      }

      const matchData = await matchResponse.json();
      const toolCall = matchData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (args.matches && Array.isArray(args.matches)) {
            // Validate that contact IDs exist in our batch
            const batchIds = new Set(batch.map((c: Contact) => c.id));
            const validMatches = args.matches.filter((m: MatchResult) => batchIds.has(m.contactId));
            allMatches.push(...validMatches);
          }
        } catch (parseError) {
          console.error("Error parsing match results:", parseError);
        }
      }
    }

    console.log(`Found ${allMatches.length} matching contacts`);

    return new Response(
      JSON.stringify({ 
        matches: allMatches,
        queryUnderstanding: queryUnderstanding.substring(0, 500),
        totalAnalyzed: contacts.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Smart sector search error:", error);
    
    if (error instanceof Error && error.message.includes("rate limit")) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
