# Memory: features/pricing-proposal/pc-sum-logic
Updated: now

Pricing proposals support 'PC Sum' (Provisional Contract Sum) flags for work items with undefined scope. The `is_pc_sum` boolean field is persisted in the `pricing_proposal_items` database table. Flagged rows are highlighted in violet/purple in the UI to signal items needing further scoping. Excel exports include a 'PC Sum?' column and a dynamic explanatory note if any flagged items are present, defining the sum as provisional and subject to structural finalization.
