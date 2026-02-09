import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Version marker for deploy verification - v2.5.0 - improved category normalization

// === PPA KNOWLEDGE BASE - STRUCTURED BY APPLICABILITY ===
// Knowledge is split into UNIVERSAL (all PPAs) and JURISDICTION/TECHNOLOGY-SPECIFIC sections
// The AI should apply universal knowledge always, and specific knowledge only when relevant

const PPA_KNOWLEDGE_BASE = `
## 📚 PPA KNOWLEDGE BASE - STRUCTURED FOR INTELLIGENT APPLICATION

=============================================================================
SECTION A: UNIVERSAL COMMERCIAL PRINCIPLES (Apply to ALL PPAs globally)
=============================================================================

### A1. FUNDAMENTAL PPA STRUCTURE
A Power Purchase Agreement (PPA) is a long-term contract (typically 10-25 years) to secure revenue for a generation project. Core elements apply regardless of jurisdiction or technology:

**THE PARTIES (Universal Terminology)**
- **Generator/Seller**: Generates electricity by operating the facility and sells the output
- **Offtaker/Buyer/Supplier**: Purchases electricity for own use, resale, or wholesale market
- ⚠️ TERMINOLOGY TRAP: In some jurisdictions, the "Supplier" is the BUYER (they supply onwards to customers)

**TERM MECHANICS (Universal)**
- Term usually starts from Commercial Operations Date (COD), NOT signing date
- Pre-COD period (signing to COD) is often excluded from the term calculation
- "Drop dead" / "Long-stop" dates: absolute backstop beyond which parties can terminate

### A2. CONDITIONS PRECEDENT & LONG-STOP DATES (Universal Principles)
- **CP Long-Stop Date**: If conditions not satisfied by this date, parties may terminate
- **Commercial Operations Long-Stop Date**: If COD not achieved, buyer may terminate
- **Risk Allocation**: Key commercial issue - who bears risk of CP failure?
- **Best/Reasonable/All Reasonable Endeavours**: Different legal standards across jurisdictions
  - "Best endeavours" = highest standard (do everything reasonably possible)
  - "Reasonable endeavours" = balance of interests (consider own commercial interests)
  - "All reasonable endeavours" = somewhere between (try multiple approaches)

### A3. PRICING & PAYMENT (Universal Structures)
**Price Mechanisms (Apply Globally)**
- **Fixed Price**: Agreed £/$/€ per MWh - provides revenue certainty
- **Floating/Pass-through**: Market price reference - provides market exposure
- **Cap and Collar**: Floor price + ceiling price - balanced risk sharing
- **Discount to Reference**: e.g., Day-Ahead Price minus X% - common in corporate PPAs
- **Hybrid/Shaped**: Different prices for different periods or volumes

**Payment Fundamentals (Universal)**
- Energy Payment: £/$/€ per MWh delivered
- Capacity Payment: Fixed payment for availability (regardless of generation)
- Indexation: Long-term contracts need price adjustment (CPI, RPI, or custom index)
- Negative Pricing: CRITICAL for renewables - what happens when wholesale prices go negative?
- Payment Terms: Invoicing frequency, payment terms (typically 30 days), late payment interest

### A4. DELIVERY & AVAILABILITY (Universal Concepts)
**Volume Mechanics**
- **Contracted Capacity**: Nameplate/installed capacity of the facility
- **Contracted Volume**: Expected annual/monthly delivery (may differ from capacity)
- **Minimum Delivery Obligations**: Guaranteed minimum volumes per period
- **Maximum Delivery Rights**: Caps on what buyer must accept
- **Excess Generation**: Treatment of volumes above contracted amounts

**Availability Guarantees (Universal)**
- Typical range: 95-99% (median ~97% for established technologies)
- Calculation methodology: Time-based vs Energy-based availability
- Allowances: Scheduled outages, acceptable unscheduled outages, force majeure
- Consequences: Payment reductions, liquidated damages, or termination rights
- **O&M Standard**: "Reasonable and Prudent Operator" (RPO) standard is near-universal

### A5. CREDIT SUPPORT (Universal Mechanisms)
**Types of Credit Support**
- **Parent Company Guarantee (PCG)**: Guarantee from creditworthy parent
- **Bank Guarantee/Letter of Credit**: Bank-backed security
- **Cash Collateral/Escrow**: Actual cash deposited as security
- **Corporate Guarantee**: Guarantee from related entity

**Universal Credit Principles**
- Pre-COD credit support typically higher (development risk)
- Post-COD credit support can step down (operational asset)
- Rating triggers: If credit rating falls, additional security required
- Replacement provisions: Security must be replaced before expiry

**Market Norms (Guideline)**
- Pre-COD: LC of 10-15% of contract value
- Post-COD: 6-12 months' forecast invoice value
- Rating threshold: Investment grade (BBB-/Baa3 or above)

### A6. FORCE MAJEURE (Universal Principles)
**Definition Elements (Apply Everywhere)**
- Event beyond reasonable control of affected party
- Could not reasonably have been anticipated or prevented
- Prevents or delays performance of obligations
- Affected party uses reasonable efforts to mitigate

**Common FM Events (Universal)**
- Natural disasters (earthquake, flood, hurricane)
- War, civil unrest, terrorism
- Government actions, expropriation
- Pandemic/epidemic (now commonly included)

**FM Mechanics (Universal Principles)**
- Notification: Must notify other party promptly (typically 24-72 hours)
- Mitigation: Must use reasonable endeavours to minimise impact
- Extension: FM typically extends performance deadlines
- ⚠️ CRITICAL ISSUE: Does FM extend Long-Stop Dates? (Often NO in buyer-friendly drafts)
- Termination: Prolonged FM (typically 6-24 months) may trigger termination right

### A7. CHANGE IN LAW (Universal Scope)
**What Constitutes Change in Law (Broad Definition)**
- New legislation coming into force
- Modification, repeal or replacement of existing laws
- Change in official interpretation by regulatory authority
- Changes to grid codes or industry rules

**Universal Exclusions**
- General tax changes (income tax, corporation tax) - typically excluded
- Known/foreseeable changes as of signing date
- Sanctions for party's own breach

**Allocation Approaches**
- Full pass-through to one party
- Sharing mechanism (50/50 or other split)
- Materiality threshold before trigger
- Renegotiation obligation with termination backstop

### A8. EVENTS OF DEFAULT & TERMINATION (Universal)
**Common Default Triggers**
- Failure to pay amounts exceeding threshold (with cure period)
- Material breach of obligations (with cure period)
- Insolvency events
- Change of control without consent
- Cross-default to other agreements
- Misrepresentation

**Universal Termination Mechanics**
- Cure periods: Typically 5-30 business days
- Notice requirements: Written notice specifying default
- Termination payments: May include break costs, loss calculations
- Survival: Which provisions survive termination

### A9. DELAY LIQUIDATED DAMAGES (Universal Principles)
**Purpose**: Compensate buyer for delay in achieving COD without proving actual loss

**Universal Elements**
- Daily/weekly LD rate (often calibrated to buyer's hedge costs or replacement power)
- LD cap (typically 15-25% of contract value)
- Grace period before LDs accrue
- Longstop date: If exceeded, buyer can terminate (not just collect LDs)

**Key Commercial Issues**
- Do LDs accrue during FM periods? (Usually suspended)
- Interaction with extension mechanisms
- Whether LDs are sole remedy or cumulative with damages

### A10. DISPUTE RESOLUTION (Universal Options)
- **Expert Determination**: For technical/calculation disputes - faster and cheaper
- **Mediation**: Non-binding facilitated negotiation
- **Arbitration**: Private, binding - common for international PPAs
- **Litigation**: Court proceedings - may be preferred for domestic contracts
- **Escalation**: Usually negotiation → expert → arbitration/litigation

### A11. INTERMITTENT GENERATION CONSIDERATIONS (Solar/Wind - Universal)
**Unique Features of Intermittent PPAs**
- Generator cannot guarantee "firm" output - depends on weather/resource
- Volume risk allocation: Who bears shortfall risk?
- Shape risk: Renewable generation profile vs consumption profile
- Imbalance costs: Mismatch between contracted and actual delivery
- Curtailment: Reduction in output due to grid constraints or negative pricing

**Market Standard for Imbalance**
- Typically buyer/offtaker bears imbalance risk for intermittent generation
- Exception: Generator liable for imbalance caused by its breach (failure to notify, poor forecasting)

=============================================================================
SECTION B: UK-SPECIFIC KNOWLEDGE (Apply when jurisdiction = UK/GB)
=============================================================================

### B1. UK EMBEDDED BENEFITS (Only for UK Embedded Generation)
**CRITICAL: Under ongoing Ofgem review - benefits being phased out or reduced**

**What are Embedded Benefits?**
- Advantages from being connected to Distribution System (not Transmission)
- Only available to SVA (Supplier Volume Allocation) metered generators
- Supplier must become Registrant for Generator's meter

**Current Embedded Benefits (2024-2025)**
- **Distribution Loss Factor (LLF)**: Adjustment >1 for embedded generation
- **RCRC Benefit**: Residual Cashflow Reallocation - often too small to include
- **Transmission Loss Benefit**: Small amount remains
- **Embedded Export Tariff**: Replaced Triad Avoidance (triads no longer used)
- **GDUoS Charges**: Generation Distribution Use of System - can be positive OR negative

**⚠️ REMOVED BENEFITS - NO LONGER AVAILABLE**
- **BSUoS Benefit**: Removed April 2021 - Generators now pay BSUoS like demand
- **Traditional Triad Avoidance**: Replaced by Embedded Export Tariff

### B2. UK METER REGISTRATION (SVA Process)
**Required for Embedded Benefits**
- Generator must be licence-exempt or "exemptable" under Electricity Act 1989
- Supplier becomes Registrant for Generator's metering system
- Supplier contracts with Data Collector and Data Aggregator
- Cannot energise without meter registrant in place

**Registration Sequence**
1. Generator notifies Metering Point ready for energisation
2. Supplier becomes Registrant for Metering System
3. Supplier contracts with DC and DA
4. Synchronisation is LAST step

### B3. UK RENEWABLE CERTIFICATES
**REGOs (Renewable Energy Guarantees of Origin)**
- Evidence of renewable source for fuel mix disclosure
- Now traded with independent market value
- Brexit impact: Continue in GB but no longer EU-recognised

**ROCs (Renewables Obligation Certificates)**
- Closed to new accreditations but continues until 2037
- ⚠️ FIXED PRICE ROC from 2027: Parties must consider payment flow implications
- Buy-Out Fund, Late Payment Fund, Mutualisation Fund arrangements
- Failure to obtain accreditation by COD = potential Event of Default

### B4. UK INDUSTRY DOCUMENTS & CODES
**Key Industry Documents**
- **BSC (Balancing and Settlement Code)**: Settlement periods, imbalance
- **Grid Code**: Technical requirements for connection
- **Distribution Code**: Distribution network requirements
- **CUSC (Connection and Use of System Code)**: Transmission access

**Changes to Industry Documents can constitute Change in Law**

### B5. UK REGULATORY EVOLUTION (Monitor These)
- **NESO Transition**: From 1 October 2024, National Energy System Operator (formerly NGESO)
- **REMA**: May result in 15-minute settlement periods (currently 30 minutes)
- **DUoS Significant Code Review**: Changes from 2025 onwards
- **Energy Act 2023**: Enables trading mechanism changes
- **Corporate Insolvency and Governance Act 2020**: May affect insolvency triggers

### B6. UK IMBALANCE (BSC Framework)
- Imbalance = difference between contracted volumes and metered volumes
- Costs/payments under BSC for imbalance
- System Buy Price (SBP) / System Sell Price (SSP)
- For intermittent generation: Supplier typically bears imbalance risk

=============================================================================
SECTION C: EUROPEAN (NON-UK) GUIDANCE (Apply when jurisdiction = EU/EEA)
=============================================================================

### C1. EU RENEWABLE CERTIFICATES
- **Guarantees of Origin (GOs)**: EU-wide recognition for renewable source
- **RED II / RED III**: Renewable Energy Directive requirements
- **Additionality requirements**: Some offtakers require proof of "new" capacity

### C2. EU MARKET DESIGN
- Day-ahead and intraday markets
- Balancing responsible party (BRP) arrangements
- Cross-border trading and coupling

### C3. COMMON EU JURISDICTIONAL VARIATIONS
- **Spain**: Specific merchant PPA structures, PVPC reference
- **Germany**: EEG framework, direct marketing
- **Nordic**: NordPool, El-certificates
- **France**: Complément de rémunération, OA mechanism
- **Netherlands**: SDE++ subsidy interaction

=============================================================================
SECTION D: TECHNOLOGY-SPECIFIC KNOWLEDGE
=============================================================================

### D1. WIND (Onshore & Offshore)
**Specific Considerations**
- Highly intermittent - seasonal and daily patterns
- Longer construction periods (especially offshore)
- Wake effect considerations for multi-turbine sites
- Turbine technology specifications and warranties
- Decommissioning obligations

### D2. SOLAR PV
**Specific Considerations**
- Predictable daily pattern but weather-dependent
- Degradation factor (typically 0.5% per year)
- Inverter replacement requirements
- Seasonal variation (summer peak vs winter trough)

### D3. BATTERY STORAGE
**Specific Considerations**
- Cycling limits and degradation
- State of charge requirements
- Revenue stacking (multiple services)
- Response time specifications

### D4. BIOMASS/BIOGAS
**Specific Considerations**
- Fuel supply arrangements
- Fuel price indexation
- Sustainability certification
- Dispatchable vs baseload operation

=============================================================================
SECTION E: DRAFTING BEST PRACTICES (Universal)
=============================================================================

### E1. DEFINITIONS
- Critical for contract interpretation - invest time in reviewing
- Ensure consistency with referenced industry documents
- Cross-check definitions against operative provisions

### E2. SCHEDULES
- Expressly state schedules form part of the agreement
- Commercial terms typically in schedules (easier to negotiate)

### E3. MATHEMATICAL NOTATION
- Use formulas for payment calculations to avoid ambiguity
- Define all variables
- Include worked examples where complex

### E4. INTERPRETATION PROVISIONS
- Headings clause (headings don't affect interpretation)
- Legislation references: "freeze" at signing or incorporate amendments?
- Hierarchy of documents if inconsistency

### E5. COMMON DRAFTING TRAPS ⚠️
- Endeavours standards: Best vs Reasonable vs All Reasonable
- Time calculations: Business days vs calendar days
- Currency and conversion timing
- Exclusive vs non-exclusive remedies
- "May" vs "Shall" vs "Will"

=============================================================================
SECTION F: PRACTICAL LAW INSIGHTS - KEY ISSUES FOR DRAFTING, REVIEWING & NEGOTIATING PPAs
=============================================================================
(Source: Practical Law UK Energy Practice Note - Thomson Reuters 2026)

### F1. PPA TYPES & STRUCTURES
**Classification by Duration & Purpose**
- **Long-term PPA**: Underpins project finance; typically matches financing term; contains detailed CP, construction, COD provisions
- **Short/Medium-term PPA**: Trading-focused; may be based on GTMA or similar standard forms with bespoke additions (e.g., FM relief for plant outage)
- **Corporate PPA**: Direct sale to end consumer; may be private wire; different risk profile from supplier PPA
- **Backstop PPA**: Last-resort PPA under CFD regime; licensed suppliers must offer to CFD generators if no commercial offtaker found; payments at substantial discount to market; never used to date

**Classification by Technology**
- **Fuelled (gas, coal, biomass, waste)**: Additional terms for fuel delivery, quality, sampling, measurement; back-to-back with fuel supply agreement; take-or-pay considerations
- **Non-fuelled/Intermittent (wind, wave, solar)**: Output depends on weather; offtaker usually takes all output; generator has reasonable endeavours obligation to maximise output; negative pricing provisions critical
- **Nuclear**: Baseload operation required; limited flexibility; plant operator prioritises safe running

### F2. IDENTIFYING THE PARTIES - KEY CONSIDERATIONS
**Seller/Generator**
- Check if generation licence required (impacts delivery mechanism and code obligations)
- Licence-exempt generators have different regulatory treatment
- For project finance: SPV structure typical; lenders require step-in rights

**Buyer/Offtaker**
- Traditional: Licensed electricity supplier or energy trading business
- Corporate: End consumer (corporate PPA)
- For embedded generation: Identity of offtaker and metering arrangements critical for embedded benefits
- Credit assessment essential: buyer's creditworthiness determines security requirements
- Understanding buyer's motivation: hedging, green credentials, physical supply, trading

### F3. WHAT IS BEING SOLD - DETAILED CHECKLIST
**Volume & Capacity Questions**
- All output vs nominated quantities?
- If nominations: generator availability notification process; offtaker nomination process; adjustment mechanisms
- Availability guarantee: reference to notification of availability, or average availability over period?
- Firm volumes (ECVN) vs non-firm (MVRN/meter registration)?
- Exclusive capacity rights or partial?
- Restrictions on generator selling to third parties?
- Impact on physical running regime if partial offtake?
- Restrictions on generator participating in balancing mechanism or providing ancillary services to NESO?

**Renewable & Other Benefits**
- Which benefits included: ROCs, REGOs, LECs (no longer issued), embedded benefits?
- Risk allocation for changes to available benefits?
- CHP heat offtake: combined or separate agreement?

### F4. DELIVERY MECHANISMS (BETTA FRAMEWORK - UK SPECIFIC)
**Delivery Routes**
- Private wire: Direct electrical connection between generator and offtaker
- Distribution network: Via DNO; plant connected at lower voltage
- Transmission system: Via NESO; larger plant at higher voltage

**BSC Meter Registration**
- **SMRS (Supplier Meter Registration Service)**: Smaller distribution-connected plant
- **CMRS (Central Meter Registration Service)**: Larger plant or transmission-connected

**Volume Notification Methods**
- **ECVN (Energy Contract Volume Notification)**: Firm volume credited whether or not plant generates; buyer bears volume risk
- **MVRN (Metered Volume Reallocation Notification)**: Actual metered volumes reallocated; generator bears volume risk
- **Meter Registration (SVA)**: Supplier becomes registrant; embedded benefits accessible
- Choice of delivery method directly impacts imbalance risk allocation

### F5. PAYMENT STRUCTURES - DETAILED ANALYSIS
**Payment Components**
- **Energy Payment** (£/MWh): Must cover fuel costs and variable operating costs when generating
- **Availability/Capacity Payment** (£/MW): Must cover fixed costs even when not generating
- **Renewable Benefits Payment**: Separate calculation for ROCs, REGOs etc.
- **Pass-through Costs**: Some generator costs passed directly to offtaker

**Critical Payment Review Points**
- Is payment sufficient for debt service and equity return?
- Appropriate escalators for fuel cost increases?
- Renegotiation provisions for extraordinary cost escalation?
- Take-or-pay structure? Caps and collars?
- Impact of windfall taxes or revenue levies (e.g., Electricity Generator Levy)?
- Mathematical notation clarity: formulas clearly defined with all variables?
- Brexit impact on pricing formulae and market references?

### F6. CONDITIONS PRECEDENT - DETAILED FRAMEWORK
**Short-term PPA CPs**
- BSC registrations and notifications for energy volume transfer

**Long-term PPA CPs (Additional)**
- Construction milestones and commissioning tests
- Financing conditions (financial close)
- Licences, consents, regulatory approvals
- COD definition and achievement requirements
- Grid connection arrangements

**CP Failure Provisions**
- Clear drafting essential to avoid confusion on whether CP met
- Walk-away rights vs continued liability for failure to use endeavours
- "Drop dead" dates: which CPs subject to absolute backstop?
- Extension mechanisms: which CPs can be extended?

### F7. PLANT SPECIFICATION & REMEDIES
**Installed Capacity vs Nameplate Capacity**
- If higher: Offtaker entitled but not obliged to buy excess? Generator can sell to third party?
- If lower: Additional time to correct? FM relief available? LDs or other offtaker remedies?
- Other "as built" divergences: impact on government subsidies or income streams?

### F8. RUNNING REGIME - TECHNOLOGY-SPECIFIC ANALYSIS
**Baseload**: Continuous operation (nuclear, some gas)
**Flexible/Two-shifting**: Morning and evening peaks (gas, biomass)
**Peaking**: Completely flexible for price spikes and system services
**Intermittent**: Weather-dependent (wind, solar)

**Key Running Regime Considerations**
- Technology and fuel constraints on flexibility
- Environmental or planning condition restrictions
- Balance between optimal running and offtaker flexibility
- Frequent output changes impact maintenance schedule and reliability
- Battery storage addition potential
- System operator actions under Grid Code
- Government emergency powers (Electricity Act 1989 ss.34-35, Energy Act 1976, Civil Contingencies Act 2004, ESEC, Fuel Security Code)

### F9. SUSPENSION & FORCE MAJEURE - PRACTICE NOTE INSIGHTS
**FM Drafting Checklist**
- Tailored to specific transaction? Generic FM definitions insufficient
- Can parties distinguish FM consequences from poor planning/negligence?
- How do FM provisions interact with: payment flows? Industry document charges? Change in law provisions? Nomination rights? Imbalance charges?
- Must offtaker continue capacity payments during FM?
- Back-to-back with other project documents (fuel supply take-or-pay)?
- Remedy period before payment deductions triggered?
- Termination rights and payments for prolonged FM?
- Information system breakdown: how handled?

### F10. CHANGE IN LAW - ENHANCED ANALYSIS
**Breadth of Definition**
- Must cover: changes to industry documents, power market changes, grid code modifications
- Not just primary legislation: includes secondary legislation, regulatory decisions, code modifications
- REMA implications: potential 15-minute settlement periods, new market arrangements
- Brexit-related changes: ongoing regulatory divergence from EU

**Specific Tax Changes**
- LECs withdrawal consequences
- VAT reverse charge for wholesale trading (dis-applied to some larger PPAs)
- Electricity Generator Levy impact
- Separate, more detailed provisions may be needed

**Change in Law Remedies**
- Price renegotiation with expert determination backstop
- Must prevent frustration from rendering PPA unworkable
- Termination rights and payments for fundamental changes
- Back-to-back with CFD terms and other project documents

### F11. BACK-TO-BACK OBLIGATIONS - LENDER REQUIREMENTS
**Key Back-to-Back Items**
- FM definitions: Identical across PPA, fuel supply agreement, construction contract, O&M contract
- Construction/commissioning obligations: PPA → construction contractor
- Availability guarantees: PPA → turbine manufacturer warranty → O&M agreement
- Fuel commitments: PPA take-or-pay ↔ fuel supply agreement take-or-pay
- Lenders insist: liability under one document must have recovery/relief under another

### F12. CREDIT SUPPORT - PRACTICE NOTE DETAIL
**Offtaker Credit Support**
- Lenders require security for offtaker payment obligations
- Covers: ongoing payments AND early termination payments (offtaker breach)
- Forms: PCG, bank guarantee, cash collateral

**Generator Credit Support**
- Offtaker may require security for generator performance obligations
- Covers: imbalance charge liability, early termination payment (generator default)
- Offtaker may negotiate: step-in rights, right to acquire plant/generator on default

### F13. FINANCIAL SERVICES REGULATORY OVERLAY
**Applicable Regimes (UK)**
- **Financial Services and Markets Act 2000**: Domestic financial regulatory regime
- **UK MiFIR** (onshored from EU MiFID II): Market in financial instruments
- **UK EMIR** (onshored from EU EMIR): OTC derivatives regulation
- **UK REMIT**: Wholesale energy market integrity and transparency

**Key Considerations**
- PPAs reportable under REMIT since April 2016 as non-standard OTC trades
- Boundaries between exchange-based, OTC, and bespoke arrangements are blurred
- Whether regulations apply depends on: contract duration, delivery method, party type, transaction purpose
- Always recommend financial services "health check" for proposed PPA arrangements

### F14. ALTERNATIVE REVENUE STREAMS (UK)
**Ancillary Services & Balancing Services**
- Frequency response, quick reserve, balancing reserve, reactive power, restoration services
- NESO continually refines required services (see product roadmap)
- CUSC modification CMP457 (July 2025): New methodology for reactive power compensation

**Balancing Mechanism**
- Flexible plant can earn additional revenue
- Physical notifications → gate closure (1 hour before) → bid-offer data
- BSC modification P342: Extended ECVN deadline to start of settlement period
- Transmission Constraint Licence Condition (TCLC): Prevents exploitation during constraints
- Inflexible Offers Licence Condition (IOLC): From October 2023, prevents excessive bids from inflexible positions
- BSUoS charges: From April 2023, recovered only from suppliers (not generators)
- Virtual lead party: New BSC participant category (2019) for aggregating smaller plant

**Capacity Market**
- Capacity agreements: up to 15 years (new build/refurbishment) or 1 year (existing)
- Cannot hold both CFD and capacity agreement
- Penalties for failure to deliver required capacity
- Capacity payments for availability commitment during system stress

**CFDs & Backstop PPA**
- CFD converts variable price to fixed strike price
- Generator pays back when market > strike price; receives payment when market < strike price
- CFD eligibility: Cannot be RO-accredited or have capacity agreement
- Backstop PPA: Licensed suppliers must offer if generator cannot find commercial offtaker
- Backstop payment at substantial discount to market - last resort only

**Combined Heat & Power (CHP)**
- Heat sales increase project revenue and may attract incentive payments
- PPA must address heat/steam offtake (combined or separate agreement)

**Embedded Benefits (Status as of 2025)**
- Distribution Loss Factor (LLF)
- Embedded Export Tariff (replaced traditional Triad Avoidance)
- GDUoS charges (can be positive or negative)
- Subject to ongoing Ofgem Targeted Charging Review and SCR reforms
- Zonal transmission losses introduced April 2018 (CMA remedy, BSC P350)

**REGOs**
- Now regularly auctioned with independent market value (historically negligible)
- Post-Brexit: UK REGOs no longer EU-recognised; EU REGOs no longer recognised in GB from April 2023
- Used for fuel mix disclosure and green tariff marketing

**ROCs**
- Closed to new accreditations; continues until 2037
- Government plans fixed price certificates from 2027
- Banding varies by technology and subject to change
- Anti-avoidance "site-sterilisation" provisions if NFFO PPA terminated for breach

### F15. GRID CAPACITY & CONNECTION
**Connection Risks**
- Delays can impact project viability
- Connection arrangement must be agreed (or be CP)
- Costs of establishing and maintaining connection: who pays?
- TEC register available on NESO website

**TMO4+ Connection Reforms (2025)**
- NESO can unilaterally revise agreed connection dates
- Priority given to projects meeting clean power by 2030 plans
- Assessed on technology, location, and readiness to connect

**Use of System Charges**
- Payable to: private wire operator, DNO, and/or NESO
- Dependent on plant size and metering arrangements
- Subject to ongoing charging reviews
`;

// Helper function to get jurisdiction-specific context
function getJurisdictionContext(jurisdiction: string | null): string {
  if (!jurisdiction) return "";
  
  const jur = jurisdiction.toLowerCase();
  
  if (jur.includes('uk') || jur.includes('gb') || jur.includes('england') || jur.includes('scotland') || jur.includes('wales') || jur.includes('britain')) {
    return `
⚠️ UK/GB JURISDICTION DETECTED - Apply Section B (UK-Specific Knowledge):
- Check for Embedded Benefits provisions
- Apply BSC/Settlement Period terminology
- Consider NESO/Ofgem regulatory context
- ROC/REGO certificate treatment
- SVA meter registration requirements
`;
  }
  
  if (jur.includes('spain') || jur.includes('spanish') || jur.includes('españa')) {
    return `
⚠️ SPAIN JURISDICTION - Apply Section C with Spanish specifics:
- PVPC reference pricing
- OMIE market framework
- Spanish regulatory requirements
`;
  }
  
  if (jur.includes('german') || jur.includes('germany') || jur.includes('deutschland')) {
    return `
⚠️ GERMANY JURISDICTION - Apply Section C with German specifics:
- EEG framework context
- Direct marketing requirements
- German balancing group arrangements
`;
  }
  
  if (jur.includes('nordic') || jur.includes('sweden') || jur.includes('norway') || jur.includes('denmark') || jur.includes('finland')) {
    return `
⚠️ NORDIC JURISDICTION - Apply Section C with Nordic specifics:
- NordPool market framework
- El-certificate system
- Nordic balancing arrangements
`;
  }
  
  // Generic EU
  if (jur.includes('eu') || jur.includes('europe') || jur.includes('netherlands') || jur.includes('france') || jur.includes('italy') || jur.includes('poland') || jur.includes('portugal') || jur.includes('ireland')) {
    return `
⚠️ EU JURISDICTION - Apply Section C (European guidance):
- Guarantees of Origin framework
- RED II/III context
- EU market design principles
`;
  }
  
  return `
⚠️ NON-UK/EU JURISDICTION: Apply universal principles from Section A. 
Specific local regulatory knowledge may be limited - flag any jurisdiction-specific provisions for manual review.
`;
}

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

    const isTermSheetAnalysis = analysisType === 'termsheet_vs_bible';

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

    // Get jurisdiction-specific context
    const jurisdictionContext = getJurisdictionContext(jurisdiction);

    const systemPrompt = `You are an expert PPA (Power Purchase Agreement) analyst specializing in European renewable energy contracts.
${isTermSheetAnalysis ? `Your task is to analyze a TERM SHEET (or Heads of Terms) against the same categories used for full PPA analysis. Term sheets are shorter, pre-contractual documents that set out the key commercial terms before long-form documentation is drafted.

## TERM SHEET ANALYSIS RULES
- A term sheet will NOT cover all categories — this is EXPECTED and NORMAL
- For categories NOT addressed in the term sheet: note "Not addressed in term sheet" with a brief explanation of what a long-form PPA would typically include, and flag whether this is a gap the parties should negotiate before going to long-form
- For categories that ARE addressed: analyze the position as you would for a full PPA, assessing market position, party favorability, and benchmarks
- Be especially vigilant about vague or ambiguous language in term sheets — flag where the term sheet lacks sufficient detail to protect either party
- Identify any "silent" areas that could become contentious in long-form negotiations
- DO NOT penalize the term sheet for being shorter than a full PPA — focus on whether the positions it DOES take are on-market and well-drafted` : `Your task is to extract ACTIONABLE, SPECIFIC positions from the provided PPA document.`}
You have been equipped with MARKET INTELLIGENCE synthesized from our precedent bank - use it to provide precise market position assessments.

${PPA_KNOWLEDGE_BASE}

## KNOWLEDGE APPLICATION RULES
- SECTION A (Universal): Apply to ALL PPAs regardless of jurisdiction or technology
- SECTION B (UK-Specific): Apply ONLY when jurisdiction is UK/GB
- SECTION C (EU): Apply to EU jurisdictions with local variations
- SECTION D (Technology): Apply based on generation technology type
- SECTION E (Drafting): Apply universally as best practice guidance

${jurisdictionContext}

PERSPECTIVE: ${perspective === 'buyer' ? 'Buyer (Offtaker)' : 'Seller (Generator)'}
${jurisdiction ? `JURISDICTION: ${jurisdiction}` : 'JURISDICTION: Not specified - apply universal principles only'}
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
 
  1. **Heading exists but no content?** This is almost certainly a PARSING ERROR - the content IS there.
     - If you see a section heading (e.g., "Change in Law", "Liability") but think there's no operative text beneath it:
       a) GO BACK and re-read the entire document section by section
       b) Search for the clause number referenced in the heading
       c) Look for the content in a different location (it may appear later or in a schedule)
       d) Check if formatting issues caused text to appear as part of another section
     - You MUST make a genuine second attempt to find and extract the content before concluding it's missing
     - PPAs ALWAYS have operative provisions under their headings - if you can't find them, the problem is your parsing, not the document
     - DO NOT just flag for manual review as a first resort - TRY HARDER to extract the actual content
 
 2. **Check related sections**: Provisions may be embedded in other clauses or schedules
 
 3. **Check definitions**: Key terms may be defined elsewhere affecting interpretation
 
  4. **ONLY as a last resort**: If after a thorough second pass you still cannot extract content from a section that clearly has a heading, then note:
     "• [Category] provisions exist (Section X) but extraction was incomplete - key terms to look for: [list specific clause language that should appear]"
     This tells the user exactly what to search for manually.
  
  Only flag "NOT ADDRESSED" when there is genuinely NO heading and NO mention of the concept anywhere in the document.
 
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

    const userPrompt = `Analyze this ${isTermSheetAnalysis ? 'TERM SHEET' : 'PPA'} and extract positions for each category following the requirements above.

PROJECT: ${projectName}

${isTermSheetAnalysis ? 'TERM SHEET' : 'PPA'} DOCUMENT TEXT:
${ppaText.substring(0, 100000)}

${comparisonText ? `
TERM SHEET / COMPARISON DOCUMENT:
${comparisonText.substring(0, 30000)}
` : ''}
${isTermSheetAnalysis ? `
IMPORTANT: This is a TERM SHEET, not a full PPA. Many categories may not be addressed — for those, note what would typically be expected in a long-form PPA and whether the omission is normal for a term sheet or represents a gap that should be addressed before going to long-form.
` : ''}

Return a JSON object:
{
  "positions": [
    {
      "category": "EXACT Category Label from the list above (e.g., 'Availability Guarantee', 'Pricing Structure', etc.)",
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

⚠️ CRITICAL - CATEGORY NAMING: You MUST use the EXACT category labels as listed above (e.g., "Target COD & Milestones", "Delay Liquidated Damages", "Pricing Structure", etc.). Do NOT use snake_case IDs like "pricing_structure" or lowercase names. Use Title Case labels EXACTLY as shown.

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
      // First, try to find the JSON block - handle markdown code blocks
      let jsonContent = content;
      
      // Remove markdown code blocks if present
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim();
      }
      
      // Try multiple extraction strategies
      let parsed = null;
      
      // Strategy 1: Direct parse (if response is clean JSON)
      try {
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        // Strategy 2: Find JSON object with positions array
        const jsonMatch = jsonContent.match(/\{[\s\S]*"positions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
        if (jsonMatch) {
          // Clean the JSON string - remove control characters and fix common issues
          let cleanJson = jsonMatch[0]
            .replace(/[\x00-\x1F\x7F]/g, ' ')  // Remove control characters
            .replace(/,\s*}/g, '}')  // Remove trailing commas before }
            .replace(/,\s*]/g, ']'); // Remove trailing commas before ]
          
          try {
            parsed = JSON.parse(cleanJson);
          } catch (e2) {
            console.error('Failed to parse cleaned JSON:', e2);
          }
        }
        
        // Strategy 3: Extract positions array directly
        if (!parsed) {
          const positionsMatch = jsonContent.match(/"positions"\s*:\s*(\[[\s\S]*?\])/);
          if (positionsMatch) {
            let cleanArray = positionsMatch[1]
              .replace(/[\x00-\x1F\x7F]/g, ' ')
              .replace(/,\s*]/g, ']');
            try {
              parsed = { positions: JSON.parse(cleanArray) };
            } catch (e3) {
              console.error('Failed to parse positions array:', e3);
            }
          }
        }
      }
      
      if (parsed && parsed.positions) {
        positions = parsed.positions;
        
        // Normalize category names to match our expected labels
        // Handle both label matches (case-insensitive) AND id matches (snake_case)
        positions = positions.map((p: any) => {
          const categoryInput = (p.category || '').toLowerCase().trim();
          
          // Try to match by label (case-insensitive)
          let matchedCat = PPA_CATEGORIES.find(c => 
            c.label.toLowerCase() === categoryInput
          );
          
          // If no match, try to match by id (snake_case)
          if (!matchedCat) {
            matchedCat = PPA_CATEGORIES.find(c => 
              c.id.toLowerCase() === categoryInput.replace(/\s+/g, '_')
            );
          }
          
          // If still no match, try partial matching
          if (!matchedCat) {
            matchedCat = PPA_CATEGORIES.find(c => 
              c.label.toLowerCase().includes(categoryInput) ||
              categoryInput.includes(c.label.toLowerCase()) ||
              c.id.toLowerCase().includes(categoryInput.replace(/\s+/g, '_'))
            );
          }
          
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
        
        console.log(`Successfully parsed ${positions.length} positions`);
      } else {
        console.error('No valid positions found in response. Content preview:', content.substring(0, 1000));
        throw new Error('Could not parse AI response - no positions array found');
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
