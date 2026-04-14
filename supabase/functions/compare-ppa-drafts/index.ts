import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newPpaText, previousPositions, perspective, jurisdiction, projectName, versionNumber } = await req.json();

    if (!newPpaText || !previousPositions) {
      return new Response(
        JSON.stringify({ error: 'New PPA text and previous positions are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Format previous positions for comparison
    const previousPositionsText = previousPositions.map((p: any) => 
      `### ${p.category}
Clause refs: ${p.source_text || 'Not specified'}
Position: ${p.position_summary}
${p.variance_notes ? `Flags: ${p.variance_notes}` : ''}`
    ).join('\n\n');

    const systemPrompt = `You are an expert PPA (Power Purchase Agreement) analyst performing a REDLINE COMPARISON between draft versions.

PERSPECTIVE: ${perspective === 'buyer' ? 'Buyer (Offtaker)' : 'Seller (Generator)'}
${jurisdiction ? `JURISDICTION: ${jurisdiction}` : ''}

## YOUR TASK

You are comparing Draft v${versionNumber} against the previous draft's extracted positions.
Your job is to identify WHAT HAS CHANGED between drafts.

## OUTPUT REQUIREMENTS

For each category:
1. Determine if the position has CHANGED, remained UNCHANGED, or is a NEW addition
2. If CHANGED: Clearly articulate WHAT specifically changed (e.g., "Availability guarantee: 95% → 97%")
3. Use the format: "Changed: [old position] → [new position]" or "New: [addition not in previous draft]"
4. Include clause references for the new draft

## CRITICAL INSTRUCTIONS

- Be SPECIFIC about changes. Don't just say "terms have been updated"
- Highlight numerical changes explicitly (amounts, percentages, dates, durations)
- Note if something was REMOVED from the previous draft
- Flag significant commercial changes with ⚠️
- If a provision is substantively the same but with minor wording tweaks, mark as "Unchanged (minor drafting)"
- Focus on COMMERCIAL and LEGAL substance, not formatting changes

## CHANGE TYPES

- "modified": The provision exists in both but has materially changed
- "unchanged": The provision is substantively the same
- "added": New provision not in previous draft
- "removed": Provision was in previous draft but not in new

## PREVIOUS DRAFT POSITIONS (to compare against):

${previousPositionsText}`;

    const userPrompt = `Compare this NEW DRAFT against the previous positions and identify all changes.

PROJECT: ${projectName} - Draft v${versionNumber}

NEW PPA DOCUMENT TEXT:
${newPpaText.substring(0, 100000)}

Return a JSON object:
{
  "positions": [
    {
      "category": "Category Label",
      "clause_references": "Clause X.X in new draft",
      "position_summary": "• Current position bullet 1\\n• Current position bullet 2",
      "change_type": "modified|unchanged|added|removed",
      "change_summary": "Changed: [specific change description] → [new value]",
      "previous_position": "The previous draft's position (for reference)",
      "confidence": "high|medium|review_required",
      "flags": "⚠️ Significant commercial change (if applicable)"
    }
  ]
}

IMPORTANT: 
- For "modified" items, the change_summary MUST clearly state what changed
- For "unchanged" items, change_summary should be "No material change" or "Unchanged (minor drafting)"
- Be conclusive and specific about every change`;

    console.log('Calling AI gateway for PPA comparison analysis...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Using Pro for detailed comparison
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        // Structured output: force JSON so we don't have to peel off
        // markdown fences in the parsing below (see #6 structured output).
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI comparison response received, parsing...');

    // Parse the JSON from the response
    let positions = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*"positions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        positions = parsed.positions || [];
        
        // Transform to match expected format
        positions = positions.map((p: any) => ({
          category: p.category,
          position_summary: p.position_summary,
          source_text: p.clause_references || null,
          confidence: p.confidence || 'review_required',
          bible_reference: null,
          comparison_position: p.previous_position || null,
          variance_notes: p.flags || null,
          change_type: p.change_type || 'unchanged',
          change_summary: p.change_summary || null,
          previous_position: p.previous_position || null,
        }));
      } else {
        console.error('No JSON found in response:', content.substring(0, 500));
        throw new Error('Could not parse AI response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse comparison results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate summary stats
    const stats = {
      modified: positions.filter((p: any) => p.change_type === 'modified').length,
      unchanged: positions.filter((p: any) => p.change_type === 'unchanged').length,
      added: positions.filter((p: any) => p.change_type === 'added').length,
      removed: positions.filter((p: any) => p.change_type === 'removed').length,
    };

    return new Response(
      JSON.stringify({ positions, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-ppa-drafts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Comparison failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
