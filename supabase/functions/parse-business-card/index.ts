import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BusinessCardContact {
  full_name: string;
  email: string | null;
  company: string | null;
  job_title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  country: string | null;
  city: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      throw new Error("No image data provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Parsing business card image...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting contact information from business cards. 
Extract all visible contact details from the business card image and return them in a structured format.
Be thorough - look for:
- Full name (first and last name combined)
- Email address
- Company/organization name
- Job title/position
- Phone number
- LinkedIn URL or handle
- Location (city and/or country)

If a field is not visible or unclear, return null for that field.
For names, if you see first and last name separately, combine them into full_name.
For LinkedIn, if you see a LinkedIn handle like "/in/johnsmith", convert it to a full URL.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`
                }
              },
              {
                type: "text",
                text: "Extract all contact information from this business card."
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contact",
              description: "Extract contact information from a business card",
              parameters: {
                type: "object",
                properties: {
                  full_name: { 
                    type: "string", 
                    description: "Full name of the person (first and last name combined)"
                  },
                  email: { 
                    type: ["string", "null"],
                    description: "Email address"
                  },
                  company: { 
                    type: ["string", "null"],
                    description: "Company or organization name"
                  },
                  job_title: { 
                    type: ["string", "null"],
                    description: "Job title or position"
                  },
                  phone: { 
                    type: ["string", "null"],
                    description: "Phone number"
                  },
                  linkedin_url: { 
                    type: ["string", "null"],
                    description: "Full LinkedIn profile URL"
                  },
                  country: { 
                    type: ["string", "null"],
                    description: "Country"
                  },
                  city: { 
                    type: ["string", "null"],
                    description: "City"
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "How confident are you in the extraction"
                  }
                },
                required: ["full_name", "confidence"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_contact" } }
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

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const result = JSON.parse(toolCall.function.arguments) as BusinessCardContact & { confidence: string };

    // Normalize LinkedIn URL if it's a handle
    if (result.linkedin_url && !result.linkedin_url.startsWith("http")) {
      const handle = result.linkedin_url.replace(/^\/?(in\/)?/, "");
      result.linkedin_url = `https://www.linkedin.com/in/${handle}`;
    }

    console.log("Extracted contact:", result);

    return new Response(JSON.stringify({ success: true, contact: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in parse-business-card:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
