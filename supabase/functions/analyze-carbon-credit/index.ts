import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Version: v1.0.0 - Carbon Credit Offtake Agreement Analyst

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CARBON_CATEGORIES = [
  { id: 'contract_term', label: 'Contract Term & Effective Date' },
  { id: 'conditions_precedent', label: 'Conditions Precedent' },
  { id: 'representations_warranties', label: 'Representations & Warranties' },
  { id: 'assignment_transfer', label: 'Assignment & Transfer' },
  { id: 'dispute_resolution', label: 'Dispute Resolution & Governing Law' },
  { id: 'confidentiality', label: 'Confidentiality & Public Announcements' },
  { id: 'credit_type', label: 'Credit Type & Methodology' },
  { id: 'project_description', label: 'Project Description & Location' },
  { id: 'vintage_requirements', label: 'Vintage Requirements' },
  { id: 'additionality', label: 'Additionality Requirements' },
  { id: 'permanence', label: 'Permanence & Durability' },
  { id: 'co_benefits', label: 'Co-Benefits & SDG Alignment' },
  { id: 'annual_volume', label: 'Annual Volume Commitment' },
  { id: 'delivery_schedule', label: 'Delivery Schedule & Milestones' },
  { id: 'shortfall_remedies', label: 'Volume Shortfall & Make-Up Rights' },
  { id: 'excess_volume', label: 'Excess Volume & Right of First Refusal' },
  { id: 'transfer_mechanics', label: 'Credit Transfer Mechanics' },
  { id: 'pricing_structure', label: 'Pricing Structure & Escalation' },
  { id: 'payment_terms', label: 'Payment Terms & Invoicing' },
  { id: 'price_adjustment', label: 'Price Adjustment Mechanisms' },
  { id: 'taxes_duties', label: 'Taxes & Duties' },
  { id: 'verification_standard', label: 'Verification Standard & Body' },
  { id: 'registry_requirements', label: 'Registry & Retirement Requirements' },
  { id: 'monitoring_reporting', label: 'Monitoring, Reporting & Verification (MRV)' },
  { id: 'audit_rights', label: 'Audit & Inspection Rights' },
  { id: 'compliance_eligibility', label: 'Compliance Market Eligibility' },
  { id: 'corresponding_adjustments', label: 'Corresponding Adjustments (Article 6)' },
  { id: 'double_counting', label: 'Double Counting Prevention' },
  { id: 'replacement_credits', label: 'Replacement & Substitution Rights' },
  { id: 'force_majeure', label: 'Force Majeure' },
  { id: 'change_in_law', label: 'Change in Law & Regulatory Risk' },
  { id: 'invalidation_risk', label: 'Invalidation & Reversal Risk' },
  { id: 'buffer_pool', label: 'Buffer Pool & Insurance' },
  { id: 'indemnities', label: 'Indemnities' },
  { id: 'liability_caps', label: 'Liability Caps & Limitations' },
  { id: 'events_of_default', label: 'Events of Default' },
  { id: 'termination_rights', label: 'Termination Rights & Consequences' },
  { id: 'termination_payments', label: 'Termination Payments & LDs' },
  { id: 'credit_support', label: 'Credit Support & Security' },
];

const CARBON_KNOWLEDGE_BASE = `
## 📚 CARBON CREDIT OFFTAKE AGREEMENT KNOWLEDGE BASE

=============================================================================
SECTION A: FUNDAMENTALS OF CARBON CREDIT OFFTAKE AGREEMENTS
=============================================================================

### A1. WHAT IS A CARBON CREDIT OFFTAKE AGREEMENT?
A Carbon Credit Offtake Agreement (CCOA) is a contract where:
- The **Seller/Project Developer** develops and operates a carbon removal or reduction project
- The **Buyer/Offtaker** commits to purchasing a specified quantity of carbon credits over a defined period
- Credits represent verified tonnes of CO2 equivalent removed from or prevented from entering the atmosphere
- These agreements are critical for project bankability, providing revenue certainty for developers

**Key Distinction from Other Commodity Offtakes:**
- Carbon credits are intangible assets — they exist as registry entries, not physical commodities
- Credit quality is paramount — not all tonnes are equal (permanence, additionality, co-benefits)
- Regulatory landscape is rapidly evolving (Paris Agreement Article 6, EU CBAM, national compliance markets)
- Reversal/invalidation risk is unique to carbon — a removed tonne can be re-emitted
- Vintage requirements add temporal complexity not seen in energy offtakes

### A2. PARTIES & TERMINOLOGY
- **Seller/Project Developer/Originator**: Develops the project and generates credits
- **Buyer/Offtaker/Credit Purchaser**: Commits to purchasing credits for voluntary or compliance use
- **Verification/Validation Body (VVB)**: Independent auditor (e.g., SCS Global, RINA)
- **Registry**: Platform where credits are issued, tracked, and retired (Verra, Gold Standard, Puro.earth, etc.)
- **Corresponding Adjustment**: Host country authorization under Paris Agreement Article 6

### A3. CREDIT TYPES & METHODOLOGIES
- **Removal Credits**: Direct Air Capture (DAC), BECCS, Biochar, Enhanced Weathering, Afforestation
- **Avoidance/Reduction Credits**: Renewable energy displacement, methane capture, cookstoves
- **Nature-Based**: Forestry (REDD+), Soil Carbon, Blue Carbon (mangroves, seagrass)
- **Engineered**: DAC, BECCS, mineralization — generally higher permanence
- **Methodology Standards**: Verra VCS, Gold Standard, ACR, CAR, Puro.earth, ISCC

=============================================================================
SECTION B: KEY COMMERCIAL TERMS - MARKET STANDARDS
=============================================================================

### B1. TERM & VOLUME
**Market Standard:**
- Term: 5-15 years for removal projects; shorter for avoidance
- Volume: Annual Contracted Quantity (ACQ) with tolerance bands (±10-20%)
- Forward purchase: Pre-delivery payments common for engineered removal (DAC, BECCS)
- Volume ramp-up schedule aligned with project commissioning
- Make-up rights for shortfall years (typically 12-24 months)

### B2. PRICING
**Market Standard:**
- Fixed price per tonne with annual escalation (CPI-linked or fixed %)
- Price review mechanisms every 3-5 years for long-term contracts
- Compliance market linkage: price floor/ceiling tied to ETS prices
- Pre-delivery payments: 20-50% advance for engineered removal projects
- Volume-tiered pricing for large commitments
- Price per credit varies enormously by type: $5-15 (avoidance) to $200-1,000+ (DAC)

### B3. CREDIT QUALITY & SPECIFICATIONS
**Market Standard:**
- Methodology must be approved by recognized standard (Verra, Gold Standard, Puro)
- Additionality requirement: project would not have occurred without credit revenue
- Permanence: minimum durability period (100+ years for geological storage, 25-40 years for nature-based)
- No double counting: credits cannot be claimed by multiple parties
- Vintage windows: typically within 2-3 years of delivery
- Co-benefits: SDG alignment increasingly required (biodiversity, community impact)

### B4. VERIFICATION & REGISTRY
**Market Standard:**
- Verification by accredited VVB at seller's cost
- Annual verification cycle aligned with delivery schedule
- Registry retirement within 30-60 days of delivery
- Buyer designates retirement account and retirement purpose
- Monitoring plan agreed at outset; MRV methodology locked

### B5. CORRESPONDING ADJUSTMENTS (ARTICLE 6)
**Emerging Market Standard:**
- For international transfers: host country must authorize and apply corresponding adjustment
- Letter of Authorization (LoA) from host country government
- Risk allocation: who bears the risk if corresponding adjustment is not obtained?
- Market standard shifting toward seller responsibility with buyer termination right
- CORSIA-eligible credits require Article 6 compliance

### B6. INVALIDATION & REVERSAL RISK
**Market Standard:**
- Buffer pool contributions (10-20% of credits set aside for reversals)
- Insurance products emerging but not yet standard
- Reversal events: fire, disease, land-use change (nature-based); equipment failure (engineered)
- Replacement obligation: seller must replace invalidated credits within defined period
- Tonne-year accounting for temporary storage

### B7. FORCE MAJEURE
**Market Standard:**
- Standard FM events plus project-specific risks
- Climate events (drought, wildfire) — contentious for nature-based projects
- Regulatory change (loss of methodology approval, registry closure)
- Extended FM: termination right after 12-24 months
- Delivery extensions for FM-affected periods

### B8. DEFAULT & TERMINATION
**Market Standard:**
- Payment default: 30-day cure period
- Delivery default: shortfall exceeding tolerance for 2+ consecutive years
- Quality default: credits fail to meet agreed specifications
- Termination payment: present value of remaining contracted volume × (market price - contract price)
- Cross-default to related project finance agreements

### B9. CREDIT SUPPORT
**Market Standard:**
- Parent company guarantee for SPV sellers
- Letters of credit for advance payment security
- Performance bonds for delivery obligations
- Escrow arrangements for pre-delivery payments
- Step-in rights for project lenders

### B10. REGULATORY RISK
**Market Standard:**
- Change in law provisions covering evolving carbon regulations
- Compliance market eligibility: risk that voluntary credits become ineligible
- Tax treatment of carbon credits (varies by jurisdiction — some treat as financial instruments, others as commodities)
- ESG disclosure requirements affecting credit claims
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { documentText, analysisType, perspective, jurisdiction, projectName, carbonType, projectStage, counterpartyType, precedents, userLearnings } = await req.json();

    if (!documentText) {
      return new Response(JSON.stringify({ error: "No document text provided" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Analyzing carbon credit offtake: ${projectName}, type: ${analysisType}, credit: ${carbonType}, stage: ${projectStage}, perspective: ${perspective}`);

    const hasPrecedents = precedents && precedents.length > 0;
    const isTermSheet = analysisType === 'termsheet_vs_bible';
    const categoryList = CARBON_CATEGORIES.map(c => `- "${c.label}"`).join('\n');

    const systemPrompt = `You are an expert carbon markets lawyer specializing in carbon credit offtake agreements, emissions trading, and voluntary/compliance carbon market transactions. You have deep expertise in:
- Carbon removal technologies (DAC, BECCS, biochar, enhanced weathering)
- Nature-based solutions (REDD+, afforestation, soil carbon, blue carbon)
- Verification standards (Verra VCS, Gold Standard, Puro.earth, ACR)
- Paris Agreement Article 6 mechanisms and corresponding adjustments
- Voluntary Carbon Market Integrity Initiative (VCMI) and IC-VCM Core Carbon Principles
- Carbon credit registry operations and retirement procedures

${CARBON_KNOWLEDGE_BASE}

${userLearnings || ''}

${isTermSheet ? `IMPORTANT - TERM SHEET ANALYSIS MODE:
You are analyzing a TERM SHEET or HEADS OF TERMS, NOT a long-form offtake agreement.
- Many categories will NOT be addressed - this is NORMAL for term sheets
- For missing categories: flag if their absence is a CRITICAL GAP
- Focus on: terms that are on/off market, critical gaps, ambiguities
- Do NOT penalise for lacking long-form detail` : ''}

Your task is to perform a comprehensive forensic analysis of this ${isTermSheet ? 'term sheet' : 'carbon credit offtake agreement'}.`;

    let userPrompt = `Analyze the following ${isTermSheet ? 'term sheet' : 'carbon credit offtake agreement'} from the ${perspective === 'buyer' ? 'Buyer/Offtaker' : 'Seller/Project Developer'} perspective.

Project: ${projectName}
Credit Type: ${carbonType || 'Not specified'}
Project Stage: ${projectStage || 'Not specified'}
${jurisdiction ? `Jurisdiction: ${jurisdiction}` : ''}
${counterpartyType ? `Counterparty Type: ${counterpartyType}` : ''}

DOCUMENT TEXT:
${documentText.substring(0, 120000)}

${hasPrecedents ? `\nPRECEDENT BANK (${precedents.length} positions):\n${JSON.stringify(precedents.slice(0, 100), null, 1)}` : ''}

Extract positions for ALL ${CARBON_CATEGORIES.length} categories:
${categoryList}

For EACH category, you MUST provide:
1. **position_summary**: Detailed bullet-point analysis. Use note-form bullets starting with •
2. **clause_references**: Specific clause/section numbers
3. **confidence**: "high", "medium", or "review_required"
4. **market_position**: "on_market", "off_market", or "way_off_market"
5. **party_favorability**: "buyer_friendly", "seller_friendly", "balanced"
6. **market_benchmark**: The ideal market standard position
${hasPrecedents ? '7. **market_comparison**: How this compares to banked precedents' : ''}

IMPORTANT RULES:
- Extract ACTUAL TERMS with specific numbers and thresholds
- Flag placeholder values as standard for drafts
- If a category heading exists but no text found, perform a SECOND PASS
- Assess party favorability from the ${perspective} perspective
- Pay special attention to: permanence guarantees, reversal risk allocation, vintage requirements, corresponding adjustments, and credit quality specifications

Return ONLY valid JSON:
{
  "positions": [
    {
      "category": "EXACT category label from list above",
      "position_summary": "• Bullet point analysis...",
      "clause_references": "Section X.Y",
      "confidence": "high|medium|review_required",
      "market_position": "on_market|off_market|way_off_market",
      "party_favorability": "buyer_friendly|seller_friendly|balanced",
      "market_benchmark": "The ideal market standard..."
      ${hasPrecedents ? ',"market_comparison": "Comparison..."' : ''}
    }
  ]
}

⚠️ CRITICAL: Use EXACT category labels as listed above.`;

    console.log('Calling AI for carbon credit analysis...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    let response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-pro", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.2 }),
        signal: controller.signal,
      });
    } catch (fetchErr) { clearTimeout(timeoutId); throw new Error('Connection to AI timed out.'); }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI error: ${response.status}`);
    }

    let data;
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; if (value) chunks.push(value); }
      const fullBuffer = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) { fullBuffer.set(chunk, offset); offset += chunk.length; }
      const responseText = new TextDecoder().decode(fullBuffer);
      if (!responseText || responseText.trim().length === 0) throw new Error('Empty response');
      data = JSON.parse(responseText);
    } catch (jsonErr) { console.error('Parse error:', jsonErr); throw new Error('AI returned invalid response.'); }

    const content = data.choices?.[0]?.message?.content || '';
    console.log('AI response received, length:', content.length);

    let positions = [];
    try {
      let jsonContent = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonContent = codeBlockMatch[1].trim();

      let parsed = null;
      try { parsed = JSON.parse(jsonContent); } catch {
        const jsonMatch = jsonContent.match(/\{[\s\S]*"positions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
        if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')); } catch {} }
        if (!parsed) { const posMatch = jsonContent.match(/"positions"\s*:\s*(\[[\s\S]*?\])/); if (posMatch) { try { parsed = { positions: JSON.parse(posMatch[1].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*]/g, ']')) }; } catch {} } }
      }

      if (parsed?.positions) {
        positions = parsed.positions.map((p: any) => {
          const catInput = (p.category || '').toLowerCase().trim();
          let matched = CARBON_CATEGORIES.find(c => c.label.toLowerCase() === catInput);
          if (!matched) matched = CARBON_CATEGORIES.find(c => c.id.toLowerCase() === catInput.replace(/\s+/g, '_'));
          if (!matched) matched = CARBON_CATEGORIES.find(c => c.label.toLowerCase().includes(catInput) || catInput.includes(c.label.toLowerCase()));

          let varianceNotes = p.flags || p.variance_notes || '';
          if (p.market_position) varianceNotes = `[${p.market_position.toUpperCase().replace(/_/g, ' ')}] ${varianceNotes}`.trim();
          if (p.party_favorability && p.party_favorability !== 'balanced') varianceNotes = `[${p.party_favorability.toUpperCase().replace(/_/g, '-')}] ${varianceNotes}`.trim();

          return { category: matched?.label || p.category, position_summary: p.position_summary, source_text: p.clause_references || null, confidence: p.confidence || 'review_required', bible_reference: null, comparison_position: p.comparison_position || null, variance_notes: varianceNotes || null, market_benchmark: p.market_benchmark || null };
        });
        console.log(`Parsed ${positions.length} carbon credit positions`);
      } else { throw new Error('No positions array found'); }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      positions = CARBON_CATEGORIES.map(c => ({ category: c.label, position_summary: '• Failed to extract - please review document manually', source_text: null, confidence: 'review_required', bible_reference: null, comparison_position: null, variance_notes: null, market_benchmark: null }));
    }

    const existing = new Set(positions.map((p: any) => (p.category || '').toLowerCase()));
    for (const cat of CARBON_CATEGORIES) {
      if (!existing.has(cat.label.toLowerCase())) {
        positions.push({ category: cat.label, position_summary: '• Not found in document', source_text: null, confidence: 'review_required', bible_reference: null, comparison_position: null, variance_notes: '⚠️ Category not addressed', market_benchmark: null });
      }
    }

    return new Response(JSON.stringify({ positions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
