import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'projectId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from('growth_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all entries
    const { data: entries } = await supabase
      .from('growth_project_entries')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    // Fetch all tasks
    const { data: tasks } = await supabase
      .from('growth_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    // Build context for AI
    const projectTypeLabels: Record<string, string> = {
      'business_development': 'Business Development',
      'professional_development': 'Professional Development',
      'learning_development': 'Learning & Development',
    };

    const entriesContext = (entries || []).map(e => 
      `[${new Date(e.created_at).toLocaleDateString()}] ${e.title || 'Entry'}: ${e.content || '(file: ' + e.file_name + ')'}`
    ).join('\n');

    const completedTasks = (tasks || []).filter(t => t.is_completed);
    const pendingTasks = (tasks || []).filter(t => !t.is_completed);

    const tasksContext = `
Completed Tasks (${completedTasks.length}):
${completedTasks.map(t => `- ${t.title}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n') || 'None'}

Pending Tasks (${pendingTasks.length}):
${pendingTasks.map(t => `- ${t.title}${t.assignee ? ` (${t.assignee})` : ''} - ${t.deadline_type.replace('_', ' ')}`).join('\n') || 'None'}
`;

    const prompt = `You are a professional development assistant for a busy legal practitioner. Analyze the following ${projectTypeLabels[project.project_type]} project and provide a concise status summary.

Project: ${project.name}
${project.mentee_name ? `Mentee: ${project.mentee_name}` : ''}
${project.description ? `Description: ${project.description}` : ''}

Recent Activity and Notes:
${entriesContext || 'No entries yet'}

Task Status:
${tasksContext}

Provide a brief, professional summary (2-3 sentences max) that captures:
1. The current status of the project
2. Key progress or achievements
3. Any immediate priorities or concerns

Be concise and actionable. Focus on what matters most for a busy professional.`;

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content?.trim() || '';

    // Update the project with the new summary
    const { error: updateError } = await supabase
      .from('growth_projects')
      .update({ ai_summary: summary })
      .eq('id', projectId);

    if (updateError) {
      console.error('Error updating project:', updateError);
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in synthesize-growth-project:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
