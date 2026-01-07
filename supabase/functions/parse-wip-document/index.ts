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

    const systemPrompt = `You are an expert legal finance analyst specializing in parsing Work In Progress (WIP) reports and fee statements for law firms. Your task is to meticulously extract EVERY fee/WIP amount from the provided document and match them to budget line items.

CRITICAL: BE THOROUGH - Extract ALL amounts, not just obvious ones.

YOUR TASK:
1. SCAN THE ENTIRE DOCUMENT for any monetary amounts, fees, WIP figures, time costs, or unbilled amounts
2. Look for amounts in TABLES, LISTS, PARAGRAPHS, SUMMARIES, TOTALS sections - everywhere
3. Common formats include:
   - Fee reports with work descriptions and amounts
   - Time sheets with hours × rates = fees
   - WIP aging reports
   - Matter summaries with multiple line items
   - Email excerpts mentioning amounts

MATCHING STRATEGY (be creative and flexible):
1. Direct matches: "Due Diligence" → "Due Diligence Review"
2. Abbreviation expansion: "DD" → "Due Diligence", "SPA" → "Share Purchase Agreement"  
3. Category/phase matching: "Phase 1 work" → items in "Pre-Closing" category
4. Provider matching: Firm names like "Local Counsel fees" → provider="Local Counsel"
5. Partial matches: "Drafting" → "Drafting and negotiation of agreements"
6. Semantic similarity: "Document review" ≈ "Documentation" ≈ "Reviewing documents"

IMPORTANT RULES:
- Extract amounts even if you're not 100% sure of the match - use "low" confidence
- If an amount could match multiple items, pick the best one
- Report ALL unmatched items so the user knows what couldn't be placed
- Numbers should be extracted as-is (e.g., 1,234.56 becomes 1234.56)
- Currency: The document may use ${currency} or other currencies - extract the number value

BUDGET LINE ITEMS TO MATCH AGAINST:
${JSON.stringify(lineItemsContext, null, 2)}

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "matches": [
    {
      "budget_line_item_id": "the-uuid-from-the-list-above",
      "work_item": "the work_item text from the budget",
      "wip_amount": 12500.00,
      "confidence": "high",
      "matched_text": "the exact text from the document that contained this amount"
    }
  ],
  "unmatched_items": [
    {
      "description": "description of the item from the document",
      "amount": 5000.00,
      "reason": "No matching budget line item found - appears to be [explanation]"
    }
  ],
  "summary": "Found X amounts in the document. Matched Y to budget items. Z items could not be matched because..."
}

CONFIDENCE LEVELS:
- "high": Exact or nearly exact description match
- "medium": Good semantic match, same category, or clear intent
- "low": Best guess - the amount exists and this is the most likely match`;

    const userPrompt = `THOROUGHLY analyze this WIP/fee document and extract EVERY monetary amount you can find:

=== DOCUMENT START ===
${content}
=== DOCUMENT END ===

Remember: Extract ALL amounts. Match as many as possible to the budget items. Report anything you cannot match in unmatched_items. Be comprehensive!`;


    // Call the Lovable AI gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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

    // Parse the AI response - strip markdown code blocks if present
    let parsedResult;
    try {
      let jsonContent = content_response.trim();
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }
      jsonContent = jsonContent.trim();
      
      parsedResult = JSON.parse(jsonContent);
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
