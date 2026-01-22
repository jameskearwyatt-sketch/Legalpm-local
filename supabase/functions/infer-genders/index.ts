import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactInput {
  id: string;
  full_name: string;
}

interface GenderResult {
  id: string;
  full_name: string;
  inferred_gender: 'male' | 'female' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contacts } = await req.json() as { contacts: ContactInput[] };

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No contacts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Process in batches of 20 to avoid token limits
    const batchSize = 20;
    const allResults: GenderResult[] = [];

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      const namesList = batch.map((c, idx) => `${idx + 1}. "${c.full_name}"`).join('\n');
      
      const systemPrompt = `You are an expert at inferring gender from names across all cultures and languages. 
You understand that:
- Names have different gender associations in different cultures (e.g., "Andrea" is male in Italy, female in English-speaking countries)
- Some names are genuinely ambiguous (e.g., "Alex", "Jordan", "Kim", "Taylor")
- Context clues from the full name can help (e.g., middle names, family name patterns)
- When uncertain, mark as "unknown" rather than guess

For each name, provide:
- gender: 'male', 'female', or 'unknown'
- confidence: 'high' (very certain), 'medium' (reasonably sure), 'low' (uncertain but leaning)
- brief reasoning (especially for non-obvious cases)`;

      const userPrompt = `Analyze these names and infer the most likely gender for each person:

${namesList}

Consider cultural context, name origins, and any patterns. Return your analysis for all ${batch.length} names.`;

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} names`);

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'report_gender_analysis',
                description: 'Report the gender analysis results for all names',
                parameters: {
                  type: 'object',
                  properties: {
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          index: { 
                            type: 'number', 
                            description: 'The 1-based index of the name in the input list' 
                          },
                          gender: { 
                            type: 'string', 
                            enum: ['male', 'female', 'unknown'],
                            description: 'The inferred gender'
                          },
                          confidence: { 
                            type: 'string', 
                            enum: ['high', 'medium', 'low'],
                            description: 'Confidence level in the inference'
                          },
                          reasoning: { 
                            type: 'string',
                            description: 'Brief explanation for the inference, especially for ambiguous names'
                          }
                        },
                        required: ['index', 'gender', 'confidence'],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ['results'],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'report_gender_analysis' } }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      console.log('AI response received');

      // Extract the tool call results
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== 'report_gender_analysis') {
        console.error('Unexpected response format:', JSON.stringify(data));
        throw new Error('Unexpected response format from AI');
      }

      const analysisResults = JSON.parse(toolCall.function.arguments);
      
      // Map results back to contacts
      for (const result of analysisResults.results) {
        const contact = batch[result.index - 1];
        if (contact) {
          allResults.push({
            id: contact.id,
            full_name: contact.full_name,
            inferred_gender: result.gender,
            confidence: result.confidence,
            reasoning: result.reasoning,
          });
        }
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Processed ${allResults.length} contacts successfully`);

    return new Response(
      JSON.stringify({ success: true, results: allResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in infer-genders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
