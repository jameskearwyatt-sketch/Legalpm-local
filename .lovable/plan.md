

# Fix Double-Discount Bug and Rename Rate Labels

## Changes

### 1. Fix double-discount bug (`src/pages/PricingProposalDetail.tsx`, line 996)
Remove the second application of `afaRateDiscount`. Change `displayBlendedRate` to just equal `blendedRate`, since `blendedRate` (totalRevenue / totalHours) already reflects the discount through the revenue calculation.

### 2. Rename "Weighted Avg Rate" → "Blended Rate" on Summary tab
- **Line 2797**: Change label from "Weighted Avg Rate" to "Blended Rate"
- **Line 2881**: Change "(wtd avg)" suffix to "(blended)" or remove it

### 3. Add simple average rate to Team & Rates tab (`src/components/pricing/EditableRateCard.tsx`)
After the fee earner list (before the save buttons, around line 385), add a summary row showing:
- **Average Rate**: arithmetic mean of all fee rates (sum of rates ÷ number of team members)
- **Average AFA Rate**: if a discount is active, show the arithmetic mean of the discounted rates too

This will be a small, subtle line — just text, no input fields.

### 4. Excel export unchanged
The blended rate on the Excel export already uses the AFA blended rate value which comes from the discounted rate card. After the double-discount fix, the Summary tab's blended rate and the AFA section's blended rate will align, so the export remains correct.

### Files to edit
- `src/pages/PricingProposalDetail.tsx` — fix line 996, rename labels at lines 2797 and 2881
- `src/components/pricing/EditableRateCard.tsx` — add average rate summary row before save buttons

