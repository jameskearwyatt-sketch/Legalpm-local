import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Version: v1.0.0 - Tolling Agreement Analyst

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tolling-specific categories
const TOLLING_CATEGORIES = [
  { id: 'contract_term', label: 'Contract Term & Effective Date' },
  { id: 'conditions_precedent', label: 'Conditions Precedent' },
  { id: 'representations_warranties', label: 'Representations & Warranties' },
  { id: 'assignment_transfer', label: 'Assignment & Transfer' },
  { id: 'dispute_resolution', label: 'Dispute Resolution' },
  { id: 'dependable_capacity', label: 'Dependable Capacity' },
  { id: 'availability_guarantee', label: 'Availability Guarantee' },
  { id: 'capacity_testing', label: 'Capacity Testing & Adjustments' },
  { id: 'outages_maintenance', label: 'Outages & Scheduled Maintenance' },
  { id: 'fuel_supply_delivery', label: 'Fuel Supply & Delivery' },
  { id: 'fuel_specifications', label: 'Fuel Specifications & Quality' },
  { id: 'heat_rate_guarantee', label: 'Heat Rate Guarantee' },
  { id: 'fuel_conversion_services', label: 'Fuel Conversion Services' },
  { id: 'dispatch_rights', label: 'Dispatch Rights & Exclusivity' },
  { id: 'dispatch_procedures', label: 'Dispatch Procedures & Notices' },
  { id: 'ancillary_services', label: 'Ancillary Services' },
  { id: 'metering_measurement', label: 'Metering & Measurement' },
  { id: 'facility_utilization', label: 'Facility Utilization Planning' },
  { id: 'environmental_compliance', label: 'Environmental Compliance' },
  { id: 'fixed_capacity_payment', label: 'Fixed Capacity Payment' },
  { id: 'variable_energy_payment', label: 'Variable Energy Payment' },
  { id: 'start_up_charges', label: 'Start-Up Charges' },
  { id: 'payment_billing', label: 'Payment & Billing Terms' },
  { id: 'taxes_duties', label: 'Taxes & Duties' },
  { id: 'credit_support', label: 'Credit Support & Security' },
  { id: 'lender_consent', label: 'Lender Consent & Financing' },
  { id: 'insurance', label: 'Insurance Requirements' },
  { id: 'force_majeure', label: 'Force Majeure' },
  { id: 'change_in_law', label: 'Change in Law' },
  { id: 'default_termination', label: 'Default & Termination' },
  { id: 'termination_payments', label: 'Termination Payments & LDs' },
  { id: 'indemnities', label: 'Indemnities' },
  { id: 'liability_caps', label: 'Liability Caps & Limitations' },
];

const TOLLING_KNOWLEDGE_BASE = `
## 📚 TOLLING AGREEMENT KNOWLEDGE BASE - GAS CCGT FOCUS

=============================================================================
SECTION A: FUNDAMENTAL TOLLING STRUCTURE
=============================================================================

### A1. WHAT IS A TOLLING AGREEMENT?
A Capacity Sale and Tolling Agreement (CSTA) is a contract where:
- The **Generator/COGEN** owns and operates a power generation facility
- The **Offtaker/Power Marketing Company (POWER CO)** supplies fuel and receives all output
- The Generator provides "Fuel Conversion Services" - converting fuel into electricity
- This is NOT a simple power purchase - the Offtaker controls dispatch and fuel supply

**Key Distinction from PPAs:**
- In a PPA, the generator manages fuel and sells electricity
- In a tolling arrangement, the offtaker supplies fuel and the generator converts it
- The offtaker has exclusive dispatch rights and control over marketing
- Payment structure reflects this: Fixed Capacity Payments + Variable Energy Payments

### A2. PARTIES & TERMINOLOGY
- **COGEN/Generator/Tolling Provider**: Owns facility, provides conversion services
- **POWER CO/Offtaker/Tolling Customer**: Supplies fuel, receives output, markets electricity
- **Facility Lender**: Debt provider with step-in rights via Consent and Agreement
- **Independent Engineer**: Technical expert for dispute resolution on performance matters
- **Transporter**: Gas pipeline company delivering fuel to the facility

### A3. GAS CCGT SPECIFIC CONSIDERATIONS
Combined Cycle Gas Turbine (CCGT) facilities have unique characteristics:
- **Dual fuel capability**: Primary gas + secondary fuel oil (No. 2 low sulfur)
- **Start-up types**: Cold Start (longest), Warm Start, Hot Start - each with different lead times and costs
- **Heat Rate**: Critical performance metric (Btu/kWh) - measures conversion efficiency
- **Station service**: Facility's own electricity consumption (excluded from market output)
- **Cogeneration**: May produce both electricity AND steam (Market Steam)
- **Minimum generation capacity**: Cannot operate below certain MW threshold
- **Ramp rates**: Physical constraints on how quickly output can change

=============================================================================
SECTION B: KEY COMMERCIAL TERMS - MARKET STANDARDS
=============================================================================

### B1. TERM & CONDITIONS PRECEDENT
**Market Standard:**
- Term should extend beyond maturity of facility debt
- Effective Date triggered by satisfaction of CPs (not signing date)
- CPs typically include: permits, interconnection, fuel supply arrangements, lender consent
- Long-stop date for CP satisfaction (termination right if not met)

### B2. CAPACITY & AVAILABILITY
**Dependable Capacity:**
- Net dependable capacity (MW) specified by season (summer/winter ratings may differ)
- Generator must not permit reduction during Term
- Capacity adjusted for steam production

**Availability Guarantee (Market Standard):**
- Monthly On-Peak Dispatch Availability guarantees
- Typical range: 90-97% depending on facility age and technology
- Off-Peak availability: "reasonable efforts" standard (no guarantee)
- Failure triggers Availability Adjustment to Fixed Payment
- Cumulative shortfall may trigger termination right for Offtaker

### B3. FUEL SUPPLY
**Gas (Primary Fuel):**
- Offtaker responsible for procurement, scheduling, and transportation
- Gas must meet Fuel Specifications at Delivery Point
- Generator may reject non-conforming gas
- Measurement per delivering Transporter procedures

**Fuel Oil (Secondary):**
- Offtaker may elect to supply fuel oil as secondary fuel
- Generator responsible for storage and maintenance after receipt
- Heat Rate Guarantee adjusted for fuel oil operation
- Subject to existing facility permits

### B4. HEAT RATE GUARANTEE
**Market Standard:**
- Annual average Heat Rate guarantee (Btu/kWh on HHV basis)
- Measured On-Peak hours only, gas-fired operation
- Adjusted for fuel oil usage and steam production
- Excess fuel consumption creates payment obligation: Generator reimburses for excess Gas
- Calculated annually, determination within 30 days of Contract Year end
- 10-day dispute window after determination

### B5. DISPATCH
**Dispatch Rights:**
- Offtaker has EXCLUSIVE right to dispatch facility
- Generator cannot dispatch for third parties
- Dispatch within operational limits per Facility Operating Procedures
- Dispatch Notice specifies capacity levels (min generation to dependable capacity)
- Minimum Dispatch Periods after starts: 2 hours (Cold Start), 1 hour (Hot Start)

**Facility Utilization Plan:**
- Annual forecasting plan submitted by Offtaker (120 days before Contract Year)
- Monthly updates; weekly updates during peak months
- For informational purposes only - does not limit dispatch rights

### B6. PRICING STRUCTURE
**Fixed Market Output Payment (Capacity Charge):**
- Monthly payment for making capacity available
- Designed to cover: debt service, amortization, Fixed O&M, return on equity
- Subject to Availability Adjustment for shortfall
- NOT payable during Force Majeure affecting Generator

**Variable Energy Payment:**
- Per-unit payment tied to actual generation
- Covers: fuel costs (pass-through), variable O&M
- Start-Up Fees: Cold Start > Warm Start > Hot Start pricing
- Additional Start-up Fee for excess starts beyond permitted limits

**Market Standard Payment Terms:**
- Monthly billing cycle
- Payment within 20 business days
- Late payment at Delayed Payment Rate (prime + 2%)
- Right to offset undisputed amounts
- 2-year audit window

### B7. CREDIT & SECURITY
**Market Standard:**
- Lender Consent and Agreement (tripartite)
- Generator may collaterally assign to Facility Lender without consent
- Assignment to successor by merger/acquisition without consent
- All other assignments require consent

### B8. FORCE MAJEURE
**Standard Definition:**
- Beyond reasonable control, not due to fault/negligence
- Could not have been avoided by due diligence
- Includes: natural disasters, war, strikes, government actions, changes in law
- Generator-specific: failure of Offtaker to deliver conforming fuel

**Key Exclusions:**
- Loss of FERC marketer status (unless caused by FM)
- Economic hardship / market conditions
- Offtaker not obligated to pay Fixed Payment during Generator FM

**Extended FM:**
- If FM continues beyond [X] months, either party may terminate
- 30 days written notice after extended FM period

### B9. DEFAULT & TERMINATION
**Events of Default (Market Standard):**
1. Bankruptcy
2. Failure to pay undisputed amounts (30-day cure)
3. Material breach (30-day cure, extendable to 90 days)
4. Material rep/warranty breach (30-day cure, extendable to 90 days)
5. Failure to comply with dispute resolution outcome (30-day cure)

**Special Termination by Offtaker:**
- Availability shortfall exceeding threshold
- Generator has one-time voidance right (Years 1-7 and 8-15)
- Independent Engineer determines cause of shortfall
- Liquidated damages if shortfall caused by gross negligence/willful misconduct

**Optional Termination by Offtaker:**
- Termination for convenience with payment of:
  1. All amounts due for services rendered
  2. Outstanding Facility Debt principal
  3. Breakage costs (interest rate swaps, prepayment penalties)

### B10. LIABILITY
**Market Standard Limitations:**
- Annual liability cap: Fixed Market Output Payment for that Contract Year
- Performance liability subcap: 10% of annual Fixed Payment
- Termination LD cap: Additional Fixed Payment for year of termination
- Mutual waiver of consequential damages (lost profits, lost revenue)
- Carve-outs from waiver: express payment obligations in Agreement

### B11. INDEMNITIES
**Market Standard Structure:**
- Mutual general indemnity (breach, violation of law, equipment/facility failure)
- Exception for willful misconduct or gross negligence of indemnified party
- Environmental indemnity by Generator (facility site environmental conditions)
- Tax indemnity split: Offtaker (fuel transport, output delivery), Generator (facility, income)
- Employee claims: not limited by workers' comp
- 2-year survival post-termination

### B12. INSURANCE
**Generator Insurance Requirements:**
- "A" rated or better by Best's Insurance Guide
- Offtaker named as additional insured
- Primary insurance (not contributory with Offtaker's)
- 30 days notice of cancellation (10 days for non-payment)
- Subrogation waiver against Offtaker
- Reasonable deductibles; shared if Offtaker at fault

### B13. DISPUTE RESOLUTION
**Multi-tier Process:**
1. CEO negotiation (30 days)
2. Board Chairman negotiation (15 days)
3. Technical disputes: Independent Engineer consideration
4. Binding arbitration (AAA rules, 3 arbitrators)
- Appeal rights preserved for conclusions of law
- No authority to modify Agreement terms
- Costs: each party bears own costs; third arbitrator shared

=============================================================================
SECTION C: BAKER MCKENZIE DRAFTING INSIGHTS
=============================================================================

### C1. STRUCTURAL SAFEGUARDS
- Exclusive nature clause prevents Generator from dealing with third parties
- Capacity cannot be reduced during Term
- Facility assets restricted to facility-related purposes only
- Compliance with law covenants by both parties

### C2. LENDER PROTECTION
- Consent and Agreement protects lender step-in rights
- Lender notice before termination for Generator default
- Collateral assignment without consent
- Termination payments cover outstanding Facility Debt

### C3. PERFORMANCE REGIME
- Availability Adjustment is sole remedy for capacity shortfall (except termination)
- Heat Rate Guarantee with annual true-up mechanism
- Start-up charges incentivize efficient dispatch
- Minimum run times prevent uneconomic cycling

### C4. RISK ALLOCATION PRINCIPLES
- Generator bears: facility performance, environmental compliance, maintenance
- Offtaker bears: fuel supply, transmission, marketing, fuel quality
- Shared: Force Majeure (neither party bears), Change in Law (varies)
- Key negotiation: who bears risk of government/regulatory change?
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const {
      tollingText,
      comparisonText,
      analysisType,
      perspective,
      jurisdiction,
      projectName,
      tollingType,
      counterpartyType,
      precedents,
      goldStandardPrecedents,
      userLearnings,
    } = await req.json();

    if (!tollingText) {
      return new Response(
        JSON.stringify({ error: "No document text provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing tolling agreement: ${projectName}, type: ${analysisType}, perspective: ${perspective}`);

    const hasPrecedents = precedents && precedents.length > 0;
    const hasGoldStandard = goldStandardPrecedents && goldStandardPrecedents.length > 0;

    const categoryList = TOLLING_CATEGORIES.map(c => `- "${c.label}"`).join('\n');

    const systemPrompt = `You are an expert energy lawyer specializing in gas-fired power tolling agreements, capacity sale agreements, and fuel conversion services contracts. You have deep expertise in CCGT project finance structures.

${TOLLING_KNOWLEDGE_BASE}

${userLearnings || ''}

Your task is to perform a comprehensive forensic analysis of this tolling agreement.`;

    let userPrompt = `Analyze the following ${analysisType === 'tolling_vs_bible' ? 'tolling agreement' : 'term sheet'} from the ${perspective === 'offtaker' ? 'Offtaker/Power Co' : 'Generator/COGEN'} perspective.

Project: ${projectName}
${jurisdiction ? `Jurisdiction: ${jurisdiction}` : ''}
${tollingType ? `Facility Type: ${tollingType}` : ''}
${counterpartyType ? `Counterparty Type: ${counterpartyType}` : ''}

DOCUMENT TEXT:
${tollingText.substring(0, 120000)}

${comparisonText ? `\nCOMPARISON DOCUMENT:\n${comparisonText.substring(0, 50000)}` : ''}

${hasPrecedents ? `\nPRECEDENT BANK (${precedents.length} positions from previous deals):\n${JSON.stringify(precedents.slice(0, 100), null, 1)}` : ''}

${hasGoldStandard ? `\nGOLD STANDARD TEMPLATE POSITIONS:\n${JSON.stringify(goldStandardPrecedents.slice(0, 50), null, 1)}` : ''}

Extract positions for ALL ${TOLLING_CATEGORIES.length} categories:
${categoryList}

For EACH category, you MUST provide:
1. **position_summary**: Detailed bullet-point analysis of the actual terms found (not just "terms exist"). Use note-form bullets starting with •
2. **clause_references**: Specific clause/section numbers referenced
3. **confidence**: "high" (clear drafting found), "medium" (inferred or partial), "review_required" (not found/unclear)
4. **market_position**: "on_market", "off_market", or "way_off_market" based on market standards
5. **party_favorability**: "offtaker_friendly", "generator_friendly", "balanced"
6. **market_benchmark**: The IDEAL market standard position for this provision (always provide this regardless of what the document says)
${hasPrecedents ? '7. **market_comparison**: How this compares to banked precedents' : ''}
${hasGoldStandard ? '8. **gold_standard_deviation**: true/false - does this deviate from BM template?\n9. **gold_standard_comparison**: Explanation of deviation or null' : ''}

IMPORTANT ANALYSIS RULES:
- Extract ACTUAL TERMS with specific numbers, thresholds, and conditions
- Flag placeholder values ([brackets], TBD) as standard for drafts - do NOT treat as gaps
- If a category heading exists but no text found, perform a SECOND PASS before marking as missing
- For ${analysisType === 'tolling_vs_termsheet' ? 'term sheets' : 'full agreements'}, adjust expectations accordingly
- Assess party favorability from the ${perspective} perspective

Return ONLY valid JSON:
{
  "positions": [
    {
      "category": "EXACT category label from list above",
      "position_summary": "• Bullet point analysis...",
      "clause_references": "Section X.Y",
      "confidence": "high|medium|review_required",
      "market_position": "on_market|off_market|way_off_market",
      "party_favorability": "offtaker_friendly|generator_friendly|balanced",
      "market_benchmark": "The ideal market standard..."
      ${hasPrecedents ? ',"market_comparison": "Comparison to precedents..."' : ''}
      ${hasGoldStandard ? ',"gold_standard_deviation": false, "gold_standard_comparison": null' : ''}
    }
  ]
}

⚠️ CRITICAL - CATEGORY NAMING: Use EXACT category labels as listed above. Do NOT use snake_case IDs.`;

    console.log('Calling AI for tolling analysis...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('AI response received, parsing...');

    let positions = [];
    try {
      let jsonContent = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonContent = codeBlockMatch[1].trim();

      let parsed = null;
      try { parsed = JSON.parse(jsonContent); } catch {
        const jsonMatch = jsonContent.match(/\{[\s\S]*"positions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
        if (jsonMatch) {
          const clean = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          try { parsed = JSON.parse(clean); } catch {}
        }
        if (!parsed) {
          const posMatch = jsonContent.match(/"positions"\s*:\s*(\[[\s\S]*?\])/);
          if (posMatch) {
            try { parsed = { positions: JSON.parse(posMatch[1].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*]/g, ']')) }; } catch {}
          }
        }
      }

      if (parsed?.positions) {
        positions = parsed.positions.map((p: any) => {
          const catInput = (p.category || '').toLowerCase().trim();
          let matched = TOLLING_CATEGORIES.find(c => c.label.toLowerCase() === catInput);
          if (!matched) matched = TOLLING_CATEGORIES.find(c => c.id.toLowerCase() === catInput.replace(/\s+/g, '_'));
          if (!matched) matched = TOLLING_CATEGORIES.find(c => c.label.toLowerCase().includes(catInput) || catInput.includes(c.label.toLowerCase()));

          let varianceNotes = p.flags || p.variance_notes || '';
          if (p.market_position) varianceNotes = `[${p.market_position.toUpperCase().replace(/_/g, ' ')}] ${varianceNotes}`.trim();
          if (p.party_favorability && p.party_favorability !== 'balanced') {
            varianceNotes = `[${p.party_favorability.toUpperCase().replace(/_/g, '-')}] ${varianceNotes}`.trim();
          }

          return {
            category: matched?.label || p.category,
            position_summary: p.position_summary,
            source_text: p.clause_references || null,
            confidence: p.confidence || 'review_required',
            bible_reference: null,
            comparison_position: p.comparison_position || null,
            variance_notes: varianceNotes || null,
            market_benchmark: p.market_benchmark || null,
          };
        });
        console.log(`Parsed ${positions.length} tolling positions`);
      } else {
        throw new Error('No positions array found');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      positions = TOLLING_CATEGORIES.map(c => ({
        category: c.label,
        position_summary: '• Failed to extract - please review document manually',
        source_text: null,
        confidence: 'review_required',
        bible_reference: null,
        comparison_position: null,
        variance_notes: null,
        market_benchmark: null,
      }));
    }

    // Ensure all categories present
    const existing = new Set(positions.map((p: any) => (p.category || '').toLowerCase()));
    for (const cat of TOLLING_CATEGORIES) {
      if (!existing.has(cat.label.toLowerCase())) {
        positions.push({
          category: cat.label,
          position_summary: '• Not found in document',
          source_text: null,
          confidence: 'review_required',
          bible_reference: null,
          comparison_position: null,
          variance_notes: '⚠️ Category not addressed',
          market_benchmark: null,
        });
      }
    }

    return new Response(
      JSON.stringify({ positions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
