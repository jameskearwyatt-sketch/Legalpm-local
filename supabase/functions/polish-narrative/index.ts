import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { narrative } = await req.json();
    
    if (!narrative || narrative.trim() === '') {
      return new Response(
        JSON.stringify({ polishedNarrative: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Polishing narrative:', narrative.substring(0, 50) + '...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert legal time recording assistant at a top international law firm. Your task is to transform brief, informal time recording notes into polished, professional narratives suitable for client billing.

Guidelines:
- Use formal, professional legal language
- Be concise but comprehensive
- Use proper legal terminology where appropriate
- Ensure perfect grammar, spelling, and punctuation
- Write in third person or passive voice as is standard in legal billing
- Expand abbreviations and shorthand into full professional descriptions
- Keep the core meaning and work performed, but make it presentation-ready
- Do not add work that wasn't mentioned - only polish what's there
- Typical length should be 1-3 sentences

Examples:
- "called client re docs" → "Telephone conference with client to discuss documentation requirements and next steps."
- "rev contract, sent comments" → "Reviewed and analysed draft contract; prepared detailed comments and amendments for client consideration."
- "prep for meeting tmrw" → "Preparation for upcoming conference, including review of relevant materials and drafting of agenda items."
- "emails w opposing counsel" → "Correspondence with opposing counsel regarding ongoing negotiations and procedural matters."

Only return the polished narrative, nothing else.`
          },
          {
            role: 'user',
            content: `Polish this time recording narrative: "${narrative}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const polishedNarrative = data.choices?.[0]?.message?.content?.trim() || narrative;

    console.log('Polished result:', polishedNarrative.substring(0, 50) + '...');

    return new Response(
      JSON.stringify({ polishedNarrative }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in polish-narrative function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
