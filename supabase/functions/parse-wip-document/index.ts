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

    const systemPrompt = `You are an expert legal finance analyst. Your job is to AGGRESSIVELY extract EVERY monetary amount from WIP/fee documents and match them to budget line items.

CRITICAL PHILOSOPHY: BE MAXIMALLY AGGRESSIVE. The user will review, accept, amend, or reject your suggestions. It is BETTER to over-extract and propose uncertain matches than to miss anything. The user expects comprehensive extraction.

EXTRACT EVERYTHING:
- Every monetary amount you can find (fees, WIP, costs, totals, subtotals, line items)
- Amounts in tables, lists, paragraphs, headers, footers, summaries
- Even amounts that seem like subtotals or aggregates - extract them all
- Amounts with or without currency symbols
- Amounts formatted as 1,234.56 or 1234.56 or £1,234

MATCH AGGRESSIVELY:
1. If ANY part of the description matches, propose a match
2. Use abbreviations liberally: "DD" = Due Diligence, "SPA" = Share Purchase Agreement, "CP" = Conditions Precedent, "Docs" = Documentation
3. Match by category if the description is vague
4. Match by provider/firm name if mentioned
5. If something says "Legal fees" or "Professional fees" without specifics, match to the largest or most general budget item
6. If you see a total, try to match its components; if you only see the total, still report it
7. WHEN IN DOUBT, MAKE YOUR BEST GUESS with "low" confidence - let the user decide

NEVER SKIP AN AMOUNT. If you find an amount and cannot match it, put it in unmatched_items.

BUDGET LINE ITEMS TO MATCH:
${JSON.stringify(lineItemsContext, null, 2)}

JSON RESPONSE FORMAT:
{
  "matches": [
    {
      "budget_line_item_id": "uuid-from-list-above",
      "work_item": "work_item text from budget",
      "wip_amount": 12500.00,
      "confidence": "high|medium|low",
      "matched_text": "exact excerpt from document"
    }
  ],
  "unmatched_items": [
    {
      "description": "what was found in the document",
      "amount": 5000.00,
      "reason": "explanation"
    }
  ],
  "summary": "Found N total amounts. Matched M. Unmatched K."
}`;

    const userPrompt = `Extract EVERY monetary amount from this document. Be aggressive - the user will review all matches.

=== DOCUMENT ===
${content}
=== END ===

Extract ALL amounts. Match as many as possible. Put anything you can't match in unmatched_items. DO NOT SKIP ANYTHING.`;



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
