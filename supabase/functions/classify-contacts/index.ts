import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactToClassify {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
}

interface ClassificationResult {
  id: string;
  is_law_firm: boolean;
  is_consultant: boolean;
  reason: string;
}

async function classifyContacts(
  contacts: ContactToClassify[]
): Promise<ClassificationResult[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const contactsList = contacts
    .map(
      (c, i) =>
        `${i + 1}. Name: ${c.full_name}, Email: ${c.email}, Company: ${c.company || "Unknown"}, Title: ${c.job_title || "Unknown"}`
    )
    .join("\n");

  const systemPrompt = `You are an expert at classifying business contacts for a law firm. Your task is to identify:

1. **is_law_firm**: Does this person work at a law firm? Look for:
   - Company names containing "Law", "Legal", "LLP", "Solicitors", "Barristers", "Advocates", "Attorney", "& Associates" (when paired with lawyer names)
   - Email domains associated with law firms (e.g., .law, lawfirm domains)
   - Job titles like "Partner", "Associate", "Counsel", "Solicitor", "Barrister", "Attorney", "Legal Counsel"

2. **is_consultant**: Is this person a professional services consultant? This includes:
   - Lawyers/Legal professionals (they are ALWAYS consultants)
   - Accountants, auditors, and accounting firms (Big 4, etc.)
   - Tax advisors
   - Management consultants and strategy consultants
   - Financial advisors and investment advisors
   - Architects and architectural firms
   - Engineering consultants
   - HR consultants
   - IT consultants and technology consultants
   - Any professional services advisor

IMPORTANT: Someone can be BOTH is_law_firm=true AND is_consultant=true (e.g., a lawyer at a law firm is both).
People working at corporations, banks (as employees not advisors), manufacturers, retailers, tech companies (as employees), etc. are NOT consultants.`;

  const userPrompt = `Classify each of these contacts. For each one, determine if they work at a law firm and if they are a consultant/professional services provider:

${contactsList}

Return your analysis for all ${contacts.length} contacts.`;

  console.log(`Sending ${contacts.length} contacts for classification`);

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
            name: "report_classification",
            description: "Report the classification results for all contacts",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: {
                        type: "number",
                        description: "The 1-based index of the contact in the input list",
                      },
                      is_law_firm: {
                        type: "boolean",
                        description: "True if the person works at a law firm",
                      },
                      is_consultant: {
                        type: "boolean",
                        description: "True if the person is a professional services consultant",
                      },
                      reason: {
                        type: "string",
                        description: "Brief explanation for the classification (max 50 words)",
                      },
                    },
                    required: ["index", "is_law_firm", "is_consultant", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_classification" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }

    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  console.log("AI response received");

  // Extract the tool call results
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== "report_classification") {
    console.error("Unexpected response format:", JSON.stringify(data));
    throw new Error("Unexpected response format from AI");
  }

  const analysisResults = JSON.parse(toolCall.function.arguments);

  // Map results back to contacts
  return analysisResults.results.map((result: { index: number; is_law_firm: boolean; is_consultant: boolean; reason: string }) => {
    const contact = contacts[result.index - 1];
    return {
      id: contact.id,
      is_law_firm: result.is_law_firm,
      is_consultant: result.is_consultant,
      reason: result.reason,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contactIds, classifyAll, reclassify } = await req.json();

    console.log(
      `Classifying contacts for user ${user.id}, classifyAll=${classifyAll}, reclassify=${reclassify}`
    );

    // Build query for contacts to classify
    let query = supabase
      .from("distribution_contacts")
      .select("id, full_name, email, company, job_title")
      .eq("user_id", user.id);

    if (contactIds && contactIds.length > 0) {
      query = query.in("id", contactIds);
    } else if (classifyAll && !reclassify) {
      // Only get unclassified contacts
      query = query.is("classified_at", null);
    }
    // If reclassify is true, get all contacts (no filter)

    const { data: contacts, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching contacts:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          classified: 0,
          message: "No contacts to classify",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${contacts.length} contacts to classify`);

    // Process in batches of 20 to avoid token limits
    const batchSize = 20;
    const results: ClassificationResult[] = [];

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(contacts.length / batchSize)}`
      );

      const batchResults = await classifyContacts(batch);
      results.push(...batchResults);

      // Update each contact in the batch
      for (const result of batchResults) {
        const { error: updateError } = await supabase
          .from("distribution_contacts")
          .update({
            is_law_firm: result.is_law_firm,
            is_consultant: result.is_consultant,
            classification_reason: result.reason,
            classified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", result.id)
          .eq("user_id", user.id);

        if (updateError) {
          console.error(`Error updating contact ${result.id}:`, updateError);
        }
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < contacts.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`Successfully classified ${results.length} contacts`);

    return new Response(
      JSON.stringify({
        success: true,
        classified: results.length,
        results: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Classification error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
