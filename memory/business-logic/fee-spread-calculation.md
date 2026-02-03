# Memory: business-logic/fee-spread-calculation
Updated: now

All AI-driven fee estimate calculations now include automatic lower estimate generation using a risk-based spread system:

**Risk Categories:**
- **Low risk (10% spread):** Closing, Meetings, Legal Opinions - predictable, standardized work
- **Medium risk (15% spread):** Due Diligence, Documentation, Tax, Other - some variability expected
- **High risk (20% spread):** Negotiations, Regulatory - significant variability possible

**Calculation Logic:**
- `fee_upper` is the primary estimate (what the AI suggests)
- `fee_lower = fee_upper × (1 - spread_percentage)`, rounded using smart rounding
- `fee_amount = (fee_lower + fee_upper) / 2`, rounded

**Implementation:**
- Utility functions in `src/lib/feeSpreadUtils.ts`: `calculateFeeRange()`, `calculateFeeLower()`, `getCategorySpreadPercentage()`
- Applied in: CategoryFeeAllocationDialog, PricingProposalDetail (AI suggest pricing, AI price to target, iterative pricing)
- Smart rounding: nearest 100 for amounts <10k, nearest 1000 for amounts ≥10k
