import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { taskTitle, assigneeName, projectName, projectType, senderName } = await req.json();

    if (!taskTitle || !assigneeName) {
      return new Response(
        JSON.stringify({ error: 'Task title and assignee name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Extract first name from assignee
    const firstName = assigneeName.split(' ')[0];

    const systemPrompt = `You are a helpful assistant that drafts professional but friendly emails. 
Write natural, warm emails that don't sound robotic or overly formal.
Keep the tone collegial and respectful.
The email should be concise - just a few sentences.
Do not include subject line, just the body.
Start with "Hi ${firstName}," and end with a simple sign-off.`;

    const userPrompt = `Draft a short, friendly professional email asking ${firstName} if they would kindly help with this task:

Task: "${taskTitle}"
${projectName ? `Project context: ${projectName}` : ''}
${projectType ? `Project type: ${projectType.replace('_', ' ')}` : ''}
${senderName ? `Sign off as: ${senderName}` : 'Sign off with just "Best" or similar'}

The email should:
- Sound natural and human, not like a template
- Be warm but professional
- Briefly explain what's needed (infer from the task title)
- Be polite and appreciative
- Be concise (3-5 sentences max for the body)`;

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
          { role: "user", content: userPrompt }
        ],
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
    const emailBody = data.choices?.[0]?.message?.content || '';

    // Generate a subject line
    const subjectPrompt = `Generate a brief, natural email subject line for this request: "${taskTitle}". 
Just return the subject line text, nothing else. Keep it under 50 characters.`;

    const subjectResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: subjectPrompt }
        ],
      }),
    });

    let subject = `Re: ${taskTitle.slice(0, 40)}`;
    if (subjectResponse.ok) {
      const subjectData = await subjectResponse.json();
      subject = subjectData.choices?.[0]?.message?.content?.trim() || subject;
    }

    return new Response(
      JSON.stringify({ 
        subject,
        body: emailBody,
        to: firstName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in draft-delegation-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
