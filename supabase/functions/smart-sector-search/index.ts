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

    // Step 1: Have AI understand the query and identify related terms
    const understandingPrompt = `You are an expert in business sectors and industries. The user is searching for contacts related to: "${query}"

First, explain what this sector/industry means and list related terms, sub-sectors, and keywords that would indicate someone works in or is connected to this area. Be comprehensive but focused.

Consider:
- Direct involvement (works in the sector)
- Adjacent sectors (suppliers, customers, service providers)
- Related technologies and innovations
- Common company types and job titles in this space

Provide a brief 2-3 sentence understanding followed by a bullet list of related keywords and terms (max 20).`;

    const understandingResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an industry classification expert." },
          { role: "user", content: understandingPrompt }
        ],
      }),
    });

    if (!understandingResponse.ok) {
      const errorText = await understandingResponse.text();
      console.error("AI understanding error:", understandingResponse.status, errorText);
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
      
      // Prepare contact summaries for AI analysis
      const contactSummaries = batch.map((c: Contact) => {
        const keywords = c.company_keywords?.join(", ") || "";
        const focusAreas = c.emi_focus_areas?.join(", ") || "";
        const sectors = c.sectors?.join(", ") || "";
        
        return {
          id: c.id,
          summary: `Name: ${c.full_name}, Company: ${c.company || "Unknown"}, Title: ${c.job_title || "Unknown"}, Business Focus: ${keywords || "Not specified"}, EMI Focus Areas: ${focusAreas || "None"}, Sectors: ${sectors || "None"}`
        };
      });

      const matchPrompt = `Based on the user's search for "${query}" contacts (which relates to: ${queryUnderstanding.substring(0, 500)}), 
      
Analyze each contact and determine if they are relevant to the "${query}" sector.

Contacts to analyze:
${contactSummaries.map(c => `[${c.id}]: ${c.summary}`).join("\n")}

For each contact that matches, provide the match using the tool. Only include contacts with genuine relevance.
- "high" confidence: Direct involvement in the sector (company name, title, or focus areas clearly indicate involvement)
- "medium" confidence: Strong indirect connection (adjacent sector, likely customer/supplier, relevant technology)
- "low" confidence: Possible connection worth including (tangential relationship, broad industry overlap)

Skip contacts with no meaningful connection.`;

      const matchResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a precise contact matching system. Only match contacts with genuine relevance to the search query." },
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
