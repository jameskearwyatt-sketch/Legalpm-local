import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssignmentRequest {
  contactIds: string[];
  focusAreas: string[]; // The approved focus areas to use
  protectManualEdits?: boolean; // Skip contacts with manual edits
}

// NAICS prefix to focus area mapping
const naicsToFocusArea: Record<string, string[]> = {
  '211': ['Oil & Gas'],
  '2111': ['Oil & Gas'],
  '21111': ['Oil & Gas'],
  '211111': ['Oil & Gas'],
  '211112': ['Natural Gas'],
  '211120': ['Oil & Gas'],
  '211130': ['Natural Gas'],
  '212': ['Mining & Metals'],
  '2121': ['Mining & Metals'],
  '2122': ['Mining & Metals'],
  '2123': ['Mining & Metals'],
  '221': ['Utilities & Grid'],
  '2211': ['Power Generation'],
  '22111': ['Power Generation'],
  '221111': ['Renewables', 'Hydropower'],
  '221112': ['Fossil Fuel Power'],
  '221113': ['Nuclear'],
  '221114': ['Renewables', 'Solar'],
  '221115': ['Renewables', 'Wind'],
  '221116': ['Renewables', 'Geothermal'],
  '221117': ['Renewables', 'Biomass'],
  '221118': ['Power Generation'],
  '22112': ['Utilities & Grid', 'Transmission'],
  '221121': ['Utilities & Grid', 'Transmission'],
  '221122': ['Utilities & Grid'],
  '2212': ['Natural Gas'],
  '2213': ['Water & Environment'],
  '237': ['Infrastructure'],
  '23711': ['Water & Environment'],
  '23712': ['Oil & Gas', 'Pipelines'],
  '23713': ['Utilities & Grid', 'Transmission'],
  '324': ['Oil & Gas'],
  '325': ['Chemicals'],
  '331': ['Mining & Metals'],
  '486': ['Pipelines'],
  '4861': ['Oil & Gas', 'Pipelines'],
  '4862': ['Natural Gas', 'Pipelines'],
};

function getFocusAreasFromNaics(codes: string[] | null, availableFocusAreas: string[]): string[] {
  if (!codes || codes.length === 0) return [];
  
  const foundAreas = new Set<string>();
  
  for (const code of codes) {
    // Try exact match first, then progressively shorter prefixes
    for (let len = code.length; len >= 3; len--) {
      const prefix = code.substring(0, len);
      if (naicsToFocusArea[prefix]) {
        naicsToFocusArea[prefix].forEach(area => {
          // Only add if it's in the approved focus areas list
          if (availableFocusAreas.some(fa => fa.toLowerCase() === area.toLowerCase())) {
            foundAreas.add(area);
          }
        });
        break;
      }
    }
  }
  
  return [...foundAreas];
}

Deno.serve(async (req) => {
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contactIds, focusAreas, protectManualEdits = true }: AssignmentRequest = await req.json();
    
    const isAllContacts = !contactIds || contactIds.length === 0;
    console.log(`Assigning focus areas to ${isAllContacts ? 'contacts without focus areas' : contactIds.length + ' selected contacts'} (protect manual: ${protectManualEdits})`);

    // Fetch contacts with their NAICS codes, focus areas, and manual edit flag
    let contactsQuery = supabase
      .from('distribution_contacts')
      .select('id, full_name, company, naics_codes, linkedin_url, job_title, emi_focus_areas, emi_focus_areas_manual_edit')
      .eq('user_id', user.id);
    
    // Only filter by IDs if specific contacts were selected
    if (!isAllContacts) {
      contactsQuery = contactsQuery.in('id', contactIds);
    }
    
    const { data: contacts, error: contactsError } = await contactsQuery;
    
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      throw contactsError;
    }
    
    console.log(`Fetched ${contacts?.length || 0} contacts from database`);

    // For "all contacts" mode, only process contacts WITHOUT focus areas already
    let contactsAfterFocusFilter = contacts || [];
    if (isAllContacts) {
      contactsAfterFocusFilter = contactsAfterFocusFilter.filter(c => 
        !c.emi_focus_areas || c.emi_focus_areas.length === 0
      );
      console.log(`Filtered to ${contactsAfterFocusFilter.length} contacts without existing focus areas`);
    }

    // Filter out manually edited contacts if protection is enabled
    const contactsToProcess = protectManualEdits 
      ? contactsAfterFocusFilter.filter(c => !c.emi_focus_areas_manual_edit)
      : contactsAfterFocusFilter;
    
    const skippedCount = contactsAfterFocusFilter.length - contactsToProcess.length;
    
    if (skippedCount > 0) {
      console.log(`Skipping ${skippedCount} contacts with manual edits`);
    }

    // Fetch clients and matters for work type matching
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, display_name')
      .eq('user_id', user.id);

    const { data: matters } = await supabase
      .from('matters')
      .select('client_id, matter_name, practice_area, matter_display_name')
      .eq('user_id', user.id);

    // Build client->matters map
    const clientMattersMap = new Map<string, { name: string; matters: Array<{ matterName: string; practiceArea: string | null }> }>();
    
    if (clients) {
      for (const client of clients) {
        const clientMatters = matters?.filter(m => m.client_id === client.id) || [];
        clientMattersMap.set(client.id, {
          name: client.display_name || client.name,
          matters: clientMatters.map(m => ({
            matterName: m.matter_display_name || m.matter_name,
            practiceArea: m.practice_area
          }))
        });
      }
    }

    // Match contacts to clients
    function findMatchingClient(company: string | null): { name: string; matters: Array<{ matterName: string; practiceArea: string | null }> } | null {
      if (!company) return null;
      
      const normalizedCompany = company.toLowerCase().trim();
      
      for (const [_, clientData] of clientMattersMap) {
        const clientName = clientData.name.toLowerCase().trim();
        if (normalizedCompany.includes(clientName) || clientName.includes(normalizedCompany)) {
          return clientData;
        }
      }
      return null;
    }

    // Use AI to assign focus areas based on all available data
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare contact data for AI (only contacts we're processing)
    const contactData = contactsToProcess.map(c => {
      const matchedClient = findMatchingClient(c.company);
      const naicsBasedAreas = getFocusAreasFromNaics(c.naics_codes, focusAreas);
      
      return {
        id: c.id,
        company: c.company,
        jobTitle: c.job_title,
        naicsCodes: c.naics_codes,
        naicsBasedSuggestion: naicsBasedAreas,
        matchedClient: matchedClient?.name || null,
        matterNames: matchedClient?.matters.map(m => m.matterName) || [],
      };
    });

    console.log('Sending to AI for focus area assignment...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert in the Energy, Mining & Infrastructure (EMI) legal sector. Assign focus areas to contacts based on their company, industry (NAICS codes), and the legal work we do for them.

CRITICAL RULES:
1. If we have matter data showing specific work types (e.g., PPA work, project finance), prioritize the WORK TYPE as the focus area
2. For companies where we do energy work but they're not energy companies themselves (e.g., a beverage company for whom we do PPA work), assign based on the work type, not their industry
3. Use NAICS codes as guidance for pure industry classification
4. A contact can have multiple focus areas if appropriate
5. Only assign focus areas from the approved list provided`
          },
          {
            role: 'user',
            content: `Assign EMI Focus Areas to these contacts.

Approved Focus Areas: ${JSON.stringify(focusAreas)}

Contacts to assign:
${JSON.stringify(contactData, null, 2)}

For each contact, determine the most appropriate focus area(s). Consider:
- Their NAICS-based suggestion
- The matters/work we do for matched clients
- The company and job title context

Return assignments for all contacts.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'assign_focus_areas',
              description: 'Assign focus areas to contacts',
              parameters: {
                type: 'object',
                properties: {
                  assignments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        contactId: { type: 'string' },
                        focusAreas: { 
                          type: 'array',
                          items: { type: 'string' }
                        },
                        reasoning: { type: 'string' }
                      },
                      required: ['contactId', 'focusAreas']
                    }
                  }
                },
                required: ['assignments']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'assign_focus_areas' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    let assignments: Array<{ contactId: string; focusAreas: string[]; reasoning?: string }> = [];
    
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        assignments = parsed.assignments || [];
      }
    } catch (e) {
      console.error('Error parsing AI response:', e);
    }

    console.log(`AI assigned focus areas to ${assignments.length} contacts`);

    // Update contacts in database
    let successCount = 0;
    let errorCount = 0;
    
    for (const assignment of assignments) {
      // Validate that assigned areas are in the approved list
      const validAreas = assignment.focusAreas.filter(area =>
        focusAreas.some(fa => fa.toLowerCase() === area.toLowerCase())
      );
      
      const { error: updateError } = await supabase
        .from('distribution_contacts')
        .update({
          emi_focus_areas: validAreas,
          emi_focus_areas_assigned_at: new Date().toISOString(),
        })
        .eq('id', assignment.contactId)
        .eq('user_id', user.id);
      
      if (updateError) {
        console.error(`Error updating contact ${assignment.contactId}:`, updateError);
        errorCount++;
      } else {
        successCount++;
      }
    }

    console.log(`Updated ${successCount} contacts, ${errorCount} errors, ${skippedCount} skipped`);

    return new Response(JSON.stringify({
      success: true,
      updated: successCount,
      errors: errorCount,
      skipped: skippedCount,
      assignments,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in assign-focus-areas:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
