import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExistingTask {
  id: string;
  title: string;
  assignee?: string;
  is_completed: boolean;
}

interface ExistingEntry {
  title?: string;
  content?: string;
  entry_type: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newEntryContent, projectName, projectType, existingTasks, existingEntries } = await req.json();

    if (!newEntryContent) {
      return new Response(JSON.stringify({ error: 'newEntryContent is required', tasks: [], amendments: [], completedTasks: [] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured', tasks: [], amendments: [], completedTasks: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const projectTypeLabels: Record<string, string> = {
      'business_development': 'Business Development',
      'professional_development': 'Professional Development',
      'learning_development': 'Learning & Development',
    };

    // Format existing entries for context (limit to recent ones to avoid token limits)
    const recentEntries = (existingEntries as ExistingEntry[] || []).slice(0, 10);
    const entriesContext = recentEntries.length > 0 
      ? recentEntries.map((e, i) => {
          const title = e.title ? `"${e.title}"` : `Entry ${i + 1}`;
          const content = e.content || '[No text content - file attachment]';
          return `--- ${title} (${e.entry_type}, ${new Date(e.created_at).toLocaleDateString()}) ---\n${content}`;
        }).join('\n\n')
      : 'No previous entries.';

    // Format existing tasks for context
    const pendingTasks = (existingTasks as ExistingTask[] || []).filter(t => !t.is_completed);
    const completedTasksList = (existingTasks as ExistingTask[] || []).filter(t => t.is_completed);
    
    const pendingTasksContext = pendingTasks.length > 0
      ? pendingTasks.map((t, i) => `${i + 1}. "${t.title}" (assigned to: ${t.assignee || 'unassigned'})`).join('\n')
      : 'No pending tasks.';

    const completedTasksContext = completedTasksList.length > 0
      ? completedTasksList.slice(0, 10).map((t, i) => `${i + 1}. "${t.title}"`).join('\n')
      : 'No completed tasks yet.';

    const prompt = `You are analyzing a ${projectTypeLabels[projectType] || 'professional'} project called "${projectName}".

## PROJECT CONTEXT

### Previous Scrapbook Entries (for context):
${entriesContext}

### Current Pending Tasks:
${pendingTasksContext}

### Recently Completed Tasks:
${completedTasksContext}

---

## NEW ENTRY TO ANALYZE

The user has just added this new entry:
"""
${newEntryContent}
"""

---

## YOUR TASK

Based on the NEW ENTRY above (using the project context to inform your analysis), identify:

1. **NEW TASKS**: Action items mentioned in the new entry that aren't already in the pending tasks list. Be specific and actionable. Don't duplicate existing tasks.

2. **TASK AMENDMENTS**: If the new entry suggests changes to existing pending tasks (e.g., scope change, new deadline, reassignment), suggest amendments.

3. **COMPLETED TASKS**: If the new entry provides evidence that any pending tasks have been delivered or satisfied, identify them with the specific evidence.

Rules:
- Focus your analysis on the NEW ENTRY - the previous entries are just for context
- If "I" or "me" is mentioned, the assignee is "Me"
- If no specific person is mentioned, leave assignee empty
- Be thorough but don't invent tasks not implied by the content
- Deadline types: this_week, next_week, this_month, next_month, in_3_months, in_6_months, no_deadline
- Only mark tasks complete if there's clear evidence in the new entry

Return your analysis using the analyze_tasks function.`;

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
              name: 'analyze_tasks',
              description: 'Return new tasks, amendments to existing tasks, and tasks that appear completed',
              parameters: {
                type: 'object',
                properties: {
                  new_tasks: {
                    type: 'array',
                    description: 'New tasks to add to the project',
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
                  },
                  amendments: {
                    type: 'array',
                    description: 'Suggested changes to existing tasks',
                    items: {
                      type: 'object',
                      properties: {
                        original_task_title: { type: 'string', description: 'The existing task title to amend' },
                        suggested_title: { type: 'string', description: 'New suggested title (if changing)' },
                        suggested_assignee: { type: 'string', description: 'New suggested assignee (if changing)' },
                        suggested_deadline_type: { 
                          type: 'string', 
                          enum: ['this_week', 'next_week', 'this_month', 'next_month', 'in_3_months', 'in_6_months', 'no_deadline'],
                          description: 'New suggested deadline (if changing)'
                        },
                        reason: { type: 'string', description: 'Brief explanation for the amendment' }
                      },
                      required: ['original_task_title', 'reason']
                    }
                  },
                  completed_tasks: {
                    type: 'array',
                    description: 'Existing tasks that appear to be completed based on the new content',
                    items: {
                      type: 'object',
                      properties: {
                        original_task_title: { type: 'string', description: 'The existing task title that appears complete' },
                        evidence: { type: 'string', description: 'Brief explanation of why this task appears complete' }
                      },
                      required: ['original_task_title', 'evidence']
                    }
                  }
                },
                required: ['new_tasks', 'amendments', 'completed_tasks']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_tasks' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.', tasks: [], amendments: [], completedTasks: [] }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.', tasks: [], amendments: [], completedTasks: [] }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error', tasks: [], amendments: [], completedTasks: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData));
    
    // Extract from tool call response
    let newTasks: Array<{ title: string; assignee?: string; deadline_type: string }> = [];
    let amendments: Array<{ original_task_title: string; suggested_title?: string; suggested_assignee?: string; suggested_deadline_type?: string; reason: string }> = [];
    let completedTasks: Array<{ original_task_title: string; evidence: string }> = [];
    
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const args = toolCalls[0]?.function?.arguments;
      if (args) {
        try {
          const parsed = typeof args === 'string' ? JSON.parse(args) : args;
          newTasks = parsed.new_tasks || [];
          amendments = parsed.amendments || [];
          completedTasks = parsed.completed_tasks || [];
        } catch (e) {
          console.error('Failed to parse tool call arguments:', e);
        }
      }
    }

    return new Response(JSON.stringify({ 
      tasks: newTasks, 
      amendments, 
      completedTasks 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in extract-tasks:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, tasks: [], amendments: [], completedTasks: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
