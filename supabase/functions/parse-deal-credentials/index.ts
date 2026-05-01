import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, source } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert at extracting structured deal/transaction credential information from unstructured text. You work for a law firm and understand legal deal credentials, pitch book formats, CV deal lists, and credential submissions.

Your task is to parse any format of deal/transaction list and extract structured credential records. The input may be:
- A Word document credential list (bullet points, numbered lists, free-text paragraphs)
- A pasted CV or bio with deal experience
- An Excel/CSV export pasted as text
- A pitch book or credential submission
- An RfP response listing relevant experience
- Any other format listing legal deals or transactions

EXTRACTION RULES:
1. Extract EVERY deal/transaction mentioned, even if details are sparse
2. For each deal, extract as many fields as possible from the text
3. Parse client names intelligently - "Advised [Client]" or "[Client] -" patterns are common
4. Detect deal types from context: PPA, Tolling, M&A, Financing, Advisory, Project Development, Concession, JV, Regulatory, Carbon, etc.
5. Detect sectors: Energy, Renewables, Oil & Gas, Mining, Infrastructure, Transport, TMT, Financial Services, Healthcare, Agriculture, Manufacturing, Water & Sanitation, Education
6. Extract jurisdictions/countries mentioned in connection with each deal
7. Parse deal values and currencies - handle "USD 500m", "$500 million", "€200m", "GBP 1.2bn" etc.
8. Extract years (completion or transaction year)
9. Detect practice areas: Corporate, JVs, Financing, Project Finance, M&A, PPP/Concessions, Regulatory, Construction, Real Estate, Tax, Employment, IP, Dispute Resolution, Environmental, Competition
10. Detect role played: "Lead counsel", "Local counsel", "Supporting counsel", "Advised", "Acted for"
11. Detect institutional involvement: IFC, EBRD, ADB, AfDB, DFC, MIGA, EIB, KfW, FMO, DEG, CDC/BII, Proparco, AIIB, IsDB, NDB, JICA/JBIC, BNDES, Norfund, Swedfund, Finnfund
12. Generate a concise 1-2 sentence description for each deal based on the extracted information
13. If a deal spans multiple bullet points or paragraphs, combine them into one record
14. For client names, use the actual client name as given - do not anonymise
15. If the text contains section headers (e.g. "Energy Transactions", "M&A"), use those to help categorise the deals beneath them
16. If deal status can be inferred (completed vs ongoing), set it. Default to "Completed" for historic deals.`;

    const userPrompt = `Parse the following ${source === 'excel' ? 'spreadsheet data' : 'document text'} and extract every deal/transaction credential you can find. Be thorough - extract everything, even deals with minimal detail.

TEXT TO PARSE:
"""
${text.substring(0, 30000)}
"""

Extract all deals and return them as structured JSON.`;

    console.log(`Parsing deal credentials from ${source} (${text.length} chars)`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_deal_credentials',
              description: 'Extract structured deal credentials from unstructured text',
              parameters: {
                type: 'object',
                properties: {
                  deals: {
                    type: 'array',
                    description: 'Array of extracted deal credentials',
                    items: {
                      type: 'object',
                      properties: {
                        deal_name: {
                          type: 'string',
                          description: 'Name or short title of the deal/transaction'
                        },
                        client_name: {
                          type: 'string',
                          description: 'Client name as mentioned in the text'
                        },
                        description: {
                          type: 'string',
                          description: 'Concise 1-2 sentence factual summary of the deal'
                        },
                        deal_type: {
                          type: 'string',
                          nullable: true,
                          description: 'Type: PPA, Tolling, M&A, Financing, Advisory, Project Development, Concession, JV, Regulatory, Carbon, etc.'
                        },
                        sector: {
                          type: 'string',
                          nullable: true,
                          description: 'Primary sector: Energy, Renewables, Oil & Gas, Mining, Infrastructure, Transport, TMT, Financial Services, Healthcare, etc.'
                        },
                        practice_areas: {
                          type: 'array',
                          nullable: true,
                          items: { type: 'string' },
                          description: 'Practice areas involved: Corporate, JVs, Financing, Project Finance, M&A, PPP/Concessions, Regulatory, etc.'
                        },
                        jurisdictions: {
                          type: 'array',
                          nullable: true,
                          items: { type: 'string' },
                          description: 'Countries/jurisdictions involved in the deal'
                        },
                        deal_value: {
                          type: 'number',
                          nullable: true,
                          description: 'Deal value in the stated currency (as a raw number, e.g. 500000000 for $500m)'
                        },
                        deal_currency: {
                          type: 'string',
                          nullable: true,
                          description: 'Currency code: USD, EUR, GBP, etc.'
                        },
                        role_played: {
                          type: 'string',
                          nullable: true,
                          description: 'Role: Lead counsel, Local counsel, Supporting counsel'
                        },
                        lead_partner: {
                          type: 'string',
                          nullable: true,
                          description: 'Lead partner name if mentioned'
                        },
                        year_completed: {
                          type: 'integer',
                          nullable: true,
                          description: 'Year the deal was completed or the year mentioned'
                        },
                        institutions: {
                          type: 'array',
                          nullable: true,
                          items: { type: 'string' },
                          description: 'Multilateral/bilateral institutions involved: IFC, EBRD, ADB, AfDB, DFC, MIGA, EIB, KfW, etc.'
                        },
                        status: {
                          type: 'string',
                          enum: ['Active', 'Completed', 'Ongoing'],
                          description: 'Deal status - default to Completed for historic deals'
                        }
                      },
                      required: ['deal_name', 'client_name', 'description']
                    }
                  },
                  parsing_notes: {
                    type: 'string',
                    description: 'Any notes about ambiguities, assumptions made, or items that could not be parsed'
                  }
                },
                required: ['deals']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_deal_credentials' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error('No valid response from AI');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const deals = (parsed.deals || []).map((d: Record<string, unknown>) => ({
      deal_name: (d.deal_name as string)?.trim() || 'Unnamed Deal',
      client_name: (d.client_name as string)?.trim() || 'Unknown Client',
      description: (d.description as string)?.trim() || null,
      deal_type: (d.deal_type as string)?.trim() || null,
      sector: (d.sector as string)?.trim() || null,
      practice_areas: Array.isArray(d.practice_areas) ? d.practice_areas.filter(Boolean) : null,
      jurisdictions: Array.isArray(d.jurisdictions) ? d.jurisdictions.filter(Boolean) : null,
      deal_value: typeof d.deal_value === 'number' ? d.deal_value : null,
      deal_currency: (d.deal_currency as string)?.trim() || null,
      role_played: (d.role_played as string)?.trim() || null,
      lead_partner: (d.lead_partner as string)?.trim() || null,
      year_completed: typeof d.year_completed === 'number' ? d.year_completed : null,
      institutions: Array.isArray(d.institutions) ? d.institutions.filter(Boolean) : null,
      status: ['Active', 'Completed', 'Ongoing'].includes(d.status as string) ? d.status : 'Completed',
    }));

    console.log(`Extracted ${deals.length} deals. Notes: ${parsed.parsing_notes || 'none'}`);

    return new Response(
      JSON.stringify({
        success: true,
        deals,
        count: deals.length,
        notes: parsed.parsing_notes || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
