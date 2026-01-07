import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { content, projectName, projectType } = await req.json();

    if (!content) {
      return new Response(JSON.stringify({ error: 'content is required', tasks: [] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured', tasks: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const projectTypeLabels: Record<string, string> = {
      'business_development': 'Business Development',
      'professional_development': 'Professional Development',
      'learning_development': 'Learning & Development',
    };

    const prompt = `You are analyzing notes from a ${projectTypeLabels[projectType] || 'professional'} project called "${projectName}".

Extract ALL actionable tasks from the following content. For each task:
1. Create a clear, specific action item title (verb + object)
2. Identify who should do it (look for names, roles, or pronouns like "I", "we", "they")
3. Suggest a deadline type based on context clues

Content to analyze:
"""
${content}
"""

Rules:
- Extract EVERY action item, commitment, or follow-up mentioned
- If "I" or "me" is mentioned, the assignee is "Me"
- If no specific person is mentioned, leave assignee empty
- Be thorough - extract 3-10 tasks if present
- Deadline types: this_week, next_week, this_month, next_month, in_3_months, in_6_months, no_deadline

Return tasks using the suggest_tasks function.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_tasks',
              description: 'Return extracted tasks from the content',
              parameters: {
                type: 'object',
                properties: {
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Clear action item starting with a verb' },
                        assignee: { type: 'string', description: 'Person responsible (use "Me" for first person)' },
                        deadline_type: { 
                          type: 'string', 
                          enum: ['this_week', 'next_week', 'this_month', 'next_month', 'in_3_months', 'in_6_months', 'no_deadline'],
                          description: 'When this should be completed'
                        }
                      },
                      required: ['title', 'deadline_type']
                    }
                  }
                },
                required: ['tasks']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_tasks' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.', tasks: [] }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.', tasks: [] }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error', tasks: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData));
    
    // Extract tasks from tool call response
    let tasks: Array<{ title: string; assignee?: string; deadline_type: string }> = [];
    
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const args = toolCalls[0]?.function?.arguments;
      if (args) {
        try {
          const parsed = typeof args === 'string' ? JSON.parse(args) : args;
          tasks = parsed.tasks || [];
        } catch (e) {
          console.error('Failed to parse tool call arguments:', e);
        }
      }
    }

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in extract-tasks:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, tasks: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
