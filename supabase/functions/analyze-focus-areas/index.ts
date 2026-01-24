import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactAnalysis {
  contactId: string;
  fullName: string;
  company: string | null;
  naicsCodes: string[] | null;
  naicsDescription: string | null;
  linkedinUrl: string | null;
  matchedClient: string | null;
  matterWorkTypes: string[];
  webScrapeData: string | null;
  suggestedFocusAreas: string[];
}

interface AnalysisResult {
  contacts: ContactAnalysis[];
  proposedFocusAreas: string[];
  analysisDetails: string;
}

// NAICS to description mapping (subset for energy/resources)
const naicsDescriptions: Record<string, string> = {
  '211': 'Oil and Gas Extraction',
  '2111': 'Oil and Gas Extraction',
  '21111': 'Oil and Gas Extraction',
  '211111': 'Crude Petroleum Extraction',
  '211112': 'Natural Gas Extraction',
  '211120': 'Crude Petroleum Extraction',
  '211130': 'Natural Gas Extraction',
  '212': 'Mining (except Oil and Gas)',
  '2121': 'Coal Mining',
  '2122': 'Metal Ore Mining',
  '2123': 'Nonmetallic Mineral Mining',
  '221': 'Utilities',
  '2211': 'Electric Power Generation',
  '22111': 'Electric Power Generation',
  '221111': 'Hydroelectric Power Generation',
  '221112': 'Fossil Fuel Electric Power Generation',
  '221113': 'Nuclear Electric Power Generation',
  '221114': 'Solar Electric Power Generation',
  '221115': 'Wind Electric Power Generation',
  '221116': 'Geothermal Electric Power Generation',
  '221117': 'Biomass Electric Power Generation',
  '221118': 'Other Electric Power Generation',
  '22112': 'Electric Power Transmission',
  '221121': 'Electric Bulk Power Transmission',
  '221122': 'Electric Power Distribution',
  '2212': 'Natural Gas Distribution',
  '2213': 'Water, Sewage and Other Systems',
  '237': 'Heavy and Civil Engineering Construction',
  '23711': 'Water and Sewer Line Construction',
  '23712': 'Oil and Gas Pipeline Construction',
  '23713': 'Power and Communication Line Construction',
  '311': 'Food Manufacturing',
  '3121': 'Beverage Manufacturing',
  '324': 'Petroleum and Coal Products Manufacturing',
  '325': 'Chemical Manufacturing',
  '331': 'Primary Metal Manufacturing',
  '333': 'Machinery Manufacturing',
  '486': 'Pipeline Transportation',
  '4861': 'Pipeline Transportation of Crude Oil',
  '4862': 'Pipeline Transportation of Natural Gas',
  '5241': 'Insurance Carriers',
  '5259': 'Other Investment Pools and Funds',
  '5411': 'Legal Services',
  '5416': 'Management Consulting',
  '541330': 'Engineering Services',
  '541620': 'Environmental Consulting',
  '926': 'Administration of Economic Programs',
};

function getNaicsDescription(codes: string[] | null): string | null {
  if (!codes || codes.length === 0) return null;
  
  for (const code of codes) {
    // Try exact match first, then progressively shorter prefixes
    for (let len = code.length; len >= 2; len--) {
      const prefix = code.substring(0, len);
      if (naicsDescriptions[prefix]) {
        return naicsDescriptions[prefix];
      }
    }
  }
  return null;
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

    const { contactIds } = await req.json();
    
    console.log(`Analyzing ${contactIds?.length || 'all'} contacts for user ${user.id}`);

    // Fetch contacts (either specified IDs or those without focus areas)
    let contactsQuery = supabase
      .from('distribution_contacts')
      .select('id, full_name, company, naics_codes, linkedin_url, job_title, emi_focus_areas')
      .eq('user_id', user.id);
    
    if (contactIds && contactIds.length > 0) {
      // Specific contacts selected - analyze those
      contactsQuery = contactsQuery.in('id', contactIds);
    } else {
      // No specific selection - only analyze contacts WITHOUT focus areas
      contactsQuery = contactsQuery.or('emi_focus_areas.is.null,emi_focus_areas.eq.{}');
    }
    
    const { data: contacts, error: contactsError } = await contactsQuery;
    
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      throw contactsError;
    }

    // Filter out contacts that already have focus areas (for the "all" case)
    const contactsToAnalyze = contactIds && contactIds.length > 0 
      ? contacts 
      : contacts?.filter(c => !c.emi_focus_areas || c.emi_focus_areas.length === 0);

    console.log(`Found ${contactsToAnalyze?.length || 0} contacts to analyze (without focus areas)`);

    // Fetch clients and matters to match work types
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, display_name')
      .eq('user_id', user.id);
    
    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
    }

    const { data: matters, error: mattersError } = await supabase
      .from('matters')
      .select('client_id, matter_name, practice_area, matter_display_name')
      .eq('user_id', user.id);
    
    if (mattersError) {
      console.error('Error fetching matters:', mattersError);
    }

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

    // Try to match contacts to clients by company name
    function findMatchingClient(company: string | null): { name: string; matters: Array<{ matterName: string; practiceArea: string | null }> } | null {
      if (!company) return null;
      
      const normalizedCompany = company.toLowerCase().trim();
      
      for (const [clientId, clientData] of clientMattersMap) {
        const clientName = clientData.name.toLowerCase().trim();
        
        // Check for match (contains either direction)
        if (normalizedCompany.includes(clientName) || clientName.includes(normalizedCompany)) {
          return clientData;
        }
        
        // Also check common variations
        const companyWords = normalizedCompany.split(/\s+/).filter(w => w.length > 2);
        const clientWords = clientName.split(/\s+/).filter(w => w.length > 2);
        
        const matchingWords = companyWords.filter(w => clientWords.includes(w));
        if (matchingWords.length >= 2) {
          return clientData;
        }
      }
      
      return null;
    }

    // Gather unique companies for web scraping
    const uniqueCompanies = [...new Set(contactsToAnalyze?.map(c => c.company).filter(Boolean) || [])];
    console.log(`Found ${uniqueCompanies.length} unique companies`);

    // Scrape company info using Firecrawl (batch, up to 10)
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const companyWebData = new Map<string, string>();
    
    if (firecrawlKey && uniqueCompanies.length > 0) {
      const companiesToScrape = uniqueCompanies.slice(0, 10); // Limit to 10 for speed
      
      for (const company of companiesToScrape) {
        try {
          console.log(`Searching for company: ${company}`);
          const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `${company} company about energy industry`,
              limit: 1,
            }),
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.data && searchData.data.length > 0) {
              const result = searchData.data[0];
              companyWebData.set(company!, `${result.title || ''}: ${result.description || ''}`);
            }
          }
        } catch (e) {
          console.error(`Error scraping ${company}:`, e);
        }
      }
    }

    // Analyze each contact
    const contactAnalyses: ContactAnalysis[] = [];
    const allWorkTypes = new Set<string>();
    const allNaicsDescriptions = new Set<string>();
    
    for (const contact of (contactsToAnalyze || [])) {
      const matchedClient = findMatchingClient(contact.company);
      const naicsDesc = getNaicsDescription(contact.naics_codes);
      const webData = contact.company ? companyWebData.get(contact.company) : null;
      
      // Extract work types from matter names
      const workTypes: string[] = [];
      if (matchedClient) {
        for (const matter of matchedClient.matters) {
          if (matter.practiceArea) workTypes.push(matter.practiceArea);
          // Extract key terms from matter names
          const matterLower = matter.matterName.toLowerCase();
          if (matterLower.includes('ppa') || matterLower.includes('power purchase')) workTypes.push('PPA');
          if (matterLower.includes('m&a') || matterLower.includes('acquisition')) workTypes.push('M&A');
          if (matterLower.includes('project finance')) workTypes.push('Project Finance');
          if (matterLower.includes('nuclear')) workTypes.push('Nuclear');
          if (matterLower.includes('solar')) workTypes.push('Solar');
          if (matterLower.includes('wind')) workTypes.push('Wind');
          if (matterLower.includes('battery') || matterLower.includes('storage')) workTypes.push('Battery Storage');
          if (matterLower.includes('hydrogen')) workTypes.push('Hydrogen');
          if (matterLower.includes('lng') || matterLower.includes('gas')) workTypes.push('Gas');
          if (matterLower.includes('oil')) workTypes.push('Oil');
          if (matterLower.includes('mining')) workTypes.push('Mining');
          if (matterLower.includes('carbon') || matterLower.includes('ccs')) workTypes.push('Carbon');
          if (matterLower.includes('grid') || matterLower.includes('transmission')) workTypes.push('Grid');
        }
      }
      
      workTypes.forEach(wt => allWorkTypes.add(wt));
      if (naicsDesc) allNaicsDescriptions.add(naicsDesc);
      
      contactAnalyses.push({
        contactId: contact.id,
        fullName: contact.full_name,
        company: contact.company,
        naicsCodes: contact.naics_codes,
        naicsDescription: naicsDesc,
        linkedinUrl: contact.linkedin_url,
        matchedClient: matchedClient?.name || null,
        matterWorkTypes: [...new Set(workTypes)],
        webScrapeData: webData || null,
        suggestedFocusAreas: [], // Will be filled by AI
      });
    }

    // Now use AI to analyze and propose focus areas
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build summary for AI
    const analysisSummary = {
      totalContacts: contactAnalyses.length,
      companiesWithMatters: contactAnalyses.filter(c => c.matchedClient).length,
      naicsDescriptionsFound: [...allNaicsDescriptions],
      workTypesFromMatters: [...allWorkTypes],
      sampleContacts: contactAnalyses.slice(0, 20).map(c => ({
        company: c.company,
        naicsDescription: c.naicsDescription,
        matchedClient: c.matchedClient,
        workTypes: c.matterWorkTypes,
        webData: c.webScrapeData,
      })),
    };

    console.log('Sending to AI for analysis...');
    
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
            content: `You are an expert in the Energy, Mining & Infrastructure (EMI) legal sector. You help categorize clients and contacts into focus areas based on their industry and the type of legal work performed for them.

You will analyze contact data including:
- NAICS industry codes and descriptions
- Company names
- Matched clients and the legal matters we've worked on for them
- Web search results about companies

Based on this, propose a list of EMI Focus Areas that accurately captures the work types and industries. Focus areas should be specific enough to be useful but broad enough to group related contacts.

IMPORTANT: If we do specific work type for a client (like PPAs for a beverage company), the focus area should reflect the WORK TYPE, not the client's general industry.`
          },
          {
            role: 'user',
            content: `Analyze this data and propose a comprehensive list of EMI Focus Areas.

Data summary:
${JSON.stringify(analysisSummary, null, 2)}

Return a JSON response with:
1. "proposedFocusAreas": Array of focus area names (strings) - be specific and useful
2. "focusAreaDescriptions": Object mapping each focus area to a brief description
3. "analysisNotes": String explaining your reasoning`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'propose_focus_areas',
              description: 'Propose EMI focus areas based on analysis',
              parameters: {
                type: 'object',
                properties: {
                  proposedFocusAreas: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of proposed focus area names'
                  },
                  focusAreaDescriptions: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    description: 'Description for each focus area'
                  },
                  analysisNotes: {
                    type: 'string',
                    description: 'Explanation of the analysis and reasoning'
                  }
                },
                required: ['proposedFocusAreas', 'focusAreaDescriptions', 'analysisNotes']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'propose_focus_areas' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    let proposedFocusAreas: string[] = [];
    let focusAreaDescriptions: Record<string, string> = {};
    let analysisNotes = '';
    
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        proposedFocusAreas = parsed.proposedFocusAreas || [];
        focusAreaDescriptions = parsed.focusAreaDescriptions || {};
        analysisNotes = parsed.analysisNotes || '';
      }
    } catch (e) {
      console.error('Error parsing AI response:', e);
    }

    const result: AnalysisResult = {
      contacts: contactAnalyses,
      proposedFocusAreas,
      analysisDetails: analysisNotes,
    };

    console.log(`Analysis complete. Proposed ${proposedFocusAreas.length} focus areas`);

    return new Response(JSON.stringify({
      success: true,
      data: result,
      focusAreaDescriptions,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-focus-areas:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
