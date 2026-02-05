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
 
 ## CRITICAL INSTRUCTIONS
 - Take the user's feedback seriously - they are domain experts
 - If they say something IS in the document, believe them and incorporate it
 - If they point out a misinterpretation, correct it
 - Maintain the same bullet-point format
 - Be specific and actionable
 - Include clause references if the user mentioned them
 
 ## OUTPUT FORMAT
 Return ONLY the corrected position summary in bullet-point format.
 Do NOT include any preamble or explanation - just the corrected analysis.`;
 
     const userPrompt = `## CONTEXT
 Category: ${category}
 Project: ${projectName || 'Unknown'}
 Jurisdiction: ${jurisdiction || 'Unknown'}
 PPA Type: ${ppaType || 'Unknown'}
 ${sourceText ? `Source Clauses: ${sourceText}` : ''}
 
 ## ORIGINAL ANALYSIS (INCORRECT)
 ${originalPosition}
 
 ## USER'S CORRECTION
 ${userFeedback}
 
 ## YOUR TASK
 Rewrite the analysis incorporating the user's correction. Output ONLY the corrected bullet-point analysis.`;
 
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
     const correctedPosition = data.choices?.[0]?.message?.content?.trim() || '';
 
     if (!correctedPosition) {
       throw new Error('AI did not return a corrected position');
     }
 
     console.log('Feedback processed successfully');
 
     return new Response(
       JSON.stringify({ 
         corrected_position: correctedPosition,
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