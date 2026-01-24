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

    console.log("Parsing business card image for multiple cards...");

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

IMPORTANT: This image may contain ONE OR MULTIPLE business cards. Carefully scan the entire image and identify ALL visible business cards.

For EACH business card you find, extract:
- Full name (ALWAYS in "FirstName Surname" format - e.g., "John Smith" not "Smith, John")
- Email address
- Company/organization name
- Job title/position
- Phone number
- LinkedIn URL or handle
- Location (city and/or country)

If a field is not visible or unclear on a card, return null for that field.
For LinkedIn, if you see a handle like "/in/johnsmith", convert it to a full URL.

Return ALL contacts found - if there are 10 business cards, return 10 contacts.
If cards overlap or are partially obscured, only extract what you can clearly read.`
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
                text: "Identify ALL business cards in this image and extract contact information from each one. There may be multiple cards - extract them all."
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contacts",
              description: "Extract contact information from one or more business cards in an image",
              parameters: {
                type: "object",
                properties: {
                  contacts: {
                    type: "array",
                    description: "Array of contacts extracted from business cards in the image",
                    items: {
                      type: "object",
                      properties: {
                        full_name: { 
                          type: "string", 
                          description: "Full name in 'FirstName Surname' format (e.g., 'John Smith')"
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
                        }
                      },
                      required: ["full_name"]
                    }
                  },
                  total_cards_detected: {
                    type: "number",
                    description: "Total number of business cards detected in the image"
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Overall confidence in the extraction"
                  },
                  notes: {
                    type: ["string", "null"],
                    description: "Any notes about cards that couldn't be read or other issues"
                  }
                },
                required: ["contacts", "total_cards_detected", "confidence"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_contacts" } }
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

    const result = JSON.parse(toolCall.function.arguments) as {
      contacts: BusinessCardContact[];
      total_cards_detected: number;
      confidence: string;
      notes?: string;
    };

    // Normalize LinkedIn URLs for all contacts
    result.contacts = result.contacts.map(contact => {
      if (contact.linkedin_url && !contact.linkedin_url.startsWith("http")) {
        const handle = contact.linkedin_url.replace(/^\/?(in\/)?/, "");
        contact.linkedin_url = `https://www.linkedin.com/in/${handle}`;
      }
      return contact;
    });

    console.log(`Extracted ${result.contacts.length} contacts from ${result.total_cards_detected} detected cards`);

    return new Response(JSON.stringify({ 
      success: true, 
      contacts: result.contacts,
      total_cards_detected: result.total_cards_detected,
      confidence: result.confidence,
      notes: result.notes
    }), {
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
