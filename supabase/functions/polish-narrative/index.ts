import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_NARRATIVE_LENGTH = 5000;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { narrative } = await req.json();

    // Validate input type
    if (narrative !== undefined && typeof narrative !== 'string') {
      console.error('Invalid narrative type:', typeof narrative);
      return new Response(
        JSON.stringify({ error: 'Invalid narrative input - must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle empty narratives
    if (!narrative || narrative.trim() === '') {
      return new Response(
        JSON.stringify({ polishedNarrative: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input length
    if (narrative.length > MAX_NARRATIVE_LENGTH) {
      console.error('Narrative too long:', narrative.length);
      return new Response(
        JSON.stringify({ error: `Narrative exceeds maximum length of ${MAX_NARRATIVE_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Polishing narrative for user:', user.id, 'length:', narrative.length);

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
- Expand common shorthand (e.g. "re" → "regarding", "w" → "with", "tmrw" → "tomorrow") but NEVER expand acronyms — leave all acronyms exactly as the user wrote them (e.g. keep "SPA", "NDA", "IP", "AML", "KYC", "CDD", "LC" unchanged)
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

    console.log('Successfully polished narrative for user:', user.id);

    return new Response(
      JSON.stringify({ polishedNarrative }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in polish-narrative function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
