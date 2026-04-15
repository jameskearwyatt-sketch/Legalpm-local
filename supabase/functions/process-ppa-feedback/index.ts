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
     const { 
       positionId,
       category,
       originalPosition,
      originalVarianceNotes,
       userFeedback,
       sourceText,
       projectName,
       jurisdiction,
       ppaType,
     } = await req.json();
 
     if (!category || !originalPosition || !userFeedback) {
       return new Response(
         JSON.stringify({ error: 'Missing required fields: category, originalPosition, userFeedback' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     console.log(`Processing feedback for category: ${category}`);
     console.log(`User feedback: ${userFeedback.substring(0, 100)}...`);
 
     const systemPrompt = `You are an expert PPA (Power Purchase Agreement) analyst who learns from user corrections.
 
 A user has provided feedback on an analysis you previously produced. Your task is to:
 1. Understand what was wrong with the original analysis
 2. Incorporate the user's correction
 3. Produce a corrected analysis that addresses the user's feedback
4. Re-evaluate the market position based on the corrected understanding
 
 ## CRITICAL INSTRUCTIONS
 - Take the user's feedback seriously - they are domain experts
 - If they say something IS in the document, believe them and incorporate it
 - If they point out a misinterpretation, correct it
- If they explain why something is APPROPRIATE for this context (e.g., a provision is correct for Private Wire), update your assessment accordingly
 - Maintain the same bullet-point format
 - Be specific and actionable
 - Include clause references if the user mentioned them
 
## MARKET POSITION RE-EVALUATION
Based on the user's feedback, you must also determine the correct market position label:
- "on_market" - Position is standard/appropriate for this type of PPA and jurisdiction
- "off_market" - Position deviates from typical market terms but is not severely unusual
- "way_off_market" - Position is severely unusual or missing a critical protection
- "not_applicable" - This provision/concept is not relevant for this PPA type (e.g., grid-related provisions for Private Wire PPAs)

If the user explains that a provision is CORRECT or APPROPRIATE for the context, do NOT mark it as off-market or way off-market.

## OUTPUT FORMAT
Return a JSON object with exactly these fields:
{
  "corrected_position": "The corrected bullet-point analysis...",
  "market_position": "on_market|off_market|way_off_market|not_applicable",
  "market_position_reason": "Brief explanation of why this market position is appropriate"
}

Return ONLY the JSON object. No preamble or additional text.`;
 
     const userPrompt = `## CONTEXT
 Category: ${category}
 Project: ${projectName || 'Unknown'}
 Jurisdiction: ${jurisdiction || 'Unknown'}
 PPA Type: ${ppaType || 'Unknown'}
 ${sourceText ? `Source Clauses: ${sourceText}` : ''}
 
## ORIGINAL ANALYSIS
 ${originalPosition}
 
## ORIGINAL MARKET ASSESSMENT
${originalVarianceNotes || 'No market position notes'}

 ## USER'S CORRECTION
 ${userFeedback}
 
 ## YOUR TASK
Rewrite the analysis incorporating the user's correction and re-evaluate the market position.
If the user is explaining that the current position is APPROPRIATE for this context, reflect that in both the analysis and the market_position field.
Output ONLY the JSON object as specified.`;
 
     console.log('Calling AI gateway for feedback processing...');
 
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         Authorization: `Bearer ${LOVABLE_API_KEY}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-3-flash-preview",
         messages: [
           { role: "system", content: systemPrompt },
           { role: "user", content: userPrompt }
         ],
         temperature: 0.3,
         // Structured output: force the model to return a JSON object
         // so the parsing below doesn't have to strip markdown fences
         // or deal with prose prefixes (see #6 structured output).
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
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '';
 
    if (!rawContent) {
       throw new Error('AI did not return a corrected position');
     }
 
    // Parse the JSON response
    let parsedResponse;
    try {
      // Extract JSON from potential markdown code blocks
      let jsonStr = rawContent;
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      parsedResponse = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', rawContent);
      // Fallback: treat the entire response as the corrected position
      parsedResponse = {
        corrected_position: rawContent,
        market_position: 'on_market', // Default to on_market if user is correcting
        market_position_reason: 'Updated based on user feedback',
      };
    }

    const correctedPosition = parsedResponse.corrected_position || rawContent;
    const marketPosition = parsedResponse.market_position || 'on_market';
    const marketPositionReason = parsedResponse.market_position_reason || '';

    // Convert market_position to the variance_notes format
    const marketPositionLabels: Record<string, string> = {
      'on_market': '[ON MARKET]',
      'off_market': '[OFF MARKET]',
      'way_off_market': '[WAY OFF MARKET]',
      'not_applicable': '[ON MARKET]', // Treat not_applicable as on_market for display
    };
    const marketPositionLabel = marketPositionLabels[marketPosition] || '[ON MARKET]';

    const correctedVarianceNotes = marketPositionReason 
      ? `${marketPositionLabel} ${marketPositionReason}` 
      : marketPositionLabel;

     console.log('Feedback processed successfully');
    console.log(`Market position updated to: ${marketPosition}`);
 
     return new Response(
       JSON.stringify({ 
         corrected_position: correctedPosition,
        corrected_variance_notes: correctedVarianceNotes,
        market_position: marketPosition,
         original_position: originalPosition,
         category,
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('Error processing feedback:', error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });