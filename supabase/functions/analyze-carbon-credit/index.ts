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
## Trained on: Frontier Offtake Agreement Template (Nov 2025) & OSCAR Open Standard (Nov 2025)

=============================================================================
SECTION A: FUNDAMENTALS OF CARBON CREDIT OFFTAKE AGREEMENTS
=============================================================================

### A1. WHAT IS A CARBON CREDIT OFFTAKE AGREEMENT?
A Carbon Credit Offtake Agreement (CCOA) / Carbon Removal Offtake Agreement is a contract where:
- The **Seller/Carbon Supplier/Project Developer** develops and operates a carbon removal project (a "CRU Project" per Frontier; "Project" per OSCAR)
- The **Buyer/Offtaker** commits to purchasing a specified quantity of Carbon Removal Units (CRUs) or Credits over a defined period
- Each credit represents one metric ton of CO2e removed from the atmosphere and durably stored, verified according to an agreed protocol and issued by a recognized registry
- These agreements are critical for project bankability, providing revenue certainty for developers
- Per OSCAR: "An Offtake Agreement is a legally binding contract in which a buyer commits to purchase CDR credits from a supplier over a defined period"

**Key Distinction from Other Commodity Offtakes:**
- Carbon credits are intangible assets — they exist as registry entries, not physical commodities
- Credit quality is paramount — not all tonnes are equal (permanence, additionality, co-benefits)
- Regulatory landscape is rapidly evolving (Paris Agreement Article 6, EU CBAM, CRCF, national compliance markets)
- Reversal/invalidation risk is unique to carbon — a removed tonne can be re-emitted
- Vintage requirements add temporal complexity not seen in energy offtakes
- Unlike PPAs, CDR credits do not exist at contract inception — they are generated only after project performance, monitoring, and registry issuance

**Market Structure (from OSCAR Guidebook):**
- The CDR market is largely voluntary and still in its formative stage
- Transaction costs are disproportionately high compared to relatively small volumes
- Nearly every offtake arrangement must be negotiated from scratch — OSCAR aims to change this
- Analogy to PPA standardization in renewable energy is instructive
- Offtake Agreements serve as "contractual infrastructure" through which capital and credits flow

### A2. PARTIES & TERMINOLOGY
- **Seller/Carbon Supplier/Project Developer/Originator**: Develops the project and generates credits/CRUs
- **Buyer/Offtaker/Credit Purchaser**: Commits to purchasing credits for voluntary or compliance use
- **Buyer's Representative** (Frontier-specific): Frontier acts as agent for buyer, approves certain actions, facilitates negotiation
- **Participants** (Frontier-specific): Group of Members/Partners entering substantially similar Offtake Agreements
- **Verification/Validation Body (VVB) / Verification Contractor**: Independent auditor verifying credits per protocol
- **Independent Expert** (Frontier-specific): Engaged by Carbon Supplier to certify technical feasibility
- **Registry / CRU Issuer**: Platform where credits are issued, tracked, transferred, and retired (Verra, Gold Standard, Puro.earth, etc.)
- **Carbon Standard Body**: Entity that establishes, develops and administers the applicable carbon standard
- **Registry Administrator**: Entity operating the registry per Carbon Standard Rules
- **Corresponding Adjustment**: Host country authorization under Paris Agreement Article 6

### A3. CREDIT TYPES & METHODOLOGIES (CDR Taxonomy per OSCAR Guidebook / CDR.fyi)
**Biomass Carbon Removal and Storage (BiCRS):**
- Bioenergy with Carbon Capture and Sequestration (BECCS)
- Biochar Carbon Removal (BCR) — pyrolysis of organic material
- Biomass Geological Sequestration (BGS) — bio-oil/bioslurry into geological formations
- Biomass Direct Storage — storing terrestrial biomass in stable environments

**Direct Air Carbon Capture and Sequestration (DACCS):**
- Capture of CO2 directly from atmosphere using chemical processes + permanent underground storage

**Marine CDR (mCDR):**
- Alkalinity Enhancement (Ocean, River, Coastal, Wastewater)
- Direct Ocean Removal — captures CO2 from ocean water
- Marine Biomass Carbon Capture and Sequestration (MBCCS) — seaweed sinking, microalgal capture

**Enhanced Weathering (EW):**
- Accelerates natural rock weathering — crushed silicate rocks spread across landscapes/oceans

**Mineralization:**
- Ex-situ Mineralization — CO2 reacted with alkaline minerals in engineered systems
- In-situ Mineralization — CO2 injected into underground rock formations
- Microbial Mineralization — microbes accelerate mineral carbonation
- Surficial Mineralization — alkaline minerals on surface react with atmospheric CO2

**Nature-Based Solutions:**
- Afforestation/Reforestation
- Soil Carbon Sequestration
- REDD+ (Avoided Deforestation)
- Blue Carbon (mangroves, seagrass, peatland restoration)

**Methodology Standards**: Verra VCS, Gold Standard, ACR, CAR, Puro.earth, ISCC
**Emerging Integrity Frameworks**: IC-VCM Core Carbon Principles, VCMI Claims Code

=============================================================================
SECTION B: KEY COMMERCIAL TERMS — MARKET STANDARDS
(Synthesized from Frontier Template & OSCAR)
=============================================================================

### B1. TERM & VOLUME
**Market Standard (Frontier/OSCAR):**
- Term: Effective Date until all CRUs for final Contract Year are Delivered (Frontier Art. 2.1; OSCAR Art. II)
- Extension/renewal requires mutual written agreement at least 30 days before expiry (Frontier)
- Volume: Annual Contract Quantity set in delivery schedule (Exhibit D / Exhibit B)
- Annual CRU Target: total CRUs expected from project per year, with Buyer's Proportionate Share = Contract Quantity ÷ Annual CRU Target
- Delivery Surplus: Buyer has right but NOT obligation to purchase Proportionate Share of Excess CRUs (Frontier §2.3(a))
- Delivery Shortfall: Supplier delivers Buyer's Proportionate Share of whatever CRUs are produced (Frontier §2.3(b); OSCAR §7.01-7.02)
- Minimum Quantity: specified percentage of Total Contract Quantity; deficit is an Event of Default
- OSCAR includes separate Generation Shortfall (project produces fewer credits) vs Delivery Shortfall (supplier fails to deliver despite production)

### B2. CONDITIONS PRECEDENT & MILESTONES
**Market Standard (Frontier §2.4 — extensive; OSCAR omits CPs but discusses in Guidebook):**
Frontier requires satisfaction before Commencement Date:
- (a) Protocol: detailed metrics/methods for quantification and verification of CRUs
- (b) CRU Issuer approval: project approved, eligible for registration on public registry
- (c) Independent Expert engagement
- (d) Project Documents: Project Design Document (PDD), Community Benefits Plan, Annual CRU Targets with Independent Expert confirmation, Ecosystem Safety Plan
- (e) Compliance with all representations/warranties
- (f) Officer's Certificate
- (g) Achievement of development Milestones (optional)
- (h) ROFO Agreement & Parent Guaranty (if applicable)
- Target Commencement Date with best-efforts obligation; 30-day buyer review period
- Commercial Operation Date (COD): separate certification that project can reliably produce targets

**OSCAR approach:** Relies on shortfall/delivery default provisions as sufficient remedies; recommends CPs mainly when payment occurs before COD

### B3. PRICING
**Market Standard (Frontier Art. 3; OSCAR Art. IV):**
- Fixed price per CRU/credit (Unit Price) set in delivery schedule, by Contract Year
- Payment trigger options (OSCAR §4.01): (i) within X days of Delivery, (ii) within X days of invoice, (iii) upon Effective Date/Fulfillment Date, (iv) prior to COD
- Frontier §3.2: Most Favored Nation (MFN) pricing — if Carbon Supplier offers lower price to ANY Participant, Buyer automatically gets lowest price. OSCAR Guidebook notes MFN clauses "can adversely affect bankability"
- Late payment interest: Frontier §3.3 at Federal Funds Rate + 2%; OSCAR §19.10 at lesser of 9% per annum or max permissible rate
- Verification & Registry Costs: separate allocation (Frontier §3.1(b) with Maximum V&R Cost cap; OSCAR §4.03)
- Common pricing models emerging: fixed per ton, cost-plus, indexed, tiered, hybrid
- Price per credit varies enormously: $5-15 (avoidance) to $200-1,000+ (DAC)
- OSCAR Guidebook: "Price formation does not depend solely on tons of CO2 removed — co-benefits such as biodiversity, water conservation, community development are material factors"

### B4. CREDIT QUALITY & SPECIFICATIONS
**Market Standard:**
- CRUs must represent verified, permanent removal of CO2 (Frontier: "Permanent" = stored for at least 1,000 years)
- Environmental Attributes: exclusive rights to all credits, benefits, emissions reductions attributable to the project
- Protocol compliance: detailed quantification/verification methodology agreed at outset
- No double counting: credits cannot be sold, transferred, or retired to/for any other party
- Exclusive rights: Carbon Supplier cannot sell Environmental Attributes to anyone else (Frontier §7.13)
- Title transfer: upon Delivery, all right/title/interest vest in Buyer, including right to verify, certify, use, transfer, sell, retire (Frontier §2.2(b))
- OSCAR §3.02: Supplier covenants not to sell, deliver, transfer, retire, or encumber any Contract Credits to third parties

### B5. DELIVERY MECHANICS & TITLE TRANSFER
**Market Standard (Frontier §2.2; OSCAR Art. V):**
- Two delivery methods: (a) Transfer Transaction — credits transferred to Buyer's Registry Account, or (b) Retirement Transaction — credits retired designating Buyer as beneficiary
- Title transfers upon Delivery, free and clear of encumbrances, with full title guarantee
- CRU Certification: seller provides certificate from CRU Issuer or executed CRU Certification form
- Buyer may request retirement on its behalf or designee's behalf
- U.S. Bankruptcy safe harbor: agreement structured as "forward contract" under 11 U.S.C. §101(25) (OSCAR §5.02)

### B6. VERIFICATION & MRV
**Market Standard (Frontier Art. 4; OSCAR Art. VI):**
- Frontier: Buyer appoints Buyer's Representative; Verifier engaged by/approved by Buyer's Representative
- Protocol: detailed system-level boundaries, quantitative estimation/measurement/monitoring, sources/methods/instruments, double-counting prevention, uncertainty assessment, storage monitoring plan, ecosystem safety plan
- OSCAR §6.01: Supplier prepares/implements/maintains Project MRV Plan per Prudent Industry Practices and Carbon Standard Rules
- OSCAR §6.03: Quarterly Project Status Reports including progress, approvals status, compliance evaluation, 12-month delivery plan
- Audit rights: Buyer may monitor/audit Project once per year during Durability Monitoring Period (OSCAR §6.05)
- Verification at seller's cost per Carbon Standard Rules and Registry requirements

### B7. SHORTFALL REMEDIES & MAKE-UP RIGHTS
**Market Standard (Frontier §2.3; OSCAR Art. VII):**
OSCAR distinguishes Generation Shortfall (project underperformance) vs Delivery Shortfall (supplier default):
- Generation Shortfall remedies (OSCAR §7.01(b)): Supplier elects (after 20 Business Day grace) to (i) deliver make-up credits by specified date, (ii) increase future Contract Quantities, or (iii) deliver Replacement Credits at Supplier's cost
- Delivery Shortfall remedies (OSCAR §7.02): similar three options, at Buyer's/Supplier's option
- Frontier: shortfall remedies at Buyer's discretion; Buyer has no obligation to purchase after expiration/termination
- Replacement Credits: must use same technology/methods and same Registry/Carbon Standard Rules
- Price reduction for persistent shortfall: OSCAR allows decreasing Unit Price by X% until make-up is delivered, doubling on each anniversary

### B8. REPRESENTATIONS & WARRANTIES
**Market Standard (Frontier Art. 6; OSCAR Art. VIII):**
Mutual reps (at Effective Date): valid existence, authority, no conflicts, binding obligations, no insolvency
Supplier-specific reps (at each Delivery): 
- Project validated/registered per Carbon Standard Rules (OSCAR §8.02(a))
- Compliance with all Applicable Laws
- No human rights impacts, modern slavery concerns (OSCAR §8.02(c))
- Worker health/safety, fair labor practices (OSCAR §8.02(d))
- Credits duly verified by Verification Contractor (OSCAR §8.02(h))
- Clean title: no encumbrances, no competing claims (OSCAR §8.02(e)-(g))
- Good title transfers to Buyer upon payment (OSCAR §8.02(g))
- All information/data provided is true, accurate, not misleading
- No material social/environmental risks that could cause reputational harm to Buyer (OSCAR §8.02(j))
- Frontier §6.2: additional reps on Protocol compliance, no litigation, no regulatory action, insurance maintenance

### B9. CORRESPONDING ADJUSTMENTS (ARTICLE 6)
**Market Standard (Frontier §7.16; OSCAR §3.03):**
- CRUs/Credits intended for voluntary purposes only
- Buyer agrees NOT to use credits in ways that would cause a Paris Agreement signatory (excluding Host Country) to claim the removals for its Nationally Determined Contributions
- Frontier: "Restricted Sovereign Use" — Buyer cannot intentionally cause nations to claim CRUs for NDCs
- Parties agree to promote mechanisms preventing double-counting between nations
- Notice obligation if either party becomes aware of challenges to Restricted Sovereign Use
- RSU Breach: 180-day cure period; if uncured, constitutes Event of Default (Frontier §8.1(g))

### B10. REVERSAL & INVALIDATION RISK
**Market Standard (Frontier; OSCAR Guidebook §4):**
- Frontier: permanence standard = "at least 1,000 years" for engineered geological storage
- Nature-based: average permanence ~40 years; durable removals: centuries+
- Buffer pool contributions (10-20% of credits for nature-based; may use insurance/guarantees for engineered)
- Replacement obligation: seller must replace invalidated credits
- OSCAR Guidebook: two approaches — (a) contractual remedies (buffer pools, replacement obligations, volume discounts), (b) insurance products (still nascent but emerging)
- Recommended: hybrid model combining contractual remedies as first line + insurance for catastrophic/systemic risks
- Reversal triggers: fire, disease, land-use change (nature-based); equipment failure, injection site leakage (engineered)

### B11. FORCE MAJEURE & CHANGE IN LAW
**Market Standard (Frontier §7.7-7.8; OSCAR §11.07-11.08):**
- FM Event: not reasonably foreseeable, not attributable to negligence/breach, beyond reasonable ability to avoid
- Exclusions: changed market/economic conditions, failure to obtain Required Authorizations (unless due to independent FM)
- FM does NOT excuse: payment obligations, pre-existing defaults, failure to maintain insurance, breach of laws
- Obligations suspended (both parties) for duration of FM; affected party must mitigate
- Prompt written notice required with reasonable detail; regular updates during continuation
- No-Fault Termination after 12 months continuous inability to perform (OSCAR §11.05)
- Change in Law: adoption/change in law or Carbon Standard Rules making performance unlawful, impossible, or commercially impractical to a disproportionate extent
- Frontier §7.8: similar notification and mitigation obligations; parties negotiate in good faith

### B12. DEFAULT & TERMINATION
**Market Standard (Frontier Art. 8; OSCAR Art. XI):**
Events of Default — Frontier:
- (a) Payment Failure: 30-day cure after notice
- (b) Milestone Failure: failure to achieve development milestones by agreed dates (auto 6-month extension for first occurrence)
- (c) Commencement Date Failure / COD Failure: failure to achieve by Target Date (auto 6-month extension)
- (d) Minimum Quantity Deficit: failure to deliver Minimum Quantity of CRUs
- (e) Carbon Supplier Breach: material breach of any provision (30-day cure if curable)
- (f) Buyer Breach: material breach (30-day cure if curable)
- (g) RSU Breach: non-compliance with Restricted Sovereign Use (180-day cure)
- (h) Insolvency Event

Events of Default — OSCAR:
- Payment Failure (30-day cure), COD Failure, Contract Quantity Failure (cure via shortfall provisions), Generation Shortfall Failure (>25% of Total Contract Quantity), Delivery Shortfall Failure (>25%), Supplier Breach (30-day cure), Buyer Breach (30-day cure), Insolvency Event (60-day dismissal period)

Termination rights:
- By mutual consent
- By Supplier: for Payment Failure or Buyer Breach
- By Buyer: for Commencement Date Failure, COD Failure, Minimum Quantity Deficit, Carbon Supplier Breach, Insolvency, Change of Control to Restricted Person
- No-Fault Termination Events (OSCAR §11.05): prolonged FM/Change in Law (12+ months), V&R cost increase ≥30%, Generation Shortfall >25% of Total, failure to reach COD due to circumstances outside both parties' control

### B13. REMEDIES & TERMINATION PAYMENTS
**Market Standard (Frontier §8.3; OSCAR §11.04):**
- Payment Failure remedy: Buyer pays (i) if Supplier resold: Unit Price minus resale price × undelivered volume, or (ii) if not resold: Unit Price × undelivered volume
- Shortfall/Delivery failure: Supplier must (i) provide Replacement Credits acceptable to Buyer, or (ii) pay difference between Unit Price and spot-market replacement cost
- Credit integrity breach: Supplier must (i) offer Replacement Credits, or (ii) reimburse Unit Price for invalid credits + related fines/penalties
- Residual Termination Payment: Non-Defaulting Party calculates net loss (one-way floor at zero)
- OSCAR: Termination Payment = damages/losses/costs realized in replacing the economic equivalent of the agreement terms
- Frontier §8.3: specific remedies for breach of delivery obligations, price adjustment, ROFO rights, credit validity
- Post-termination ROFO (Frontier §8.4): during 18-month Restricted Period, Supplier must offer Buyer Proportionate Share of any CRUs sold at lower of contract/third-party price

### B14. INDEMNITIES & LIABILITY CAPS
**Market Standard (Frontier §8.5-8.6; OSCAR Art. XII-XIII):**
- Carbon Supplier indemnifies Buyer Indemnified Parties against third-party claims from project ownership/operation, negligence/willful misconduct, environmental impacts/personal injury/property damage
- Frontier §8.6: NO consequential, incidental, special, or punitive damages (except for fraud/willful misconduct and payment obligations)
- Aggregate liability cap: Frontier caps at Total Contract Value
- OSCAR: Supplier's total liability capped at total contract value; Buyer's liability capped at unpaid amounts
- Exceptions from caps: indemnities and intentional misconduct

### B15. ASSIGNMENT & FINANCING
**Market Standard (Frontier §7.11; OSCAR §19.04):**
- General: assignment requires prior written consent (not unreasonably withheld)
- Permitted assignments without consent: to Affiliates, to acquirer of substantially all business/assets, collateral assignment for project financing
- Buyer consent required for all other assignments; purported assignment in violation is voidable
- Financing accommodation: Buyer cooperates with Supplier's financing parties; executes consent to collateral assignment in reasonable form
- Supplier Lender step-in/cure rights: OSCAR §11.02 allows lenders to cure defaults on Supplier's behalf
- Change of Control: 30-day prior notice required; Buyer termination right if Change of Control to Restricted Person (Frontier §7.12)
- Restricted Person: competitor of Buyer, primary oil & gas business, sanctioned person, or convicted of fraud

### B16. RIGHT OF FIRST OFFER (ROFO)
**Market Standard (Frontier Art. 5; OSCAR Guidebook §5):**
- New Project ROFO (Frontier §5.1): If Carbon Supplier or Affiliates develop new CRU projects, must first offer Buyer's ROFO Share to Buyer/Participants before third parties
- ROFO Notice: written notice with project description, available CRU quantity, proposed price, proposed agreement terms
- Buyer has 90-day Proposed Project Period to evaluate, then ROFO Deadline to accept
- Excess CRU ROFO (Frontier §5.2): Buyer's right to purchase Proportionate Share of Excess CRUs at same Contract Price
- OSCAR Guidebook: "ROFO requires supplier to offer additional credits to buyer before marketing to third parties; ROFR allows buyer to match third-party offers"

### B17. CONFIDENTIALITY & PUBLIC ANNOUNCEMENTS
**Market Standard (Frontier Art. 9; OSCAR Art. IX, XIV):**
- Mutual confidentiality obligations covering all non-public information
- Disclosure permitted: as required by law, to affiliates/advisers/investors bound by confidentiality
- Public announcements: prior written consent required (not unreasonably withheld)
- Exception: legally required disclosures (stock exchange rules, financial statements)
- Marketing materials: Supplier provides upon Buyer's reasonable request
- License to project materials: non-exclusive, unlimited, perpetual right to use photos/illustrations/videos
- Survival: confidentiality survives termination

### B18. REPUTATIONAL RISK & ENVIRONMENTAL SAFETY
**Market Standard (Frontier §7.17; OSCAR Art. X):**
- Reputational Events: Supplier must notify Buyer within 3 Business Days of: environmental law violations, corrective actions/remedial obligations, material project impact approvals, actual/known opposition to project, negative press/third-party complaints
- Supplier coordinates with Buyer to mitigate reputational harm
- Ecosystem Safety Monitoring: biannual monitoring, annual Ecosystem Impact Data Report
- Community Benefits Plan: community/labor engagement, workforce development, DEI plan, environmental justice plan
- Data Sharing (Frontier §7.18): health/safety data made public; research data shared with non-conflicted researchers

### B19. CREDIT SUPPORT & SECURITY
**Market Standard:**
- Parent company guarantee for SPV sellers (Frontier: Form of Guaranty in Exhibit N)
- Letters of credit for advance payment security
- Performance bonds for delivery obligations
- Escrow arrangements for pre-delivery payments
- Step-in rights for project lenders (OSCAR §11.02 Financing Party Accommodation)
- Insurance requirements: Supplier maintains specified coverage (OSCAR Art. XVI)

### B20. REGULATORY RISK & FUTURE-PROOFING
**Market Standard (OSCAR Guidebook §C.3):**
- Change in law provisions covering evolving carbon regulations
- Compliance market eligibility: risk that voluntary credits become ineligible
- Article 6: corresponding adjustments for international transfers
- EU CRCF: Carbon Removal Certification Framework — emerging certification rules
- IC-VCM Core Carbon Principles: benchmarks for "high-quality" credits
- VCMI Claims Code: guidelines for corporate claims about credit use
- Contract future-proofing: define standards by reference to time of delivery (not signing); allow substitution if chosen standard migrates to compliance regime
- Tax treatment: varies by jurisdiction (financial instruments vs commodities)
- ESG disclosure requirements affecting credit claims
- CORSIA-eligible credits require Article 6 compliance

### B21. DISPUTE RESOLUTION
**Market Standard (Frontier §9; OSCAR §19.14):**
- OSCAR: New York law; federal/state courts in New York; jury waiver
- Frontier: governing law specified per agreement
- Equitable relief: parties entitled to injunctive relief/specific performance in addition to other remedies
- OSCAR Guidebook: "parties may wish to consider replacing jurisdiction clause with arbitration provisions for confidential, potentially speedier forum"
- Each party bears own costs of preparation and negotiation (OSCAR §19.09)

### B22. KEY DIFFERENCES — FRONTIER vs OSCAR
**Structural:**
- Frontier is buyer-consortium model (Members/Partners via Frontier as Representative); OSCAR is bilateral
- Frontier includes extensive Conditions Precedent and Milestones; OSCAR deliberately omits CPs (relies on default provisions)
- Frontier includes MFN pricing across Participants; OSCAR does not include MFN
- Frontier includes Community Benefits Plan, Ecosystem Safety Plan, Data Sharing obligations; OSCAR is lighter
- Frontier has Restricted Person / Change of Control provisions; OSCAR has basic assignment provisions
- Both use "Permanent" storage but Frontier explicitly defines as 1,000+ years

**Risk Allocation:**
- Both buyer-friendly but OSCAR Guidebook explicitly acknowledges this: "OSCAR is intentionally drafted in a buyer-friendly manner" while "remaining balanced" to avoid "overburdening suppliers"
- Frontier more prescriptive on CPs, milestones, and reporting; OSCAR more flexible
- OSCAR includes No-Fault Termination Events (structural safety valves); Frontier relies more on specific Events of Default

**Delivery/Shortfall:**
- OSCAR: detailed distinction between Generation Shortfall (project underperformance) and Delivery Shortfall (supplier default) with different cure mechanisms
- Frontier: simpler Delivery Shortfall construct but with post-termination ROFO during Restricted Period
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { documentText, analysisType, perspective, jurisdiction, projectName, carbonType, projectStage, counterpartyType, creditClass, precedents, userLearnings } = await req.json();

    if (!documentText) {
      return new Response(JSON.stringify({ error: "No document text provided" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Analyzing carbon credit offtake: ${projectName}, type: ${analysisType}, credit: ${carbonType}, class: ${creditClass || 'auto-detect'}, stage: ${projectStage}, perspective: ${perspective}`);

    const hasPrecedents = precedents && precedents.length > 0;
    const isTermSheet = analysisType === 'termsheet_vs_bible';
    const categoryList = CARBON_CATEGORIES.map(c => `- "${c.label}"`).join('\n');

    const isIndustrial = creditClass === 'industrial';
    const isNatureBased = creditClass === 'nature_based';

    const creditClassInstructions = isIndustrial
      ? `
⚠️ CRITICAL CONTEXT — INDUSTRIAL / ENGINEERED CARBON REMOVAL:
This is an INDUSTRIAL-BASED carbon credit offtake agreement. The carbon credits are generated through engineered/technological means (e.g., Direct Air Capture, BECCS, biochar, enhanced weathering, mineralisation, geological storage).

CONTEXTUAL ANALYSIS RULES FOR INDUSTRIAL PROJECTS:
- DO NOT flag the absence of comprehensive field-based Monitoring, Reporting & Verification (MRV) procedures as a gap — industrial projects use equipment-based measurement, not ecological monitoring
- DO NOT flag the absence of biodiversity safeguards, community consultation, or FPIC (Free Prior and Informed Consent) — these are nature-based project requirements
- DO NOT expect provisions on deforestation risk, land tenure, forest fire, drought, or biological permanence risks — these do not apply
- DO expect and focus on: equipment performance guarantees, capture rate specifications, geological storage integrity, technology risk allocation, pre-delivery financing (common for capital-intensive engineered projects), and facility operational requirements
- Permanence analysis should focus on GEOLOGICAL permanence (1,000+ years for geological storage) rather than biological permanence (25-40 years)
- Buffer pool analysis: industrial projects may use insurance or guarantees instead of registry buffer pools
- Reversal risk: focus on equipment failure, injection site leakage, not wildfire/disease/land-use change
- Verification: focus on metered/measured capture volumes, not ecological surveys
`
      : isNatureBased
      ? `
⚠️ CRITICAL CONTEXT — NATURE-BASED CARBON REMOVAL:
This is a NATURE-BASED carbon credit offtake agreement. The carbon credits are generated through natural carbon sequestration (e.g., afforestation, REDD+, soil carbon, blue carbon, peatland restoration).

CONTEXTUAL ANALYSIS RULES FOR NATURE-BASED PROJECTS:
- DO expect comprehensive Monitoring, Reporting & Verification (MRV) procedures — these are essential for nature-based projects
- DO expect provisions on biodiversity safeguards, community impacts, FPIC, and SDG alignment
- DO expect land tenure and access rights provisions — these are critical for nature-based projects
- DO flag the absence of buffer pool contributions as a significant gap — nature-based projects typically require 10-20% buffer
- Permanence analysis should focus on BIOLOGICAL permanence risks: fire, disease, drought, land-use change, with typical durability periods of 25-40 years
- Reversal risk: focus on natural events (wildfire, pest, drought), illegal logging, land-use change
- Additionality: heightened scrutiny — baseline scenario assessment is critical
- Vintage requirements may be more complex due to variable sequestration rates
- Leakage risk (displacement of emissions) is a material concern for nature-based projects
`
      : `
NOTE: Credit class not specified. You must AUTO-DETECT from the document text whether this is an industrial/engineered or nature-based carbon credit offtake agreement, and state your determination prominently in the Credit Type & Methodology category. Apply the appropriate contextual rules based on your determination.
`;

    const systemPrompt = `You are an expert carbon markets lawyer specialising in carbon credit offtake agreements, emissions trading, and voluntary/compliance carbon market transactions. You have deep expertise in:
- Carbon removal technologies (DAC, BECCS, biochar, enhanced weathering)
- Nature-based solutions (REDD+, afforestation, soil carbon, blue carbon)
- Verification standards (Verra VCS, Gold Standard, Puro.earth, ACR)
- Paris Agreement Article 6 mechanisms and corresponding adjustments
- Voluntary Carbon Market Integrity Initiative (VCMI) and IC-VCM Core Carbon Principles
- Carbon credit registry operations and retirement procedures

${CARBON_KNOWLEDGE_BASE}

${creditClassInstructions}

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
Credit Class: ${isIndustrial ? 'INDUSTRIAL / ENGINEERED' : isNatureBased ? 'NATURE-BASED' : 'AUTO-DETECT from document'}
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

    // JSON schema for structured output. Only category/position_summary/
    // confidence are required because market_comparison is conditional on
    // whether precedents were retrieved. strict: false so the gateway
    // allows extra optional fields without rejecting the whole response.
    const positionsJsonSchema = {
      name: "carbon_positions",
      strict: false,
      schema: {
        type: "object",
        required: ["positions"],
        properties: {
          positions: {
            type: "array",
            items: {
              type: "object",
              required: ["category", "position_summary", "confidence"],
              properties: {
                category: { type: "string" },
                clause_references: { type: ["string", "null"] },
                position_summary: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "review_required"] },
                party_favorability: { type: ["string", "null"], enum: ["buyer_friendly", "seller_friendly", "balanced", null] },
                market_benchmark: { type: ["string", "null"] },
                market_position: { type: ["string", "null"], enum: ["on_market", "off_market", "way_off_market", null] },
                market_comparison: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    let response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.2,
          // Structured output: force Gemini via Lovable gateway to
          // return JSON conforming to the schema. Defensive parsing
          // below remains as a safety net (see #6 structured output).
          response_format: { type: "json_schema", json_schema: positionsJsonSchema },
        }),
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
