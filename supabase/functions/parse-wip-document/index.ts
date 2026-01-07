import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BudgetLineItem {
  id: string;
  work_item: string;
  category: string | null;
  fee_amount: number;
  provider: string;
  lc_firm_name: string | null;
}

interface ParsedWipItem {
  budget_line_item_id: string;
  work_item: string;
  wip_amount: number;
  confidence: 'high' | 'medium' | 'low';
  matched_text?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, budgetLineItems, currency } = await req.json();

    if (!content || !budgetLineItems || budgetLineItems.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Content and budget line items are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing WIP document for', budgetLineItems.length, 'line items');

    // Build context about the budget line items for the AI
    const lineItemsContext = budgetLineItems.map((item: BudgetLineItem, index: number) => ({
      index: index + 1,
      id: item.id,
      work_item: item.work_item,
      category: item.category,
      provider: item.provider,
      lc_firm_name: item.lc_firm_name,
      fee_amount: item.fee_amount,
    }));

    const systemPrompt = `You are an expert legal finance assistant specializing in analyzing Work In Progress (WIP) documents for law firms. Your task is to extract WIP amounts from the provided content and match them to the given budget line items.

CRITICAL INSTRUCTIONS:
1. Analyze the provided content carefully to identify WIP amounts (work in progress, unbilled time, accrued fees, etc.)
2. Match each identified WIP amount to the most appropriate budget line item based on:
   - Work description similarity
   - Category matching
   - Provider/firm name matching
   - Context clues
3. Be intelligent about variations in terminology (e.g., "Due Diligence" might match "DD Review", "Documentation" might match "Drafting agreements")
4. Handle various formats: tables, lists, paragraphs, summaries
5. Look for amounts in ${currency} or other currencies (convert mentally if obvious)
6. If a WIP item doesn't clearly match any budget line item, skip it
7. Never invent or guess amounts - only extract what's explicitly stated

BUDGET LINE ITEMS TO MATCH AGAINST:
${JSON.stringify(lineItemsContext, null, 2)}

RESPONSE FORMAT:
Return a JSON object with:
{
  "matches": [
    {
      "budget_line_item_id": "uuid-of-matched-item",
      "work_item": "description from budget",
      "wip_amount": 12500.00,
      "confidence": "high|medium|low",
      "matched_text": "relevant excerpt from the document"
    }
  ],
  "unmatched_items": [
    {
      "description": "item from document that couldn't be matched",
      "amount": 5000.00,
      "reason": "why it couldn't be matched"
    }
  ],
  "summary": "Brief summary of what was found and any notes"
}

CONFIDENCE LEVELS:
- high: Clear match with exact or very similar work description
- medium: Reasonable match based on category or partial description
- low: Best guess match, user should verify`;

    const userPrompt = `Please analyze the following WIP information and match it to the budget line items:

--- START OF WIP CONTENT ---
${content}
--- END OF WIP CONTENT ---

Extract all WIP amounts and match them to the appropriate budget line items. Return the results as JSON.`;

    // Call the Lovable AI gateway
    const response = await fetch('https://ai-gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', errorText);
      throw new Error(`AI gateway returned ${response.status}: ${errorText}`);
    }

    const aiResponse = await response.json();
    const content_response = aiResponse.choices?.[0]?.message?.content;

    if (!content_response) {
      throw new Error('No response from AI');
    }

    console.log('AI response received');

    // Parse the AI response
    let parsedResult;
    try {
      parsedResult = JSON.parse(content_response);
    } catch (e) {
      console.error('Failed to parse AI response:', content_response);
      throw new Error('Failed to parse AI response as JSON');
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches: parsedResult.matches || [],
        unmatched_items: parsedResult.unmatched_items || [],
        summary: parsedResult.summary || 'Analysis complete',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing WIP document:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse WIP document' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
