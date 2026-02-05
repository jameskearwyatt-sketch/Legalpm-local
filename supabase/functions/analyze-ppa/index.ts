import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Full PPA categories based on the Bible framework
const PPA_CATEGORIES = [
  // ===== PRE-COD / DEVELOPMENT =====
  {
    id: 'target_cod',
    label: 'Target COD & Milestones',
    group: 'Pre-COD / Development',
    extractionRequirements: `MUST EXTRACT - FORENSIC COD TIMELINE ANALYSIS:

## 1. BASE TIMELINE
• Target COD date (exact date or "X months from signing")
• Longstop Date (the absolute backstop)
• Key intermediate milestones

## 2. ⚠️ CRITICAL: ALL EXTENSION MECHANISMS (Worst-Case Analysis)
You MUST identify EVERY mechanism by which Target COD or Longstop Date can be extended:

A) FORCE MAJEURE EXTENSIONS:
   • Day-for-day extension for FM? YES/NO
   • Cap on FM extension period (e.g., "max 180 days")
   • Does FM extend Longstop Date or just Target COD?

B) SELLER UNILATERAL EXTENSIONS:
   • Can Seller extend if "substantial progress" made? (COMMON TRAP ⚠️)
   • Extension for permitting delays?
   • Extension for grid connection delays?
   • Extension for financing delays?
   • Any other Seller discretionary extensions?
   • What is the cap on each?

C) BUYER-CAUSED DELAYS:
   • Extension for Buyer's failure to perform CPs?
   • Extension for site access issues?

D) THIRD PARTY / EXTERNAL:
   • Grid operator delay extensions
   • Government/regulatory approval delays
   • Interconnection delays

## 3. WORST-CASE TIMELINE CALCULATION
Calculate and state: "Under worst-case scenario (all extensions invoked), Buyer could wait up to [X months/years] past Target COD before COD is achieved or termination right arises."

## 4. TERMINATION TRIGGERS
• When can Buyer terminate for delay?
• What compensation (if any) on delay termination?
• Are there any "zombie project" traps where Seller can keep project alive indefinitely?

## 5. FLAGS ⚠️
• Flag if total possible extension exceeds 12 months
• Flag if Seller has broad discretionary extensions
• Flag if Longstop Date itself can be extended
• Flag if NO hard cap on total extensions`,
  },
  {
    id: 'delay_liquidated_damages',
    label: 'Delay Liquidated Damages',
    group: 'Pre-COD / Development',
    extractionRequirements: `MUST EXTRACT:
• Daily/weekly LD rate (exact figures)
• LD cap (as % of contract value or absolute amount)
• Grace period before LDs accrue
• Longstop date and consequences (termination right?)
• Deemed COD provisions

⚠️ COD EXTENSION INTERACTION:
• Do LDs accrue during extension periods or are they suspended?
• Does Longstop Date itself extend (reducing Buyer's termination protection)?
• If FM extends Target COD, is Seller still paying LDs? Or does LD obligation suspend?

• Exclusions from delay (FM, buyer delays, grid connection delays)`,
  },
  {
    id: 'conditions_precedent',
    label: 'Conditions Precedent',
    group: 'Pre-COD / Development',
    extractionRequirements: `MUST EXTRACT:
• List of CPs (planning, grid, financing, permits)
• CP satisfaction deadlines
• Waiver rights
• Consequences of CP failure
• Who bears risk of CP failure`,
  },
  {
    id: 'construction_obligations',
    label: 'Construction & Development',
    group: 'Pre-COD / Development',
    extractionRequirements: `MUST EXTRACT:
• Seller's construction obligations
• Buyer's site access/cooperation obligations
• Reporting requirements during construction
• Change order process
• Technology/equipment specifications (if any)`,
  },

  // ===== PRICING & SETTLEMENT =====
  {
    id: 'pricing_structure',
    label: 'Pricing Structure',
    group: 'Pricing & Settlement',
    extractionRequirements: `MUST EXTRACT:
• Price mechanism (fixed/floating/hybrid/discount to reference)
• Price per MWh (exact figure in contract currency)
• Indexation mechanism - what index, frequency, formula
• Price floor and/or cap
• Escalation provisions and frequency
• Price reopener triggers (if any)
• Negative pricing provisions`,
  },
  {
    id: 'volume_structure',
    label: 'Volume & Shape',
    group: 'Pricing & Settlement',
    extractionRequirements: `MUST EXTRACT:
• Contract quantity (annual MWh or % of output)
• Pay-as-produced vs baseload vs shaped
• Minimum/maximum volume commitments
• Shape risk allocation (who bears profile costs)
• Deemed generation provisions
• Excess generation treatment`,
  },
  {
    id: 'settlement_metering',
    label: 'Settlement & Metering',
    group: 'Pricing & Settlement',
    extractionRequirements: `MUST EXTRACT:
• Settlement period (monthly/quarterly)
• Metering arrangements and responsibility
• Meter dispute resolution
• True-up/reconciliation process
• Data provision requirements`,
  },
  {
    id: 'balancing_costs',
    label: 'Balancing & Imbalance Costs',
    group: 'Pricing & Settlement',
    extractionRequirements: `MUST EXTRACT:
• Who bears balancing/imbalance costs
• Balancing responsibility allocation
• Forecasting obligations
• Imbalance cost pass-through (if any)
• Tolerance bands before liability`,
  },

  // ===== OPERATIONS =====
  {
    id: 'availability_guarantee',
    label: 'Availability Guarantee',
    group: 'Operations',
    extractionRequirements: `MUST EXTRACT:
• Guaranteed availability % (annual/lifetime)
• Availability calculation methodology
• Consequences of underperformance (LDs, termination)
• Availability LD rate (£/MWh shortfall)
• Exclusions from calculation (planned outages, FM, curtailment)
• Bonus provisions for over-performance (if any)`,
  },
  {
    id: 'curtailment',
    label: 'Curtailment',
    group: 'Operations',
    extractionRequirements: `MUST EXTRACT:
• Voluntary curtailment (buyer's right to curtail):
  - Compensation rate and formula
  - Cap on voluntary curtailment hours
• Involuntary curtailment (grid/dispatch down):
  - Is buyer compensated? At what rate?
  - Does it count toward volume commitments?
  - Cap on curtailment hours/MWh
• REGO treatment during curtailment:
  - Does buyer still receive REGOs on curtailed volumes?
  - Deemed generation for REGO purposes
• Curtailment notification requirements`,
  },
  {
    id: 'outages_maintenance',
    label: 'Outages & Maintenance',
    group: 'Operations',
    extractionRequirements: `MUST EXTRACT:
• Planned outage scheduling and notification
• Unplanned outage notification requirements
• Maintenance obligations and standards
• Outage caps/limits
• Buyer's right to require maintenance timing`,
  },
  {
    id: 'operations_reporting',
    label: 'Operations & Reporting',
    group: 'Operations',
    extractionRequirements: `MUST EXTRACT:
• Operating standards required
• Reporting obligations (frequency, content)
• Buyer's inspection/audit rights
• Performance data sharing
• Operator qualifications`,
  },

  // ===== ENVIRONMENTAL ATTRIBUTES =====
  {
    id: 'green_certificates',
    label: 'REGOs & Green Certificates',
    group: 'Environmental Attributes',
    extractionRequirements: `MUST EXTRACT:
• What attributes transfer (REGOs, GOs, carbon credits, other EACs)
• Price bundled or separate
• Shortfall remedies (damages, buy-out price, replacement obligation)
• REGO shortfall price/penalty amount
• Timing of transfer (when must REGOs be delivered)
• Retirement vs transfer obligations`,
  },
  {
    id: 'additionality',
    label: 'Additionality & Claims',
    group: 'Environmental Attributes',
    extractionRequirements: `MUST EXTRACT:
• Additionality representations/warranties
• Buyer's right to make environmental claims
• Marketing/publicity restrictions
• Carbon accounting treatment
• Exclusivity of claims`,
  },

  // ===== CREDIT & PAYMENT =====
  {
    id: 'seller_credit_support',
    label: 'Credit Support (Seller)',
    group: 'Credit & Payment',
    extractionRequirements: `MUST EXTRACT for EACH time period:
• Pre-COD credit support: type, amount, form (PCG/LC/bond)
• Post-COD credit support: type, amount, form
• If NO credit support for any period, FLAG THIS CLEARLY ⚠️
• Credit rating thresholds that trigger additional security
• Acceptable forms of security (LC issuer requirements)
• Release/step-down provisions
• Timing of provision (when must security be posted)`,
  },
  {
    id: 'buyer_credit_support',
    label: 'Credit Support (Buyer)',
    group: 'Credit & Payment',
    extractionRequirements: `MUST EXTRACT for EACH time period:
• Pre-COD credit support: type, amount, form
• Post-COD credit support: type, amount, form
• If NO credit support for any period, FLAG THIS CLEARLY ⚠️
• Credit rating thresholds
• Parent company guarantee requirements
• Payment security arrangements
• Step-down provisions`,
  },
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    group: 'Credit & Payment',
    extractionRequirements: `MUST EXTRACT:
• Billing frequency (monthly/quarterly)
• Payment period (X business days from invoice)
• Interest rate on late payment
• Disputed invoice procedure
• Netting/set-off rights
• Payment method requirements`,
  },
  {
    id: 'credit_events',
    label: 'Credit Events & Downgrades',
    group: 'Credit & Payment',
    extractionRequirements: `MUST EXTRACT:
• Credit rating triggers
• Consequences of downgrade
• Additional security requirements on downgrade
• Material adverse change provisions
• Cross-default provisions`,
  },

  // ===== RISK ALLOCATION =====
  {
    id: 'force_majeure',
    label: 'Force Majeure',
    group: 'Risk Allocation',
    extractionRequirements: `MUST EXTRACT:
• Definition scope (what is/isn't FM)
• Notification requirements (timing, content)
• Duration before termination right arises
• Financial consequences during FM period (who bears costs)
• Specific exclusions (grid events, price changes, weather)

⚠️ COD EXTENSION IMPACT (Critical for Pre-COD):
• Does FM extend Target COD? Day-for-day or capped?
• Does FM extend Longstop Date? (If yes, Buyer loses termination protection ⚠️)
• What is the maximum FM extension period?
• Can FM suspend Delay LDs?
• After FM ends, how quickly must Seller achieve COD?

• Extension of term for FM (post-COD)`,
  },
  {
    id: 'change_in_law',
    label: 'Change in Law',
    group: 'Risk Allocation',
    extractionRequirements: `MUST EXTRACT:
• Definition of qualifying change (discriminatory/general/tax)
• Mechanism for addressing: negotiation? adjustment formula? termination?
• Cost allocation: Who bears what costs?
• Timeframe for reaching agreement
• Fallback if agreement not reached (arbitration, termination, formula)
• Material adverse threshold (if any)
• Specific carve-outs (subsidy changes, carbon pricing)`,
  },
  {
    id: 'market_disruption',
    label: 'Market Disruption',
    group: 'Risk Allocation',
    extractionRequirements: `MUST EXTRACT:
• Market disruption definition
• Consequences (suspension, price adjustment, termination)
• Price source fallback hierarchy
• Material change triggers
• Renegotiation provisions`,
  },
  {
    id: 'insurance',
    label: 'Insurance Requirements',
    group: 'Risk Allocation',
    extractionRequirements: `MUST EXTRACT:
• Required insurance types (property, liability, BI)
• Minimum coverage amounts
• Named insured/additional insured requirements
• Evidence of insurance requirements
• Consequences of lapse`,
  },

  // ===== GENERAL / TERM =====
  {
    id: 'contract_term',
    label: 'Contract Term',
    group: 'General',
    extractionRequirements: `MUST EXTRACT:
• Total term length (years)
• Term commencement trigger (signing, COD, first delivery)
• Extension rights (who holds, conditions, length, price)
• Early termination for convenience (if any)
• Survival provisions`,
  },
  {
    id: 'termination_rights',
    label: 'Termination Rights',
    group: 'General',
    extractionRequirements: `MUST EXTRACT:
• Events of default (list each key trigger)
• Cure periods for each default type
• Termination payment calculation methodology
• Who pays whom on termination (defaulting vs non-defaulting party)
• Specific termination triggers (prolonged FM, insolvency, material breach)
• Automatic vs elective termination`,
  },
  {
    id: 'termination_payments',
    label: 'Termination Payments',
    group: 'General',
    extractionRequirements: `MUST EXTRACT:
• Calculation methodology (market quotation, formula, fixed)
• Who pays in each scenario
• Timing of payment
• Disputes over calculation
• Set-off against other amounts
• Caps on termination payments (if any)`,
  },
  {
    id: 'assignment_transfer',
    label: 'Assignment & Transfer',
    group: 'General',
    extractionRequirements: `MUST EXTRACT:
• Seller assignment restrictions
• Buyer assignment restrictions
• Permitted transferees
• Consent requirements (not to be unreasonably withheld?)
• Change of control provisions
• Novation requirements`,
  },
  {
    id: 'dispute_resolution',
    label: 'Dispute Resolution',
    group: 'General',
    extractionRequirements: `MUST EXTRACT:
• Governing law
• Dispute escalation process
• Arbitration vs court (if arbitration: seat, rules, language)
• Expert determination for technical disputes
• Interim relief provisions`,
  },
  {
    id: 'liability_caps',
    label: 'Liability & Limitations',
    group: 'General',
    extractionRequirements: `MUST EXTRACT:
• Overall liability cap (amount or formula)
• Exclusion of consequential/indirect damages
• Carve-outs from limitations (fraud, wilful misconduct, indemnities)
• Indemnity provisions
• Third party claims handling`,
  },
  {
    id: 'representations_warranties',
    label: 'Representations & Warranties',
    group: 'General',
    extractionRequirements: `MUST EXTRACT:
• Key seller representations (title, capacity, permits, no litigation)
• Key buyer representations (credit, authority)
• Repetition of representations
• Consequences of breach
• Disclosure requirements`,
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      ppaText, 
      comparisonText, 
      analysisType, 
      perspective, 
      jurisdiction, 
      projectName,
      ppaType, // NEW: PPA structure type
      counterpartyType, // NEW: Counterparty type
      precedents, 
      goldStandardPrecedents,
      marketIntelligence,
      intelligenceConfidence,
       userLearnings, // User corrections and feedback
    } = await req.json();

    if (!ppaText) {
      return new Response(
        JSON.stringify({ error: 'PPA text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we have market intelligence or raw precedents
    const hasMarketIntelligence = marketIntelligence && typeof marketIntelligence === 'string' && marketIntelligence.length > 100;
    const hasPrecedents = precedents && Array.isArray(precedents) && precedents.length > 0;
    const hasGoldStandard = goldStandardPrecedents && Array.isArray(goldStandardPrecedents) && goldStandardPrecedents.length > 0;
     const hasLearnings = userLearnings && typeof userLearnings === 'string' && userLearnings.length > 10;

     console.log(`Analysis request: hasMarketIntelligence=${hasMarketIntelligence}, hasPrecedents=${hasPrecedents}, hasGoldStandard=${hasGoldStandard}, hasLearnings=${hasLearnings}, intelligenceConfidence=${intelligenceConfidence}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Group categories for prompt
    const groupedCategories: Record<string, typeof PPA_CATEGORIES> = {};
    for (const cat of PPA_CATEGORIES) {
      if (!groupedCategories[cat.group]) groupedCategories[cat.group] = [];
      groupedCategories[cat.group].push(cat);
    }

    // Build category list for prompt
    let categoryList = '';
    for (const [group, cats] of Object.entries(groupedCategories)) {
      categoryList += `\n## ${group}\n\n`;
      for (const c of cats) {
        categoryList += `### ${c.label} (id: ${c.id})\n${c.extractionRequirements}\n\n`;
      }
    }

    // Build GOLD STANDARD template context (highest priority - always compared against)
    let goldStandardContext = '';
    if (hasGoldStandard) {
      const goldByCategory: Record<string, any[]> = {};
      for (const p of goldStandardPrecedents) {
        if (!goldByCategory[p.category]) goldByCategory[p.category] = [];
        goldByCategory[p.category].push(p);
      }
      
      goldStandardContext = `\n\n## ⭐ GOLD STANDARD TEMPLATE COMPARISON (CRITICAL)
You have access to positions from the Baker McKenzie EU VPPA Template - our firm's gold standard precedent document.
This template represents best-practice positions for European VPPAs from the buyer's perspective.

**CRITICAL INSTRUCTION**: For EVERY category where gold standard positions exist:
1. You MUST compare the draft PPA against the gold standard template
2. Flag ANY material deviation from the gold standard with "⚠️ DEVIATES FROM BM TEMPLATE:"
3. Explain specifically how the draft differs and whether the deviation favors buyer or seller
4. Even if a position is "on market" compared to other precedents, if it deviates from our template, FLAG IT

For each extracted position, include:
- "gold_standard_deviation": true/false (does this materially deviate from the BM template?)
- "gold_standard_comparison": "Specific explanation of how this differs from BM template position" or null

GOLD STANDARD TEMPLATE POSITIONS:
${Object.entries(goldByCategory).map(([cat, precs]) => {
  return `### ${cat}
${precs.map(p => `⭐ BM TEMPLATE: ${p.position_summary}`).join('\n')}`;
}).join('\n\n')}
`;
    }

    // Build MARKET INTELLIGENCE context (synthesized patterns from precedent bank)
    let marketIntelligenceContext = '';
    if (hasMarketIntelligence) {
      marketIntelligenceContext = `\n\n## 📊 SYNTHESIZED MARKET INTELLIGENCE (CRITICAL)

You have access to SYNTHESIZED MARKET INTELLIGENCE extracted from our precedent bank. This is NOT just raw precedents - it contains:
- **Aggregated numeric ranges** (e.g., "Availability Guarantee: 95-99%, median 97%")
- **Common market structures** and their frequency
- **Position clusters** showing what combinations typically appear together
- **Jurisdiction-specific patterns** where regional differences exist
- **Buyer vs Seller tendencies** for each category
- **Cross-category correlations** and insights

⚠️ **CRITICAL INSTRUCTION**: This synthesized intelligence takes PRIORITY over raw precedent comparison. Use the ranges, medians, and frequency data to determine market position ratings with PRECISION.

**Intelligence Confidence Level**: ${intelligenceConfidence?.toUpperCase() || 'UNKNOWN'}
${intelligenceConfidence === 'very_high' ? '(Extensive data - high confidence in market benchmarks)' : ''}
${intelligenceConfidence === 'high' ? '(Good data depth - reliable market benchmarks)' : ''}
${intelligenceConfidence === 'medium' ? '(Moderate data - use as guidance but note limitations)' : ''}
${intelligenceConfidence === 'low' ? '(Limited data - treat as indicative only)' : ''}

${marketIntelligence}
`;
    }

    // Build raw precedent context as backup (secondary to synthesized intelligence)
    // Only include raw precedents if we don't have synthesized intelligence (fallback)
    let precedentContext = '';
    if (hasPrecedents && !hasMarketIntelligence) {
      const precedentsByCategory: Record<string, any[]> = {};
      for (const p of precedents) {
        if (!precedentsByCategory[p.category]) precedentsByCategory[p.category] = [];
        precedentsByCategory[p.category].push(p);
      }
      
      precedentContext = `\n\n## MARKET PRECEDENT COMPARISON
You have access to ${precedents.length} banked positions from agreed PPAs. For each category where precedents exist, compare the current PPA against market practice and provide a MARKET POSITION assessment.

MARKET POSITION RATINGS:
- "on_market": Position is consistent with majority of precedents (within normal range)
- "off_market": Position deviates materially from precedents (notable but not extreme)
- "way_off_market": Position is significantly outside precedent range (major concern, flag prominently)

For each extracted position, include:
- "market_position": "on_market" | "off_market" | "way_off_market" | null (if insufficient precedents)
- "market_comparison": Brief explanation of how this compares to precedents (e.g., "Availability at 95% is below market range of 97-99%")

MARKET PRECEDENT DATA BY CATEGORY:
${Object.entries(precedentsByCategory).map(([cat, precs]) => {
  return `### ${cat} (${precs.length} precedent${precs.length > 1 ? 's' : ''})
${precs.map(p => `- ${p.project_name}${p.jurisdiction ? ` (${p.jurisdiction})` : ''}: ${p.position_summary.substring(0, 200)}...`).join('\n')}`;
}).join('\n\n')}
`;
    }

    // Map PPA type codes to labels
    const ppaTypeLabels: Record<string, string> = {
      vppa: 'Virtual PPA (VPPA / CFD)',
      physical: 'Physical PPA',
      sleeved: 'Sleeved PPA',
      private_wire: 'Private Wire Physical PPA',
    };

    const systemPrompt = `You are an expert PPA (Power Purchase Agreement) analyst specializing in European renewable energy contracts.
Your task is to extract ACTIONABLE, SPECIFIC positions from the provided PPA document.
You have been equipped with MARKET INTELLIGENCE synthesized from our precedent bank - use it to provide precise market position assessments.

PERSPECTIVE: ${perspective === 'buyer' ? 'Buyer (Offtaker)' : 'Seller (Generator)'}
${jurisdiction ? `JURISDICTION: ${jurisdiction}` : ''}
${ppaType ? `PPA STRUCTURE TYPE: ${ppaTypeLabels[ppaType] || ppaType.toUpperCase()}

⚠️ STRUCTURE-SPECIFIC ANALYSIS: This is a ${ppaTypeLabels[ppaType] || ppaType.toUpperCase()}. Different PPA structures have DIFFERENT market norms:
- VPPAs focus on CFD/settlement mechanics, virtual delivery, and REGOs as primary deliverable
- Physical PPAs involve actual power delivery, grid connection, and physical offtake
- Sleeved PPAs add utility intermediary complexity and sleeving fees
- Private Wire PPAs involve direct connection and on-site delivery considerations

Apply structure-specific market benchmarks where available in the intelligence data.` : ''}
${counterpartyType ? `COUNTERPARTY TYPE: ${counterpartyType}` : ''}
${marketIntelligenceContext}
${goldStandardContext}
${precedentContext}
 ${hasLearnings ? userLearnings : ''}

## OUTPUT REQUIREMENTS

For each category you MUST:

1. **Clause References**: List the specific clause numbers where provisions are found (e.g., "Clause 8.2, Schedule 3 para 2.1")
2. **Position Summary**: Use SHORT BULLET POINTS, not narrative paragraphs:
   • Each bullet = one specific provision or term
   • Include exact figures, percentages, amounts, dates
   • Be CONCLUSIVE - tell the user WHAT the contract says, not just THAT it has provisions
   • Flag gaps or unusual terms with ⚠️
3. **Confidence**: "high" (clear clauses found), "medium" (inferred from related language), "review_required" (not found or ambiguous)
4. **Party Favorability**: Assess whether each position favors buyer or seller:
   - "buyer_friendly": Position is more protective of buyer's interests than typical/balanced
   - "seller_friendly": Position is more protective of seller's interests than typical/balanced
   - "balanced": Position is reasonably balanced between parties
   - "neutral": Position doesn't materially favor either party (purely procedural)
5. **Market Benchmark** (ALWAYS REQUIRED): For EVERY position, provide the "textbook" or "ideal" market position:
   - What would the PERFECT, bang-on-market position look like for this category?
   - Be specific with typical ranges, percentages, durations, structures
   - This is the "What's Market?" signpost - show what ideal looks like
   - Even if the current position is acceptable, show what perfect would be
   - Format: Concise statement of the ideal market standard (1-2 sentences max)
${hasMarketIntelligence ? `6. **Market Position** (PRECISION REQUIRED): Use the SYNTHESIZED MARKET INTELLIGENCE above to determine market position with precision:
   - Compare against the NUMERIC RANGES provided (if value is outside range, it's off/way-off market)
   - Check COMMON STRUCTURES frequency (if structure is <20% frequency, consider off-market)
   - Consider JURISDICTION-SPECIFIC patterns if analyzing a matching jurisdiction
   - Reference the POSITION CLUSTERS to identify standard vs unusual combinations` : ''}
${hasGoldStandard ? `${hasMarketIntelligence ? '7' : '6'}. **Gold Standard Comparison**: ALWAYS compare against BM template - flag ANY deviation with gold_standard_deviation: true and explain in gold_standard_comparison` : ''}
${hasPrecedents && !hasMarketIntelligence ? `${hasGoldStandard ? '7' : '6'}. **Market Position**: Compare against precedent bank and provide market_position rating with brief market_comparison explanation` : ''}

## CRITICAL INSTRUCTIONS

 ## 📝 DRAFT DOCUMENT HANDLING (CRITICAL)
 Many PPAs are DRAFTS with commercial figures not yet finalized. This is NORMAL.
 
 **Square brackets and placeholders** (e.g., "[TBD]", "[$X]", "[●]", "[INSERT]") for commercial terms are EXPECTED in drafts:
 - ✅ DO note that figures are "to be agreed" or "placeholder in draft"
 - ✅ DO extract the structure and mechanism even if amounts are placeholders
 - ❌ DO NOT treat placeholder amounts as "critical gaps" or "way off market"
 - ❌ DO NOT flag missing commercial figures (LDs, credit amounts, prices) as major deficiencies
 
 The PRIMARY PURPOSE is to identify **risk allocation issues** - who bears what risk, what mechanisms exist, what protections are in place. Commercial amounts being unfilled is NOT a risk allocation issue.
 
 Example - CORRECT approach for Delay LDs with placeholders:
 "• Delay LDs: [£X]/day (amount TBD) with [Y] day cap
 • Mechanism: Day-for-day accrual from Target COD
 • No grace period specified ⚠️ (risk allocation concern)"
 
 Example - INCORRECT approach:
 "• ⚠️ CRITICAL GAP: No delay LD amount specified" (WRONG - this is normal for drafts)
 
 ## 🔍 DOCUMENT PARSING VERIFICATION (CRITICAL)
 Before concluding a provision is MISSING, you MUST triple-check:
 
 1. **Heading exists but no content?** This is likely a PARSING ERROR, not a missing provision.
    - If you see a section heading (e.g., "Change in Law", "Liability") but think there's no operative text, ASSUME there IS content that wasn't extracted properly.
    - In such cases, state: "• Section heading identified but content may not have been fully extracted - recommend manual review of [Section X]"
    - Confidence: "review_required"
    - DO NOT flag as "NOT ADDRESSED" when the heading clearly exists
 
 2. **Check related sections**: Provisions may be embedded in other clauses or schedules
 
 3. **Check definitions**: Key terms may be defined elsewhere affecting interpretation
 
 Only flag "NOT ADDRESSED" when there is genuinely NO mention of the concept anywhere in the document.
 
 ## ⚠️ TRUE MISSING PROVISIONS
 A provision is truly MISSING only when:
 - No section heading exists for it
 - No related language appears anywhere in the document
 - The concept is not addressed in schedules, definitions, or ancillary clauses
 
 For genuinely missing provisions, include them in the output with:
   - position_summary: "• ⚠️ NOT ADDRESSED IN DOCUMENT - [explain what's typically expected and the risk of omission]"
   - confidence: "review_required"
   - A clear warning about the gap and its commercial implications
 
- DO NOT write narrative summaries like "The document outlines mechanisms for..."
- DO write specific conclusions like "• Seller must provide £500k LC pre-COD; NO post-COD security required ⚠️"
 - If a mechanism or protection is MISSING (not just amounts), FLAG IT with ⚠️
${hasMarketIntelligence ? `- 📊 MARKET INTELLIGENCE: You have synthesized market data. Use the RANGES and MEDIANS to assess positions precisely. A position at the median is "on_market", near the edges is "off_market", beyond the range is "way_off_market".` : ''}
${hasGoldStandard ? `- ⭐ GOLD STANDARD CHECK: For EVERY category, compare against BM template. Deviation from our template is more important than market position!` : ''}
- 🎯 MARKET BENCHMARK: For EVERY category, include the market_benchmark field showing the ideal/textbook position. This is mandatory.
 - 🚨 TRULY MISSING = FLAG: If a category has NO mention at all in the PPA (no heading, no language), flag the omission. But if a heading exists, assume parsing issues.
- For Credit Support: ALWAYS distinguish pre-COD vs post-COD periods
- For Curtailment: ALWAYS address involuntary curtailment compensation and REGO treatment
- For Change in Law: ALWAYS explain the actual mechanism, not just that one exists
- For Termination: List specific triggers and cure periods
- Include actual numbers, dates, percentages - not just "as specified in Schedule X"
 - If amounts are in square brackets/placeholders, note the structure exists but amounts are TBD

## PARTY FAVORABILITY GUIDANCE
When assessing party_favorability, consider the perspective (${perspective === 'buyer' ? 'Buyer' : 'Seller'}):
- Higher security requirements = buyer_friendly
- Broader FM/extension rights for seller = seller_friendly
- Strong cure rights = benefits the party with the obligation
- Caps on liability = favors the party whose liability is capped
- Delay LDs = buyer_friendly (protects against delays)
- Broad curtailment rights without compensation = seller_friendly
- Stringent termination triggers = benefits the non-defaulting party (typically buyer)

## MARKET BENCHMARK EXAMPLES (What's Market?)
For each category, market_benchmark should look like:
- Credit Support: "Market: Pre-COD LC of 10-15% contract value; post-COD PCG or LC of 6-12 months' average invoice value"
- Availability: "Market: 95-98% P50 generation guarantee with ~80% price for underperformance"
- Payment Terms: "Market: Monthly invoicing, 30 days payment, 2-3% late interest"
- Force Majeure: "Market: 12-18 month FM extension cap, mutual termination right thereafter"
${hasMarketIntelligence ? `
## MARKET POSITION PRECISION GUIDANCE (Using Intelligence Data)
- **on_market**: Position is within the typical range from market intelligence, uses common structures (>50% frequency)
- **off_market**: Position is at the edge of ranges, uses less common structures (10-50% frequency), or deviates from jurisdiction norms
- **way_off_market**: Position is OUTSIDE the stated ranges, uses rare structures (<10% frequency), or significantly deviates from all clusters

When you cite market intelligence, be specific: "This 93% availability is below the market range of 95-99% (median 97%)"` : ''}

## CATEGORIES TO EXTRACT
${categoryList}`;

    const userPrompt = `Analyze this PPA and extract positions for each category following the requirements above.

PROJECT: ${projectName}

PPA DOCUMENT TEXT:
${ppaText.substring(0, 100000)}

${comparisonText ? `
TERM SHEET / COMPARISON DOCUMENT:
${comparisonText.substring(0, 30000)}
` : ''}

Return a JSON object:
{
  "positions": [
    {
      "category": "Category Label",
      "clause_references": "Clause X.X, Schedule Y para Z",
      "position_summary": "• Bullet point 1\\n• Bullet point 2\\n• Bullet point 3",
      "confidence": "high|medium|review_required",
      "party_favorability": "buyer_friendly|seller_friendly|balanced|neutral",
      "flags": "⚠️ Any concerns or gaps to flag (optional)",
      "market_benchmark": "What's Market: Concise statement of the ideal/textbook market position for this category (ALWAYS REQUIRED)"${hasMarketIntelligence || hasPrecedents ? `,
      "market_position": "on_market|off_market|way_off_market|null",
      "market_comparison": "Brief comparison citing specific intelligence data (e.g., 'Below market range of 95-99%')"` : ''}${hasGoldStandard ? `,
      "gold_standard_deviation": true|false,
      "gold_standard_comparison": "Explanation of deviation from BM template or null"` : ''}
    }
  ]
}

IMPORTANT: Extract ALL ${PPA_CATEGORIES.length} categories. Be SPECIFIC and CONCLUSIVE. Extract the actual terms, not just that terms exist. ALWAYS include party_favorability assessment. ALWAYS include market_benchmark showing the ideal/textbook market position - this is mandatory for every category.${hasMarketIntelligence ? ' USE THE MARKET INTELLIGENCE DATA to provide PRECISE market_position ratings with specific citations.' : ''}${hasGoldStandard ? ' ALWAYS check against BM gold standard template.' : ''}${hasPrecedents && !hasMarketIntelligence ? ' Include market_position for all categories where precedents exist.' : ''}`;

    console.log('Calling AI gateway for full PPA analysis...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Using Pro for comprehensive analysis
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing...');

    // Parse the JSON from the response
    let positions = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*"positions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        positions = parsed.positions || [];
        
        // Normalize category names to match our expected labels (case-insensitive matching)
        positions = positions.map((p: any) => {
          const matchedCat = PPA_CATEGORIES.find(c => 
            c.label.toLowerCase() === (p.category || '').toLowerCase()
          );
          
          // Build variance_notes with market position tag if available
          let varianceNotes = p.flags || p.variance_notes || '';
          if (p.market_position) {
            const marketTag = `[${p.market_position.toUpperCase().replace(/_/g, ' ')}]`;
            varianceNotes = `${marketTag} ${varianceNotes}`.trim();
          }
          // Add party favorability tag
          if (p.party_favorability && p.party_favorability !== 'neutral') {
            const partyTag = `[${p.party_favorability.toUpperCase().replace(/_/g, '-')}]`;
            varianceNotes = `${partyTag} ${varianceNotes}`.trim();
          }
          
          return {
            category: matchedCat?.label || p.category,
            position_summary: p.position_summary,
            source_text: p.clause_references || null,
            confidence: p.confidence || 'review_required',
            bible_reference: null,
            comparison_position: p.comparison_position || null,
            variance_notes: varianceNotes || null,
            market_position: p.market_position || null,
            market_comparison: p.market_comparison || null,
            gold_standard_deviation: p.gold_standard_deviation || false,
            gold_standard_comparison: p.gold_standard_comparison || null,
            party_favorability: p.party_favorability || 'neutral',
          };
        });
      } else {
        console.error('No JSON found in response:', content.substring(0, 500));
        throw new Error('Could not parse AI response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      positions = PPA_CATEGORIES.map(c => ({
        category: c.label,
        position_summary: '• Failed to extract - please review document manually',
        source_text: null,
        confidence: 'review_required',
        bible_reference: null,
        comparison_position: null,
        variance_notes: null,
        market_position: null,
        market_comparison: null,
        gold_standard_deviation: false,
        gold_standard_comparison: null,
        party_favorability: 'neutral',
      }));
    }

    // Ensure all categories have entries (case-insensitive check)
    const existingCategories = new Set(positions.map((p: any) => (p.category || '').toLowerCase()));
    for (const cat of PPA_CATEGORIES) {
      if (!existingCategories.has(cat.label.toLowerCase())) {
        positions.push({
          category: cat.label,
          position_summary: '• Not found in document',
          source_text: null,
          confidence: 'review_required',
          bible_reference: null,
          comparison_position: null,
          variance_notes: '⚠️ Category not addressed in PPA',
          market_position: null,
          market_comparison: null,
          gold_standard_deviation: false,
          gold_standard_comparison: null,
          party_favorability: 'neutral',
        });
      }
    }

    return new Response(
      JSON.stringify({ positions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-ppa:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
