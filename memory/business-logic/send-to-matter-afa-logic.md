# Memory: business-logic/send-to-matter-afa-logic
Updated: 2026-03-04

When sending an 'Agreed' pricing proposal to a matter, the total budget and line items are calculated based on the primary AFA type: 
- Fixed Fee (Whole or Phase): Line items are scaled proportionally (Option A) so they sum exactly to the fixed amount.
- Success Fee: Line items remain at baseline values, and the fee is added to the matter total (Option B).
- Discounted Rates: Line items and total remain at their ORIGINAL (undiscounted) values. Rate discounts do NOT reduce the budget — they lower the hourly rate so the team can record more hours within the same budget. The discount percentage is recorded as metadata.
- Blended Rate: Line items are scaled to match the blended rate total.
- Fee Cap: Line items use baseline amounts as the cap is a ceiling.
