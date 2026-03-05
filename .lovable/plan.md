

# Fix: Correct Bella V1 USD→GBP Scaling Factor

## Finding
Queried all V1 vs current line items. 25+ items have an exact ratio of **1.3600** (V1÷current), confirming the USD→GBP rate used was **1/1.36 = 0.7353**.

The current code uses 0.79 — that's wrong. Changing it to `1/1.36` will make the converted V1 amounts match the current GBP amounts for unchanged items, and the 2% tolerance will correctly filter out FX noise.

## Change
**`src/components/matters/BudgetSection.tsx`** — one line change: replace `0.79` with `(1 / 1.36)` in the Bella-specific USD→GBP conversion block.

